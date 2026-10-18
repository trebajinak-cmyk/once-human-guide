from fastapi import FastAPI, APIRouter, HTTPException, Header, Query
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Any, Annotated, List, Optional
from datetime import datetime, timezone, timedelta

import httpx
from bson import ObjectId
from pydantic import BaseModel, Field, BeforeValidator

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import wiki  # noqa: E402
import feeds  # noqa: E402
import builds  # noqa: E402
from guides_data import GUIDES, GROUPS  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone  # noqa: E402

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
LLM_KEY = os.environ['EMERGENT_LLM_KEY']
BRIDGE_TOKEN = os.environ['AI_BRIDGE_TOKEN']
MODEL = ("anthropic", "claude-sonnet-5-5")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Once Human Guide API", openapi_url="/api/openapi.json", docs_url="/api/docs")


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")

# ---------------------------------------------------------------- models
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    model_config = {"populate_by_name": True}

    def to_mongo(self):
        d = self.model_dump(by_alias=True, exclude={"id"})
        return d

    @classmethod
    def from_mongo(cls, doc):
        return cls(**doc) if doc else None


class ChatMessage(BaseDocument):
    session_id: str
    role: str
    text: str
    sources: List[dict] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChatIn(BaseModel):
    session_id: str
    message: str
    lang: str = "cs"


class TranslateIn(BaseModel):
    key: str
    lang: str = "cs"
    data: Any


class BridgeAsk(BaseModel):
    question: str
    lang: str = "en"


ITEM_PROJ = {"_id": 0, "search": 0}
CARD_PROJ = {"_id": 0, "slug": 1, "category": 1, "title": 1, "image": 1, "rarity": 1, "style": 1, "subtype": 1}


# ---------------------------------------------------------------- cache helper
async def cached(key: str, ttl_min: int, producer):
    doc = await db.cache.find_one({"_id": key})
    now = datetime.now(timezone.utc)
    if doc and datetime.fromisoformat(doc["at"]) > now - timedelta(minutes=ttl_min):
        return doc["data"]
    try:
        data = await producer()
    except Exception as e:
        logger.warning("producer %s failed: %s", key, e)
        if doc:
            return doc["data"]
        raise HTTPException(502, "Upstream source unavailable")
    await db.cache.replace_one({"_id": key}, {"_id": key, "data": data, "at": now.isoformat()}, upsert=True)
    return data


# ---------------------------------------------------------------- items
@api.get("/")
async def root():
    return {"message": "Once Human Guide API", "source": wiki.WIKI}


@api.get("/meta")
async def meta():
    sync = await db.meta.find_one({"_id": "sync"}, {"_id": 0}) or {}
    counts = {}
    for k in wiki.CATEGORIES:
        counts[k] = await db.items.count_documents({"category": k})
    return {"sync": sync, "counts": counts}


@api.post("/sync")
async def trigger_sync():
    return await wiki.sync_all(db)


@api.get("/items")
async def list_items(category: Optional[str] = None, q: Optional[str] = None, rarity: Optional[str] = None,
                     limit: int = Query(300, le=500)):
    f: dict = {}
    if category:
        f["category"] = category
    if rarity:
        f["rarity"] = rarity
    if q:
        f["search"] = {"$regex": re.escape(q.lower())}
    rank = {"Legendary": 0, "Epic": 1, "Rare": 2, "Common": 3}
    docs = await db.items.find(f, CARD_PROJ).to_list(limit)
    docs.sort(key=lambda d: (rank.get(d.get("rarity"), 4), d["title"]))
    return docs


@api.get("/items/{category}/{slug}")
async def get_item(category: str, slug: str):
    doc = await db.items.find_one({"category": category, "slug": slug}, ITEM_PROJ)
    if not doc:
        raise HTTPException(404, "Item not found")
    return doc


IMG_HOSTS = ("https://static.wikia.nocookie.net/", "https://once-human.fandom.com/")
_img_client = httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})


