"""Creator knowledge base: every Once Human video of Anestic & Doomeris.

Stage 1 (always): list all channel videos + descriptions/timestamps (scraped live).
Stage 2 (needs GEMINI_API_KEY – user's own Google AI Studio key): Gemini watches each
YouTube video (speech + visuals) and extracts structured knowledge.
A background worker processes the queue respecting free-tier limits and re-scans channels every 6 h.
"""
import os
import re
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta

import httpx

import feeds

log = logging.getLogger("creators")

CHANNELS = {"anestic": "Anestic", "doomeris": "Doomeris"}
GEMINI_MODELS = [m for m in [os.environ.get("GEMINI_VIDEO_MODEL"), "gemini-3.8-flash", "gemini-3-flash-preview", "gemini-2.5-flash"] if m]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
UA = feeds.UA
COOKIES = {"CONSENT": "YES+1", "SOCS": "CAI"}

ANALYSIS_PROMPT = """You are building a complete, precise knowledge base about the game Once Human from this video by {channel}.
Watch the whole video (speech AND what is shown on screen: gear, mod names, stats, menus, numbers).
Return ONLY JSON (English, keep exact in-game names):
{{
 "is_once_human": bool,
 "summary": "5-8 sentence detailed summary",
 "game_context": "season/scenario/patch/version mentioned or shown (e.g. Season X, scenario name, date) or empty",
 "topics": ["build","mechanic","boss","event","patch","beginner","farming","pvp","base","deviation","news", ...],
 "weapons": ["exact weapon names"], "armor": ["exact armor / set names"], "mods": ["exact mod names"],
 "deviations": ["exact deviation names"], "bosses_or_activities": ["..."],
 "builds": [{{"name": "", "keyword": "", "weapon": "", "weapon_mod": "", "armor": {{"Helmet": "", "Mask": "", "Top": "", "Gloves": "", "Bottoms": "", "Shoes": ""}},
             "armor_mods": {{}}, "calibration": "", "substats": [""], "accessories": [""], "deviation": "", "cradle_or_overrides": [""],
             "rotation": [""], "variants": [""], "notes": ""}}],
 "mechanics": [{{"name": "", "explanation": "precise explanation incl. numbers/conditions said in the video"}}],
 "key_facts": [{{"t": "mm:ss", "fact": "specific verified statement from the video"}}],
 "tips": ["practical tips"],
 "opinions": ["creator's tier/meta opinions, clearly as opinion"]
}}
Be exhaustive and exact; do not invent anything not said or shown. Video title: {title}"""


def _walk(node, key, out):
    if isinstance(node, dict):
        if key in node:
            out.append(node[key])
        for v in node.values():
            _walk(v, key, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, key, out)


def _parse_lockups(data):
    vids = []
    lockups = []
    _walk(data, "lockupViewModel", lockups)
    for lv in lockups:
        vid = lv.get("contentId")
        if not vid or len(vid) != 11:
            continue
        meta = lv.get("metadata", {}).get("lockupMetadataViewModel", {})
        title = meta.get("title", {}).get("content", "")
        rows = []
        _walk(meta, "content", rows)
        texts = [r for r in rows if isinstance(r, str) and r != title]
        dur = []
        _walk(lv.get("contentImage", {}), "text", dur)
        vids.append({"video_id": vid, "title": title,
                     "views": next((x for x in texts if "view" in x.lower()), ""),
                     "published": next((x for x in texts if "ago" in x.lower()), ""),
                     "duration": next((d for d in dur if isinstance(d, str) and re.match(r"^\d+:\d", d)), "")})
    renderers = []
    _walk(data, "videoRenderer", renderers)
    for v in renderers:
        if v.get("videoId"):
            vids.append({"video_id": v["videoId"], "title": feeds._txt(v.get("title")),
                         "views": feeds._txt(v.get("viewCountText")), "published": feeds._txt(v.get("publishedTimeText")),
                         "duration": feeds._txt(v.get("lengthText"))})
    return vids


def _continuations(data):
    toks = []
    _walk(data, "continuationCommand", toks)
    return [t.get("token") for t in toks if isinstance(t, dict) and t.get("token")]


