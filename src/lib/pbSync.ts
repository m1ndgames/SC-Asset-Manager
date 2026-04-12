import { assets, trades, migrationPending, migrationBackend } from './stores';
import { getPb, toPbId } from './pocketbase';
import type { Asset, Trade } from './types';
import { get } from 'svelte/store';

type UnsubFn = () => Promise<void>;

let unsubPbAssets: UnsubFn | null = null;
let unsubPbTrades: UnsubFn | null = null;
let unsubStoreAssets: (() => void) | null = null;
let unsubStoreTrades: (() => void) | null = null;

// Reference arrays to detect PocketBase-originated updates and avoid echo writes
let pbAssets: Asset[] = [];
let pbTrades: Trade[] = [];

function recordToAsset(r: Record<string, unknown>): Asset {
  return {
    id: (r.app_id as string) ?? (r.id as string),
    item: r.item as string,
    amount: r.amount as number,
    buyPrice: r.buyPrice as number,
    location: r.location as string,
    createdAt: r.createdAt as string,
    ...(r.loggedBy ? { loggedBy: r.loggedBy as string } : {}),
    ...(r.uexBuyId != null ? { uexBuyId: r.uexBuyId as number } : {}),
  };
}

function recordToTrade(r: Record<string, unknown>): Trade {
  return {
    id: (r.app_id as string) ?? (r.id as string),
    assetId: r.assetId as string,
    item: r.item as string,
    amountSold: r.amountSold as number,
    sellPrice: r.sellPrice as number,
    sellLocation: r.sellLocation as string,
    soldAt: r.soldAt as string,
    ...(r.buyPrice != null ? { buyPrice: r.buyPrice as number } : {}),
    ...(r.buyLocation ? { buyLocation: r.buyLocation as string } : {}),
    ...(r.loggedBy ? { loggedBy: r.loggedBy as string } : {}),
    ...(r.uexSellId != null ? { uexSellId: r.uexSellId as number } : {}),
  };
}

function assetToRecord(a: Asset): Record<string, unknown> {
  return { ...a, id: toPbId(a.id), app_id: a.id };
}

function tradeToRecord(t: Trade): Record<string, unknown> {
  return { ...t, id: toPbId(t.id), app_id: t.id };
}

export async function startPbSync(): Promise<void> {
  const pb = getPb();
  if (!pb || !pb.authStore.isValid) return;

  const [assetsPage, tradesPage] = await Promise.all([
    pb.collection('assets').getList(1, 1),
    pb.collection('trades').getList(1, 1),
  ]);

  const hasPbData = assetsPage.totalItems > 0 || tradesPage.totalItems > 0;
  const localAssets = get(assets);
  const localTrades = get(trades);
  const hasLocalData = localAssets.length > 0 || localTrades.length > 0;

  if (!hasPbData && hasLocalData) {
    migrationBackend.set('pocketbase');
    migrationPending.set(true);
    return;
  }

  await _attachListeners();
}

export async function migrateToPocketBase(): Promise<void> {
  const pb = getPb();
  if (!pb) return;

  const localAssets = get(assets);
  const localTrades = get(trades);

  await Promise.all([
    ...localAssets.map((a) => pb.collection('assets').create(assetToRecord(a))),
    ...localTrades.map((t) => pb.collection('trades').create(tradeToRecord(t))),
  ]);

  migrationPending.set(false);
  await _attachListeners();
}

export function skipPbMigration(): void {
  migrationPending.set(false);
  _attachListeners();
}

async function _attachListeners(): Promise<void> {
  const pb = getPb();
  if (!pb) return;

  // Initial full load
  const [allAssets, allTrades] = await Promise.all([
    pb.collection('assets').getFullList<Record<string, unknown>>(),
    pb.collection('trades').getFullList<Record<string, unknown>>(),
  ]);

  pbAssets = allAssets.map(recordToAsset);
  pbTrades = allTrades.map(recordToTrade);
  assets.set(pbAssets);
  trades.set(pbTrades);

  // PocketBase → Store (real-time)
  unsubPbAssets = await pb.collection('assets').subscribe('*', (e) => {
    const record = recordToAsset(e.record as Record<string, unknown>);
    if (e.action === 'create') {
      pbAssets = [...pbAssets, record];
    } else if (e.action === 'update') {
      pbAssets = pbAssets.map((a) => a.id === record.id ? record : a);
    } else if (e.action === 'delete') {
      pbAssets = pbAssets.filter((a) => a.id !== record.id);
    }
    assets.set(pbAssets);
  });

  unsubPbTrades = await pb.collection('trades').subscribe('*', (e) => {
    const record = recordToTrade(e.record as Record<string, unknown>);
    if (e.action === 'create') {
      pbTrades = [...pbTrades, record];
    } else if (e.action === 'update') {
      pbTrades = pbTrades.map((t) => t.id === record.id ? record : t);
    } else if (e.action === 'delete') {
      pbTrades = pbTrades.filter((t) => t.id !== record.id);
    }
    trades.set(pbTrades);
  });

  // Store → PocketBase
  let prevAssets = new Map(get(assets).map((a) => [a.id, a]));
  unsubStoreAssets = assets.subscribe(async (current) => {
    if (current === pbAssets) return; // PB-originated, skip
    const pb = getPb();
    if (!pb) return;

    const currentMap = new Map(current.map((a) => [a.id, a]));
    for (const a of current) {
      if (!prevAssets.has(a.id)) {
        pb.collection('assets').create(assetToRecord(a)).catch(() => {});
      } else if (JSON.stringify(prevAssets.get(a.id)) !== JSON.stringify(a)) {
        pb.collection('assets').update(toPbId(a.id), a).catch(() => {});
      }
    }
    for (const [id] of prevAssets) {
      if (!currentMap.has(id)) pb.collection('assets').delete(toPbId(id)).catch(() => {});
    }
    prevAssets = currentMap;
  });

  let prevTrades = new Map(get(trades).map((t) => [t.id, t]));
  unsubStoreTrades = trades.subscribe(async (current) => {
    if (current === pbTrades) return; // PB-originated, skip
    const pb = getPb();
    if (!pb) return;

    const currentMap = new Map(current.map((t) => [t.id, t]));
    for (const t of current) {
      if (!prevTrades.has(t.id)) {
        pb.collection('trades').create(tradeToRecord(t)).catch(() => {});
      } else if (JSON.stringify(prevTrades.get(t.id)) !== JSON.stringify(t)) {
        pb.collection('trades').update(toPbId(t.id), t).catch(() => {});
      }
    }
    for (const [id] of prevTrades) {
      if (!currentMap.has(id)) pb.collection('trades').delete(toPbId(id)).catch(() => {});
    }
    prevTrades = currentMap;
  });
}

export function stopPbSync(): void {
  unsubPbAssets?.();
  unsubPbTrades?.();
  unsubStoreAssets?.();
  unsubStoreTrades?.();
  unsubPbAssets = null;
  unsubPbTrades = null;
  unsubStoreAssets = null;
  unsubStoreTrades = null;
  pbAssets = [];
  pbTrades = [];
}