@api.get("/img")
async def img_proxy(u: str):
    if not u.startswith(IMG_HOSTS):
        raise HTTPException(400, "Host not allowed")
    r = await _img_client.get(u)
    if r.status_code != 200:
        raise HTTPException(404, "Image not found")
    return Response(content=r.content, media_type=r.headers.get("content-type", "image/png"),
                    headers={"Cache-Control": "public, max-age=604800"})


# ---------------------------------------------------------------- news
async def _news():
    return await cached("steam_news", 20, feeds.fetch_steam_news)


@api.get("/news")
async def news(patch_only: bool = False, limit: int = 30):
    items = await _news()
    if patch_only:
        items = [n for n in items if n["is_patch"]]
    return [{k: v for k, v in n.items() if k != "blocks"} for n in items[:limit]]


@api.get("/news/{gid}")
async def news_detail(gid: str):
    for n in await _news():
        if n["gid"] == gid:
            return n
    raise HTTPException(404, "News not found")


# ---------------------------------------------------------------- guides
@api.get("/guides")
async def guides():
    return {"groups": GROUPS, "guides": GUIDES}


@api.get("/guides/{gid}")
async def guide_detail(gid: str):
    g = next((x for x in GUIDES if x["id"] == gid), None)
    if not g:
        raise HTTPException(404, "Guide not found")

    async def articles():
        async with httpx.AsyncClient(headers=wiki.UA, timeout=30) as c:
            res = [await wiki.wiki_article(c, t) for t in g["wiki"]]
        return [r for r in res if r]

    arts = await cached(f"guide_wiki:{gid}", 12 * 60, articles) if g["wiki"] else []
    vids = await cached(f"guide_yt:{gid}", 24 * 60, lambda: feeds.youtube_search(g["yt"], 6))
    return {**g, "articles": arts, "videos": vids}


@api.get("/videos")
async def videos(q: str):
    return await cached(f"yt:{q.lower()}", 24 * 60, lambda: feeds.youtube_search(f"Once Human {q}", 8))


# ---------------------------------------------------------------- translation
@api.post("/translate")
async def translate(body: TranslateIn):
    if body.lang == "en":
        return {"data": body.data, "cached": False}
    key = f"tr:{body.lang}:{body.key}"
    doc = await db.translations.find_one({"_id": key})
    if doc:
        return {"data": doc["data"], "cached": True}
    lang_name = {"cs": "Czech"}.get(body.lang, body.lang)
    chat = LlmChat(api_key=LLM_KEY, session_id=f"tr-{uuid.uuid4()}",
                   system_message=(f"You translate Once Human game guide content into {lang_name}. Keep proper names "
                                   "of items, weapons, armor, mods, deviations, bosses, locations and keyword effects "
                                   "(e.g. Shrapnel, Burn, Power Surge, Frost Vortex, Bounce, Unstable Bomber, Fast "
                                   "Gunner, Fortress Warfare, Bull's Eye, Crit DMG, Weakspot DMG, Psi Intensity) in English. "
                                   "Keep all numbers exactly. Return ONLY valid JSON with the identical structure and keys.")
                   ).with_model(*MODEL)
    raw = await chat.send_message(UserMessage(text=json.dumps(body.data, ensure_ascii=False)))
    m = re.search(r"[\[{].*[\]}]", raw, flags=re.S)
    try:
        data = json.loads(m.group(0)) if m else body.data
    except json.JSONDecodeError:
        return {"data": body.data, "cached": False, "failed": True}
    await db.translations.replace_one({"_id": key}, {"_id": key, "data": data,
                                                     "at": datetime.now(timezone.utc).isoformat()}, upsert=True)
    return {"data": data, "cached": False}


# ---------------------------------------------------------------- AI assistant
STOP = set("the and for with what how does best are is jak co je to na do se v ve za pro který která které nejlepší".split())