async def list_channel(handle: str, max_pages: int = 40):
    async with httpx.AsyncClient(headers=UA, cookies=COOKIES, timeout=30, follow_redirects=True) as c:
        page = (await c.get(f"https://www.youtube.com/@{handle}/videos")).text
        m = re.search(r"var ytInitialData = (\{.*?\});</script>", page, flags=re.S)
        key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', page).group(1)
        ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', page).group(1)
        data = json.loads(m.group(1))
        vids = _parse_lockups(data)
        toks = _continuations(data)
        seen = {v["video_id"] for v in vids}
        for _ in range(max_pages):
            if not toks:
                break
            r = await c.post(f"https://www.youtube.com/youtubei/v1/browse?key={key}",
                             json={"context": {"client": {"clientName": "WEB", "clientVersion": ver, "hl": "en"}},
                                   "continuation": toks[0]})
            d = r.json()
            new = [v for v in _parse_lockups(d) if v["video_id"] not in seen]
            if not new:
                break
            vids += new
            seen |= {v["video_id"] for v in new}
            toks = _continuations(d)
    return vids


async def video_description(c: httpx.AsyncClient, vid: str) -> str:
    try:
        p = (await c.get(f"https://www.youtube.com/watch?v={vid}")).text
        m = re.search(r'"attributedDescription":\{"content":"((?:[^"\\]|\\.)*)"', p)
        return json.loads(f'"{m.group(1)}"') if m else ""
    except Exception:
        return ""


def _search_text(doc):
    a = doc.get("analysis") or {}
    return " ".join([doc.get("title", ""), doc.get("description", ""), json.dumps(a, ensure_ascii=False)]).lower()


