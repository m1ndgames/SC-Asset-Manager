#!/usr/bin/env python3
"""
fetch_items.py

Downloads data from scunpacked-data and writes two files used by the app:
  - static/items.json     — display names of all purchasable items
  - static/locations.json — names of all locations with Commodity Trading

Usage:
    python scripts/fetch_items.py

Run this locally or in CI before `npm run build`.
"""

import io
import json
import sys
import zipfile
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

REPO_ZIP = "https://github.com/StarCitizenWiki/scunpacked-data/archive/refs/heads/master.zip"
STARMAP_URL = "https://raw.githubusercontent.com/StarCitizenWiki/scunpacked-data/refs/heads/master/starmap.json"

STATIC = Path(__file__).parent.parent / "static"
ITEMS_OUT = STATIC / "items.json"
LOCATIONS_OUT = STATIC / "locations.json"


def extract_item_name(data: dict) -> str | None:
    """Try known paths in order of preference to find the display name."""
    try:
        name = (
            data["Raw"]["Entity"]["Components"]
            ["SAttachableComponentParams"]["AttachDef"]["Localization"]["Name"]
        )
        if isinstance(name, str) and name.strip():
            return name.strip()
    except (KeyError, TypeError):
        pass
    try:
        name = (
            data["Raw"]["Entity"]["Components"]
            ["SCItemPurchasableParams"]["displayName"]
        )
        if isinstance(name, str) and name.strip():
            return name.strip()
    except (KeyError, TypeError):
        pass
    return None


def fetch_items(zf: zipfile.ZipFile) -> None:
    item_files = [
        n for n in zf.namelist()
        if "/items/" in n and n.endswith(".json")
    ]
    print(f"  Found {len(item_files)} item files")

    names: set[str] = set()
    skipped = 0
    for fname in item_files:
        try:
            content = json.loads(zf.read(fname))
            name = extract_item_name(content)
            if name:
                names.add(name)
            else:
                skipped += 1
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            skipped += 1

    if not names:
        print("ERROR: no item names extracted — check repo structure", file=sys.stderr)
        sys.exit(1)

    sorted_names = sorted(names, key=str.casefold)
    with ITEMS_OUT.open("w", encoding="utf-8") as f:
        json.dump(sorted_names, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Done: {len(sorted_names)} items ->{ITEMS_OUT}")
    if skipped:
        print(f"  (skipped {skipped} files with no recognisable name)")


def fetch_locations() -> None:
    print(f"Fetching {STARMAP_URL} ...")
    try:
        with urlopen(STARMAP_URL) as resp:
            data: list[dict] = json.loads(resp.read())
    except URLError as e:
        print(f"ERROR: starmap download failed — {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: starmap JSON invalid — {e}", file=sys.stderr)
        sys.exit(1)

    locations: list[str] = []
    for loc in data:
        name = loc.get("name", "")
        if not isinstance(name, str) or not name.strip():
            continue
        amenities = loc.get("amenities") or []
        has_trading = any(
            a.get("displayName") == "Commodity Trading"
            for a in amenities
            if isinstance(a, dict)
        )
        if has_trading:
            locations.append(name.strip())

    if not locations:
        print("ERROR: no trading locations found — check starmap structure", file=sys.stderr)
        sys.exit(1)

    locations.sort(key=str.casefold)
    with LOCATIONS_OUT.open("w", encoding="utf-8") as f:
        json.dump(locations, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Done: {len(locations)} trading locations ->{LOCATIONS_OUT}")


def main() -> None:
    STATIC.mkdir(parents=True, exist_ok=True)

    # ── Items ────────────────────────────────────────────────────────────────
    print(f"Downloading {REPO_ZIP} ...")
    try:
        with urlopen(REPO_ZIP) as resp:
            raw = resp.read()
    except URLError as e:
        print(f"ERROR: repo download failed — {e}", file=sys.stderr)
        sys.exit(1)

    print("Processing items...")
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        fetch_items(zf)

    # ── Locations ────────────────────────────────────────────────────────────
    print("Processing locations...")
    fetch_locations()


if __name__ == "__main__":
    main()
