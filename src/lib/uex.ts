const UEX_BASE = 'https://api.uexcorp.space/2.0';

export interface UexCommodity {
  id: number;
  name: string;
  code: string;
  slug: string;
  kind: string | null;
  price_buy: number;
  price_sell: number;
  is_illegal: number;
  is_volatile_qt: number;
  is_volatile_time: number;
  is_explosive: number;
  wiki: string | null;
}

export interface UexItem {
  id: number;
  name: string;
  slug: string;
  section: string | null;
  category: string | null;
  company_name: string | null;
  uuid: string | null;
}

/** Unified shape used by the detail modal regardless of commodity vs item. */
export interface UexEntity {
  id: number;
  name: string;
  slug: string;
  kind: string | null;       // commodity: kind; item: category
  section: string | null;    // item only
  is_illegal: number;
  is_volatile_qt: number;
  is_volatile_time: number;
  is_explosive: number;
  type: 'commodity' | 'item';
}

export interface UexTerminal {
  id: number;
  name: string;
  fullname: string;
  nickname: string | null;
  type: string;
  is_available: number;
}

export interface UexPrice {
  terminal_name: string;
  terminal_slug: string;
  star_system_name: string;
  planet_name: string | null;
  price_buy: number;
  price_sell: number;
  price_sell_avg: number;
  price_buy_avg: number;
}

interface UexCategory {
  id: number;
  type: string;
  section: string;
  name: string;
}

// Module-level cache (in-memory, lives for the page session)
let terminalsCache: { data: UexTerminal[]; ts: number } | null = null;
let commoditiesCache: { data: UexCommodity[]; ts: number } | null = null;
let itemsCache: { data: UexItem[]; ts: number } | null = null;
// In-flight promise for items so parallel openDetail calls don't double-fetch
let itemsFetch: Promise<UexItem[]> | null = null;
const priceCache = new Map<string, { data: UexPrice[]; ts: number }>();