async def scan_channels(db):
    """Stage 1: list videos and fetch descriptions for new ones."""
    total_new = 0
    for handle, name in CHANNELS.items():
        try:
            vids = await list_channel(handle)
        except Exception as e:
            log.exception("list %s failed %s", handle, e)
            continue
        for order, v in enumerate(vids):
            existing = await db.creator_videos.find_one({"video_id": v["video_id"]}, {"_id": 0, "video_id": 1})
            base = {**v, "channel": name, "handle": handle, "order": order,
                    "thumbnail": f"https://i.ytimg.com/vi/{v['video_id']}/hqdefault.jpg"}
            if existing:
                await db.creator_videos.update_one({"video_id": v["video_id"]}, {"$set": {"views": v["views"], "published": v["published"], "order": order}})
                continue
            base.update({"status": "listed", "description": "", "analysis": None,
                         "added_at": datetime.now(timezone.utc).isoformat()})
            await db.creator_videos.insert_one(base)
            total_new += 1
    async with httpx.AsyncClient(headers=UA, cookies=COOKIES, timeout=30, follow_redirects=True) as c:
        old = re.compile(r"^([3-9]|\d\d+) years? ago")
        async for v in db.creator_videos.find({"status": "listed"}, {"_id": 0, "video_id": 1, "title": 1, "published": 1}):
            if old.match(v.get("published", "")) and "once human" not in v["title"].lower():
                await db.creator_videos.update_one({"video_id": v["video_id"]}, {"$set": {"status": "skipped", "is_once_human": False, "search": v["title"].lower()}})
        pending = await db.creator_videos.find({"status": "listed"}, {"_id": 0, "video_id": 1, "title": 1}).to_list(2000)
        for i in range(0, len(pending), 8):
            batch = pending[i:i + 8]
            descs = await asyncio.gather(*[video_description(c, v["video_id"]) for v in batch])
            for v, d in zip(batch, descs):
                oh = "once human" in (v["title"] + " " + d).lower() or "oncehuman" in d.lower()
                doc = {"description": d, "status": "described", "is_once_human": oh}
                doc["search"] = (v["title"] + " " + d).lower()
                await db.creator_videos.update_one({"video_id": v["video_id"]}, {"$set": doc})
    await db.meta.update_one({"_id": "creators"}, {"$set": {"last_scan": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return total_new


async def gemini_analyze(video: dict, key: str):
    body = {"contents": [{"role": "user", "parts": [
        {"file_data": {"file_uri": f"https://www.youtube.com/watch?v={video['video_id']}"}},
        {"text": ANALYSIS_PROMPT.format(channel=video["channel"], title=video["title"])},
    ]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}}
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    last = None
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as c:
        for model in GEMINI_MODELS:
            r = await c.post(GEMINI_URL.format(model=model), headers=headers, json=body)
            if r.status_code == 404:
                last = r
                continue
            if r.status_code == 429:
                raise RateLimited(r.text[:300])
            if r.status_code >= 400:
                raise RuntimeError(f"{r.status_code} {r.text[:300]}")
            data = r.json()
            text = "".join(p.get("text", "") for cand in data.get("candidates", []) for p in cand.get("content", {}).get("parts", []))
            m = re.search(r"\{.*\}", text, flags=re.S)
            return json.loads(m.group(0)) if m else None, model
    raise RuntimeError(f"No Gemini model available: {last.text[:200] if last else ''}")


class RateLimited(Exception):
    pass


async def worker(db, interval_s: int = 40):
    """Background queue: scan channels every 6h, analyze one video at a time with Gemini (if key)."""
    last_scan = datetime.min.replace(tzinfo=timezone.utc)
    while True:
        try:
            now = datetime.now(timezone.utc)
            if now - last_scan > timedelta(hours=6):
                await scan_channels(db)
                last_scan = now
            key = os.environ.get("GEMINI_API_KEY", "").strip()
            meta = await db.meta.find_one({"_id": "creators"}) or {}
            paused = meta.get("paused_until")
            if not key or (paused and datetime.fromisoformat(paused) > now):
                await asyncio.sleep(120)
                continue
            v = await db.creator_videos.find_one({"status": "described", "is_once_human": True}, sort=[("order", 1)])
            if not v:
                await asyncio.sleep(600)
                continue
            try:
                analysis, model = await gemini_analyze(v, key)
                status = "analyzed" if analysis else "failed"
                upd = {"analysis": analysis, "status": status, "model": model, "analyzed_at": now.isoformat()}
                if analysis and analysis.get("is_once_human") is False:
                    upd["is_once_human"] = False
                v.update(upd)
                upd["search"] = _search_text(v)
                await db.creator_videos.update_one({"video_id": v["video_id"]}, {"$set": upd})
                await db.meta.update_one({"_id": "creators"}, {"$set": {"last_error": "", "paused_until": None}}, upsert=True)
            except RateLimited as e:
                await db.meta.update_one({"_id": "creators"}, {"$set": {"paused_until": (now + timedelta(hours=1)).isoformat(), "last_error": f"rate limit: {e}"}}, upsert=True)
            except Exception as e:
                log.warning("analyze %s failed: %s", v["video_id"], e)
                await db.creator_videos.update_one({"video_id": v["video_id"]}, {"$set": {"status": "failed", "error": str(e)[:300]}})
                await db.meta.update_one({"_id": "creators"}, {"$set": {"last_error": str(e)[:300]}}, upsert=True)
            await asyncio.sleep(interval_s)
        except Exception as e:
            log.exception("creator worker loop error %s", e)
            await asyncio.sleep(300)


async def search_kb(db, words, limit=4):
    if not words:
        return []
    ors = [{"search": {"$regex": re.escape(w)}} for w in words]
    docs = await db.creator_videos.find({"$or": ors, "is_once_human": True},
                                        {"_id": 0, "video_id": 1, "channel": 1, "title": 1, "published": 1, "description": 1,
                                         "analysis": 1, "search": 1, "status": 1}).to_list(300)
    docs.sort(key=lambda d: (-sum(d["search"].count(w) for w in words) - (5 if d.get("analysis") else 0)))
    out = []
    for d in docs[:limit]:
        a = d.get("analysis") or {}
        out.append({"video": f"https://www.youtube.com/watch?v={d['video_id']}", "channel": d["channel"], "title": d["title"],
                    "published": d.get("published", ""),
                    "analysis": {k: a.get(k) for k in ("summary", "game_context", "builds", "mechanics", "key_facts", "tips")} if a else None,
                    "description": "" if a else d.get("description", "")[:900]})
    return out
