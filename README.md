# SC Asset Manager

A lightweight, browser-based tracker for your Star Citizen in-game commodities. No account, no server — your data stays in your browser.

## Features

- **Track assets** — log items you've bought with amount, price paid, storage location, and quality (0–1000) for commodities (SC 4.7.1+)
- **Record sales** — mark assets as sold with quantity, sell location, and price; inventory updates automatically
- **Trade history** — view all past sell orders with P&L summary per trade and overall
- **Searchable item catalogue** — autocomplete backed by [StarCitizenWiki/scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data) (~7 500 items including ships, typed by category)
- **Searchable trading locations** — only shows locations with Commodity Trading (~225 stations)
- **Export / Import** — back up assets and trades as JSON (full restore) or CSV (spreadsheet analysis) via **Settings → Export**
- **UEX Corp integration** *(opt-in)* — click any asset to see live sell prices, best locations by system, profit estimates, and commodity flags; push buy/sell orders directly to your UEX Corp trade log — all powered by [UEX Corp API](https://uexcorp.space/api/documentation/)
- **Firebase sync** *(opt-in)* — share a live database across multiple users with role-based access control (`user`, `moderator`, `admin`); see [FIREBASE.md](FIREBASE.md) for setup
- **PocketBase sync** *(opt-in)* — self-hosted alternative to Firebase; full real-time sync and role management on your own server; see [POCKETBASE.md](POCKETBASE.md) for setup

## Support

If this tool saves you time, consider buying me a coffee: **https://ko-fi.com/m1ndio**

## Hosting options

### Hosted (free, no setup)

The app is deployed automatically to Cloudflare Pages on every push to `main`:

**https://s-c-a-m.me**

### Self-host with Docker

```bash
docker compose up -d
```

This pulls `ghcr.io/m1ndgames/sc-asset-manager:latest` and serves the app on **http://localhost:8080**.

Optionally uncomment the `pocketbase` service in `docker-compose.yml` to run PocketBase alongside the app on the same host.

## How it works

By default all data is stored in your browser's `localStorage` — nothing is sent to any server. The item and location databases are built from scunpacked-data at build time and shipped as static JSON files.

### Switching machines

Use **Settings → Export** to download a JSON backup of your assets and trades. On the new machine, import the file to restore everything.

### UEX Corp live prices & trade log

Click any asset name in the Inventory to open a detail panel. With a free UEX Corp **App Token** added in **Settings → General**, the panel shows live sell prices across all terminals (filterable by star system), profit per unit vs your buy price, and a direct link to the UEX Corp item page.

With an additional **Personal Token** (also in Settings), a UEX button appears next to each commodity row in both Inventory and Trade Log. Clicking it pushes the buy or sell order to your personal UEX Corp trade log. The button turns green once a trade has been logged, and re-pushing asks for confirmation. In multi-user mode, only the user who logged the record sees the push button.

Get both tokens at [uexcorp.space/api/apps](https://uexcorp.space/api/apps).

### Multi-user / group play

Two optional sync backends are available via **Settings → Backend**:

- **Firebase** — bring your own Firebase project; free tier is more than enough for a group. See [FIREBASE.md](FIREBASE.md) for the full setup guide.
- **PocketBase** — fully self-hosted, single binary or Docker container. See [POCKETBASE.md](POCKETBASE.md) for the full setup guide.

Both backends provide real-time sync across all members. Each action is attributed to a nickname. Roles (`user`, `moderator`, `admin`) control what each member can edit or delete — admins can manage roles directly from the Settings page.

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
