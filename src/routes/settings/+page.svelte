<script lang="ts">
  import { onMount } from 'svelte';
  import { assets, trades, firebaseUser, pbUser, userRole, nickname, uexApiKey, uexSecretKey } from '$lib/stores';
  import { get } from 'svelte/store';
  import { readStoredConfig, validateConfig, initFirebase } from '$lib/firebase';
  import { signIn, signOut, initAuthListener, destroyAuthListener } from '$lib/auth';
  import { startSync, stopSync } from '$lib/firestoreSync';
  import { setUserRole, getAllRoles, getAllProfiles } from '$lib/roleManager';
  import { readStoredPbUrl, initPocketBase, getPb } from '$lib/pocketbase';
  import { pbSignIn, pbSignOut, initPbAuthListener, destroyPbAuthListener } from '$lib/pbAuth';
  import { startPbSync, stopPbSync } from '$lib/pbSync';
  import { setPbUserRole, getAllPbRoles, getAllPbProfiles } from '$lib/pbRoleManager';
  import type { FirebaseConfig, Role } from '$lib/types';

  type Section = 'general' | 'backend' | 'export';
  type BackendProvider = 'local' | 'firebase' | 'pocketbase';

  let activeSection = $state<Section>('general');
  let backendProvider = $state<BackendProvider>('local');

  // ── Shared role UI state ──────────────────────────────────────────────────
  let roleMap = $state<Map<string, Role>>(new Map());
  let profileMap = $state<Map<string, string>>(new Map());
  let roleLoading = $state(false);
  let roleError = $state('');
  let roleSuccess = $state('');

  const ROLE_COLORS: Record<Role, string> = {
    admin: 'text-yellow-400 border-yellow-600',
    moderator: 'text-blue-400 border-blue-600',
    user: 'text-muted border-border'
  };

  // ── Firebase state ────────────────────────────────────────────────────────
  let fbConfigRaw = $state('');
  let fbConfigError = $state('');
  let fbConfigSaved = $state(false);
  let fbHasConfig = $state(false);
  let fbEmail = $state('');
  let fbPassword = $state('');
  let fbAuthError = $state('');
  let fbAuthLoading = $state(false);

  // ── PocketBase state ──────────────────────────────────────────────────────
  let pbUrlInput = $state('');
  let pbConnected = $state(false);
  let pbConnecting = $state(false);
  let pbConnectError = $state('');
  let pbEmail = $state('');
  let pbPassword = $state('');
  let pbAuthError = $state('');
  let pbAuthLoading = $state(false);

  onMount(() => {
    // Firebase
    const fbStored = readStoredConfig();
    if (fbStored) {
      fbConfigRaw = JSON.stringify(fbStored, null, 2);
      fbHasConfig = true;
      backendProvider = 'firebase';
    }

    // PocketBase
    const pbStored = readStoredPbUrl();
    if (pbStored) {
      pbUrlInput = pbStored;
      pbConnected = true;
      // Firebase takes display priority if both stored; otherwise show PB
      if (!fbStored) backendProvider = 'pocketbase';
    }
  });

  // Reset role maps when no user is signed in
  $effect(() => {
    if (!$firebaseUser && !$pbUser) {
      roleMap = new Map();
      profileMap = new Map();
    }
  });

  // Auto-load roles when admin signs in
  $effect(() => {
    if ($userRole === 'admin' && roleMap.size === 0 && profileMap.size === 0 && !roleLoading) {
      loadRoles();
    }
  });

  // ══ FIREBASE functions ════════════════════════════════════════════════════

  async function fbSaveConfig() {
    fbConfigError = '';
    fbConfigSaved = false;
    let parsed: unknown;
    try {
      const cleaned = fbConfigRaw
        .replace(/^\s*const\s+\w+\s*=\s*/, '')
        .replace(/;\s*$/, '')
        .trim();
      try { parsed = JSON.parse(cleaned); }
      catch {
        const quoted = cleaned.replace(/([{,]\s*)(\w+)(\s*):/g, '$1"$2"$3:');
        parsed = JSON.parse(quoted);
      }
    } catch {
      fbConfigError = 'Could not parse config — paste the Firebase snippet or a plain JSON object.';
      return;
    }
    if (!validateConfig(parsed)) {
      fbConfigError = 'Missing required Firebase fields (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).';
      return;
    }
    localStorage.setItem('sc_firebase_config', JSON.stringify(parsed));
    await initFirebase(parsed as FirebaseConfig);
    fbHasConfig = true;
    fbConfigSaved = true;
    await initAuthListener(
      async (uid) => { await startSync(uid); },
      () => { stopSync(); }
    );
  }

  function fbDisconnect() {
    if (!confirm('Disconnect Firebase? Your local data is kept. You will be signed out.')) return;
    signOut();
    destroyAuthListener();
    stopSync();
    localStorage.removeItem('sc_firebase_config');
    fbHasConfig = false;
    fbConfigRaw = '';
    fbConfigSaved = false;
  }

  async function fbHandleSignIn() {
    fbAuthError = '';
    fbAuthLoading = true;
    try {
      await signIn(fbEmail, fbPassword);
      fbPassword = '';
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        fbAuthError = 'Invalid email or password.';
      } else {
        fbAuthError = 'Sign in failed. Check your Firebase project settings.';
      }
    } finally {
      fbAuthLoading = false;
    }
  }

  async function fbHandleSignOut() {
    stopSync();
    await signOut();
  }

  // ══ POCKETBASE functions ══════════════════════════════════════════════════

  async function pbConnect() {
    if (!pbUrlInput.trim()) { pbConnectError = 'Enter the PocketBase URL.'; return; }
    pbConnectError = '';
    pbConnecting = true;
    try {
      const url = pbUrlInput.trim().replace(/\/$/, '');
      initPocketBase(url);
      // Quick health check
      const pb = getPb()!;
      await pb.health.check();
      localStorage.setItem('sc_pb_url', url);
      pbUrlInput = url;
      pbConnected = true;
      await initPbAuthListener(
        async () => { await startPbSync(); },
        () => { stopPbSync(); }
      );
    } catch {
      pbConnectError = 'Could not reach PocketBase. Check the URL and make sure the server is running.';
    } finally {
      pbConnecting = false;
    }
  }

  function pbDisconnect() {
    if (!confirm('Disconnect PocketBase? Your local data is kept. You will be signed out.')) return;
    pbSignOut();
    destroyPbAuthListener();
    stopPbSync();
    localStorage.removeItem('sc_pb_url');
    pbConnected = false;
    pbConnectError = '';
  }

  async function pbHandleSignIn() {
    pbAuthError = '';
    pbAuthLoading = true;
    try {
      await pbSignIn(pbEmail, pbPassword);
      pbPassword = '';
    } catch {
      pbAuthError = 'Invalid email or password.';
    } finally {
      pbAuthLoading = false;
    }
  }

  function pbHandleSignOut() {
    stopPbSync();
    pbSignOut();
  }

  // ══ Shared role management ════════════════════════════════════════════════

  async function loadRoles() {
    roleLoading = true;
    roleError = '';
    try {
      if (backendProvider === 'firebase') {
        [roleMap, profileMap] = await Promise.all([getAllRoles(), getAllProfiles()]);
      } else {
        [roleMap, profileMap] = await Promise.all([getAllPbRoles(), getAllPbProfiles()]);
      }
    } catch {
      roleError = 'Failed to load roles.';
    } finally {
      roleLoading = false;
    }
  }

  // ══ EXPORT / IMPORT ══════════════════════════════════════════════════════

  let exportMineOnly = $state(true);
  let importError = $state('');
  let importSuccess = $state('');

  const syncActive = $derived(!!$firebaseUser || !!$pbUser);

  function exportData() {
    const all = get(assets);
    const allTrades = get(trades);
    const filteredAssets = exportMineOnly && syncActive && $nickname
      ? all.filter(a => !a.loggedBy || a.loggedBy === $nickname)
      : all;
    const filteredTrades = exportMineOnly && syncActive && $nickname
      ? allTrades.filter(t => !t.loggedBy || t.loggedBy === $nickname)
      : allTrades;

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      ...(exportMineOnly && syncActive && $nickname ? { exportedBy: $nickname } : {}),
      assets: filteredAssets,
      trades: filteredTrades,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = exportMineOnly && syncActive && $nickname ? `-${$nickname}` : '';
    a.download = `sc-assets${suffix}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const myTrades = get(trades).filter(t => !syncActive || !$nickname || !t.loggedBy || t.loggedBy === $nickname);
    const headers = ['Item', 'Qty Sold', 'Buy Price/unit', 'Sell Price/unit', 'Profit', 'Location', 'Date'];
    if (syncActive) headers.push('Logged By');
    const rows = [...myTrades]
      .sort((a, b) => b.soldAt.localeCompare(a.soldAt))
      .map(t => {
        const profit = t.buyPrice != null ? (t.sellPrice - t.buyPrice) * t.amountSold : null;
        const cells = [t.item, t.amountSold, t.buyPrice ?? '', t.sellPrice, profit !== null ? profit : '', t.sellLocation, new Date(t.soldAt).toLocaleString()];
        if (syncActive) cells.push(t.loggedBy ?? '');
        return cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = syncActive && $nickname ? `-${$nickname}` : '';
    a.download = `sc-trades${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: Event) {
    importError = '';
    importSuccess = '';
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
      importSuccess = `Imported ${data.assets.length} assets and ${data.trades.length} trades.`;
    } catch {
      importError = 'Could not parse file — is it a valid SC Asset Manager export?';
    }
    input.value = '';
  }

  async function updateRole(uid: string, role: Role) {
    roleError = '';
    roleSuccess = '';
    try {
      if (backendProvider === 'firebase') {
        await setUserRole(uid, role);
      } else {
        await setPbUserRole(uid, role);
      }
      roleMap = new Map(roleMap).set(uid, role);
      roleSuccess = `Role updated for ${uid.slice(0, 8)}…`;
      setTimeout(() => (roleSuccess = ''), 3000);
    } catch {
      roleError = 'Failed to update role. Are you admin?';
    }
  }
