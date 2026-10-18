"""Once Human fandom wiki sync + wikitext parsing (single source of verified data)."""
import re
import asyncio
import logging
from datetime import datetime, timezone
from urllib.parse import quote

import httpx

log = logging.getLogger("wiki")

WIKI = "https://once-human.fandom.com"
API = f"{WIKI}/api.php"
UA = {"User-Agent": "OnceHumanGuideApp/1.0 (companion app)"}

CATEGORIES = {
    "weapons": "Weapon",
    "armor": "Armor",
    "deviations": "Deviation",
    "weapon_mods": "Weapon Mod",
    "armor_mods": "Armor Mod",
}
EXCLUDE = {"Blueprints", "Weapons", "Armor", "Weapon", "Deviation", "Weapon Mod", "Armor Mod"}
WEAPON_CLASSES = ["Assault Rifle", "Sniper Rifle", "Shotgun", "SMG", "LMG", "Pistol", "Crossbow",
                  "Heavy Melee", "Melee", "Sword", "Club"]
RARITIES = ["Legendary", "Epic", "Rare", "Common"]
STYLES = ["Operator", "Beyonder", "Juggernaut", "Wanderer", "Huntsman", "Standard", "Morphic"]
DROP_SECTIONS = {"trivia", "see also", "notes and references", "references", "gallery", "notes", "variants gallery"}

STAT_LABELS = {
    "dmg": ("DMG", ""), "fire_rate": ("Fire Rate", " RPM"), "magazine_capacity": ("Magazine", ""),
    "weakspot_dmg": ("Weakspot DMG", "%"), "crit_rate": ("Crit Rate", "%"), "crit_dmg": ("Crit DMG", "%"),
    "weight": ("Weight", ""), "durability": ("Durability", ""), "hp": ("HP", ""),
    "pollution_resist": ("Pollution Resist", ""), "psi_intensity": ("Psi Intensity", ""),
    "armor_type": ("Slot", ""), "weapon_type": ("Weapon Type", ""), "mod_type": ("Mod Slot", ""),
    "type": ("Type", ""), "utility": ("Utility", ""), "ammo": ("Ammo", ""), "ammo_type": ("Ammo", ""),
    "stability": ("Stability", ""), "accuracy": ("Accuracy", ""), "range": ("Range", ""),
    "reload_speed": ("Reload Speed", ""),
}
SKIP_KEYS = {"thumbnail", "thumbnail-caption", "name", "quote", "variants", "rarity", "style",
             "weapon_features", "armor_features", "status_effects", "image", "caption", "dungeons"}


def slugify(title: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
    return s or "item"


def _strip_templates(t: str) -> str:
    prev = None
    while prev != t:
        prev = t
        t = re.sub(r"\{\{[^{}]*\}\}", "", t)
    return t


def _table_to_lines(t: str) -> str:
    def conv(m):
        body = m.group(1)
        rows = re.split(r"\n\|-[^\n]*", body)
        out = []
        for r in rows:
            cells = []
            for line in r.split("\n"):
                line = line.strip()
                if not line or line.startswith("|+") or (not line.startswith("|") and not line.startswith("!")):
                    if cells and line and not line.startswith("{|"):
                        cells[-1] += " " + line
                    continue
                for c in re.split(r"\|\||!!", line[1:]):
                    c = re.sub(r'^\s*[a-zA-Z\-]+\s*=\s*"[^"]*"\s*\|', "", c)
                    cells.append(c.strip())
            cells = [c for c in cells if c]
            if cells:
                out.append(" — ".join(cells))
        return "\n".join(out)
    return re.sub(r"\{\|[^\n]*\n(.*?)\n\|\}", conv, t, flags=re.S)


def clean(t: str, title: str = "") -> str:
    if not t:
        return ""
    t = t.replace("{{PAGENAME}}", title)
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", t)
    t = re.sub(r"\[\[:?Category:[^\]|]*\|([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", t)
    t = _strip_templates(t)
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"</?div[^>]*>", "\n", t)
    t = _table_to_lines(t)
    t = re.sub(r"'{2,}", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"__[A-Z]+__", "", t)
    t = re.sub(r"^[*#]+:?\s*", "• ", t, flags=re.M)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    return t.strip()


def extract_infobox(wt: str):
    i = wt.find("{{Infobox")
    if i < 0:
        return {}, wt
    depth, j = 0, i
    while j < len(wt) - 1:
        if wt[j:j + 2] == "{{":
            depth += 1
            j += 2
            continue
        if wt[j:j + 2] == "}}":
            depth -= 1
            j += 2
            if depth == 0:
                break
            continue
        j += 1
    body = wt[i + 2:j - 2]
    rest = wt[:i] + wt[j:]
    params, buf, d1, d2 = [], "", 0, 0
    k = 0
    while k < len(body):
        two = body[k:k + 2]
        if two == "{{":
            d1 += 1; buf += two; k += 2; continue
        if two == "}}":
            d1 -= 1; buf += two; k += 2; continue
        if two == "[[":
            d2 += 1; buf += two; k += 2; continue
        if two == "]]":
            d2 -= 1; buf += two; k += 2; continue
        if body[k] == "|" and d1 == 0 and d2 == 0:
            params.append(buf); buf = ""; k += 1; continue
        buf += body[k]; k += 1
    params.append(buf)
    box = {}
    for p in params[1:]:
        if "=" in p:
            key, val = p.split("=", 1)
            box[key.strip().lower()] = val.strip()
    return box, rest


