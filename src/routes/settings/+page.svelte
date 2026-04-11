<script lang="ts">
  import { onMount } from 'svelte';
  import { firebaseUser, userRole, nickname } from '$lib/stores';
  import { readStoredConfig, validateConfig, initFirebase, isFirebaseReady } from '$lib/firebase';
  import { signIn, signOut, initAuthListener, destroyAuthListener } from '$lib/auth';
  import { startSync, stopSync } from '$lib/firestoreSync';
  import { setUserRole, getAllRoles, getAllProfiles } from '$lib/roleManager';
  import type { FirebaseConfig, Role } from '$lib/types';

  // ── Config section ─────────────────────────────────────────────────────────
  let configRaw = $state('');
  let configError = $state('');
  let configSaved = $state(false);
  let hasConfig = $state(false);

  // ── Auth section ──────────────────────────────────────────────────────────
  let email = $state('');
  let password = $state('');
  let authError = $state('');
  let authLoading = $state(false);

  // ── Role management section ───────────────────────────────────────────────
  let roleMap = $state<Map<string, Role>>(new Map());
  let profileMap = $state<Map<string, string>>(new Map()); // uid → email
  let roleLoading = $state(false);
  let roleError = $state('');
  let roleSuccess = $state('');

  onMount(() => {
    const stored = readStoredConfig();
    if (stored) {
      configRaw = JSON.stringify(stored, null, 2);
      hasConfig = true;
    }
  });

  // React to userRole resolving after mount (auth is async)
  $effect(() => {
    if ($userRole === 'admin' && roleMap.size === 0 && !roleLoading) {
      loadRoles();
    }
  });

  // ── Config ────────────────────────────────────────────────────────────────
  async function saveConfig() {
    configError = '';
    configSaved = false;
    let parsed: unknown;
    try {
      // Strip JS variable declaration and trailing semicolon
      const cleaned = configRaw
        .replace(/^\s*const\s+\w+\s*=\s*/, '')
        .replace(/;\s*$/, '')
        .trim();
      // Try raw JSON first, then fall back to JS object literal (unquoted keys)
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const quoted = cleaned.replace(/([{,]\s*)(\w+)(\s*):/g, '$1"$2"$3:');
        parsed = JSON.parse(quoted);
      }
    } catch {
      configError = 'Could not parse config — paste the Firebase snippet or a plain JSON object.';
      return;
    }
    if (!validateConfig(parsed)) {
      configError = 'Missing required Firebase fields (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).';
      return;
    }
    localStorage.setItem('sc_firebase_config', JSON.stringify(parsed));
    await initFirebase(parsed as FirebaseConfig);
    hasConfig = true;
    configSaved = true;

    // Wire up auth listener now that Firebase is ready
    await initAuthListener(
      async (uid) => { await startSync(uid); },
      () => { stopSync(); }
    );
  }

  function disconnect() {
    if (!confirm('Disconnect Firebase? Your local data is kept. You will be signed out.')) return;
    signOut();
    destroyAuthListener();
    stopSync();
    localStorage.removeItem('sc_firebase_config');
    hasConfig = false;
    configRaw = '';
    configSaved = false;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function handleSignIn() {
    authError = '';
    authLoading = true;
    try {
      await signIn(email, password);
      password = '';
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        authError = 'Invalid email or password.';
      } else {
        authError = 'Sign in failed. Check your Firebase project settings.';
      }
    } finally {
      authLoading = false;
    }
  }

  async function handleSignOut() {
    stopSync();
    await signOut();
  }

  // ── Role management ───────────────────────────────────────────────────────
  async function loadRoles() {
    roleLoading = true;
    roleError = '';
    try {
      [roleMap, profileMap] = await Promise.all([getAllRoles(), getAllProfiles()]);
    } catch {
      roleError = 'Failed to load roles.';
    } finally {
      roleLoading = false;
    }
  }

  async function updateRole(uid: string, role: Role) {
    roleError = '';
    roleSuccess = '';
    try {
      await setUserRole(uid, role);
      roleMap = new Map(roleMap).set(uid, role);
      roleSuccess = `Role updated for ${uid.slice(0, 8)}…`;
      setTimeout(() => (roleSuccess = ''), 3000);
    } catch {
      roleError = 'Failed to update role. Are you admin?';
    }
  }

  const ROLE_COLORS: Record<Role, string> = {
    admin: 'text-yellow-400 border-yellow-600',
    moderator: 'text-blue-400 border-blue-600',
    user: 'text-muted border-border'
  };
</script>

