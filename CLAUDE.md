# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Asset Manager is a browser-based Star Citizen commodity tracker. It is a fully client-side SPA — no backend. All user data (assets and trades) is persisted in `localStorage` by default. Item and location data is fetched from [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) at build time and shipped as static JSON files.

**Optional Firebase sync** — users can bring their own Firebase project config to share a live Firestore database across a group. Data is stored in shared top-level collections (`/assets`, `/trades`). Authentication is Firebase Email/Password. Roles (`user`, `moderator`, `admin`) are stored in `/roles/{uid}` and enforced in the UI. See `FIREBASE.md` for the full setup guide and `firestore.rules` for the security rules.

## Tech Stack

- **SvelteKit 2** with **Svelte 5** — use runes syntax throughout (`$state`, `$derived`, `$props`); stores are still `svelte/store` writables accessed via `$storeName` in templates
- **Tailwind CSS v4** via `@tailwindcss/vite` — no `tailwind.config.js`; import in `src/app.css` with `@import "tailwindcss"`
- **Dual adapter** — `@sveltejs/adapter-cloudflare` when `CF_PAGES=1` (Cloudflare Pages deploy), `@sveltejs/adapter-static` with `fallback: 'index.html'` otherwise (Docker / local dev)
- **SSR disabled globally** — `src/routes/+layout.ts` exports `ssr = false`; never use server-side APIs
- **TypeScript** throughout

## Architecture

### Data flow

```
scripts/fetch_items.py
  → static/items.json       (~7 476 items as {name,type}[], incl. ships)
  → static/locations.json   (225 trading locations, string[])
        ↓
+layout.svelte fetches both on mount via Promise.allSettled
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
| `firebaseUser` | `User \| null` | no (set by auth listener) |
| `userRole` | `Role \| null` | no (fetched on sign-in) |
| `migrationPending` | `boolean` | no (set by firestoreSync) |

### Routes

| Route | Purpose |
|---|---|
| `/` | redirects to `/assets` |
| `/assets` | add / edit / delete assets; sell modal; Mine filter; type filter; click item name → UEX detail popup; UEX buy push button per commodity row |
| `/trades` | trade history; edit / delete records; CSV export; Mine filter; UEX sell push button per commodity row |
| `/settings` | Firebase config, sign-in/out, nickname, role management (admin only); UEX App Token + Personal Token |
| `/info` | static usage guide (formerly `/howto`) |

### Firebase lib files (`src/lib/`)

| File | Purpose |
|---|---|
| `firebase.ts` | init, `getDb()`, `getFirebaseAuth()`, config helpers |
| `auth.ts` | `signIn`, `signOut`, `initAuthListener` — fetches role on sign-in |
| `firestoreSync.ts` | `startSync` / `stopSync` — real-time listeners on `/assets` and `/trades`; migration flow |
| `roleManager.ts` | `setUserRole`, `getAllRoles`, `getAllProfiles` |

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

`svelte.config.js` checks `process.env.CF_PAGES` to select the adapter. The Cloudflare deploy workflow sets `CF_PAGES=1`; Docker and local dev leave it unset. There is no `BASE_PATH` — the app is served from the root of `https://s-c-a-m.me`.

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
| Cloudflare Pages | push to `main` | `.github/workflows/pages.yml`, `CF_PAGES=1`, deploys to `s-c-a-m.me` |
| Docker (ghcr.io) | push to `main` or `v*` tag | `.github/workflows/docker.yml`, multi-stage Dockerfile |

End users self-host via `docker-compose.yml` (port 8080) or use the Pages URL.