def split_sections(wt: str, title: str):
    parts = re.split(r"^(={2,4})\s*(.*?)\s*\1\s*$", wt, flags=re.M)
    sections = []
    for idx in range(1, len(parts) - 2, 3):
        level = len(parts[idx])
        head = clean(parts[idx + 1], title)
        raw = parts[idx + 2]
        sections.append({"title": head, "level": level, "raw": raw})
    return sections


def bullets(text: str):
    out = []
    for line in text.split("\n"):
        line = line.strip().lstrip("*#:•").strip()
        if line and line.lower() not in ("key effect:", "tba"):
            out.append(line)
    return out


def parse_page(title: str, wt: str, categories, thumb: str, category_key: str, touched: str, revid):
    box, rest = extract_infobox(wt)
    cats = [c.replace("Category:", "") for c in categories]
    rarity = clean(box.get("rarity", ""), title) or next((r for r in RARITIES if r in cats), "")
    style = clean(box.get("style", ""), title) or next((s for s in STYLES if s in cats), "")
    if style in ("???", "TBA"):
        style = next((s for s in STYLES if s in cats), "")
    subtype = ""
    if category_key == "weapons":
        subtype = next((c for c in WEAPON_CLASSES if c in cats), clean(box.get("weapon_type", ""), title))
    elif category_key == "armor":
        subtype = "Armor Set" if title.lower().endswith("set") or "set (armor)" in title.lower() else clean(box.get("armor_type", ""), title) or "Armor"
    elif category_key in ("weapon_mods", "armor_mods"):
        subtype = clean(box.get("mod_type", ""), title)
    elif category_key == "deviations":
        subtype = clean(box.get("type", ""), title)

    stats = []
    for k, v in box.items():
        if k in SKIP_KEYS or k.startswith("env_"):
            continue
        val = clean(v, title)
        if not val or val in ("TBA", "???"):
            continue
        label, unit = STAT_LABELS.get(k, (k.replace("_", " ").title(), ""))
        if unit and not val.endswith(unit.strip()):
            val = f"{val}{unit}"
        stats.append({"key": k, "label": label, "value": val})
    env = [k.replace("env_", "").replace("redlight", "red light").title() for k, v in box.items() if k.startswith("env_") and v.strip() not in ("", "0")]
    if env:
        stats.append({"key": "environment", "label": "Containment Mood", "value": ", ".join(env)})

    features = []
    for fk in ("weapon_features", "armor_features", "status_effects"):
        if box.get(fk):
            features += bullets(clean(box[fk], title))

    sections, set_effects, summary = [], [], ""
    have = {s["label"].lower() for s in stats}
    for s in split_sections(rest, title):
        if s["title"].lower() in DROP_SECTIONS:
            continue
        txt = clean(s["raw"], title)
        if s["title"].lower() == "set effects":
            for line in txt.split("\n"):
                cells = [c.strip() for c in line.split(" — ")]
                if len(cells) >= 2 and cells[0][:1].isdigit():
                    set_effects.append({"pieces": cells[0], "effect": " ".join(cells[1:])})
            continue
        if "basic stats" in s["title"].lower() or "endless dream" in s["title"].lower():
            for line in txt.split("\n"):
                m = re.match(r"^[•*]?\s*([A-Za-z .]+):\s*(.+)$", line.strip())
                if m and m.group(2).strip() not in ("TBA", "None") and m.group(1).strip().lower() not in have:
                    stats.append({"key": slugify(m.group(1)), "label": m.group(1).strip(), "value": m.group(2).strip()})
                    have.add(m.group(1).strip().lower())
            continue
        if not txt or txt.upper() == "TBA" or len(txt) < 3:
            continue
        if s["title"].lower() == "summary" and not summary:
            summary = txt
            continue
        if s["title"].lower() == "core effect":
            if not features:
                features = bullets(txt)
            continue
        sections.append({"title": s["title"], "text": txt[:4000]})

    if set_effects:
        features = [f for f in features if not re.match(r"^\d\s*[-—]", f)]
    image = thumb or (f"{WIKI}/wiki/Special:FilePath/{quote(box.get('thumbnail', '').replace(' ', '_'))}" if box.get("thumbnail") else "")
    quote_txt = clean(box.get("quote", ""), title)
    slug = slugify(title)
    search = " ".join([title, subtype, rarity, style, summary, " ".join(features)]).lower()
    return {
        "slug": slug, "category": category_key, "title": title, "image": image, "rarity": rarity,
        "style": style, "subtype": subtype, "quote": quote_txt, "summary": summary, "stats": stats,
        "features": features, "set_effects": set_effects, "sections": sections,
        "wiki_url": f"{WIKI}/wiki/{quote(title.replace(' ', '_'))}", "wiki_updated": touched,
        "revid": revid, "search": search, "synced_at": datetime.now(timezone.utc).isoformat(),
    }


