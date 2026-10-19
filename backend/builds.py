"""Build planner AI (methodology modelled on YouTubers Anestic & Doomeris) + interactive map data."""
import re
import json
import asyncio
import logging
from urllib.parse import quote

import httpx

import feeds
import wiki

log = logging.getLogger("builds")

CREATORS = ["Anestic", "Doomeris"]
SLOTS = ["Helmet", "Mask", "Top", "Gloves", "Bottoms", "Shoes"]

METHODOLOGY = """You design Once Human PvE builds using the exact approach of the YouTube creators Anestic and Doomeris:
1. Start from ONE main keyword/damage engine (Shrapnel, Burn, Frost Vortex, Power Surge, Bounce, Unstable Bomber, Fast Gunner, Fortress Warfare, Bull's Eye, Weakspot/Crit, or Melee) and a main weapon whose features scale that keyword.
2. Pick key gear (the strongest legendary armor piece for that keyword) and armor sets so that set bonuses support the engine (e.g. a 4-piece + 2-piece split, or a full set), respecting the 6 slots Helmet, Mask, Top, Gloves, Bottoms, Shoes.
3. Put keyword-matching mods into the weapon and every armor slot; explain substat priorities (e.g. Crit DMG, Weakspot DMG, Elemental DMG, Status DMG) and calibration.
4. Choose a supporting combat Deviation and explain cradle/override choices only if confirmed by the context.
5. Explain a simple rotation, low-HP vs high-HP variants if relevant, and beginner-friendly vs endgame (silo/prime war/nightmare boss) usage.
Use ONLY items present in the CATALOG (use their exact slug). Use the creators' video titles/descriptions in the context as the primary reference; never invent numbers that are not in the context."""


async def _video_description(client, vid):
    try:
        p = (await client.get(f"https://www.youtube.com/watch?v={vid}", cookies={"CONSENT": "YES+1"})).text
        m = re.search(r'"attributedDescription":\{"content":"((?:[^"\\]|\\.)*)"', p)
        return json.loads(f'"{m.group(1)}"')[:1500] if m else ""
    except Exception:
        return ""


async def creator_knowledge():
    vids = []
    for ch in CREATORS:
        for q in (f"{ch} Once Human build", f"{ch} Once Human best build guide"):
            for v in await feeds.youtube_search(q, 20):
                if v["channel"].lower().startswith(ch.lower()) and v["video_id"] not in {x["video_id"] for x in vids}:
                    vids.append(v)
    by = {ch: [v for v in vids if v["channel"].lower().startswith(ch.lower())][:10] for ch in CREATORS}
    sel = by[CREATORS[0]] + by[CREATORS[1]]
    async with httpx.AsyncClient(headers=feeds.UA, timeout=20, follow_redirects=True) as c:
        descs = await asyncio.gather(*[_video_description(c, v["video_id"]) for v in sel])
    for v, d in zip(sel, descs):
        v["description"] = d
    return sel


async def catalog(db):
    out = {"weapons": [], "armor": [], "weapon_mods": [], "armor_mods": [], "deviations": []}
    async for d in db.items.find({}, {"_id": 0, "slug": 1, "category": 1, "title": 1, "subtype": 1, "rarity": 1,
                                       "features": 1, "set_effects": 1}):
        if d["category"] == "deviations" and d.get("subtype") != "Combat":
            continue
        e = {"slug": d["slug"], "t": d["title"], "type": d.get("subtype", ""), "r": d.get("rarity", "")}
        if d.get("features"):
            e["f"] = " | ".join(d["features"])[:260]
        if d.get("set_effects"):
            e["set"] = " | ".join(f"{s['pieces']}: {s['effect']}" for s in d["set_effects"])[:400]
        out[d["category"]].append(e)
    return out


def extract_json(raw: str):
    m = re.search(r"\{.*\}", raw, flags=re.S)
    return json.loads(m.group(0)) if m else None


def build_schema():
    return ('Return ONLY JSON: {"name": str, "keyword": str, "playstyle": str, "summary": str, '
            '"weapon": slug, "armor": {"Helmet": slug, "Mask": slug, "Top": slug, "Gloves": slug, "Bottoms": slug, "Shoes": slug}, '
            '"weapon_mod": slug, "armor_mods": {"Helmet": slug, ...6 slots}, "deviation": slug, '
            '"calibration": str, "substats": [str], "rotation": [str], "tips": [str], '
            '"creator_refs": [{"video_id": str, "title": str, "channel": str, "why": str}]}. '
            'For an armor slot you may use either a piece of that slot type or an "Armor Set" slug (meaning a piece of that set).')


MAPS = {"nalcott": ("Map:Nalcott", "Nalcott Island"), "main": ("Map:OnceHuman", "Once Human – Main World")}


async def map_data(region: str = "nalcott"):
    page, fallback_title = MAPS[region]
    async with httpx.AsyncClient(headers=wiki.UA, timeout=40) as c:
        r = await c.get(wiki.API, params={"action": "parse", "page": page, "prop": "wikitext", "format": "json"})
        m = json.loads(r.json()["parse"]["wikitext"]["*"])
        files = {m["mapImage"]} | {cat["icon"].replace("File:", "") for cat in m["categories"] if cat.get("icon")}
        files |= {mk["popup"]["image"].replace("File:", "") for mk in m["markers"] if mk.get("popup", {}).get("image")}
        urls = {}
        fl = list(files)
        for i in range(0, len(fl), 50):
            q = await c.get(wiki.API, params={"action": "query", "prop": "imageinfo", "iiprop": "url",
                                              "titles": "|".join(f"File:{f}" for f in fl[i:i + 50]), "format": "json"})
            for p in q.json()["query"]["pages"].values():
                if p.get("imageinfo"):
                    urls[p["title"].replace("File:", "")] = p["imageinfo"][0]["url"]
    (x0, y0), (x1, y1) = m["mapBounds"]
    img = urls.get(m["mapImage"], "")
    img = img.replace("/revision/latest", "/revision/latest/scale-to-width-down/2048") if img else ""
    cats = {cat["id"]: {"id": cat["id"], "name": cat["name"], "icon": urls.get(cat.get("icon", "").replace("File:", ""), ""), "count": 0}
            for cat in m["categories"]}
    markers = []
    for mk in m["markers"]:
        px, py = float(mk["position"][0]), float(mk["position"][1])
        nx = (px - x0) / (x1 - x0)
        ny = 1 - (py - y0) / (y1 - y0)
        pop = mk.get("popup", {})
        link = pop.get("link", {}).get("url", "")
        cat = cats.get(mk["categoryId"])
        if cat:
            cat["count"] += 1
        markers.append({
            "id": mk["id"], "cat": mk["categoryId"], "x": round(nx, 5), "y": round(ny, 5),
            "title": pop.get("title", ""), "desc": wiki.clean(pop.get("description", "")),
            "image": urls.get(pop.get("image", "").replace("File:", ""), ""),
            "wiki_url": f"{wiki.WIKI}/wiki/{quote(link.replace(' ', '_'))}" if link else "",
            "coords": f"{int(px)}, {int(py)}",
        })
    return {"region": region, "title": m.get("description") or fallback_title, "image": img, "categories": [c for c in cats.values() if c["count"]],
            "markers": markers, "source": f"{wiki.WIKI}/wiki/{page}"}