</script>

<div class="max-w-4xl mx-auto py-2">

  <!-- Page header -->
  <div class="flex items-center gap-3 mb-8">
    <div class="w-1 h-6 bg-accent opacity-80"></div>
    <h1 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-sm font-bold tracking-widest uppercase">
      Settings
    </h1>
  </div>

  <div class="flex gap-8">

    <!-- ── Sidebar navigation ───────────────────────────────────────────────── -->
    <nav class="w-44 shrink-0 space-y-0.5">

      <button
        onclick={() => (activeSection = 'general')}
        class="w-full text-left px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors
          {activeSection === 'general'
            ? 'text-accent border-l-2 border-accent bg-surface pl-[10px]'
            : 'text-muted hover:text-text border-l-2 border-transparent pl-[10px]'}"
      >
        General
      </button>

      <button
        onclick={() => (activeSection = 'backend')}
        class="w-full text-left px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors
          {activeSection === 'backend'
            ? 'text-accent border-l-2 border-accent bg-surface pl-[10px]'
            : 'text-muted hover:text-text border-l-2 border-transparent pl-[10px]'}"
      >
        Backend
        {#if $firebaseUser || $pbUser}
          <span class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent align-middle animate-pulse"></span>
        {/if}
      </button>

      <button
        onclick={() => (activeSection = 'export')}
        class="w-full text-left px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors
          {activeSection === 'export'
            ? 'text-accent border-l-2 border-accent bg-surface pl-[10px]'
            : 'text-muted hover:text-text border-l-2 border-transparent pl-[10px]'}"
      >
        Export
      </button>

    </nav>

    <!-- ── Content area ──────────────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0 space-y-6">

      <!-- ══ GENERAL ══════════════════════════════════════════════════════════ -->
      {#if activeSection === 'general'}

        <section class="border border-border bg-surface p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">UEX Corp API</h2>
            <a href="https://uexcorp.space/api/apps" target="_blank" rel="noopener noreferrer"
              class="text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider font-semibold">
              uexcorp.space →
            </a>
          </div>

          <p class="text-xs text-muted leading-relaxed">
            Optional. The <span class="text-text">App Token</span> enables live commodity prices and best sell locations.
            The <span class="text-text">Personal Token</span> enables pushing buy/sell orders to your UEX trade log.
            Both are available from your UEX profile.
          </p>

          <div class="space-y-1.5">
            <label class="block text-xs uppercase tracking-widest text-muted font-semibold">App Token</label>
            <div class="flex gap-2 items-center">
              <input type="password" bind:value={$uexApiKey}
                placeholder="Bearer token from uexcorp.space/api/apps…"
                class="flex-1 bg-bg border border-border text-text text-xs font-mono px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
              {#if $uexApiKey}
                <button onclick={() => ($uexApiKey = '')}
                  class="px-3 py-2 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200">
                  Clear
                </button>
              {/if}
            </div>
            {#if $uexApiKey}
              <p class="text-xs text-accent font-semibold uppercase tracking-wider">Set — live prices enabled.</p>
            {/if}
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Personal Token</label>
            <div class="flex gap-2 items-center">
              <input type="password" bind:value={$uexSecretKey}
                placeholder="Personal token from your UEX profile…"
                class="flex-1 bg-bg border border-border text-text text-xs font-mono px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
              {#if $uexSecretKey}
                <button onclick={() => ($uexSecretKey = '')}
                  class="px-3 py-2 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200">
                  Clear
                </button>
              {/if}
            </div>
            {#if $uexSecretKey}
              <p class="text-xs text-accent font-semibold uppercase tracking-wider">Set — trade log push enabled.</p>
            {/if}
          </div>
        </section>

      {/if}

      <!-- ══ BACKEND ══════════════════════════════════════════════════════════ -->
      {#if activeSection === 'backend'}

        <!-- Provider selector -->
        <section class="border border-border bg-surface p-5 space-y-3">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Provider</h2>
          <div class="flex items-center gap-4">
            <select bind:value={backendProvider}
              class="bg-bg border border-border text-text text-xs px-3 py-2 focus:outline-none focus:border-accent transition-colors">
              <option value="local">Local Browser</option>
              <option value="firebase">Firebase</option>
              <option value="pocketbase">PocketBase</option>
            </select>
            {#if backendProvider === 'local'}
              <span class="text-xs text-muted font-semibold uppercase tracking-wider">Active</span>
            {:else if backendProvider === 'firebase'}
              {#if $firebaseUser}
                <span class="flex items-center gap-1.5 text-xs text-accent font-semibold uppercase tracking-wider">
                  <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                  Connected
                </span>
              {:else}
                <span class="text-xs text-muted font-semibold uppercase tracking-wider">Not connected</span>
              {/if}
            {:else if backendProvider === 'pocketbase'}
              {#if $pbUser}
                <span class="flex items-center gap-1.5 text-xs text-accent font-semibold uppercase tracking-wider">
                  <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                  Connected
                </span>
              {:else if pbConnected}
                <span class="text-xs text-muted font-semibold uppercase tracking-wider">Reachable — not signed in</span>
              {:else}
                <span class="text-xs text-muted font-semibold uppercase tracking-wider">Not connected</span>
              {/if}
            {/if}
          </div>
        </section>

        <!-- ── LOCAL BROWSER ─────────────────────────────────────────────── -->
        {#if backendProvider === 'local'}
          <p class="text-xs text-muted leading-relaxed">
            All data is stored in your browser's <span class="text-text">localStorage</span>. Nothing is sent to any server.
            Use the <span class="text-text">Export / Import</span> buttons in the nav bar to back up or transfer your data.
          </p>
          {#if fbHasConfig || pbConnected}
            <p class="text-xs text-yellow-500 font-semibold">
              A backend sync is still active. Switch to
              <span class="underline underline-offset-2 cursor-pointer" role="button" tabindex="0"
                onclick={() => (backendProvider = fbHasConfig ? 'firebase' : 'pocketbase')}
                onkeydown={(e) => e.key === 'Enter' && (backendProvider = fbHasConfig ? 'firebase' : 'pocketbase')}>
                {fbHasConfig ? 'Firebase' : 'PocketBase'}
              </span>
              above to disconnect.
            </p>
          {/if}
        {/if}

        <!-- ── FIREBASE ──────────────────────────────────────────────────── -->
        {#if backendProvider === 'firebase'}

          {#if pbConnected}
            <p class="text-xs text-yellow-500 font-semibold">
              PocketBase sync is still active. Switch to
              <span class="underline underline-offset-2 cursor-pointer" role="button" tabindex="0"
                onclick={() => (backendProvider = 'pocketbase')}
                onkeydown={(e) => e.key === 'Enter' && (backendProvider = 'pocketbase')}>PocketBase</span>
              above to disconnect.
            </p>
          {/if}

          <section class="border border-border bg-surface p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Project Config</h2>
              <a href="https://github.com/m1ndgames/SC-Asset-Manager/blob/main/FIREBASE.md" target="_blank" rel="noopener noreferrer"
                class="text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider font-semibold">
                Setup Guide →
              </a>
            </div>
            <p class="text-xs text-muted leading-relaxed">
              Create a free Firebase project, then paste the snippet from
              <span class="text-text">Project Settings → Your apps → SDK setup</span>.
              The full <span class="text-text font-mono">const firebaseConfig = {'{ … }'}</span> block or a plain JSON object both work.
            </p>
            <textarea bind:value={fbConfigRaw} rows="8"
              placeholder={'// Paste the Firebase snippet or raw JSON object\nconst firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  ...\n};'}
              class="w-full bg-bg border border-border text-text text-xs font-mono p-3 resize-none focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40">
            </textarea>
            {#if fbConfigError}<p class="text-xs text-red-400 font-semibold">{fbConfigError}</p>{/if}
            {#if fbConfigSaved}<p class="text-xs text-accent font-semibold uppercase tracking-wider">Config saved — Firebase ready.</p>{/if}
            <div class="flex gap-2">
              <button onclick={fbSaveConfig}
                class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200">
                Save & Connect
              </button>
              {#if fbHasConfig}
                <button onclick={fbDisconnect}
                  class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200">
                  Disconnect
                </button>
              {/if}
            </div>
          </section>

          {#if fbHasConfig}
            <section class="border border-border bg-surface p-5 space-y-4">
              <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Authentication</h2>
              {#if $firebaseUser}
                <div class="space-y-3">
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-text text-sm font-semibold">{$firebaseUser.email}</span>
                      <span class="text-muted text-xs font-mono">{$firebaseUser.uid}</span>
                    </div>
                    <div class="ml-auto">
                      <span class="px-2 py-0.5 border text-xs font-bold uppercase tracking-wider {$userRole ? ROLE_COLORS[$userRole] : 'text-muted border-border animate-pulse'}">
                        {$userRole ?? 'loading…'}
                      </span>
                    </div>
                  </div>
                  <div class="space-y-2 pt-1">
                    <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Nickname <span class="text-red-500">*</span></label>
                    <input type="text" bind:value={$nickname} maxlength="32" placeholder="e.g. VaporWolf"
                      class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40 {!$nickname ? 'border-yellow-700' : ''}" />
                    <p class="text-xs text-muted">Shown on assets and trades you log. Never your email.</p>
                  </div>
                  <button onclick={fbHandleSignOut}
                    class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200">
                    Sign Out
                  </button>
                </div>
              {:else}
                <div class="space-y-3">
                  <div class="space-y-2">
                    <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Email</label>
                    <input type="email" bind:value={fbEmail} placeholder="you@example.com"
                      class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Password</label>
                    <input type="password" bind:value={fbPassword} placeholder="••••••••"
                      onkeydown={(e) => e.key === 'Enter' && fbHandleSignIn()}
                      class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
                  </div>
                  {#if fbAuthError}<p class="text-xs text-red-400 font-semibold">{fbAuthError}</p>{/if}
                  <button onclick={fbHandleSignIn} disabled={fbAuthLoading}
                    class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                    {fbAuthLoading ? 'Signing in…' : 'Sign In'}
                  </button>
                </div>
              {/if}
            </section>
          {/if}

          {#if $userRole === 'admin' && $firebaseUser}
            {@render roleManagementSection()}
          {/if}

        {/if}

        <!-- ── POCKETBASE ─────────────────────────────────────────────────── -->
        {#if backendProvider === 'pocketbase'}

          {#if fbHasConfig}
            <p class="text-xs text-yellow-500 font-semibold">
              Firebase sync is still active. Switch to
              <span class="underline underline-offset-2 cursor-pointer" role="button" tabindex="0"
                onclick={() => (backendProvider = 'firebase')}
                onkeydown={(e) => e.key === 'Enter' && (backendProvider = 'firebase')}>Firebase</span>
              above to disconnect.
            </p>
          {/if}

          <section class="border border-border bg-surface p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Connection</h2>
              <a href="https://github.com/m1ndgames/SC-Asset-Manager/blob/main/POCKETBASE.md" target="_blank" rel="noopener noreferrer"
                class="text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider font-semibold">
                Setup Guide →
              </a>
            </div>
            <p class="text-xs text-muted leading-relaxed">
              Enter the URL of your self-hosted PocketBase instance (e.g. <span class="text-text font-mono">http://your-host:8090</span>).
              See <span class="text-text">POCKETBASE.md</span> for the required collection setup.
            </p>
            <div class="space-y-1.5">
              <label class="block text-xs uppercase tracking-widest text-muted font-semibold">PocketBase URL</label>
              <div class="flex gap-2">
                <input type="url" bind:value={pbUrlInput} placeholder="http://your-host:8090"
                  onkeydown={(e) => e.key === 'Enter' && pbConnect()}
                  class="flex-1 bg-bg border border-border text-text text-sm font-mono px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
                <button onclick={pbConnect} disabled={pbConnecting || pbConnected}
                  class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                  {pbConnecting ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </div>
            {#if pbConnectError}<p class="text-xs text-red-400 font-semibold">{pbConnectError}</p>{/if}
            {#if pbConnected && !pbConnectError}
              <div class="flex items-center justify-between">
                <p class="text-xs text-accent font-semibold uppercase tracking-wider">Server reachable.</p>
                <button onclick={pbDisconnect}
                  class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200">
                  Disconnect
                </button>
              </div>
            {/if}
          </section>

          {#if pbConnected}
            <section class="border border-border bg-surface p-5 space-y-4">
              <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Authentication</h2>
              {#if $pbUser}
                <div class="space-y-3">
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-text text-sm font-semibold">{$pbUser.email}</span>
                      <span class="text-muted text-xs font-mono">{$pbUser.id}</span>
                    </div>
                    <div class="ml-auto">
                      <span class="px-2 py-0.5 border text-xs font-bold uppercase tracking-wider {$userRole ? ROLE_COLORS[$userRole] : 'text-muted border-border animate-pulse'}">
                        {$userRole ?? 'loading…'}
                      </span>
                    </div>
                  </div>
                  <div class="space-y-2 pt-1">
                    <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Nickname <span class="text-red-500">*</span></label>
                    <input type="text" bind:value={$nickname} maxlength="32" placeholder="e.g. VaporWolf"
                      class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40 {!$nickname ? 'border-yellow-700' : ''}" />
                    <p class="text-xs text-muted">Shown on assets and trades you log. Never your email.</p>
                  </div>
                  <button onclick={pbHandleSignOut}
                    class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200">
                    Sign Out
                  </button>
                </div>
              {:else}
                <div class="space-y-3">
                  <div class="space-y-2">
                    <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Email</label>
                    <input type="email" bind:value={pbEmail} placeholder="you@example.com"
                      class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Password</label>
                    <input type="password" bind:value={pbPassword} placeholder="••••••••"
                      onkeydown={(e) => e.key === 'Enter' && pbHandleSignIn()}
                      class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40" />
                  </div>
                  {#if pbAuthError}<p class="text-xs text-red-400 font-semibold">{pbAuthError}</p>{/if}
                  <button onclick={pbHandleSignIn} disabled={pbAuthLoading}
                    class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                    {pbAuthLoading ? 'Signing in…' : 'Sign In'}
                  </button>
                </div>
              {/if}
            </section>
          {/if}

          {#if $userRole === 'admin' && $pbUser}
            {@render roleManagementSection()}
          {/if}

        {/if}

      {/if}<!-- end backend section -->

      <!-- ══ EXPORT ══════════════════════════════════════════════════════════ -->
      {#if activeSection === 'export'}

        <!-- JSON Export -->
        <section class="border border-border bg-surface p-5 space-y-4">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Export Data (JSON)</h2>
          <p class="text-xs text-muted leading-relaxed">
            Full backup of your assets and trades as a <span class="text-text">.json</span> file. Use this to transfer your data between devices or restore after a browser reset.
          </p>

          {#if syncActive}
            <div class="space-y-2">
              <p class="text-xs text-muted leading-relaxed">Choose which records to include in the export.</p>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input type="radio" bind:group={exportMineOnly} value={true}
                  class="accent-accent" />
                <span class="text-xs font-semibold text-text group-hover:text-accent transition-colors">
                  My records only
                  {#if $nickname}<span class="text-muted font-normal">({$nickname})</span>{/if}
                </span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input type="radio" bind:group={exportMineOnly} value={false}
                  class="accent-accent" />
                <span class="text-xs font-semibold text-text group-hover:text-accent transition-colors">All users</span>
              </label>
            </div>
          {:else}
            <p class="text-xs text-muted leading-relaxed">
              Exports all assets and trades stored in your browser.
            </p>
          {/if}

          <button onclick={exportData}
            class="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200">
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download JSON
          </button>
        </section>

        <!-- CSV Export -->
        <section class="border border-border bg-surface p-5 space-y-4">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Export Trades (CSV)</h2>
          <p class="text-xs text-muted leading-relaxed">
            Downloads your trade history as a <span class="text-text">.csv</span> file — useful for spreadsheet analysis in Excel or Google Sheets.
            {#if syncActive && $nickname}
              Only trades logged by <span class="text-text">{$nickname}</span> are included.
            {:else}
              Includes all trade records stored in your browser.
            {/if}
          </p>
          <button onclick={exportCSV}
            class="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200">
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download CSV
          </button>
        </section>

        <!-- Import -->
        <section class="border border-border bg-surface p-5 space-y-4">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Import Data</h2>
          <p class="text-xs text-muted leading-relaxed">
            Restore from a previous <span class="text-text">JSON export</span>. <span class="text-yellow-500 font-semibold">This replaces all current data.</span>
          </p>

          {#if importError}
            <p class="text-xs text-red-400 font-semibold">{importError}</p>
          {/if}
          {#if importSuccess}
            <p class="text-xs text-accent font-semibold uppercase tracking-wider">{importSuccess}</p>
          {/if}

          <label class="cursor-pointer group inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted group-hover:border-accent group-hover:text-accent transition-all duration-200">
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Choose File
            <input type="file" accept=".json,application/json" onchange={handleImport} class="sr-only" />
          </label>
        </section>

      {/if}<!-- end export section -->

    </div>
  </div>

</div>

<!-- ── Shared role management snippet ─────────────────────────────────────── -->
{#snippet roleManagementSection()}
  <section class="border border-border bg-surface p-5 space-y-4">
    <div class="flex items-center gap-3">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Role Management</h2>
      <button onclick={loadRoles}
        class="ml-auto text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider font-semibold">
        Refresh
      </button>
    </div>
    <p class="text-xs text-muted leading-relaxed">
      {#if backendProvider === 'firebase'}
        User IDs are visible in the <span class="text-text">Firebase Console → Authentication → Users</span>.
        The first admin must be seeded manually in Firestore at <span class="text-text font-mono">/roles/{'{uid}'}</span>.
      {:else}
        User IDs are visible in the <span class="text-text">PocketBase Admin UI → Collections → roles</span>.
        The first admin must be seeded manually in the <span class="text-text font-mono">roles</span> collection.
      {/if}
    </p>
    {#if roleError}<p class="text-xs text-red-400 font-semibold">{roleError}</p>{/if}
    {#if roleSuccess}<p class="text-xs text-accent font-semibold uppercase tracking-wider">{roleSuccess}</p>{/if}
    {#if roleLoading}
      <p class="text-xs text-muted uppercase tracking-wider animate-pulse">Loading…</p>
    {:else if profileMap.size === 0}
      <p class="text-xs text-muted">No users found. Users appear here after their first sign-in.</p>
    {:else}
      <div class="space-y-2">
        {#each [...profileMap.entries()] as [uid, userEmail]}
          <div class="flex items-center gap-3 border border-border px-3 py-2">
            <div class="flex flex-col gap-0.5 flex-1 min-w-0">
              <span class="text-xs text-text font-semibold truncate">{userEmail}</span>
              <span class="text-xs font-mono text-muted/50 truncate">{uid}</span>
            </div>
            <select value={roleMap.get(uid) ?? 'user'}
              onchange={(e) => updateRole(uid, (e.target as HTMLSelectElement).value as Role)}
              class="bg-bg border border-border text-text text-xs px-2 py-1 focus:outline-none focus:border-accent transition-colors shrink-0">
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        {/each}
      </div>
    {/if}
  </section>
{/snippet}
