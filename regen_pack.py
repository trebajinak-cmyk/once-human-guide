#!/usr/bin/env python3
"""Regenerate ohg_data.js from module JSON files. Sets OHG_META.version from version.json data_version."""
from __future__ import annotations
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
MODULES = {
    "weapons": "weapons.json",
    "armor": "armor.json",
    "mods": "mods.json",
    "deviations": "deviations.json",
    "creatures": "creatures.json",
    "animals": "animals.json",
    "plants": "plants.json",
    "flowers": "flowers.json",
    "materials": "materials.json",
    "locations": "map_locations.json",
    "recipes": "recipes.json",
    "quests": "quests.json",
    "events": "events.json",
    "npcs": "npcs.json",
    "bosses": "bosses.json",
    "scenarios": "scenarios.json",
    "fish": "fish.json",
}

def main() -> None:
    ver = json.loads((BASE / "version.json").read_text(encoding="utf-8"))
    data_version = ver.get("data_version", "unknown")
    patch = ver.get("patch_target", "3.0.7")
    data = {}
    counts = {}
    for key, fname in MODULES.items():
        rows = json.loads((BASE / fname).read_text(encoding="utf-8"))
        if not isinstance(rows, list):
            raise SystemExit(f"{fname}: expected list")
        data[key] = rows
        counts[key] = len(rows)
    total = sum(counts.values())
    meta = {"version": data_version, "patch": patch, "entities": total, "counts": counts}
    pack = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    meta_s = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    (BASE / "ohg_data.js").write_text(
        f"window.OHG_DATA={pack};\nwindow.OHG_META={meta_s};\n",
        encoding="utf-8",
    )
    print(json.dumps({"entities": total, "version": data_version, "file": "ohg_data.js"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