async def build_context(question: str):
    words = [w for w in re.findall(r"[\w\.\-]{3,}", question.lower()) if w not in STOP][:8]
    local = []
    if words:
        ors = [{"search": {"$regex": re.escape(w)}} for w in words]
        docs = await db.items.find({"$or": ors}, ITEM_PROJ).to_list(60)
        docs.sort(key=lambda d: -sum(w in d["title"].lower() for w in words))
        for d in docs[:6]:
            local.append({"title": d["title"], "category": d["category"], "rarity": d.get("rarity"),
                          "type": d.get("subtype"), "stats": {s["label"]: s["value"] for s in d.get("stats", [])},
                          "features": d.get("features"), "set_effects": d.get("set_effects"),
                          "summary": d.get("summary", "")[:400], "url": d["wiki_url"]})
    web = []
    try:
        async with httpx.AsyncClient(headers=wiki.UA, timeout=20) as c:
            web = await wiki.wiki_search_context(c, question, 3, 2200)
    except Exception as e:
        logger.warning("wiki search failed %s", e)
    news_items = []
    try:
        news_items = [{"title": n["title"], "date": n["date"][:10], "excerpt": n["excerpt"][:200]} for n in (await _news())[:6]]
    except Exception:
        pass
    sources = [{"title": x["title"], "url": x["url"]} for x in local] + [{"title": x["title"], "url": x["url"]} for x in web]
    seen, uniq = set(), []
    for s in sources:
        if s["url"] not in seen:
            seen.add(s["url"]); uniq.append(s)
    ctx = json.dumps({"database_items": local, "wiki_live_search": web, "latest_official_news": news_items},
                     ensure_ascii=False)
    return ctx, uniq[:6]


def system_prompt(lang: str):
    lng = "Czech" if lang == "cs" else "English"
    return ("You are 'OH Guide AI', an expert assistant for the game Once Human (NetEase / Starry Studio). "
            f"Always answer in {lng}. Keep in-game names (weapons, armor, mods, deviations, keywords) in English. "
            "Base factual claims (numbers, effects, drop sources, patch info) ONLY on the provided CONTEXT, which "
            "contains verified data synced from the Once Human wiki and official Steam news fetched live right now. "
            "If the context does not contain the answer, say clearly that it is not verified and give general advice. "
            "Be concise, structured (short headings, bullet points), practical (builds, tips, step-by-step).")


async def history_text(session_id: str, n: int = 10):
    msgs = await db.chat_messages.find({"session_id": session_id}).sort("created_at", -1).to_list(n)
    msgs.reverse()
    return "\n".join(f"{m['role'].upper()}: {m['text'][:1500]}" for m in msgs)


@api.post("/chat/stream")
async def chat_stream(body: ChatIn):
    if not body.message.strip():
        raise HTTPException(400, "Empty message")
    hist = await history_text(body.session_id)
    ctx, sources = await build_context(body.message)
    await db.chat_messages.insert_one(ChatMessage(session_id=body.session_id, role="user", text=body.message).to_mongo())
    prompt = (f"CONVERSATION SO FAR:\n{hist or '(none)'}\n\nCONTEXT (verified, live):\n{ctx}\n\n"
              f"USER QUESTION:\n{body.message}")
    chat = LlmChat(api_key=LLM_KEY, session_id=f"{body.session_id}-{uuid.uuid4()}",
                   system_message=system_prompt(body.lang)).with_model(*MODEL)

    async def gen():
        full = ""
        yield f"data: {json.dumps({'sources': sources})}\n\n"
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.exception("chat error %s", e)
            yield f"data: {json.dumps({'error': 'AI service error'})}\n\n"
        if full:
            await db.chat_messages.insert_one(ChatMessage(session_id=body.session_id, role="assistant",
                                                          text=full, sources=sources).to_mongo())
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.get("/chat/{session_id}")
async def chat_history(session_id: str):
    docs = await db.chat_messages.find({"session_id": session_id}).sort("created_at", 1).to_list(200)
    return [ChatMessage.from_mongo(d).model_dump() for d in docs]


