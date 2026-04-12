<script lang="ts">
  import { trades, scLocations, scItems, firebaseUser, nickname, userRole, uexApiKey, uexSecretKey } from '$lib/stores';
  import type { Trade } from '$lib/types';
  import { findEntity, findTerminal, submitTrade } from '$lib/uex';

  // ── Permissions ──────────────────────────────────────────────────────────────
  let canManage = $derived(!$firebaseUser || $userRole === 'moderator' || $userRole === 'admin');

  let showEditModal = $state(false);
  let editTarget = $state<Trade | null>(null);
  let formError = $state('');

  // ── Item type lookup (for UEX push visibility) ────────────────────────────────
  let scItemMap = $derived(new Map($scItems.map(i => [i.name.toLowerCase(), i])));
  function scItemType(name: string): string {
    return scItemMap.get(name.toLowerCase())?.type ?? '';
  }

  // ── UEX trade push ────────────────────────────────────────────────────────────
  type PushState = { status: 'loading' | 'success' | 'error'; msg?: string };
  let uexPush = $state<Record<string, PushState>>({});

  async function pushSellToUex(trade: Trade) {
    if (trade.uexSellId && !confirm(`Already logged to UEX as trade #${trade.uexSellId}. Push again?`)) return;
    uexPush = { ...uexPush, [trade.id]: { status: 'loading' } };
    try {
      const entity = await findEntity($uexApiKey, trade.item, scItemType(trade.item));
      if (!entity || entity.type !== 'commodity') throw new Error('Not found as a UEX commodity');
      const terminal = await findTerminal($uexApiKey, trade.sellLocation);
      if (!terminal) throw new Error(`Terminal not found: "${trade.sellLocation}"`);
      const uexSellId = await submitTrade($uexApiKey, $uexSecretKey, {
        id_terminal: terminal.id,
        id_commodity: entity.id,
        operation: 'sell',
        scu: trade.amountSold,
        price: trade.sellPrice,
      });
      trades.update(list => list.map(t => t.id === trade.id ? { ...t, uexSellId } : t));
      const { [trade.id]: _, ...rest } = uexPush;
      uexPush = rest;
    } catch (e) {
      uexPush = { ...uexPush, [trade.id]: { status: 'error', msg: e instanceof Error ? e.message : 'Failed' } };
    }
  }

  // ── Buy order detail popup ────────────────────────────────────────────────────
  let showBuyDetailModal = $state(false);
  let buyDetailTrade = $state<Trade | null>(null);

  function openBuyDetail(trade: Trade) {
    buyDetailTrade = trade;
    showBuyDetailModal = true;
  }

  let fAmountSold = $state<number | ''>(0);
  let fSellPrice = $state<number | ''>(0);
  let fSellLocation = $state('');
  let fLocSearch = $state('');
  let showLocDropdown = $state(false);

  // ── Table state ───────────────────────────────────────────────────────────────
  let tableFilter = $state('');
  let showMineOnly = $state(false);
  let sortCol = $state('soldAt');
  let sortDir = $state<'asc' | 'desc'>('desc');

  let filteredLocs = $derived(
    fLocSearch.length >= 2
      ? $scLocations.filter((n) => n.toLowerCase().includes(fLocSearch.toLowerCase())).slice(0, 25)
      : []
  );

  let displayTrades = $derived(
    [...$trades]
      .filter(t => !tableFilter || t.item.toLowerCase().includes(tableFilter.toLowerCase()))
      .filter(t => !showMineOnly || t.loggedBy === $nickname)
      .sort((a, b) => {
        let av: string | number, bv: string | number;
        if (sortCol === 'item')       { av = a.item;                       bv = b.item; }
        else if (sortCol === 'qty')   { av = a.amountSold;                 bv = b.amountSold; }
        else if (sortCol === 'sell')  { av = a.sellPrice;                  bv = b.sellPrice; }
        else if (sortCol === 'yield') { av = a.amountSold * a.sellPrice;   bv = b.amountSold * b.sellPrice; }
        else if (sortCol === 'profit') {
          av = (a.buyPrice ?? 0) > 0 ? (a.sellPrice - (a.buyPrice ?? 0)) * a.amountSold : -Infinity;
          bv = (b.buyPrice ?? 0) > 0 ? (b.sellPrice - (b.buyPrice ?? 0)) * b.amountSold : -Infinity;
        }
        else if (sortCol === 'location') { av = a.sellLocation; bv = b.sellLocation; }
        else                          { av = a.soldAt;                     bv = b.soldAt; }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
  );

  function toggleSort(col: string) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'asc'; }
  }

  function si(col: string) { return sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''; }

  function uec(n: number) { return n.toLocaleString() + ' aUEC'; }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function profitOf(t: Trade): number | null {
    if (!t.buyPrice || t.buyPrice === 0) return null;
    return (t.sellPrice - t.buyPrice) * t.amountSold;
  }

  function profitClass(p: number | null): string {
    if (p === null) return 'text-muted';
    if (p > 0) return 'text-green-400';
    if (p < 0) return 'text-red-400';
    return 'text-muted';
  }

  let totalYield = $derived(displayTrades.reduce((sum, t) => sum + t.amountSold * t.sellPrice, 0));
  let totalProfit = $derived(displayTrades.reduce((sum, t) => {
    const p = profitOf(t);
    return p !== null ? sum + p : sum;
  }, 0));
  let hasProfitData = $derived(displayTrades.some(t => t.buyPrice && t.buyPrice > 0));

  function openEdit(trade: Trade) {
    editTarget = trade;
    fAmountSold = trade.amountSold;
    fSellPrice = trade.sellPrice;
    fSellLocation = trade.sellLocation;
    fLocSearch = trade.sellLocation;
    formError = '';
    showEditModal = true;
  }

  function saveEdit() {
    if (!editTarget) return;
    if (!fAmountSold || Number(fAmountSold) <= 0) { formError = 'Amount must be greater than 0.'; return; }
    trades.update((list) =>
      list.map((t) => t.id === editTarget!.id
        ? { ...t, amountSold: Number(fAmountSold), sellPrice: Number(fSellPrice) || 0, sellLocation: fSellLocation.trim() }
        : t
      )
    );
    showEditModal = false;
    editTarget = null;
  }

  function deleteTrade(id: string) {
    if (!confirm('Delete this trade record?')) return;
    trades.update((list) => list.filter((t) => t.id !== id));
  }

  function exportCSV() {
    const synced = !!$firebaseUser;
    const headers = ['Item', 'Qty Sold', 'Buy Price/unit', 'Sell Price/unit', 'Profit', 'Yield', 'Location', 'Date'];
    if (synced) headers.push('Logged By');

    const rows = [...$trades]
      .sort((a, b) => b.soldAt.localeCompare(a.soldAt))
      .map(t => {
        const p = profitOf(t);
        const cells = [
          t.item,
          t.amountSold,
          t.buyPrice ?? '',
          t.sellPrice,
          p !== null ? p : '',
          t.amountSold * t.sellPrice,
          t.sellLocation,
          new Date(t.soldAt).toLocaleString()
        ];
        if (synced) cells.push(t.loggedBy ?? '');
        return cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sc-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3 py-2">
      <div class="w-1 h-5 bg-accent opacity-70"></div>
      <h1 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-sm font-bold tracking-widest uppercase">
        Trade Log
      </h1>
    </div>
    {#if $trades.length > 0}
      <div class="flex items-center gap-2">
        {#if hasProfitData}
          <div class="hidden sm:flex items-center gap-2 border border-border bg-surface px-3 py-1.5">
            <span class="text-xs uppercase tracking-widest text-muted font-semibold">P&L</span>
            <div class="w-px h-3 bg-border"></div>
            <span style="font-family: 'Orbitron', sans-serif;" class="font-bold text-xs {totalProfit > 0 ? 'text-green-400' : totalProfit < 0 ? 'text-red-400' : 'text-muted'}">
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()} aUEC
            </span>
          </div>
        {/if}
        <button
          onclick={exportCSV}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-accent hover:text-accent transition-all duration-200"
        >
          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          <span class="hidden sm:inline">CSV</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Filter bar -->
  {#if $trades.length > 0}
    <div class="flex gap-2">
      <input
        type="text"
        placeholder="Filter by item name…"
        bind:value={tableFilter}
        class="flex-1 bg-bg border border-border px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
      />
      {#if $firebaseUser}
        <button
          onclick={() => showMineOnly = !showMineOnly}
          class="px-3 py-2 text-xs font-semibold uppercase tracking-wider border transition-all duration-200 {showMineOnly ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted hover:border-accent hover:text-accent'}"
        >
          Mine
        </button>
      {/if}
    </div>
  {/if}

  <!-- Table -->
  {#if $trades.length === 0}
    <div class="rsi-panel border border-border bg-surface py-16 text-center">
      <p style="font-family: 'Orbitron', sans-serif;" class="text-muted text-xs uppercase tracking-widest">
        No trades on record
      </p>
      <p class="text-muted text-sm mt-2 opacity-60">Complete a sale from the Inventory screen</p>
    </div>
  {:else}
    <div class="rsi-panel border border-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="rsi-scanline bg-surface border-b border-border">
            <tr>
              <th onclick={() => toggleSort('item')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Item{si('item')}</th>
              <th onclick={() => toggleSort('qty')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Qty{si('qty')}</th>
              <th onclick={() => toggleSort('sell')} class="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Sell Price{si('sell')}</th>
              <th onclick={() => toggleSort('yield')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Yield{si('yield')}</th>
              <th onclick={() => toggleSort('profit')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Profit{si('profit')}</th>
              <th onclick={() => toggleSort('location')} class="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Location{si('location')}</th>
              <th onclick={() => toggleSort('soldAt')} class="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Date{si('soldAt')}</th>
              <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-muted">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each displayTrades as trade (trade.id)}
              {@const profit = profitOf(trade)}
              <tr class="bg-bg hover:bg-surface transition-colors duration-150">
                <td class="px-4 py-3">
                  <span class="font-semibold text-text">{trade.item}</span>
                  {#if trade.loggedBy}
                    <span class="block text-xs text-muted/60 font-normal mt-0.5">{trade.loggedBy}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-text font-bold" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {trade.amountSold.toLocaleString()}
                </td>
                <td class="hidden sm:table-cell px-4 py-3 text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {trade.sellPrice > 0 ? uec(trade.sellPrice) : '—'}
                </td>
                <td class="px-4 py-3 text-accent font-bold" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {trade.sellPrice > 0 ? uec(trade.amountSold * trade.sellPrice) : '—'}
                </td>
                <td class="px-4 py-3 font-bold {profitClass(profit)}" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {#if profit !== null}
                    {profit >= 0 ? '+' : ''}{uec(profit)}
                  {:else}
                    <span class="text-muted opacity-40">—</span>
                  {/if}
                </td>
                <td class="hidden md:table-cell px-4 py-3 text-muted text-xs">{trade.sellLocation || '—'}</td>
                <td class="hidden md:table-cell px-4 py-3 text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 10px;">
                  {fmtDate(trade.soldAt)}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      onclick={() => openBuyDetail(trade)}
                      title="Buy order details"
                      class="px-2 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-accent hover:text-accent transition-all duration-150"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </button>
                    {#if $uexSecretKey && scItemType(trade.item) === 'commodity' && trade.sellLocation && (!trade.loggedBy || trade.loggedBy === $nickname)}
                      {@const ps = uexPush[trade.id]}
                      {#if ps?.status === 'loading'}
                        <span class="px-2 py-1 text-xs text-muted border border-border animate-pulse uppercase tracking-wider">…</span>
                      {:else if ps?.status === 'error'}
                        <button
                          onclick={() => { const { [trade.id]: _, ...rest } = uexPush; uexPush = rest; }}
                          title={ps.msg}
                          class="px-2 py-1 text-xs text-red-400 border border-red-800 uppercase tracking-wider font-semibold hover:bg-red-950 transition-colors"
                        >✕</button>
                      {:else if trade.uexSellId}
                        <button
                          onclick={() => pushSellToUex(trade)}
                          title="Logged as UEX trade #{trade.uexSellId}. Click to push again."
                          class="px-2 py-1 border border-green-800 text-green-500 text-xs uppercase tracking-wider hover:border-green-500 transition-all duration-150"
                        >UEX</button>
                      {:else}
                        <button
                          onclick={() => pushSellToUex(trade)}
                          title="Push sell order to UEX trade log"
                          class="px-2 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-accent hover:text-accent transition-all duration-150"
                        >UEX</button>
                      {/if}
                    {/if}
                    {#if canManage}
                      <button onclick={() => openEdit(trade)}
                        class="px-3 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-text hover:text-text transition-all duration-150">
                        Edit
                      </button>
                      <button onclick={() => deleteTrade(trade.id)}
                        class="px-3 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-red-700 hover:text-red-500 transition-all duration-150">
                        Delete
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
            {#if displayTrades.length === 0}
              <tr>
                <td colspan="8" class="px-4 py-8 text-center text-muted text-xs uppercase tracking-widest">No matching trades</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- ── Buy Order Detail Modal ─────────────────────────────────────────────────── -->
{#if showBuyDetailModal && buyDetailTrade}
  {@const t = buyDetailTrade}
  <div
    class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={(e) => e.key === 'Escape' && (showBuyDetailModal = false)}
  >
    <div class="rsi-panel bg-surface border border-border w-full max-w-sm shadow-2xl" style="box-shadow: 0 0 40px rgba(66,200,244,0.08);">

      <div class="px-5 py-3 border-b border-border flex items-center gap-3 rsi-scanline">
        <div class="w-1 h-4 bg-accent opacity-70"></div>
        <div class="flex-1 min-w-0">
          <h2 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest truncate">
            {t.item}
          </h2>
        </div>
        <span class="shrink-0 px-2 py-0.5 text-xs font-bold uppercase tracking-wider border border-border text-muted">
          Buy Order
        </span>
      </div>

      <div class="px-5 py-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="border border-border bg-bg px-3 py-2">
            <p class="text-xs uppercase tracking-widest text-muted font-semibold mb-1">Qty Bought</p>
            <p style="font-family: 'Orbitron', sans-serif;" class="text-accent font-bold text-sm">{t.amountSold.toLocaleString()}</p>
          </div>
          <div class="border border-border bg-bg px-3 py-2">
            <p class="text-xs uppercase tracking-widest text-muted font-semibold mb-1">Buy Price / unit</p>
            <p style="font-family: 'Orbitron', sans-serif;" class="text-text text-xs font-bold">
              {t.buyPrice && t.buyPrice > 0 ? t.buyPrice.toLocaleString() + ' aUEC' : '—'}
            </p>
          </div>
        </div>

        <div class="border border-border bg-bg px-3 py-2">
          <p class="text-xs uppercase tracking-widest text-muted font-semibold mb-1">Total Cost</p>
          <p style="font-family: 'Orbitron', sans-serif;" class="text-text text-sm font-bold">
            {t.buyPrice && t.buyPrice > 0 ? (t.amountSold * t.buyPrice).toLocaleString() + ' aUEC' : '—'}
          </p>
        </div>

        <div class="border border-border bg-bg px-3 py-2">
          <p class="text-xs uppercase tracking-widest text-muted font-semibold mb-1">Bought At</p>
          <p class="text-text text-xs font-semibold">{t.buyLocation || '—'}</p>
        </div>
      </div>

      <div class="px-5 py-3 border-t border-border flex justify-end bg-bg/40">
        <button
          onclick={() => { showBuyDetailModal = false; buyDetailTrade = null; }}
          class="px-4 py-2 border border-border text-muted text-xs font-semibold uppercase tracking-widest hover:border-text hover:text-text transition-all duration-150"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Trade Modal -->
{#if showEditModal && editTarget}
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div class="rsi-panel bg-surface border border-border w-full max-w-md shadow-2xl" style="box-shadow: 0 0 40px rgba(66,200,244,0.08);">

      <div class="px-5 py-3 border-b border-border rsi-scanline">
        <div class="flex items-center gap-3">
          <div class="w-1 h-4 bg-accent opacity-70"></div>
          <h2 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
            Amend Trade Record
          </h2>
        </div>
        <p class="text-xs text-muted mt-1 ml-4 font-semibold">{editTarget.item}</p>
      </div>

      <div class="px-5 py-4 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="t-amount" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Quantity Sold</label>
            <input id="t-amount" type="number" min="1" bind:value={fAmountSold}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label for="t-price" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Price / unit (aUEC)</label>
            <input id="t-price" type="number" min="0" bind:value={fSellPrice}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>

        <div>
          <label for="t-location" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Sell Location</label>
          <div class="relative">
            <input id="t-location" type="text"
              placeholder={$scLocations.length ? 'Search locations…' : 'Sell location'}
              bind:value={fLocSearch}
              oninput={() => { fSellLocation = fLocSearch; showLocDropdown = true; }}
              onfocus={() => { showLocDropdown = true; }}
              onblur={() => setTimeout(() => { showLocDropdown = false; }, 150)}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
            />
            {#if showLocDropdown && filteredLocs.length > 0}
              <ul class="absolute z-10 w-full mt-px bg-surface border border-border-bright max-h-48 overflow-y-auto shadow-lg" style="box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
                {#each filteredLocs as loc (loc)}
                  <li>
                    <button type="button" onmousedown={() => { fSellLocation = loc; fLocSearch = loc; showLocDropdown = false; }}
                      class="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-2 hover:text-accent transition-colors border-b border-border last:border-0">
                      {loc}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>

      {#if formError}
        <p class="px-5 pb-2 text-xs text-red-400 uppercase tracking-wider font-semibold">{formError}</p>
      {/if}

      <div class="px-5 py-3 border-t border-border flex justify-end gap-2 bg-bg/40">
        <button
          onclick={() => { showEditModal = false; editTarget = null; }}
          class="px-4 py-2 border border-border text-muted text-xs font-semibold uppercase tracking-widest hover:border-text hover:text-text transition-all duration-150">
          Abort
        </button>
        <button
          onclick={saveEdit}
          class="px-4 py-2 bg-accent-glow border border-accent-dim text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-bg transition-all duration-150">
          Update Record
        </button>
      </div>
    </div>
  </div>
{/if}