<div class="max-w-2xl mx-auto space-y-8 py-2">

  <!-- Page header -->
  <div class="flex items-center gap-3">
    <div class="w-1 h-6 bg-accent opacity-80"></div>
    <h1 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-sm font-bold tracking-widest uppercase">
      Firebase Sync
    </h1>
    {#if $firebaseUser}
      <span class="ml-auto flex items-center gap-1.5 text-xs text-accent font-semibold uppercase tracking-wider">
        <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
        Connected
      </span>
    {:else}
      <span class="ml-auto text-xs text-muted font-semibold uppercase tracking-wider">Standalone</span>
    {/if}
  </div>

  <!-- ── Section 1: Firebase config ───────────────────────────────────────── -->
  <section class="border border-border bg-surface p-5 space-y-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Firebase Project Config</h2>

    <p class="text-xs text-muted leading-relaxed">
      Create a free Firebase project, then paste the snippet from
      <span class="text-text">Project Settings → Your apps → SDK setup</span>.
      The full <span class="text-text font-mono">const firebaseConfig = {'{ … }'}</span> block or a plain JSON object both work.
      Everyone sharing this config syncs to the same Firestore database.
    </p>

    <textarea
      bind:value={configRaw}
      rows="8"
      placeholder={'// Paste the Firebase snippet or raw JSON object\nconst firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  ...\n};'}
      class="w-full bg-bg border border-border text-text text-xs font-mono p-3 resize-none focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40"
    ></textarea>

    {#if configError}
      <p class="text-xs text-red-400 font-semibold">{configError}</p>
    {/if}
    {#if configSaved}
      <p class="text-xs text-accent font-semibold uppercase tracking-wider">Config saved — Firebase ready.</p>
    {/if}

    <div class="flex gap-2">
      <button
        onclick={saveConfig}
        class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200"
      >
        Save & Connect
      </button>
      {#if hasConfig}
        <button
          onclick={disconnect}
          class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200"
        >
          Disconnect
        </button>
      {/if}
    </div>
  </section>

  <!-- ── Section 2: Authentication ────────────────────────────────────────── -->
  {#if hasConfig}
    <section class="border border-border bg-surface p-5 space-y-4">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Authentication</h2>

      {#if $firebaseUser}
        <!-- Signed in -->
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
          <!-- Nickname -->
          <div class="space-y-2 pt-1">
            <label class="block text-xs uppercase tracking-widest text-muted font-semibold">
              Nickname <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                bind:value={$nickname}
                maxlength="32"
                placeholder="e.g. VaporWolf"
                class="flex-1 bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40 {!$nickname ? 'border-yellow-700' : ''}"
              />
            </div>
            <p class="text-xs text-muted">Shown on assets and trades you log. Never your email.</p>
          </div>

          <button
            onclick={handleSignOut}
            class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted hover:border-red-700 hover:text-red-400 transition-all duration-200"
          >
            Sign Out
          </button>
        </div>
      {:else}
        <!-- Sign in form -->
        <div class="space-y-3">
          <div class="space-y-2">
            <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Email</label>
            <input
              type="email"
              bind:value={email}
              placeholder="you@example.com"
              class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-xs uppercase tracking-widest text-muted font-semibold">Password</label>
            <input
              type="password"
              bind:value={password}
              placeholder="••••••••"
              onkeydown={(e) => e.key === 'Enter' && handleSignIn()}
              class="w-full bg-bg border border-border text-text text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors placeholder:text-muted/40"
            />
          </div>

          {#if authError}
            <p class="text-xs text-red-400 font-semibold">{authError}</p>
          {/if}

          <button
            onclick={handleSignIn}
            disabled={authLoading}
            class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {authLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      {/if}
    </section>
  {/if}

  <!-- ── Section 3: Role management (admin only) ───────────────────────────── -->
  {#if $userRole === 'admin'}
    <section class="border border-border bg-surface p-5 space-y-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Role Management</h2>
        <button
          onclick={loadRoles}
          class="ml-auto text-xs text-muted hover:text-accent transition-colors uppercase tracking-wider font-semibold"
        >
          Refresh
        </button>
      </div>

      <p class="text-xs text-muted leading-relaxed">
        User IDs are visible in the <span class="text-text">Firebase Console → Authentication → Users</span>.
        The first admin must be seeded manually in Firestore at <span class="text-text font-mono">/roles/{'{uid}'}</span>.
      </p>

      {#if roleError}
        <p class="text-xs text-red-400 font-semibold">{roleError}</p>
      {/if}
      {#if roleSuccess}
        <p class="text-xs text-accent font-semibold uppercase tracking-wider">{roleSuccess}</p>
      {/if}

      {#if roleLoading}
        <p class="text-xs text-muted uppercase tracking-wider animate-pulse">Loading…</p>
      {:else if roleMap.size === 0}
        <p class="text-xs text-muted">No role documents found in Firestore.</p>
      {:else}
        <div class="space-y-2">
          {#each [...roleMap.entries()] as [uid, role]}
            <div class="flex items-center gap-3 border border-border px-3 py-2">
              <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                <span class="text-xs text-text font-semibold truncate">
                  {profileMap.get(uid) ?? '—'}
                </span>
                <span class="text-xs font-mono text-muted/50 truncate">{uid}</span>
              </div>
              <select
                value={role}
                onchange={(e) => updateRole(uid, (e.target as HTMLSelectElement).value as Role)}
                class="bg-bg border border-border text-text text-xs px-2 py-1 focus:outline-none focus:border-accent transition-colors shrink-0"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- ── Firestore rules reminder ──────────────────────────────────────────── -->
  <section class="border border-border bg-surface p-5 space-y-3">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">Firestore Security Rules</h2>
    <p class="text-xs text-muted leading-relaxed">
      Deploy <span class="text-text font-mono">firestore.rules</span> from the repo root to your Firebase project:
    </p>
    <pre class="bg-bg border border-border text-xs text-muted p-3 overflow-x-auto font-mono leading-relaxed">firebase deploy --only firestore:rules</pre>
  </section>

</div>