const TERMINALS_TTL   = 60 * 60 * 1000;  // 1 hour
const COMMODITIES_TTL = 60 * 60 * 1000;  // 1 hour
const ITEMS_TTL       = 60 * 60 * 1000;  // 1 hour
const PRICES_TTL      = 30 * 60 * 1000;  // 30 minutes

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function fetchCommodities(apiKey: string): Promise<UexCommodity[]> {
  const now = Date.now();
  if (commoditiesCache && now - commoditiesCache.ts < COMMODITIES_TTL) return commoditiesCache.data;
  const res = await fetch(`${UEX_BASE}/commodities/`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error(`UEX ${res.status}`);
  const json = await res.json();
  commoditiesCache = { data: json.data as UexCommodity[], ts: now };
  return commoditiesCache.data;
}

/**
 * Fetch all items by: get all item categories, then fetch items per category in parallel.
 * Result is merged and cached for 1 hour.
 */
async function fetchAllItems(apiKey: string): Promise<UexItem[]> {
  const now = Date.now();
  if (itemsCache && now - itemsCache.ts < ITEMS_TTL) return itemsCache.data;

  // Fetch item categories (24h TTL on the API side)
  const catRes = await fetch(`${UEX_BASE}/categories/?type=item`, { headers: authHeaders(apiKey) });
  if (!catRes.ok) throw new Error(`UEX ${catRes.status}`);
  const catJson = await catRes.json();
  const categories = catJson.data as UexCategory[];

  // Fetch items for every category in parallel; ignore failed categories silently
  const results = await Promise.allSettled(
    categories.map((cat) =>
      fetch(`${UEX_BASE}/items/?id_category=${cat.id}`, { headers: authHeaders(apiKey) })
        .then((r) => (r.ok ? r.json() : Promise.resolve({ data: [] })))
        .then((j) => (j.data ?? []) as UexItem[])
    )
  );

  const merged: UexItem[] = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  itemsCache = { data: merged, ts: now };
  return merged;
}

export function fetchItems(apiKey: string): Promise<UexItem[]> {
  const now = Date.now();
  if (itemsCache && now - itemsCache.ts < ITEMS_TTL) return Promise.resolve(itemsCache.data);
  if (!itemsFetch) {
    itemsFetch = fetchAllItems(apiKey).finally(() => { itemsFetch = null; });
  }
  return itemsFetch;
}

export async function fetchCommodityPrices(apiKey: string, id: number): Promise<UexPrice[]> {
  const key = `commodity:${id}`;
  const now = Date.now();
  const cached = priceCache.get(key);
  if (cached && now - cached.ts < PRICES_TTL) return cached.data;
  const res = await fetch(`${UEX_BASE}/commodities_prices/?id_commodity=${id}`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error(`UEX ${res.status}`);
  const json = await res.json();
  const data = json.data as UexPrice[];
  priceCache.set(key, { data, ts: now });
  return data;
}

export async function fetchItemPrices(apiKey: string, id: number): Promise<UexPrice[]> {
  const key = `item:${id}`;
  const now = Date.now();
  const cached = priceCache.get(key);
  if (cached && now - cached.ts < PRICES_TTL) return cached.data;
  const res = await fetch(`${UEX_BASE}/items_prices/?id_item=${id}`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error(`UEX ${res.status}`);
  const json = await res.json();
  const data = json.data as UexPrice[];
  priceCache.set(key, { data, ts: now });
  return data;
}

/** Case-insensitive name match with partial fallback. */
function findByName<T extends { name: string }>(list: T[], name: string): T | null {
  const lower = name.toLowerCase();
  return (
    list.find((c) => c.name.toLowerCase() === lower) ??
    list.find((c) => c.name.toLowerCase().includes(lower)) ??
    list.find((c) => lower.includes(c.name.toLowerCase())) ??
    null
  );
}

// Item types that should only ever be in UEX /items (never /commodities)
const ITEMS_ONLY_TYPES = new Set(['clothing', 'armor', 'weapon']);
// Item types that should only ever be in UEX /commodities (never /items)
const COMMODITIES_ONLY_TYPES = new Set(['commodity', 'consumable']);

/**
 * Search UEX for a named entity, routing by the scunpacked type hint when available.
 * - clothing / armor / weapon  → /items only
 * - commodity / consumable     → /commodities only
 * - everything else            → /commodities first, then /items fallback
 */
export async function findEntity(apiKey: string, name: string, scType?: string): Promise<UexEntity | null> {
  const skipCommodities = scType !== undefined && ITEMS_ONLY_TYPES.has(scType);
  const skipItems = scType !== undefined && COMMODITIES_ONLY_TYPES.has(scType);

  if (!skipCommodities) {
    const commodities = await fetchCommodities(apiKey);
    const commodity = findByName(commodities, name);
    if (commodity) {
      return {
        id: commodity.id,
        name: commodity.name,
        slug: commodity.slug,
        kind: commodity.kind,
        section: null,
        is_illegal: commodity.is_illegal,
        is_volatile_qt: commodity.is_volatile_qt,
        is_volatile_time: commodity.is_volatile_time,
        is_explosive: commodity.is_explosive,
        type: 'commodity',
      };
    }
  }

  if (!skipItems) {
    const items = await fetchItems(apiKey);
    const item = findByName(items, name);
    if (item) {
      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        kind: item.category,
        section: item.section,
        is_illegal: 0,
        is_volatile_qt: 0,
        is_volatile_time: 0,
        is_explosive: 0,
        type: 'item',
      };
    }
  }

  return null;
}

/** Top N terminals for selling (highest sell price, must have sell price > 0). */
export function topSellLocations(prices: UexPrice[], n = 5): UexPrice[] {
  return prices
    .filter((p) => p.price_sell > 0)
    .sort((a, b) => b.price_sell - a.price_sell)
    .slice(0, n);
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function fetchTerminals(apiKey: string): Promise<UexTerminal[]> {
  const now = Date.now();
  if (terminalsCache && now - terminalsCache.ts < TERMINALS_TTL) return terminalsCache.data;
  const res = await fetch(`${UEX_BASE}/terminals/`, { headers: authHeaders(apiKey) });
  if (!res.ok) throw new Error(`UEX ${res.status}`);
  const json = await res.json();
  terminalsCache = { data: json.data as UexTerminal[], ts: now };
  return terminalsCache.data;
}

/**
 * Fuzzy-match a location string (station/city name from scunpacked) against
 * UEX terminal names. Our strings are coarse (e.g. "Levski", "Area18") while
 * UEX names are short codes like "Admin - ARC-L1", so we try several strategies.
 */
export async function findTerminal(apiKey: string, locationName: string): Promise<UexTerminal | null> {
  if (!locationName) return null;
  const terminals = await fetchTerminals(apiKey);
  const lower = locationName.toLowerCase();

  const prefer = (list: UexTerminal[]) =>
    list.find((t) => t.type === 'commodity') ?? list[0] ?? null;

  // 1. Exact match on any name field
  const exact = terminals.filter(
    (t) =>
      t.fullname?.toLowerCase() === lower ||
      t.name?.toLowerCase() === lower ||
      t.nickname?.toLowerCase() === lower
  );
  if (exact.length) return prefer(exact);

  // 2. Our string appears inside the terminal's fullname
  const inFull = terminals.filter((t) => t.fullname?.toLowerCase().includes(lower));
  if (inFull.length) return prefer(inFull);

  // 3. Our string appears inside nickname
  const inNick = terminals.filter((t) => t.nickname?.toLowerCase().includes(lower));
  if (inNick.length) return prefer(inNick);

  // 4. Terminal name appears inside our string
  const nameInOurs = terminals.filter(
    (t) => t.name && lower.includes(t.name.toLowerCase())
  );
  if (nameInOurs.length) return prefer(nameInOurs);

  // 5. Extract Lagrange-point code (e.g. "ARC-L1") from the start of our location name.
  //    UEX terminal names use format "Merchant - ARC-L1" so the code appears as a suffix.
  const lpMatch = locationName.match(/^([A-Z]+-L\d+)\b/i);
  if (lpMatch) {
    const lpCode = lpMatch[1].toLowerCase();
    const byLp = terminals.filter(
      (t) =>
        t.name?.toLowerCase().includes(lpCode) ||
        t.fullname?.toLowerCase().includes(lpCode)
    );
    if (byLp.length) return prefer(byLp);
  }

  return null;
}

export interface UexTradeParams {
  id_terminal: number;
  id_commodity: number;
  operation: 'buy' | 'sell';
  scu: number;
  price: number;
}

/** Submit a single trade leg to UEX user_trades_add. Returns the new id_user_trade. */
export async function submitTrade(
  apiKey: string,
  secretKey: string,
  params: UexTradeParams
): Promise<number> {
  const res = await fetch(`${UEX_BASE}/user_trades_add/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'secret_key': secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_production: 1, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? `UEX ${res.status}`);
  }
  return json.data?.id_user_trade as number;
}

export function uexEntityUrl(entity: UexEntity): string {
  const slug = entity.slug || toSlug(entity.name);
  if (entity.type === 'commodity') {
    return `https://uexcorp.space/commodities/info?name=${slug}`;
  }
  return `https://uexcorp.space/items/info?name=${slug}`;
}
