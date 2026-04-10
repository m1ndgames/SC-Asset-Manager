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
    return $page.url.pathname.startsWith(base + path);
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

<div class="min-h-screen bg-bg text-text" style="font-family: 'Rajdhani', sans-serif;">

  <!-- Top accent line -->
  <div class="h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"></div>

  <nav class="bg-surface border-b border-border sticky top-0 z-40">
    <!-- Decorative top stripe -->
    <div class="h-px bg-gradient-to-r from-surface via-accent-dim to-surface opacity-40"></div>
    <div class="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">

      <!-- Brand -->
      <div class="flex items-center gap-3">
        <div class="w-1 h-6 bg-accent opacity-80"></div>
        <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-sm font-bold tracking-widest uppercase">
          SC Asset Manager
        </span>
      </div>

      <div class="w-px h-5 bg-border"></div>

      <!-- Nav links -->
      <a
        href="{base}/assets"
        class="text-xs font-semibold uppercase tracking-widest transition-all duration-200 {isActive('/assets')
          ? 'text-accent border-b border-accent pb-0.5'
          : 'text-muted hover:text-text'}"
      >
        Assets
      </a>
      <a
        href="{base}/trades"
        class="text-xs font-semibold uppercase tracking-widest transition-all duration-200 {isActive('/trades')
          ? 'text-accent border-b border-accent pb-0.5'
          : 'text-muted hover:text-text'}"
      >
        Trades
      </a>

      <div class="ml-auto flex items-center gap-3">
        <!-- Import -->
        <label class="cursor-pointer group">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted group-hover:border-accent group-hover:text-accent transition-all duration-200">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Import
          </span>
          <input type="file" accept=".json,application/json" onchange={handleImport} class="sr-only" />
        </label>

        <!-- Export -->
        <button
          onclick={exportData}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-accent hover:text-accent transition-all duration-200"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export
        </button>

        <div class="w-px h-4 bg-border"></div>

        <span class="text-xs text-muted" style="font-family: 'Orbitron', sans-serif; font-size: 10px;">
          {#if itemsError}
            <span class="text-yellow-500">NO ITEM DATA</span>
          {:else if $scItems.length === 0}
            <span class="opacity-50">LOADING...</span>
          {:else}
            <span class="text-accent">{$scItems.length.toLocaleString()}</span> ITEMS
          {/if}
        </span>
      </div>
    </div>
  </nav>

  {#if importError}
    <div class="bg-red-950/60 border-b border-red-900 px-6 py-2 text-xs text-red-400 text-center uppercase tracking-wider font-semibold">
      {importError}
      <button onclick={() => importError = ''} class="ml-4 text-red-500 hover:text-red-300 transition-colors">✕</button>
    </div>
  {/if}

  <main class="max-w-6xl mx-auto px-6 py-8">
    {@render children()}
  </main>

  <!-- Bottom accent line -->
  <div class="h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-20 mt-8"></div>
</div>
