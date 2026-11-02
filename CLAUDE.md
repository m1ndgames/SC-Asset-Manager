# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC-AssetManager is a browser-based Star Citizen commodity tracker. It is a fully client-side SPA — no backend. All user data (assets and trades) is persisted in `localStorage` by default. Item and location data is fetched from [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) at build time and shipped as static JSON files.

**Optional sync backend** — users can share a live database across a group using either **Firebase Firestore** or a self-hosted **PocketBase**. Both store data in shared top-level collections (`assets`, `trades`) with Email/Password auth and roles (`user`, `moderator`, `admin`) in a `roles` collection, enforced in the UI. See `FIREBASE.md` + `firestore.rules`, and `POCKETBASE.md`.

The two backends are **parallel implementations with no shared abstraction** (see the lib table below). Selection is **implicit**, derived from which localStorage key is present — `sc_firebase_config` for Firebase, `sc_pb_url` for PocketBase — and `+layout.svelte` initializes each independently. The `BackendProvider` type in `settings/+page.svelte` is component-local UI state, not a store, and is not consulted by the sync engines. Configuring both at once is not prevented and is not supported.

**External writers** — because there is no server in front of the database, an external program that signs in as a group member can write assets and trades directly, and the app's realtime listeners pick them up with no app-side change. This is how the Game.log watcher integration works; there is no API endpoint. `INTEGRATIONS.md` is the contract: field/unit semantics, document-id rules, deterministic UUIDv5 ids for idempotency, buy/sell semantics, and the `source` field. Two invariants that contract depends on: `Trade.assetId` is **write-only** (stored and round-tripped, never dereferenced), so orphan trades are legal; and `Asset.buyPrice`/`Trade.sellPrice` are denominated in that record's own `unit`, not in SCU.

## Tech Stack

- **SvelteKit 3** with **Svelte 5** — use runes syntax throughout (`$state`, `$derived`, `$props`); stores are still `svelte/store` writables accessed via `$storeName` in templates
- **No `svelte.config.js`** — SvelteKit 3 takes its config as options to the `sveltekit()` plugin in `vite.config.ts` (adapter, prerender)
- **`#lib` subpath imports, not `$lib`** — the alias is gone; import as `#lib/stores.js` (extension required), mapped by the `imports` field in `package.json`
- **`$app/state`, not `$app/stores`** — `page` is a rune-based object, so write `page.url`, not `$page.url`
- **Node 22.17+** required by SvelteKit 3 (workflows and the Dockerfile build stage run Node 26)
- **Tailwind CSS v4** via `@tailwindcss/vite` — no `tailwind.config.js`; import in `src/app.css` with `@import "tailwindcss"`
- **Dual adapter** — `@sveltejs/adapter-cloudflare` when `CF_PAGES=1` (Cloudflare Pages deploy), `@sveltejs/adapter-static` with `fallback: 'index.html'` otherwise (Docker / local dev)
- **SSR disabled globally** — `src/routes/+layout.ts` exports `ssr = false`; never use server-side APIs
- **TypeScript** throughout

## Architecture

### Data flow

```
scripts/fetch_items.py
  → static/items.json       (~8 100 items as {name,type}[], incl. ships + commodities)
  → static/locations.json   (~219 trading locations, string[])
  → static/commodities.json (206 commodities as {resourceGUID: {name,key}})
                            NOT fetched by the app — published for external
                            writers, which only see a resourceGUID in Game.log.
                            Its names are unioned into items.json so the two
                            vocabularies cannot drift (see INTEGRATIONS.md).
        ↓
+layout.svelte fetches items.json + locations.json on mount via Promise.allSettled
        ↓
scItems / scLocations stores (plain writable, NOT localStorage-backed)
```

`items.json` entries carry a `type` field (`clothing | armor | weapon | commodity | consumable | paint | ship | item`) derived at build time from `AttachDef.Type` and component presence in scunpacked-data. Ships come from the `ships/` directory (root-level `Name` field). This type is used both for the asset-view type-filter UI and for routing UEX API lookups to the correct endpoint.

