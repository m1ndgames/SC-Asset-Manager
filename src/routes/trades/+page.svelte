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

  function uec(n: number) { return n.toLocaleString() + ' aUEC'; }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
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

  let sorted = $derived([...$trades].sort((a, b) => b.soldAt.localeCompare(a.soldAt)));
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
  </div>

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
              <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted">Item</th>
              <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted">Qty</th>
              <th class="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted">Sell Price</th>
              <th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted">Yield</th>
              <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted">Location</th>
              <th class="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted">Date</th>
              <th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-muted">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each sorted as trade (trade.id)}
              <tr class="bg-bg hover:bg-surface transition-colors duration-150">
                <td class="px-4 py-3 font-semibold text-text">{trade.item}</td>
                <td class="px-4 py-3 text-text font-bold" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {trade.amountSold.toLocaleString()}
                </td>
                <td class="hidden sm:table-cell px-4 py-3 text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {trade.sellPrice > 0 ? uec(trade.sellPrice) : '—'}
                </td>
                <td class="px-4 py-3 text-accent font-bold" style="font-family: 'Orbitron', sans-serif; font-size: 11px;">
                  {trade.sellPrice > 0 ? uec(trade.amountSold * trade.sellPrice) : '—'}
                </td>
                <td class="hidden md:table-cell px-4 py-3 text-muted text-xs">{trade.sellLocation || '—'}</td>
                <td class="hidden md:table-cell px-4 py-3 text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 10px;">
                  {fmtDate(trade.soldAt)}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-2">
                    <button onclick={() => openEdit(trade)}
                      class="px-3 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-text hover:text-text transition-all duration-150">
                      Edit
                    </button>
                    <button onclick={() => deleteTrade(trade.id)}
                      class="px-3 py-1 border border-border text-muted text-xs uppercase tracking-wider hover:border-red-700 hover:text-red-500 transition-all duration-150">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

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
