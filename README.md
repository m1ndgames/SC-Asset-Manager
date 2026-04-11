# SC Asset Manager

A lightweight, browser-based tracker for your Star Citizen in-game commodities. No account, no server — your data stays in your browser.

## Features

- **Track assets** — log items you've bought with amount, price paid, and storage location
- **Record sales** — mark assets as sold with quantity, sell location, and price; inventory updates automatically
- **Trade history** — view all past sell orders with total proceeds and P&L summary
- **Searchable item catalogue** — autocomplete backed by [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) (~7 000 items)
- **Searchable trading locations** — only shows locations with Commodity Trading (~225 stations)
- **CSV export** — download your full trade history as a spreadsheet-ready CSV file
- **Import / Export** — back up your data as JSON and restore it on any machine
- **Firebase sync** *(opt-in)* — share a live database across multiple users with role-based access control; see [FIREBASE.md](FIREBASE.md) for setup

## Support

If this tool saves you time, consider buying me a coffee: **https://ko-fi.com/m1ndio**

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

By default all data is stored in your browser's `localStorage` — nothing is sent to any server. The item and location databases are built from scunpacked-data at Docker/Pages build time and shipped as static JSON files.

### Switching machines

Use the **Export Data** button in the nav bar to download a JSON backup of your assets and trades. On the new machine, click **Import Data** to restore.

### Multi-user / group play

Enable optional Firebase sync via the **Sync** settings page. All members share a live Firestore database and see each other's assets and trades in real time. Each action is attributed to a nickname. Roles (`user`, `moderator`, `admin`) control what each member can do — see [FIREBASE.md](FIREBASE.md) for the full setup guide.

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
