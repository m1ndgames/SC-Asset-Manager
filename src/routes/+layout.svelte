<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { assets, trades, scItems, scLocations } from '$lib/stores';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { base } from '$app/paths';

  let { children } = $props();

  let itemsError = $state(false);
  let importError = $state('');

  onMount(async () => {
    const [itemsRes, locationsRes] = await Promise.allSettled([
      fetch(`${base}/items.json`),
      fetch(`${base}/locations.json`)
    ]);

    if (itemsRes.status === 'fulfilled' && itemsRes.value.ok) {
      scItems.set(await itemsRes.value.json());
    } else {
      itemsError = true;
    }

    if (locationsRes.status === 'fulfilled' && locationsRes.value.ok) {
      scLocations.set(await locationsRes.value.json());
    }
  });

  function isActive(path: string) {
    return $page.url.pathname.startsWith(path);
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function exportData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets: get(assets),
      trades: get(trades)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sc-assets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────────
  async function handleImport(event: Event) {
    importError = '';
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.assets) || !Array.isArray(data.trades)) {
        importError = 'Invalid file — expected assets and trades arrays.';
        input.value = '';
        return;
      }
      if (!confirm(`This will replace your current data with ${data.assets.length} assets and ${data.trades.length} trades. Continue?`)) {
        input.value = '';
        return;
      }
      assets.set(data.assets);
      trades.set(data.trades);
    } catch {
      importError = 'Could not parse file — is it a valid SC Asset Manager export?';
    }
    input.value = '';
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100">
  <nav class="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
      <span class="font-bold text-blue-400 tracking-wide">SC Asset Manager</span>

      <a
        href="/assets"
        class="text-sm transition-colors {isActive('/assets') ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}"
      >
        Assets
      </a>
      <a
        href="/trades"
        class="text-sm transition-colors {isActive('/trades') ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}"
      >
        Trades
      </a>

      <div class="ml-auto flex items-center gap-2">
        <!-- Import -->
        <label class="cursor-pointer">
          <span class="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 hover:text-white transition-colors">
            Import Data
          </span>
          <input type="file" accept=".json,application/json" onchange={handleImport} class="sr-only" />
        </label>

        <!-- Export -->
        <button
          onclick={exportData}
          class="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 hover:text-white transition-colors"
        >
          Export Data
        </button>

        <span class="text-xs text-gray-600">|</span>

        <span class="text-xs text-gray-500">
          {#if itemsError}
            <span class="text-yellow-500">item data unavailable</span>
          {:else if $scItems.length === 0}
            loading items…
          {:else}
            {$scItems.length.toLocaleString()} items
          {/if}
        </span>
      </div>
    </div>
  </nav>

  {#if importError}
    <div class="bg-red-900/50 border-b border-red-700 px-4 py-2 text-sm text-red-300 text-center">
      {importError}
      <button onclick={() => importError = ''} class="ml-3 text-red-400 hover:text-red-200">✕</button>
    </div>
  {/if}

  <main class="max-w-6xl mx-auto px-4 py-6">
    {@render children()}
  </main>
</div>
