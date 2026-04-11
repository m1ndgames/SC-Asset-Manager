<script lang="ts">
  import { assets, trades, scItems, scLocations, firebaseUser, nickname } from '$lib/stores';
  import type { Asset } from '$lib/types';

  // ── Modal visibility ────────────────────────────────────────────────────────
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let showSellModal = $state(false);

  // ── Editing / selling target ────────────────────────────────────────────────
  let editTarget = $state<Asset | null>(null);
  let sellTarget = $state<Asset | null>(null);

  // ── Add / Edit form ─────────────────────────────────────────────────────────
  let fItem = $state('');
  let fAmount = $state<number | ''>(1);
  let fBuyPrice = $state<number | ''>(0);
  let fLocation = $state('');
  let fSearch = $state('');
  let fLocSearch = $state('');
  let formError = $state('');

  // ── Sell form ───────────────────────────────────────────────────────────────
  let sSellAmount = $state<number | ''>(1);
  let sSellPrice = $state<number | ''>(0);
  let sSellLocation = $state('');
  let sSellLocSearch = $state('');
  let sellError = $state('');

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  let showItemDropdown = $state(false);
  let showLocDropdown = $state(false);
  let showSellLocDropdown = $state(false);

  // ── Table state ───────────────────────────────────────────────────────────────
  let tableFilter = $state('');
  let sortCol = $state('createdAt');
  let sortDir = $state<'asc' | 'desc'>('desc');

  let filteredItems = $derived(
    fSearch.length >= 2
      ? $scItems.filter((n) => n.toLowerCase().includes(fSearch.toLowerCase())).slice(0, 25)
      : []
  );
  let filteredLocs = $derived(
    fLocSearch.length >= 2
      ? $scLocations.filter((n) => n.toLowerCase().includes(fLocSearch.toLowerCase())).slice(0, 25)
      : []
  );
  let filteredSellLocs = $derived(
    sSellLocSearch.length >= 2
      ? $scLocations.filter((n) => n.toLowerCase().includes(sSellLocSearch.toLowerCase())).slice(0, 25)
      : []
  );

  let displayAssets = $derived(
    [...$assets]
      .filter(a => !tableFilter || a.item.toLowerCase().includes(tableFilter.toLowerCase()))
      .sort((a, b) => {
        let av: string | number, bv: string | number;
        if (sortCol === 'item')          { av = a.item;               bv = b.item; }
        else if (sortCol === 'amount')   { av = a.amount;             bv = b.amount; }
        else if (sortCol === 'buyPrice') { av = a.buyPrice;           bv = b.buyPrice; }
        else if (sortCol === 'total')    { av = a.amount * a.buyPrice; bv = b.amount * b.buyPrice; }
        else if (sortCol === 'location') { av = a.location;           bv = b.location; }
        else                             { av = a.createdAt;          bv = b.createdAt; }
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

  function openAdd() {
    fItem = ''; fSearch = ''; fAmount = 1; fBuyPrice = 0;
    fLocation = ''; fLocSearch = ''; formError = '';
    showAddModal = true;
  }

  function saveAdd() {
    if (!fItem.trim()) { formError = 'Item name is required.'; return; }
    if (!fAmount || fAmount <= 0) { formError = 'Amount must be greater than 0.'; return; }

    const existing = $assets.find(a =>
      a.item.toLowerCase() === fItem.trim().toLowerCase() &&
      a.location.toLowerCase() === fLocation.trim().toLowerCase()
    );

    if (existing) {
      const loc = existing.location || 'no location';
      if (confirm(`"${existing.item}" at "${loc}" already exists (${existing.amount.toLocaleString()} units). Merge into existing record?`)) {
        assets.update(list => list.map(a =>
          a.id === existing.id
            ? { ...a, amount: a.amount + Number(fAmount), buyPrice: Number(fBuyPrice) || a.buyPrice }
            : a
        ));
        showAddModal = false;
        return;
      }
    }

    assets.update((list) => [...list, {
      id: crypto.randomUUID(),
      item: fItem.trim(),
      amount: Number(fAmount),
      buyPrice: Number(fBuyPrice) || 0,
      location: fLocation.trim(),
      createdAt: new Date().toISOString(),
      ...($firebaseUser && $nickname ? { loggedBy: $nickname } : {})
    }]);
    showAddModal = false;
  }

  function openEdit(asset: Asset) {
    editTarget = asset;
    fItem = asset.item; fSearch = asset.item;
    fAmount = asset.amount; fBuyPrice = asset.buyPrice;
    fLocation = asset.location; fLocSearch = asset.location;
    formError = '';
    showEditModal = true;
  }

  function saveEdit() {
    if (!editTarget) return;
    if (!fItem.trim()) { formError = 'Item name is required.'; return; }
    if (!fAmount || fAmount <= 0) { formError = 'Amount must be greater than 0.'; return; }
    assets.update((list) =>
      list.map((a) => a.id === editTarget!.id
        ? { ...a, item: fItem.trim(), amount: Number(fAmount), buyPrice: Number(fBuyPrice) || 0, location: fLocation.trim() }
        : a
      )
    );
    showEditModal = false;
    editTarget = null;
  }

  function deleteAsset(id: string) {
    if (!confirm('Delete this asset?')) return;
    assets.update((list) => list.filter((a) => a.id !== id));
  }

  function openSell(asset: Asset) {
    sellTarget = asset;
    sSellAmount = 1; sSellPrice = 0;
    sSellLocation = ''; sSellLocSearch = '';
    sellError = '';
    showSellModal = true;
  }

  function confirmSell() {
    if (!sellTarget) return;
    const qty = Number(sSellAmount);
    if (!qty || qty <= 0) { sellError = 'Amount must be greater than 0.'; return; }
    if (qty > sellTarget.amount) { sellError = `Max available: ${sellTarget.amount}.`; return; }

    trades.update((list) => [...list, {
      id: crypto.randomUUID(),
      assetId: sellTarget!.id,
      item: sellTarget!.item,
      amountSold: qty,
      buyPrice: sellTarget!.buyPrice,
      sellPrice: Number(sSellPrice) || 0,
      sellLocation: sSellLocation.trim(),
      soldAt: new Date().toISOString(),
      ...($firebaseUser && $nickname ? { loggedBy: $nickname } : {})
    }]);

    assets.update((list) => {
      const updated = list.map((a) =>
        a.id === sellTarget!.id ? { ...a, amount: a.amount - qty } : a
      );
      return updated.filter((a) => a.amount > 0);
    });

    showSellModal = false;
    sellTarget = null;
  }

  function pickItem(name: string) { fItem = name; fSearch = name; showItemDropdown = false; }
  function pickLoc(name: string) { fLocation = name; fLocSearch = name; showLocDropdown = false; }
  function pickSellLoc(name: string) { sSellLocation = name; sSellLocSearch = name; showSellLocDropdown = false; }
</script>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3 py-2">
      <div class="w-1 h-5 bg-accent opacity-70"></div>
      <h1 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-sm font-bold tracking-widest uppercase">
        Inventory
      </h1>
    </div>
    <button
      onclick={openAdd}
      class="rsi-panel px-4 py-2 bg-surface-2 border border-border-bright text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-bg hover:border-accent transition-all duration-200"
    >
      + Add Asset
    </button>
  </div>

  <!-- Filter bar -->
  {#if $assets.length > 0}
    <input
      type="text"
      placeholder="Filter by item name…"
      bind:value={tableFilter}
      class="w-full bg-bg border border-border px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
    />
  {/if}

  <!-- Table -->
  {#if $assets.length === 0}
    <div class="rsi-panel border border-border bg-surface py-16 text-center">
      <p style="font-family: 'Orbitron', sans-serif;" class="text-muted text-xs uppercase tracking-widest">
        No assets on record
      </p>
      <p class="text-muted text-sm mt-2 opacity-60">Add your first asset to begin tracking</p>
    </div>
  {:else}
    <div class="rsi-panel border border-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="rsi-scanline bg-surface border-b border-border">
            <tr>
              <th onclick={() => toggleSort('item')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Item{si('item')}</th>
              <th onclick={() => toggleSort('amount')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Amount{si('amount')}</th>
              <th onclick={() => toggleSort('buyPrice')} class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Price / Unit{si('buyPrice')}</th>
              <th onclick={() => toggleSort('total')} class="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Total Cost{si('total')}</th>
              <th onclick={() => toggleSort('location')} class="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Location{si('location')}</th>
              <th onclick={() => toggleSort('createdAt')} class="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted cursor-pointer hover:text-text select-none">Added{si('createdAt')}</th>
              <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-muted">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each displayAssets as asset (asset.id)}
              <tr class="bg-bg hover:bg-surface transition-colors duration-150 group">
                <td class="px-4 py-3">
                  <span class="font-semibold text-text">{asset.item}</span>
                  {#if asset.loggedBy}
                    <span class="block text-xs text-muted/60 font-normal mt-0.5">{asset.loggedBy}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-accent font-bold" style="font-family: 'Orbitron', sans-serif; font-size: 12px;">
                  {asset.amount.toLocaleString()}
                </td>
                <td class="px-4 py-3 text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {asset.buyPrice > 0 ? uec(asset.buyPrice) : '—'}
                </td>
                <td class="hidden sm:table-cell px-4 py-3 text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {asset.buyPrice > 0 ? uec(asset.amount * asset.buyPrice) : '—'}
                </td>
                <td class="hidden md:table-cell px-4 py-3 text-muted text-xs">{asset.location || '—'}</td>
                <td class="hidden md:table-cell px-4 py-3 text-muted text-xs" style="font-family: 'Orbitron', sans-serif; font-size: 10px;">
                  {fmtDate(asset.createdAt)}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-2">
                    <button onclick={() => openSell(asset)}
                      class="px-3 py-1 bg-accent-glow border border-accent-dim text-accent text-xs font-bold uppercase tracking-wider hover:bg-accent hover:text-bg transition-all duration-150">
                      Sell
                    </button>
                    <button onclick={() => openEdit(asset)}
                      class="px-3 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-text hover:text-text transition-all duration-150">
                      Edit
                    </button>
                    <button onclick={() => deleteAsset(asset.id)}
                      class="px-3 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-red-700 hover:text-red-500 transition-all duration-150">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
            {#if displayAssets.length === 0}
              <tr>
                <td colspan="7" class="px-4 py-8 text-center text-muted text-xs uppercase tracking-widest">No matching assets</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- ── Add / Edit Modal ───────────────────────────────────────────────────────── -->
{#if showAddModal || showEditModal}
  {@const isEdit = showEditModal}
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div class="rsi-panel bg-surface border border-border w-full max-w-md shadow-2xl" style="box-shadow: 0 0 40px rgba(66,200,244,0.08);">

      <!-- Modal header -->
      <div class="px-5 py-3 border-b border-border flex items-center gap-3 rsi-scanline">
        <div class="w-1 h-4 bg-accent opacity-70"></div>
        <h2 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
          {isEdit ? 'Modify Asset Record' : 'New Asset Record'}
        </h2>
      </div>

      <div class="px-5 py-4 space-y-4">
        <!-- Item -->
        <div>
          <label for="f-item" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Commodity</label>
          <div class="relative">
            <input id="f-item" type="text"
              placeholder={$scItems.length ? 'Search items…' : 'Item name'}
              bind:value={fSearch}
              oninput={() => { fItem = fSearch; showItemDropdown = true; }}
              onfocus={() => { showItemDropdown = true; }}
              onblur={() => setTimeout(() => { showItemDropdown = false; }, 150)}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
            />
            {#if showItemDropdown && filteredItems.length > 0}
              <ul class="absolute z-10 w-full mt-px bg-surface border border-border-bright max-h-48 overflow-y-auto shadow-lg" style="box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
                {#each filteredItems as name (name)}
                  <li>
                    <button type="button" onmousedown={() => pickItem(name)}
                      class="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-2 hover:text-accent transition-colors border-b border-border last:border-0">
                      {name}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- Amount -->
          <div>
            <label for="f-amount" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Quantity</label>
            <input id="f-amount" type="number" min="1" bind:value={fAmount}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
          </div>

          <!-- Buy price -->
          <div>
            <label for="f-buy-price" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Buy Price / unit</label>
            <input id="f-buy-price" type="number" min="0" bind:value={fBuyPrice}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>

        <!-- Storage Location -->
        <div>
          <label for="f-location" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Storage Location</label>
          <div class="relative">
            <input id="f-location" type="text"
              placeholder={$scLocations.length ? 'Search locations…' : 'Storage location'}
              bind:value={fLocSearch}
              oninput={() => { fLocation = fLocSearch; showLocDropdown = true; }}
              onfocus={() => { showLocDropdown = true; }}
              onblur={() => setTimeout(() => { showLocDropdown = false; }, 150)}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
            />
            {#if showLocDropdown && filteredLocs.length > 0}
              <ul class="absolute z-10 w-full mt-px bg-surface border border-border-bright max-h-48 overflow-y-auto shadow-lg" style="box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
                {#each filteredLocs as loc (loc)}
                  <li>
                    <button type="button" onmousedown={() => pickLoc(loc)}
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
          onclick={() => { showAddModal = false; showEditModal = false; }}
          class="px-4 py-2 border border-border text-muted text-xs font-semibold uppercase tracking-widest hover:border-text hover:text-text transition-all duration-150">
          Abort
        </button>
        <button
          onclick={isEdit ? saveEdit : saveAdd}
          class="px-4 py-2 bg-accent-glow border border-accent-dim text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-bg transition-all duration-150">
          {isEdit ? 'Update Record' : 'Log Asset'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Sell Modal ─────────────────────────────────────────────────────────────── -->
{#if showSellModal && sellTarget}
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div class="rsi-panel bg-surface border border-border w-full max-w-md shadow-2xl" style="box-shadow: 0 0 40px rgba(66,200,244,0.08);">

      <div class="px-5 py-3 border-b border-border rsi-scanline">
        <div class="flex items-center gap-3">
          <div class="w-1 h-4 bg-accent opacity-70"></div>
          <h2 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
            Initiate Trade
          </h2>
        </div>
        <p class="text-xs text-muted mt-1 ml-4 font-semibold">
          {sellTarget.item}
          <span class="text-border mx-1">|</span>
          <span style="font-family: 'Orbitron', sans-serif;">{sellTarget.amount.toLocaleString()}</span> units available
        </p>
      </div>

      <div class="px-5 py-4 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="s-amount" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Quantity</label>
            <input id="s-amount" type="number" min="1" max={sellTarget.amount} bind:value={sSellAmount}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label for="s-price" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Price / unit (aUEC)</label>
            <input id="s-price" type="number" min="0" bind:value={sSellPrice}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>

        <div>
          <label for="s-location" class="block text-xs uppercase tracking-widest text-muted mb-1 font-semibold">Sell Location</label>
          <div class="relative">
            <input id="s-location" type="text"
              placeholder={$scLocations.length ? 'Search locations…' : 'Sell location'}
              bind:value={sSellLocSearch}
              oninput={() => { sSellLocation = sSellLocSearch; showSellLocDropdown = true; }}
              onfocus={() => { showSellLocDropdown = true; }}
              onblur={() => setTimeout(() => { showSellLocDropdown = false; }, 150)}
              class="w-full bg-bg border border-border px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
            />
            {#if showSellLocDropdown && filteredSellLocs.length > 0}
              <ul class="absolute z-10 w-full mt-px bg-surface border border-border-bright max-h-48 overflow-y-auto shadow-lg" style="box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
                {#each filteredSellLocs as loc (loc)}
                  <li>
                    <button type="button" onmousedown={() => pickSellLoc(loc)}
                      class="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-2 hover:text-accent transition-colors border-b border-border last:border-0">
                      {loc}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>

        {#if Number(sSellAmount) > 0 && Number(sSellPrice) > 0}
          {@const qty = Number(sSellAmount)}
          {@const sell = Number(sSellPrice)}
          {@const yield_ = qty * sell}
          {@const cost = sellTarget.buyPrice > 0 ? qty * sellTarget.buyPrice : 0}
          {@const profit = yield_ - cost}
          <div class="border border-border-bright bg-accent-glow px-4 py-3 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs uppercase tracking-widest text-muted font-semibold">Expected Yield</span>
              <span style="font-family: 'Orbitron', sans-serif;" class="text-accent font-bold text-sm">{uec(yield_)}</span>
            </div>
            {#if sellTarget.buyPrice > 0}
              <div class="flex items-center justify-between">
                <span class="text-xs uppercase tracking-widest text-muted font-semibold">Total Cost</span>
                <span style="font-family: 'Orbitron', sans-serif;" class="text-muted text-xs">{uec(cost)}</span>
              </div>
              <div class="h-px bg-border"></div>
              <div class="flex items-center justify-between">
                <span class="text-xs uppercase tracking-widest text-muted font-semibold">Est. Profit</span>
                <span style="font-family: 'Orbitron', sans-serif;" class="font-bold text-sm {profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-muted'}">
                  {profit >= 0 ? '+' : ''}{uec(profit)}
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if sellError}
        <p class="px-5 pb-2 text-xs text-red-400 uppercase tracking-wider font-semibold">{sellError}</p>
      {/if}

      <div class="px-5 py-3 border-t border-border flex justify-end gap-2 bg-bg/40">
        <button
          onclick={() => { showSellModal = false; sellTarget = null; }}
          class="px-4 py-2 border border-border text-muted text-xs font-semibold uppercase tracking-widest hover:border-text hover:text-text transition-all duration-150">
          Abort
        </button>
        <button
          onclick={confirmSell}
          class="px-4 py-2 bg-accent-glow border border-accent-dim text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-bg transition-all duration-150">
          Confirm Trade
        </button>
      </div>
    </div>
  </div>
{/if}