@api.delete("/chat/{session_id}")
async def chat_clear(session_id: str):
    r = await db.chat_messages.delete_many({"session_id": session_id})
    return {"deleted": r.deleted_count}


# ---------------------------------------------------------------- AI bridge for third-party AI apps
def _check(token: Optional[str]):
    if (token or "").replace("Bearer ", "") != BRIDGE_TOKEN:
        raise HTTPException(401, "Invalid bridge token")


@api.get("/bridge/manifest")
async def bridge_manifest():
    return {
        "name": "Once Human Guide – AI Bridge",
        "description": "Verified Once Human data (wiki-synced items, official Steam news, tutorials) for external AI assistants.",
        "openapi": "/api/openapi.json",
        "auth": "Header 'X-Bridge-Token: <token>' (only for /api/bridge/ask)",
        "endpoints": {
            "search": "GET /api/bridge/search?q=<text>&category=weapons|armor|deviations|weapon_mods|armor_mods",
            "item": "GET /api/items/{category}/{slug}",
            "news": "GET /api/news?patch_only=true",
            "guides": "GET /api/guides",
            "ask": "POST /api/bridge/ask {question, lang}",
            "export": "GET /api/bridge/export",
        },
    }


@api.get("/bridge/config")
async def bridge_config():
    return {"token": BRIDGE_TOKEN}


@api.get("/bridge/search")
async def bridge_search(q: str, category: Optional[str] = None, limit: int = 10):
    f: dict = {"search": {"$regex": re.escape(q.lower())}}
    if category:
        f["category"] = category
    return await db.items.find(f, ITEM_PROJ).to_list(limit)


@api.get("/bridge/export")
async def bridge_export():
    items = await db.items.find({}, ITEM_PROJ).to_list(2000)
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "source": wiki.WIKI, "items": items}


@api.post("/bridge/ask")
async def bridge_ask(body: BridgeAsk, x_bridge_token: Optional[str] = Header(None)):
    _check(x_bridge_token)
    ctx, sources = await build_context(body.question)
    chat = LlmChat(api_key=LLM_KEY, session_id=f"bridge-{uuid.uuid4()}",
                   system_message=system_prompt(body.lang)).with_model(*MODEL)
    answer = await chat.send_message(UserMessage(text=f"CONTEXT (verified, live):\n{ctx}\n\nQUESTION:\n{body.question}"))
    return {"answer": answer, "sources": sources}


# ---------------------------------------------------------------- build planner + map
class BuildGenIn(BaseModel):
    goal: str = ""
    keyword: str = ""
    lang: str = "cs"


class BuildReviewIn(BaseModel):
    build: dict
    lang: str = "cs"


@api.get("/builds/creators")
async def build_creators():
    vids = await cached("creator_videos", 24 * 60, builds.creator_knowledge)
    return [{k: v for k, v in x.items() if k != "description"} for x in vids]


async def _valid_slugs():
    out = {}
    async for d in db.items.find({}, {"_id": 0, "slug": 1, "category": 1, "title": 1, "image": 1, "rarity": 1, "subtype": 1}):
        out.setdefault(d["slug"], d)
    return out


def _ref(slugs, s):
    return slugs.get(s) if isinstance(s, str) else None