User data (`assets`, `trades`) is held in localStorage-backed stores defined in `src/lib/stores.ts`.

### Cargo unit support

Commodity assets and trades carry an optional `unit?: CargoUnit` field (`'SCU' | 'cSCU' | 'μSCU'`). When present, quantities are displayed with the unit label and the sell modal shows a unit toggle. Helper functions in `src/routes/assets/+page.svelte`:

- `toMicroSCU(amount, unit)` — converts any unit to μSCU for cross-unit arithmetic (1 SCU = 1 000 000 μSCU, 1 cSCU = 10 000 μSCU)
- `fromMicroSCU(uSCU, unit)` — inverse
- `toSCU(amount, unit?)` — converts to SCU for UEX trade push (`scu` param)

`Asset.unit` is the buy unit (set when item type is `commodity`). `Trade.unit` is the sell unit; `Trade.buyUnit` is the asset's unit at sale time. Both may differ (e.g. bought 1 SCU, sold 1 cSCU). The profit calculation in the trade table uses `amountSold` and `sellPrice`/`buyPrice` — these are all in the sell unit, so cross-unit profit display is approximate for mixed-unit trades.

### Stores (`src/lib/stores.ts`)

| Store | Type | Persisted |
|---|---|---|
| `assets` | `Asset[]` | localStorage |
| `trades` | `Trade[]` | localStorage |
| `nickname` | `string` | localStorage |
| `uexApiKey` | `string` | localStorage |
| `uexSecretKey` | `string` | localStorage |
| `uexLoggedIds` | `string[]` | localStorage |
| `scItems` | `ScItem[]` | no (fetched on load) |
| `scLocations` | `string[]` | no (fetched on load) |
| `pbUrl` | `string` | localStorage |
| `firebaseUser` | `User \| null` | no (set by auth listener) |
| `pbUser` | `Record<string, any> \| null` | no (set by PB auth listener) |
| `userRole` | `Role \| null` | no (fetched on sign-in; **shared by both backends** — last listener to fire wins) |
| `migrationPending` | `boolean` | no (set by either sync engine) |
| `migrationBackend` | `'firebase' \| 'pocketbase' \| null` | no (which engine raised the migration prompt) |
| `triggerAddAsset` | `boolean` | no (nav bar → assets page "Add Asset" trigger) |

### Routes

| Route | Purpose |
|---|---|
| `/` | redirects to `/assets` |
| `/assets` | add / edit / delete assets; sell modal; Mine filter; type filter; click item name → UEX detail popup; UEX buy push button per commodity row |
| `/trades` | trade history; edit / delete records; CSV export; Mine filter; UEX sell push button per commodity row |
| `/settings` | backend selection (Firebase config / PocketBase URL), sign-in/out, nickname, role management (admin only); UEX App Token + Personal Token; JSON import/export + trade CSV export |
| `/info` | static usage guide (formerly `/howto`) |

### Sync backend lib files (`src/lib/`)

Two mirrored implementations, one per backend. There is no common interface.

| File | Purpose |
|---|---|
| `firebase.ts` | init, `getDb()`, `getFirebaseAuth()`, config helpers |
| `auth.ts` | `signIn`, `signOut`, `initAuthListener` — fetches role on sign-in |
| `firestoreSync.ts` | `startSync` / `stopSync` — realtime listeners on `/assets` and `/trades`; migration flow |
| `roleManager.ts` | `setUserRole`, `getAllRoles`, `getAllProfiles` |
| `pocketbase.ts` | init, `getPb()`, `readStoredPbUrl()`, `toPbId()` |
| `pbAuth.ts` | `pbSignIn`, `pbSignOut`, `initPbAuthListener` |
| `pbSync.ts` | `startPbSync` / `stopPbSync`; `recordTo*` / `*ToRecord` mappers; migration flow |
| `pbRoleManager.ts` | `getPbUserRole`, `setPbUserRole`, `getAllPbRoles`, `getAllPbProfiles`, `upsertPbProfile` |

