<script>
</script>

<div class="space-y-10">

  <!-- Page heading -->
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-1 h-5 bg-accent opacity-70"></div>
      <h1 style="font-family: 'Orbitron', sans-serif;" class="text-accent text-sm font-bold tracking-widest uppercase">
        Pilot Briefing
      </h1>
    </div>
    <p class="text-text text-base leading-relaxed ml-4">
      S.C.A.M (Star Citizen Asset Manager) is a lightweight, browser-based tool for tracking your Star Citizen commodities —
      what you have, where it's stored, what you paid, and what you sold it for.
      No account required. All data stays in your browser.
    </p>
  </div>

  <!-- Section: Inventory -->
  <section class="rsi-panel border border-border">
    <div class="px-5 py-3 border-b border-border rsi-scanline flex items-center gap-3">
      <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
        01 — Inventory
      </span>
    </div>
    <div class="px-5 py-4 space-y-4 text-sm text-text leading-relaxed">
      <p>The <span class="text-accent font-semibold">Inventory</span> screen lists everything you currently hold.</p>
      <ul class="space-y-3 ml-2">
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Add Asset</span> — enter item (autocomplete, ~7 000 SC items), quantity, buy price per unit, and storage location. If the same item already exists at that location you'll be asked to merge.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Sell</span> — enter quantity, sell location, and sell price. The inventory updates immediately. The sell dialog shows your expected yield, total cost, and estimated profit. A record is created in the Trade Log.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Edit / Delete</span> — update or remove any asset at any time.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Sort & Filter</span> — click any column header to sort. Use the filter bar to search by item name.</span>
        </li>
      </ul>
    </div>
  </section>

  <!-- Section: Trade Log -->
  <section class="rsi-panel border border-border">
    <div class="px-5 py-3 border-b border-border rsi-scanline flex items-center gap-3">
      <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
        02 — Trade Log
      </span>
    </div>
    <div class="px-5 py-4 space-y-3 text-sm text-text leading-relaxed">
      <p>Every sale you make is recorded here. Columns are sortable and filterable.</p>
      <ul class="space-y-3 ml-2">
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Profit</span> — shows per-trade profit (sell price − buy price × qty), color-coded green/red. Requires a buy price to have been set on the asset.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">P&L</span> — total profit/loss across all trades, shown in the header.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">CSV Export</span> — download your full trade history as a spreadsheet-ready CSV file.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Edit / Delete</span> — correct the quantity, price, or location of any trade record.</span>
        </li>
      </ul>
    </div>
  </section>

  <!-- Section: Nav bar stats -->
  <section class="rsi-panel border border-border">
    <div class="px-5 py-3 border-b border-border rsi-scanline flex items-center gap-3">
      <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
        03 — Nav Bar
      </span>
    </div>
    <div class="px-5 py-4 space-y-3 text-sm text-text leading-relaxed">
      <ul class="space-y-3 ml-2">
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Portfolio</span> — total value of your current inventory (amount × buy price).</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Yield</span> — total aUEC earned across all recorded sales.</span>
        </li>
        <li class="flex gap-3">
          <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
          <span><span class="text-text font-semibold">Import / Export</span> — back up your data as JSON and restore it on any machine.</span>
        </li>
      </ul>
    </div>
  </section>

  <!-- Section: Item & Location data -->
  <section class="rsi-panel border border-border">
    <div class="px-5 py-3 border-b border-border rsi-scanline flex items-center gap-3">
      <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
        04 — Item &amp; Location Data
      </span>
    </div>
    <div class="px-5 py-4 space-y-3 text-sm text-text leading-relaxed">
      <p>
        Item names (~7 265 commodities) and trading locations (~225 stations with Commodity Trading) are
        sourced from <a href="https://github.com/StarCitizenWiki/scunpacked-data" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors">StarCitizenWiki/scunpacked-data</a>
        and bundled with each release. Data updates automatically when a new version is deployed after a patch.
      </p>
    </div>
  </section>

  <!-- Section: UEX Corp Integration -->
  <section class="rsi-panel border border-border">
    <div class="px-5 py-3 border-b border-border rsi-scanline flex items-center gap-3">
      <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
        05 — UEX Corp Integration
      </span>
    </div>
    <div class="px-5 py-4 space-y-4 text-sm text-text leading-relaxed">
      <p>
        Powered by <a href="https://uexcorp.space" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline underline-offset-2 transition-colors">UEX Corp</a>.
        Two tokens can be configured in <a href="/settings" class="text-accent hover:underline underline-offset-2 transition-colors">Settings</a> — get them at uexcorp.space/api/apps.
      </p>
      <div class="space-y-1">
        <p class="text-text font-semibold">App Token</p>
        <ul class="space-y-2 ml-2">
          <li class="flex gap-3">
            <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
            <span>Click any asset name to open a detail panel with live sell prices across all terminals, filterable by star system</span>
          </li>
          <li class="flex gap-3">
            <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
            <span>Estimated profit per unit and total profit based on your buy price</span>
          </li>
          <li class="flex gap-3">
            <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
            <span>Commodity flags (Illegal, Explosive, Volatile) and a direct link to the UEX item page</span>
          </li>
        </ul>
      </div>
      <div class="space-y-1">
        <p class="text-text font-semibold">Personal Token <span class="text-muted font-normal">(also required for trade push)</span></p>
        <ul class="space-y-2 ml-2">
          <li class="flex gap-3">
            <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
            <span>A <span class="text-text font-semibold">UEX</span> button appears next to each commodity in Inventory and Trade Log — click it to push the buy or sell order directly to your UEX Corp trade log</span>
          </li>
          <li class="flex gap-3">
            <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
            <span>The button turns green once a trade has been logged; clicking it again asks for confirmation before re-pushing</span>
          </li>
          <li class="flex gap-3">
            <span class="text-accent font-bold shrink-0" style="font-family: 'Orbitron', sans-serif;">+</span>
            <span>In multi-user mode, the button is only visible on records you logged yourself</span>
          </li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Section: Brand -->
  <section class="rsi-panel border border-border">
    <div class="px-5 py-3 border-b border-border rsi-scanline flex items-center gap-3">
      <span style="font-family: 'Orbitron', sans-serif;" class="text-accent text-xs font-bold uppercase tracking-widest">
        06 — SCAM? Couldn't you come up with a better name?
      </span>
    </div>
    <div class="px-5 py-4 space-y-4 text-sm text-text leading-relaxed">
      <p>I didn't even notice it initially... guess we can all be happy I didn't call it 'Star Citizen Asset Tracker'.</p>
    </div>
  </section>

  <!-- Links: GitHub + Ko-fi -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

    <!-- GitHub -->
    <a
      href="https://github.com/m1ndgames/SC-Asset-Manager"
      target="_blank"
      rel="noopener noreferrer"
      class="rsi-panel border border-border bg-surface hover:border-border-bright hover:bg-surface-2 transition-all duration-200 group flex items-center gap-4 px-5 py-4"
    >
      <svg class="w-8 h-8 text-muted group-hover:text-accent transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
      <div>
        <p style="font-family: 'Orbitron', sans-serif;" class="text-xs font-bold uppercase tracking-widest text-accent mb-0.5">Source Code</p>
        <p class="text-xs text-muted">m1ndgames/SC-Asset-Manager</p>
      </div>
    </a>

    <!-- Discord -->
    <a
      href="https://discord.gg/aqpMgrVva2"
      target="_blank"
      rel="noopener noreferrer"
      class="rsi-panel border border-border bg-surface hover:border-border-bright hover:bg-surface-2 transition-all duration-200 group flex items-center gap-4 px-5 py-4"
    >
      <svg class="w-8 h-8 text-muted group-hover:text-accent transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
      <div>
        <p style="font-family: 'Orbitron', sans-serif;" class="text-xs font-bold uppercase tracking-widest text-accent mb-0.5">Discord</p>
        <p class="text-xs text-muted">Join the community</p>
      </div>
    </a>

    <!-- Ko-fi -->
    <a
      href="https://ko-fi.com/m1ndio"
      target="_blank"
      rel="noopener noreferrer"
      class="rsi-panel border border-border bg-surface hover:border-border-bright hover:bg-surface-2 transition-all duration-200 group flex items-center gap-4 px-5 py-4"
    >
      <svg class="w-8 h-8 text-muted group-hover:text-accent transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 2.692.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
      </svg>
      <div>
        <p style="font-family: 'Orbitron', sans-serif;" class="text-xs font-bold uppercase tracking-widest text-accent mb-0.5">Support the Project</p>
        <p class="text-xs text-muted">ko-fi.com/m1ndio</p>
      </div>
    </a>
  </div>

</div>
