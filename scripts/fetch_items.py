#!/usr/bin/env python3
"""
fetch_items.py

Downloads data from scunpacked-data and writes three files used by the app:
  - static/items.json       — purchasable items with name + type
  - static/locations.json   — names of all locations with Commodity Trading
  - static/commodities.json — resource GUID -> commodity name/key lookup

static/commodities.json exists for external integrations (see INTEGRATIONS.md).
The Star Citizen Game.log identifies traded commodities only by resourceGUID, so
a log watcher needs this table to turn a GUID into a name the app recognises.
Every resolved commodity name is also unioned into items.json so the two
vocabularies cannot drift apart.

Usage:
    python scripts/fetch_items.py

Run this locally or in CI before `npm run build`.

Item types:
  clothing   — wearable cosmetics (hats, jackets, glasses, etc.)
  armor      — armor pieces and helmets
  weapon     — FPS weapons and attachments
  commodity  — tradeable cargo (ores, drugs, harvested materials, etc.)
  consumable — usable items (food, medicine, stimulants)
  paint      — ship liveries / paint jobs
  ship       — flyable ships
  item       — everything else
"""

import io
import json
import re
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
COMMODITIES_OUT = STATIC / "commodities.json"


def extract_name(data: dict) -> str | None:
    """Try known paths in order of preference to find the display name."""
    comp = data.get("Raw", {}).get("Entity", {}).get("Components", {})
    try:
        name = (
            comp["SAttachableComponentParams"]["AttachDef"]["Localization"]["Name"]
        )
        if isinstance(name, str) and name.strip() and not name.startswith("<="):
            return name.strip()
    except (KeyError, TypeError):
        pass
    try:
        name = comp["SCItemPurchasableParams"]["displayName"]
        if isinstance(name, str) and name.strip() and not name.startswith("<=") and not name.startswith("@"):
            return name.strip()
    except (KeyError, TypeError):
        pass
    return None


def classify_type(data: dict) -> str:
    """Derive a broad item category from game component data."""
    comp = data.get("Raw", {}).get("Entity", {}).get("Components", {})

    # Explicit commodity component → definitely tradeable cargo
    if "CommodityComponentParams" in comp:
        return "commodity"

    attach = comp.get("SAttachableComponentParams", {}).get("AttachDef", {})
    t = (attach.get("Type") or "").strip()

    if t.startswith("Char_Clothing_") or t.startswith("Char_Accessory_"):
        return "clothing"

    if t.startswith("Char_Armor_") or t == "Armor":
        return "armor"

    if t in ("WeaponPersonal", "WeaponAttachment", "WeaponGun", "WeaponDefensive", "WeaponMelee"):
        return "weapon"

    # Cargo type = bulk tradeable goods (Agricium, Stims, WiDoW, etc.)
    if t == "Cargo":
        return "commodity"

    # Harvestable trophies / creature drops (Kopion Horn, hides, etc.)
    if t == "Misc" and "SEntityComponentCarryableParams" in comp:
        return "commodity"

    if t == "Food":
        return "consumable"

    if t == "Usable":
        return "consumable"

    if t == "Paints":
        return "paint"

    return "item"


def fetch_items(zf: zipfile.ZipFile) -> list[dict]:
    item_files = [
        n for n in zf.namelist()
        if "/items/" in n and n.endswith(".json")
    ]
    print(f"  Found {len(item_files)} item files")

    items: dict[str, dict] = {}  # name → {name, type}; dedup by name, keep first seen
    skipped = 0

    for fname in item_files:
        try:
            content = json.loads(zf.read(fname))
            name = extract_name(content)
            if not name or name.startswith("@"):
                skipped += 1
                continue
            if name not in items:
                items[name] = {"name": name, "type": classify_type(content)}
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            skipped += 1

    if not items:
        print("ERROR: no item names extracted — check repo structure", file=sys.stderr)
        sys.exit(1)

    print(f"  Done: {len(items)} items ({skipped} skipped)")
    return sorted(items.values(), key=lambda x: x["name"].casefold())


def fetch_ships(zf: zipfile.ZipFile) -> list[dict]:
    ship_files = [
        n for n in zf.namelist()
        if "/ships/" in n and n.endswith(".json")
    ]
    print(f"  Found {len(ship_files)} ship files")

    ships: dict[str, dict] = {}
    skipped = 0

    for fname in ship_files:
        try:
            content = json.loads(zf.read(fname))
            name = content.get("Name", "").strip()
            if not name or name.startswith("<="):
                skipped += 1
                continue
            if name not in ships:
                ships[name] = {"name": name, "type": "ship"}
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            skipped += 1

    print(f"  Done: {len(ships)} ships ({skipped} skipped)")
    return sorted(ships.values(), key=lambda x: x["name"].casefold())


PLACEHOLDER_NAME = "<= PLACEHOLDER =>"

