# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Asset Manager is a browser-based Star Citizen commodity tracker. It is a fully client-side SPA — no backend, no login. All user data (assets and trades) is persisted in `localStorage`. Item and location data is fetched from [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) at build time and shipped as static JSON files.

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
| `scItems` | `string[]` | no (fetched on load) |
| `scLocations` | `string[]` | no (fetched on load) |

### Routes

| Route | Purpose |
|---|---|
| `/` | redirects to `/assets` |
| `/assets` | add / edit / delete assets; sell modal creates a Trade and reduces asset quantity |
| `/trades` | trade history; edit / delete records |

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
