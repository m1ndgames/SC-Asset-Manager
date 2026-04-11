# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Asset Manager is a browser-based Star Citizen commodity tracker. It is a fully client-side SPA — no backend. All user data (assets and trades) is persisted in `localStorage` by default. Item and location data is fetched from [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) at build time and shipped as static JSON files.

**Optional Firebase sync** — users can bring their own Firebase project config to share a live Firestore database across a group. Data is stored in shared top-level collections (`/assets`, `/trades`). Authentication is Firebase Email/Password. Roles (`user`, `moderator`, `admin`) are stored in `/roles/{uid}` and enforced in the UI. See `FIREBASE.md` for the full setup guide and `firestore.rules` for the security rules.

## Tech Stack

- **SvelteKit 2** with **Svelte 5** — use runes syntax throughout (`$state`, `$derived`, `$props`); stores are still `svelte/store` writables accessed via `$storeName` in templates
- **Tailwind CSS v4** via `@tailwindcss/vite` — no `tailwind.config.js`; import in `src/app.css` with `@import "tailwindcss"`
- **`@sveltejs/adapter-static`** with `fallback: 'index.html'` for SPA routing
- **SSR disabled globally** — `src/routes/+layout.ts` exports `ssr = false`; never use server-side APIs
- **TypeScript** throughout

## Architecture

### Data flow

```
scripts/fetch_items.py
  → static/items.json       (7 265 item names, string[])
  → static/locations.json   (225 trading locations, string[])
        ↓
+layout.svelte fetches both on mount via Promise.allSettled
        ↓
scItems / scLocations stores (plain writable, NOT localStorage-backed)
```

User data (`assets`, `trades`) is held in localStorage-backed stores defined in `src/lib/stores.ts`.

### Stores (`src/lib/stores.ts`)

| Store | Type | Persisted |
|---|---|---|
| `assets` | `Asset[]` | localStorage |
| `trades` | `Trade[]` | localStorage |
| `nickname` | `string` | localStorage |
| `scItems` | `string[]` | no (fetched on load) |
| `scLocations` | `string[]` | no (fetched on load) |
| `firebaseUser` | `User \| null` | no (set by auth listener) |
| `userRole` | `Role \| null` | no (fetched on sign-in) |
| `migrationPending` | `boolean` | no (set by firestoreSync) |

### Routes

| Route | Purpose |
|---|---|
| `/` | redirects to `/assets` |
| `/assets` | add / edit / delete assets; sell modal creates a Trade and reduces asset quantity; Mine filter |
| `/trades` | trade history; edit / delete records; CSV export; Mine filter |
| `/settings` | Firebase config, sign-in/out, nickname, role management (admin only) |
| `/howto` | static usage guide |

### Firebase lib files (`src/lib/`)

| File | Purpose |
|---|---|
| `firebase.ts` | init, `getDb()`, `getFirebaseAuth()`, config helpers |
| `auth.ts` | `signIn`, `signOut`, `initAuthListener` — fetches role on sign-in |
| `firestoreSync.ts` | `startSync` / `stopSync` — real-time listeners on `/assets` and `/trades`; migration flow |
| `roleManager.ts` | `setUserRole`, `getAllRoles`, `getAllProfiles` |

### Base path

`svelte.config.js` reads `process.env.BASE_PATH` (defaults to `""`). The GitHub Pages workflow sets it to `/SC-Asset-Manager`. All static fetches in `+layout.svelte` use the `base` import from `$app/paths` — keep this consistent when adding new static fetches.

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
| GitHub Pages | push to `main` | `.github/workflows/pages.yml`, `BASE_PATH=/SC-Asset-Manager` |
| Docker (ghcr.io) | push to `main` or `v*` tag | `.github/workflows/docker.yml`, multi-stage Dockerfile |

End users self-host via `docker-compose.yml` (port 8080) or use the Pages URL.
