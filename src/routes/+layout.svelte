<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { trades, scItems, scLocations, firebaseUser, pbUser, userRole, migrationPending, migrationBackend, nickname, triggerAddAsset } from '$lib/stores';
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { readStoredConfig, initFirebase } from '$lib/firebase';
  import { initAuthListener, destroyAuthListener } from '$lib/auth';
  import { startSync, stopSync, migrateLocalToFirestore, skipMigration } from '$lib/firestoreSync';
  import { readStoredPbUrl, initPocketBase } from '$lib/pocketbase';
  import { initPbAuthListener, destroyPbAuthListener } from '$lib/pbAuth';
  import { startPbSync, stopPbSync, migrateToPocketBase, skipPbMigration } from '$lib/pbSync';

  let { children } = $props();

  let itemsError = $state(false);

  let currentUid = $state<string | null>(null);
  let currentPbUserId = $state<string | null>(null);

  let anyUserActive = $derived(!!$firebaseUser || !!$pbUser);

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

    // Firebase — only if the user has saved a config
    const fbConfig = readStoredConfig();
    if (fbConfig) {
      await initFirebase(fbConfig);
      await initAuthListener(
        async (uid) => {
          currentUid = uid;
          await startSync(uid);
        },
        () => {
          currentUid = null;
          stopSync();
        }
      );
    }

    // PocketBase — only if the user has saved a URL
    const pbUrlStored = readStoredPbUrl();
    if (pbUrlStored) {
      initPocketBase(pbUrlStored);
      await initPbAuthListener(
        async (userId) => {
          currentPbUserId = userId;
          await startPbSync();
        },
        () => {
          currentPbUserId = null;
          stopPbSync();
        }
      );
    }
  });

  onDestroy(() => {
    destroyAuthListener();
    stopSync();
    destroyPbAuthListener();
    stopPbSync();
  });

  function isActive(path: string) {
    return $page.url.pathname.startsWith(base + path);
  }


</script>

<div class="min-h-screen bg-bg text-text" style="font-family: 'Rajdhani', sans-serif;">

  <!-- Top accent line -->
  <div class="h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"></div>

  <nav class="bg-surface border-b border-border sticky top-0 z-40">
    <!-- Decorative top stripe -->
    <div class="h-px bg-gradient-to-r from-surface via-accent-dim to-surface opacity-40"></div>
    <div class="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3 sm:gap-6">

      <!-- Brand -->
      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
        <div class="w-1 h-6 bg-accent opacity-80"></div>
        <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs sm:text-sm font-bold tracking-widest uppercase hidden xs:block sm:block">
          S.C.A.M
        </span>
      </div>

      <div class="w-px h-5 bg-border hidden sm:block"></div>

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
      <a
        href="{base}/info"
        class="text-xs font-semibold uppercase tracking-widest transition-all duration-200 {isActive('/howto')
          ? 'text-accent border-b border-accent pb-0.5'
          : 'text-muted hover:text-text'}"
      >
        Info
      </a>
      <a
        href="{base}/settings"
        class="relative text-xs font-semibold uppercase tracking-widest transition-all duration-200 {isActive('/settings')
          ? 'text-accent border-b border-accent pb-0.5'
          : 'text-muted hover:text-text'}"
      >
        Settings
        {#if anyUserActive}
          <span class="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-accent"></span>
        {/if}
      </a>

      <div class="ml-auto">
        {#if isActive('/assets')}
          <button
            onclick={() => triggerAddAsset.set(true)}
            class="px-4 py-1.5 border border-accent text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-bg transition-all duration-200"
          >
            + Add Asset
          </button>
        {/if}
      </div>
    </div>
  </nav>

  {#if anyUserActive && !$nickname}
    <div class="bg-yellow-950/40 border-b border-yellow-800/60 px-6 py-2 flex items-center justify-center gap-3 text-xs">
      <span class="text-yellow-400 font-semibold uppercase tracking-wider">Sync active — set a nickname so your actions are attributed</span>
      <a href="{base}/settings" class="px-3 py-1 border border-yellow-700 text-yellow-400 hover:bg-yellow-800/40 transition-all duration-200 font-semibold uppercase tracking-wider">
        Set Nickname
      </a>
    </div>
  {/if}

  {#if $migrationPending}
    {@const isFirebase = $migrationBackend === 'firebase'}
    <div class="bg-accent/10 border-b border-accent/40 px-6 py-2.5 flex items-center justify-center gap-4 text-xs">
      <span class="text-accent font-semibold uppercase tracking-wider">
        Local data detected — push to {isFirebase ? 'Firebase' : 'PocketBase'}?
      </span>
      <button
        onclick={() => isFirebase ? migrateLocalToFirestore(currentUid!) : migrateToPocketBase()}
        class="px-3 py-1 border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 font-semibold uppercase tracking-wider"
      >Push</button>
      <button
        onclick={() => isFirebase ? skipMigration(currentUid!) : skipPbMigration()}
        class="px-3 py-1 border border-border text-muted hover:border-text hover:text-text transition-all duration-200 font-semibold uppercase tracking-wider"
      >Skip</button>
    </div>
  {/if}

  <main class="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
    {@render children()}
  </main>

  <!-- Bottom accent line -->
  <div class="h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-20 mt-8"></div>
</div>