# Upstream display names that disagree with their own siblings. Keep this table
# tiny and only for unambiguous cases — a wrong alias silently mis-labels cargo.
# Every other raw ore in commodities.json is suffixed "(Raw)"; Hephaestanite
# alone is abbreviated "(R)".
COMMODITY_NAME_ALIASES = {
    "Hephaestanite (R)": "Hephaestanite (Raw)",
}


def humanize_key(key: str) -> str:
    """Turn a CamelCase resource key into a readable name (VIPCryopod -> VIP Cryopod)."""
    s = key.replace("_", " ")
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", s)
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def resolve_commodity_name(entry: dict) -> str | None:
    """Display name for a commodity, falling back to a humanized Key.

    A handful of entries carry no usable localized name: three are literal
    placeholders and CarbonDioxide ships HTML markup ('CO<font size="%d">2</font>').
    """
    name = (entry.get("Name") or "").strip().rstrip(":").strip()
    if not (name and PLACEHOLDER_NAME not in name and "<" not in name and not name.startswith("@")):
        name = humanize_key((entry.get("Key") or "").strip())
    return COMMODITY_NAME_ALIASES.get(name, name) or None


def fetch_commodities(zf: zipfile.ZipFile) -> dict[str, dict]:
    """Build a resourceGUID -> {name, key} table from resources/commodities.json."""
    match = [n for n in zf.namelist() if n.endswith("/resources/commodities.json")]
    if not match:
        print("ERROR: resources/commodities.json not found in repo zip", file=sys.stderr)
        sys.exit(1)

    try:
        entries = json.loads(zf.read(match[0]))
    except (json.JSONDecodeError, ValueError) as e:
        print(f"ERROR: commodities.json invalid — {e}", file=sys.stderr)
        sys.exit(1)

    table: dict[str, dict] = {}
    skipped = 0
    for entry in entries:
        uuid = (entry.get("UUID") or "").strip()
        key = (entry.get("Key") or "").strip()
        name = resolve_commodity_name(entry)
        if not uuid or not name:
            skipped += 1
            continue
        table[uuid] = {"name": name, "key": key}

    if not table:
        print("ERROR: no commodities extracted — check repo structure", file=sys.stderr)
        sys.exit(1)

    print(f"  Done: {len(table)} commodities ({skipped} skipped)")
    return table


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

    seen: set[str] = set()
    locations: list[str] = []
    for loc in data:
        name = loc.get("Name", "")
        if not isinstance(name, str) or not name.strip():
            continue
        amenities = loc.get("Amenities") or []
        has_trading = any(
            a.get("DisplayName") == "Commodity Trading"
            for a in amenities
            if isinstance(a, dict)
        )
        if has_trading and name.strip() not in seen:
            seen.add(name.strip())
            locations.append(name.strip())

    if not locations:
        print("ERROR: no trading locations found — check starmap structure", file=sys.stderr)
        sys.exit(1)

    locations.sort(key=str.casefold)
    with LOCATIONS_OUT.open("w", encoding="utf-8") as f:
        json.dump(locations, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Done: {len(locations)} trading locations -> {LOCATIONS_OUT}")


def main() -> None:
    STATIC.mkdir(parents=True, exist_ok=True)

    # ── Items + Ships ─────────────────────────────────────────────────────────
    print(f"Downloading {REPO_ZIP} ...")
    try:
        with urlopen(REPO_ZIP) as resp:
            raw = resp.read()
    except URLError as e:
        print(f"ERROR: repo download failed — {e}", file=sys.stderr)
        sys.exit(1)

    print("Processing items...")
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        items = fetch_items(zf)
        print("Processing ships...")
        ships = fetch_ships(zf)
        print("Processing commodities...")
        commodities = fetch_commodities(zf)

    # Merge: ships take precedence if a name collision occurs (unlikely)
    merged: dict[str, dict] = {i["name"]: i for i in items}
    for s in ships:
        merged[s["name"]] = s

    # Union commodity display names into the item vocabulary. Asset.item and
    # Trade.item are plain display-name strings drawn from items.json, so every
    # name a log watcher can resolve from a resourceGUID must be selectable here
    # — otherwise externally written records fall outside the app's autocomplete.
    added = sorted(
        {e["name"] for e in commodities.values() if e["name"] not in merged}
    )
    for name in added:
        merged[name] = {"name": name, "type": "commodity"}
    print(f"  Unioned {len(added)} commodity name(s) missing from the item list")
    if added:
        for name in added:
            print(f"    + {name}")

    combined = sorted(merged.values(), key=lambda x: x["name"].casefold())

    with ITEMS_OUT.open("w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, separators=(",", ":"))

    with COMMODITIES_OUT.open("w", encoding="utf-8") as f:
        json.dump(commodities, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {len(commodities)} commodities -> {COMMODITIES_OUT}")

    # Print type breakdown
    from collections import Counter
    counts = Counter(i["type"] for i in combined)
    print(f"\n  Total: {len(combined)} entries")
    for t, c in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {t:12s} {c}")

    # ── Locations ────────────────────────────────────────────────────────────
    print("\nProcessing locations...")
    fetch_locations()


if __name__ == "__main__":
    main()
