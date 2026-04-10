# SC Asset Manager

A lightweight, browser-based tracker for your Star Citizen in-game commodities. No account, no server — your data stays in your browser.

## Features

- **Track assets** — log items you've bought with amount, price paid, and storage location
- **Record sales** — mark assets as sold with quantity, sell location, and price; inventory updates automatically
- **Trade history** — view all past sell orders with total proceeds
- **Searchable item catalogue** — autocomplete backed by [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) (~7 000 items)
- **Searchable trading locations** — only shows locations with Commodity Trading (~225 stations)
- **Import / Export** — back up your data as JSON and restore it on any machine

## Hosting options

### GitHub Pages (free, no setup)

The app is deployed automatically to GitHub Pages on every push to `main`:

**https://m1ndgames.github.io/SC-Asset-Manager**

### Self-host with Docker

```bash
docker compose up -d
```

This pulls `ghcr.io/m1ndgames/sc-asset-manager:latest` and serves the app on **http://localhost:8080**.

## How it works

All data is stored in your browser's `localStorage` — nothing is sent to any server. The item and location databases are built from scunpacked-data at Docker/Pages build time and shipped as static JSON files, so no import step is needed.

### Switching machines

Use the **Export Data** button in the nav bar to download a JSON backup of your assets and trades. On the new machine, click **Import Data** to restore.

## Development

### Prerequisites

- Node 20+
- Python 3.12+ with a virtualenv at `.venv/`

### Setup

```bash
npm install

# Fetch item and location data from scunpacked-data
.venv/Scripts/python.exe scripts/fetch_items.py   # Windows
# or
.venv/bin/python scripts/fetch_items.py           # macOS / Linux
```

### Run

```bash
npm run dev      # http://localhost:5173
npm run build    # production build → ./build/
npm run preview  # preview production build locally
```

### Updating game data

Run `scripts/fetch_items.py` whenever a new Star Citizen patch is released and the item/location data changes, then rebuild.