async def _members(client: httpx.AsyncClient, cat: str):
    r = await client.get(API, params={"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}",
                                      "cmlimit": 500, "cmnamespace": 0, "format": "json"})
    return [m["title"] for m in r.json()["query"]["categorymembers"] if m["title"] not in EXCLUDE]


async def fetch_pages(client: httpx.AsyncClient, titles):
    """Returns dict title -> {wikitext, categories, thumb, touched, revid}."""
    out = {}
    for i in range(0, len(titles), 40):
        batch = titles[i:i + 40]
        params = {"action": "query", "prop": "revisions|pageimages|categories|info", "rvprop": "content|ids",
                  "rvslots": "main", "pithumbsize": 800, "pilimit": 50, "cllimit": "max", "clshow": "!hidden",
                  "titles": "|".join(batch), "format": "json", "redirects": 1}
        data = (await client.get(API, params=params)).json()
        pages = data.get("query", {}).get("pages", {})
        for p in pages.values():
            if "missing" in p or not p.get("revisions"):
                continue
            rev = p["revisions"][0]
            wt = rev.get("slots", {}).get("main", {}).get("*", "")
            out[p["title"]] = {
                "wikitext": wt, "categories": [c["title"] for c in p.get("categories", [])],
                "thumb": p.get("thumbnail", {}).get("source", ""), "touched": p.get("touched", ""),
                "revid": rev.get("revid"),
            }
    return out


async def sync_all(db):
    started = datetime.now(timezone.utc)
    counts = {}
    async with httpx.AsyncClient(headers=UA, timeout=40) as client:
        for key, cat in CATEGORIES.items():
            try:
                titles = await _members(client, cat)
                pages = await fetch_pages(client, titles)
                n = 0
                for title, p in pages.items():
                    doc = parse_page(title, p["wikitext"], p["categories"], p["thumb"], key, p["touched"], p["revid"])
                    await db.items.update_one({"slug": doc["slug"], "category": key}, {"$set": doc}, upsert=True)
                    n += 1
                counts[key] = n
            except Exception as e:  # network/wiki hiccup: keep previous data
                log.exception("sync %s failed: %s", key, e)
                counts[key] = -1
    meta = {"_id": "sync", "last_sync": datetime.now(timezone.utc).isoformat(), "counts": counts,
            "duration_s": (datetime.now(timezone.utc) - started).total_seconds(), "source": WIKI}
    await db.meta.replace_one({"_id": "sync"}, meta, upsert=True)
    log.info("wiki sync done %s", counts)
    return meta


async def wiki_article(client: httpx.AsyncClient, title: str):
    pages = await fetch_pages(client, [title])
    if not pages:
        return None
    t, p = next(iter(pages.items()))
    box, rest = extract_infobox(p["wikitext"])
    secs = []
    lead = clean(re.split(r"^==", rest, maxsplit=1, flags=re.M)[0], t)
    if lead and len(lead) > 20:
        secs.append({"title": "Overview", "text": lead[:4000]})
    for s in split_sections(rest, t):
        if s["title"].lower() in DROP_SECTIONS:
            continue
        txt = clean(s["raw"], t)
        if txt and txt.upper() != "TBA" and len(txt) > 3:
            secs.append({"title": s["title"], "text": txt[:4000]})
    return {"title": t, "image": p["thumb"], "sections": secs,
            "wiki_url": f"{WIKI}/wiki/{quote(t.replace(' ', '_'))}", "wiki_updated": p["touched"]}


async def wiki_search_context(client: httpx.AsyncClient, q: str, limit: int = 3, chars: int = 2500):
    r = await client.get(API, params={"action": "query", "list": "search", "srsearch": q, "srlimit": limit, "format": "json"})
    titles = [x["title"] for x in r.json().get("query", {}).get("search", [])]
    if not titles:
        return []
    pages = await fetch_pages(client, titles)
    out = []
    for t in titles:
        if t in pages:
            out.append({"title": t, "url": f"{WIKI}/wiki/{quote(t.replace(' ', '_'))}",
                        "text": clean(pages[t]["wikitext"], t)[:chars]})
    return out


async def periodic_sync(db, hours: float = 6):
    while True:
        try:
            await sync_all(db)
        except Exception as e:
            log.exception("periodic sync error %s", e)
        await asyncio.sleep(hours * 3600)