**PocketBase ids** — PB rejects hyphenated UUIDs as record ids, so a record carries
both a mangled `id` from `toPbId()` and the original UUID in `app_id`; readers prefer
`app_id`. Any new field must be added to the `recordTo*` mappers **and** to the
collection schema in `POCKETBASE.md`, or PocketBase discards it on write and the
mapper drops it on read.

**Both engines write a changed-only diff** (previous-value `Map` + `JSON.stringify`
compare) and refresh that map on the echo-skip path when a remote snapshot arrives.
Do not revert either to rewriting the whole collection: that reopens a lost-update
window against concurrent and external writers.

**Role gating is keyed on `$firebaseUser`** in `assets/+page.svelte` and
`trades/+page.svelte`, so PocketBase-only users currently get standalone-mode
permissions. Known behaviour, not intent.

### UEX Corp lib (`src/lib/uex.ts`)

Client for the [UEX Corp API v2](https://uexcorp.space/api/documentation/) with module-level in-memory cache (commodities/items/terminals: 1 h, prices: 30 min). Key exports:

| Export | Purpose |
|---|---|
| `findEntity(apiKey, name, scType?)` | Search UEX for an item by name; routes to `/commodities` or `/items` based on `scType` hint |
| `fetchCommodityPrices(apiKey, id)` | Prices for a commodity from `/commodities_prices` |
| `fetchItemPrices(apiKey, id)` | Prices for an item from `/items_prices` |
| `topSellLocations(prices, n)` | Returns top N terminals sorted by sell price |
| `uexEntityUrl(entity)` | Constructs the correct UEX Corp page URL (`?name=slug`) |
| `fetchTerminals(apiKey)` | All terminals from `/terminals/`, cached 1 h |
| `findTerminal(apiKey, locationName)` | Fuzzy-match a scunpacked location name to a UEX terminal; handles L-point codes (e.g. `"ARC-L1 Wide Forest Station"` → `"Admin - ARC-L1"`) |
| `submitTrade(apiKey, secretKey, params)` | POST to `/user_trades_add/`; requires both App Token (Bearer) and Personal Token (`secret_key` header); returns `id_user_trade` |

`findEntity` routing rules (via `scType` from `ScItem.type`):
- `clothing | armor | weapon` → skip `/commodities`, query `/items` only
- `commodity | consumable` → skip `/items`, query `/commodities` only
- anything else → try `/commodities` first, fall back to `/items`

**UEX trade push** — commodity rows in Inventory and Trade Log show a UEX button when `uexSecretKey` is set. The push resolves `findEntity` + `findTerminal`, calls `submitTrade`, and stores the returned `id_user_trade` on the record (`uexBuyId` / `uexSellId`). Button shows `↑ UEX` (unlogged, muted border) or `✓ UEX` (logged, solid green background). Re-push asks for confirmation. In Firebase mode the button is hidden on records logged by other users (`loggedBy !== $nickname`).

### Base path

`vite.config.ts` checks `process.env.CF_PAGES` to select the adapter. The Cloudflare deploy workflow sets `CF_PAGES=1`; Docker and local dev leave it unset. There is no `BASE_PATH` — the app is served from the root of `https://sc-assetmanager.org` (also `https://s-c-a-m.me`).

## Commands

```bash
# Fetch game data (run before building when scunpacked-data has updated)
.venv/Scripts/python.exe scripts/fetch_items.py   # Windows
.venv/bin/python scripts/fetch_items.py           # macOS / Linux

# Dev
npm run dev      # http://localhost:5173
npm run build    # production build → ./build/
npm run preview  # preview production build

# Docker
docker build -t sc-asset-manager .
docker compose up
```

## Deployment

| Target | Trigger | Config |
|---|---|---|
| Cloudflare Pages | push to `main` | `.github/workflows/pages.yml`, `CF_PAGES=1`, deploys to `sc-assetmanager.org` / `s-c-a-m.me` |
| Docker (ghcr.io) | push to `main` or `v*` tag | `.github/workflows/docker.yml`, multi-stage Dockerfile |

End users self-host via `docker-compose.yml` (port 8080) or use the Pages URL.