@api.post("/builds/generate")
async def build_generate(body: BuildGenIn):
    vids = await cached("creator_videos", 24 * 60, builds.creator_knowledge)
    cat = await builds.catalog(db)
    lng = "Czech" if body.lang == "cs" else "English"
    ctx = {"creator_videos": [{"video_id": v["video_id"], "channel": v["channel"], "title": v["title"],
                               "published": v["published"], "description": v.get("description", "")[:900]} for v in vids],
           "CATALOG": cat}
    chat = LlmChat(api_key=LLM_KEY, session_id=f"build-{uuid.uuid4()}",
                   system_message=builds.METHODOLOGY + f"\nWrite all free text in {lng}; keep item names in English. "
                   + builds.build_schema()).with_model(*MODEL)
    req = f"Goal: {body.goal or 'strong all-round PvE endgame build'}. Main keyword: {body.keyword or 'choose the best'}."
    raw = await chat.send_message(UserMessage(text=f"CONTEXT:\n{json.dumps(ctx, ensure_ascii=False)}\n\nREQUEST: {req}"))
    try:
        b = builds.extract_json(raw)
    except json.JSONDecodeError:
        b = None
    if not b:
        raise HTTPException(502, "AI returned an invalid build")
    slugs = await _valid_slugs()
    vid_ids = {v["video_id"]: v for v in vids}
    return {
        "name": b.get("name", "AI build"), "keyword": b.get("keyword", body.keyword), "playstyle": b.get("playstyle", ""),
        "summary": b.get("summary", ""), "weapon": _ref(slugs, b.get("weapon")),
        "armor": {s: _ref(slugs, (b.get("armor") or {}).get(s)) for s in builds.SLOTS},
        "weapon_mod": _ref(slugs, b.get("weapon_mod")),
        "armor_mods": {s: _ref(slugs, (b.get("armor_mods") or {}).get(s)) for s in builds.SLOTS},
        "deviation": _ref(slugs, b.get("deviation")), "calibration": b.get("calibration", ""),
        "substats": b.get("substats", []), "rotation": b.get("rotation", []), "tips": b.get("tips", []),
        "creator_refs": [{**r, "thumbnail": f"https://i.ytimg.com/vi/{r['video_id']}/hqdefault.jpg"}
                         for r in b.get("creator_refs", []) if r.get("video_id") in vid_ids],
    }


@api.post("/builds/review")
async def build_review(body: BuildReviewIn):
    vids = await cached("creator_videos", 24 * 60, builds.creator_knowledge)
    details = await db.items.find({"slug": {"$in": _collect_slugs(body.build)}},
                                  {"_id": 0, "title": 1, "category": 1, "subtype": 1, "features": 1, "set_effects": 1, "stats": 1}).to_list(30)
    lng = "Czech" if body.lang == "cs" else "English"
    chat = LlmChat(api_key=LLM_KEY, session_id=f"review-{uuid.uuid4()}",
                   system_message=builds.METHODOLOGY + f"\nNow REVIEW the user's build in {lng} (markdown, concise): rating /10, "
                   "what synergises, what is wrong, concrete swaps from the catalog, active set bonuses, and which creator video to watch.").with_model(*MODEL)
    ctx = {"user_build_items": details, "creator_videos": [{"title": v["title"], "channel": v["channel"], "description": v.get("description", "")[:600]} for v in vids[:12]]}
    text = await chat.send_message(UserMessage(text=f"CONTEXT:\n{json.dumps(ctx, ensure_ascii=False)}\n\nBUILD: {json.dumps([d['title'] for d in details])}"))
    return {"review": text}


def _collect_slugs(b: dict):
    out = []
    for k in ("weapon", "weapon_mod", "deviation"):
        if isinstance(b.get(k), dict) and b[k].get("slug"):
            out.append(b[k]["slug"])
    for k in ("armor", "armor_mods"):
        for v in (b.get(k) or {}).values():
            if isinstance(v, dict) and v.get("slug"):
                out.append(v["slug"])
    return out


@api.get("/map")
async def map_endpoint():
    return await cached("map_nalcott", 12 * 60, builds.map_data)


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.items.create_index([("category", 1), ("slug", 1)], unique=True)
    await db.chat_messages.create_index([("session_id", 1), ("created_at", 1)])
    asyncio.create_task(wiki.periodic_sync(db, 6))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
