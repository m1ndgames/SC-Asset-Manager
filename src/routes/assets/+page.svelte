<script lang="ts">
  import { assets, trades, scItems, scLocations } from '$lib/stores';
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

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function uec(n: number) {
    return n.toLocaleString() + ' aUEC';
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // ── Add ──────────────────────────────────────────────────────────────────────
  function openAdd() {
    fItem = '';
    fSearch = '';
    fAmount = 1;
    fBuyPrice = 0;
    fLocation = '';
    fLocSearch = '';
    formError = '';
    showAddModal = true;
  }

  function saveAdd() {
    if (!fItem.trim()) { formError = 'Item name is required.'; return; }
    if (!fAmount || fAmount <= 0) { formError = 'Amount must be greater than 0.'; return; }
    assets.update((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        item: fItem.trim(),
        amount: Number(fAmount),
        buyPrice: Number(fBuyPrice) || 0,
        location: fLocation.trim(),
        createdAt: new Date().toISOString()
      }
    ]);
    showAddModal = false;
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(asset: Asset) {
    editTarget = asset;
    fItem = asset.item;
    fSearch = asset.item;
    fAmount = asset.amount;
    fBuyPrice = asset.buyPrice;
    fLocation = asset.location;
    fLocSearch = asset.location;
    formError = '';
    showEditModal = true;
  }

  function saveEdit() {
    if (!editTarget) return;
    if (!fItem.trim()) { formError = 'Item name is required.'; return; }
    if (!fAmount || fAmount <= 0) { formError = 'Amount must be greater than 0.'; return; }
    assets.update((list) =>
      list.map((a) =>
        a.id === editTarget!.id
          ? {
              ...a,
              item: fItem.trim(),
              amount: Number(fAmount),
              buyPrice: Number(fBuyPrice) || 0,
              location: fLocation.trim()
            }
          : a
      )
    );
    showEditModal = false;
    editTarget = null;
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function deleteAsset(id: string) {
    if (!confirm('Delete this asset?')) return;
    assets.update((list) => list.filter((a) => a.id !== id));
  }

  // ── Sell ─────────────────────────────────────────────────────────────────────
  function openSell(asset: Asset) {
    sellTarget = asset;
    sSellAmount = 1;
    sSellPrice = 0;
    sSellLocation = '';
    sSellLocSearch = '';
    sellError = '';
    showSellModal = true;
  }

  function confirmSell() {
    if (!sellTarget) return;
    const qty = Number(sSellAmount);
    if (!qty || qty <= 0) { sellError = 'Amount must be greater than 0.'; return; }
    if (qty > sellTarget.amount) { sellError = `Max available: ${sellTarget.amount}.`; return; }

    trades.update((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        assetId: sellTarget!.id,
        item: sellTarget!.item,
        amountSold: qty,
        sellPrice: Number(sSellPrice) || 0,
        sellLocation: sSellLocation.trim(),
        soldAt: new Date().toISOString()
      }
    ]);

    assets.update((list) => {
      const updated = list.map((a) =>
        a.id === sellTarget!.id ? { ...a, amount: a.amount - qty } : a
      );
      return updated.filter((a) => a.amount > 0);
    });

    showSellModal = false;
    sellTarget = null;
  }

  // ── Autocomplete picks ───────────────────────────────────────────────────────
  function pickItem(name: string) {
    fItem = name;
    fSearch = name;
    showItemDropdown = false;
  }
  function pickLoc(name: string) {
    fLocation = name;
    fLocSearch = name;
    showLocDropdown = false;
  }
  function pickSellLoc(name: string) {
    sSellLocation = name;
    sSellLocSearch = name;
    showSellLocDropdown = false;
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">Assets</h1>
    <button
      onclick={openAdd}
      class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
    >
      + Add Asset
    </button>
  </div>

  <!-- Table -->
  {#if $assets.length === 0}
    <p class="text-gray-500 text-sm mt-8 text-center">No assets yet. Click "Add Asset" to get started.</p>
  {:else}
    <div class="overflow-x-auto rounded-lg border border-gray-700">
      <table class="w-full text-sm">
        <thead class="bg-gray-800 text-gray-400 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Item</th>
            <th class="px-4 py-3 font-medium">Amount</th>
            <th class="px-4 py-3 font-medium">Buy Price</th>
            <th class="px-4 py-3 font-medium">Location</th>
            <th class="px-4 py-3 font-medium">Added</th>
            <th class="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          {#each $assets as asset (asset.id)}
            <tr class="bg-gray-900 hover:bg-gray-800/60 transition-colors">
              <td class="px-4 py-3 font-medium text-white">{asset.item}</td>
              <td class="px-4 py-3 text-gray-300">{asset.amount.toLocaleString()}</td>
              <td class="px-4 py-3 text-gray-300">
                {asset.buyPrice > 0 ? uec(asset.buyPrice) : '—'}
              </td>
              <td class="px-4 py-3 text-gray-300">{asset.location || '—'}</td>
              <td class="px-4 py-3 text-gray-500">{fmtDate(asset.createdAt)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={() => openSell(asset)}
                    class="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-xs font-medium transition-colors"
                  >
                    Sell
                  </button>
                  <button
                    onclick={() => openEdit(asset)}
                    class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onclick={() => deleteAsset(asset.id)}
                    class="px-3 py-1 rounded bg-red-900 hover:bg-red-700 text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- ── Add / Edit Modal (shared layout) ─────────────────────────────────────── -->
{#if showAddModal || showEditModal}
  {@const isEdit = showEditModal}
  <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true">
    <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 shadow-xl">
      <h2 class="text-lg font-semibold mb-5">{isEdit ? 'Edit Asset' : 'Add Asset'}</h2>

      <div class="space-y-4">
        <!-- Item name with autocomplete -->
        <div>
          <label for="f-item" class="block text-sm text-gray-300 mb-1">Item</label>
          <div class="relative">
            <input
              id="f-item"
              type="text"
              placeholder={$scItems.length ? 'Search or type item name…' : 'Item name'}
              bind:value={fSearch}
              oninput={() => { fItem = fSearch; showItemDropdown = true; }}
              onfocus={() => { showItemDropdown = true; }}
              onblur={() => setTimeout(() => { showItemDropdown = false; }, 150)}
              class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {#if showItemDropdown && filteredItems.length > 0}
              <ul class="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-48 overflow-y-auto">
                {#each filteredItems as name (name)}
                  <li>
                    <button type="button" onmousedown={() => pickItem(name)}
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-600 transition-colors">
                      {name}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>

        <!-- Amount -->
        <div>
          <label for="f-amount" class="block text-sm text-gray-300 mb-1">Amount</label>
          <input
            id="f-amount"
            type="number"
            min="1"
            bind:value={fAmount}
            class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- Buy price -->
        <div>
          <label for="f-buy-price" class="block text-sm text-gray-300 mb-1">Buy Price (aUEC per unit)</label>
          <input
            id="f-buy-price"
            type="number"
            min="0"
            bind:value={fBuyPrice}
            class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- Storage Location -->
        <div>
          <label for="f-location" class="block text-sm text-gray-300 mb-1">Storage Location</label>
          <div class="relative">
            <input
              id="f-location"
              type="text"
              placeholder={$scLocations.length ? 'Search location…' : 'Storage location'}
              bind:value={fLocSearch}
              oninput={() => { fLocation = fLocSearch; showLocDropdown = true; }}
              onfocus={() => { showLocDropdown = true; }}
              onblur={() => setTimeout(() => { showLocDropdown = false; }, 150)}
              class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {#if showLocDropdown && filteredLocs.length > 0}
              <ul class="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-48 overflow-y-auto">
                {#each filteredLocs as loc (loc)}
                  <li>
                    <button type="button" onmousedown={() => pickLoc(loc)}
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-600 transition-colors">
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
        <p class="mt-3 text-sm text-red-400">{formError}</p>
      {/if}

      <div class="mt-6 flex justify-end gap-3">
        <button
          onclick={() => { showAddModal = false; showEditModal = false; }}
          class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={isEdit ? saveEdit : saveAdd}
          class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
        >
          {isEdit ? 'Save Changes' : 'Add Asset'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Sell Modal ─────────────────────────────────────────────────────────────── -->
{#if showSellModal && sellTarget}
  <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true">
    <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 shadow-xl">
      <h2 class="text-lg font-semibold mb-1">Sell Asset</h2>
      <p class="text-sm text-gray-400 mb-5">
        {sellTarget.item}
        <span class="text-gray-500">&mdash; {sellTarget.amount.toLocaleString()} available</span>
      </p>

      <div class="space-y-4">
        <div>
          <label for="s-amount" class="block text-sm text-gray-300 mb-1">Amount to Sell</label>
          <input
            id="s-amount"
            type="number"
            min="1"
            max={sellTarget.amount}
            bind:value={sSellAmount}
            class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label for="s-price" class="block text-sm text-gray-300 mb-1">Sell Price (aUEC per unit)</label>
          <input
            id="s-price"
            type="number"
            min="0"
            bind:value={sSellPrice}
            class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label for="s-location" class="block text-sm text-gray-300 mb-1">Sell Location</label>
          <div class="relative">
            <input
              id="s-location"
              type="text"
              placeholder={$scLocations.length ? 'Search location…' : 'Sell location'}
              bind:value={sSellLocSearch}
              oninput={() => { sSellLocation = sSellLocSearch; showSellLocDropdown = true; }}
              onfocus={() => { showSellLocDropdown = true; }}
              onblur={() => setTimeout(() => { showSellLocDropdown = false; }, 150)}
              class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {#if showSellLocDropdown && filteredSellLocs.length > 0}
              <ul class="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-48 overflow-y-auto">
                {#each filteredSellLocs as loc (loc)}
                  <li>
                    <button type="button" onmousedown={() => pickSellLoc(loc)}
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-600 transition-colors">
                      {loc}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>

        {#if Number(sSellAmount) > 0 && Number(sSellPrice) > 0}
          <div class="rounded bg-gray-700/50 px-3 py-2 text-sm text-gray-300">
            Total proceeds:
            <span class="text-white font-medium">{uec(Number(sSellAmount) * Number(sSellPrice))}</span>
          </div>
        {/if}
      </div>

      {#if sellError}
        <p class="mt-3 text-sm text-red-400">{sellError}</p>
      {/if}

      <div class="mt-6 flex justify-end gap-3">
        <button
          onclick={() => { showSellModal = false; sellTarget = null; }}
          class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={confirmSell}
          class="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-sm font-medium transition-colors"
        >
          Confirm Sell
        </button>
      </div>
    </div>
  </div>
{/if}
