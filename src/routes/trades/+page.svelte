<script lang="ts">
  import { trades, scLocations } from '$lib/stores';
  import type { Trade } from '$lib/types';

  let showEditModal = $state(false);
  let editTarget = $state<Trade | null>(null);
  let formError = $state('');

  let fAmountSold = $state<number | ''>(0);
  let fSellPrice = $state<number | ''>(0);
  let fSellLocation = $state('');
  let fLocSearch = $state('');
  let showLocDropdown = $state(false);

  let filteredLocs = $derived(
    fLocSearch.length >= 2
      ? $scLocations.filter((n) => n.toLowerCase().includes(fLocSearch.toLowerCase())).slice(0, 25)
      : []
  );

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
    if (!fAmountSold || Number(fAmountSold) <= 0) {
      formError = 'Amount must be greater than 0.';
      return;
    }
    trades.update((list) =>
      list.map((t) =>
        t.id === editTarget!.id
          ? {
              ...t,
              amountSold: Number(fAmountSold),
              sellPrice: Number(fSellPrice) || 0,
              sellLocation: fSellLocation.trim()
            }
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

  // Sort newest first
  let sorted = $derived([...$trades].sort((a, b) => b.soldAt.localeCompare(a.soldAt)));

  let totalProceeds = $derived(
    $trades.reduce((sum, t) => sum + t.amountSold * t.sellPrice, 0)
  );
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">Trades</h1>
    {#if $trades.length > 0}
      <span class="text-sm text-gray-400">
        Total proceeds: <span class="text-white font-medium">{uec(totalProceeds)}</span>
      </span>
    {/if}
  </div>

  <!-- Table -->
  {#if $trades.length === 0}
    <p class="text-gray-500 text-sm mt-8 text-center">No trades yet. Sell an asset from the Assets page.</p>
  {:else}
    <div class="overflow-x-auto rounded-lg border border-gray-700">
      <table class="w-full text-sm">
        <thead class="bg-gray-800 text-gray-400 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Item</th>
            <th class="px-4 py-3 font-medium">Amount</th>
            <th class="px-4 py-3 font-medium">Sell Price</th>
            <th class="px-4 py-3 font-medium">Total</th>
            <th class="px-4 py-3 font-medium">Location</th>
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          {#each sorted as trade (trade.id)}
            <tr class="bg-gray-900 hover:bg-gray-800/60 transition-colors">
              <td class="px-4 py-3 font-medium text-white">{trade.item}</td>
              <td class="px-4 py-3 text-gray-300">{trade.amountSold.toLocaleString()}</td>
              <td class="px-4 py-3 text-gray-300">
                {trade.sellPrice > 0 ? uec(trade.sellPrice) : '—'}
              </td>
              <td class="px-4 py-3 text-green-400 font-medium">
                {trade.sellPrice > 0 ? uec(trade.amountSold * trade.sellPrice) : '—'}
              </td>
              <td class="px-4 py-3 text-gray-300">{trade.sellLocation || '—'}</td>
              <td class="px-4 py-3 text-gray-500">{fmtDate(trade.soldAt)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={() => openEdit(trade)}
                    class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onclick={() => deleteTrade(trade.id)}
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

<!-- Edit Trade Modal -->
{#if showEditModal && editTarget}
  <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true">
    <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 shadow-xl">
      <h2 class="text-lg font-semibold mb-1">Edit Trade</h2>
      <p class="text-sm text-gray-400 mb-5">{editTarget.item}</p>

      <div class="space-y-4">
        <div>
          <label for="t-amount" class="block text-sm text-gray-300 mb-1">Amount Sold</label>
          <input
            id="t-amount"
            type="number"
            min="1"
            bind:value={fAmountSold}
            class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label for="t-price" class="block text-sm text-gray-300 mb-1">Sell Price (aUEC per unit)</label>
          <input
            id="t-price"
            type="number"
            min="0"
            bind:value={fSellPrice}
            class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label for="t-location" class="block text-sm text-gray-300 mb-1">Sell Location</label>
          <div class="relative">
            <input
              id="t-location"
              type="text"
              placeholder={$scLocations.length ? 'Search location…' : 'Sell location'}
              bind:value={fLocSearch}
              oninput={() => { fSellLocation = fLocSearch; showLocDropdown = true; }}
              onfocus={() => { showLocDropdown = true; }}
              onblur={() => setTimeout(() => { showLocDropdown = false; }, 150)}
              class="w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {#if showLocDropdown && filteredLocs.length > 0}
              <ul class="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-48 overflow-y-auto">
                {#each filteredLocs as loc (loc)}
                  <li>
                    <button type="button" onmousedown={() => { fSellLocation = loc; fLocSearch = loc; showLocDropdown = false; }}
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
          onclick={() => { showEditModal = false; editTarget = null; }}
          class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={saveEdit}
          class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
{/if}
