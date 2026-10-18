"""Live feeds: official Steam news (patch notes) and YouTube tutorial search."""
import re
import json
import html
from datetime import datetime, timezone
from urllib.parse import quote_plus

import httpx

STEAM_APPID = 2139460
STEAM_NEWS = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
CLAN_IMG = "https://clan.akamai.steamstatic.com/images"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"}
PATCH_RE = re.compile(r"patch|update|maintenance|version|hotfix|fix|changelog|optimi", re.I)


def _bb_blocks(contents: str):
    c = contents.replace("{STEAM_CLAN_IMAGE}", CLAN_IMG)
    c = re.sub(r"\[img[^\]]*\](.*?)\[/img\]", lambda m: f"\n@@IMG@@{m.group(1).strip()}\n", c, flags=re.S | re.I)
    c = re.sub(r"\[h[1-6]\](.*?)\[/h[1-6]\]", lambda m: f"\n@@H@@{m.group(1)}\n", c, flags=re.S | re.I)
    c = re.sub(r"\[\*\]", "\n• ", c)
    c = re.sub(r"\[/?(p|list|olist|b|i|u|strike|quote|code|table|tr|td|th|spoiler|noparse|hr)[^\]]*\]", "\n", c, flags=re.I)
    c = re.sub(r"\[url=([^\]]*)\](.*?)\[/url\]", r"\2", c, flags=re.S | re.I)
    c = re.sub(r"\[/?[a-z]+[^\]]*\]", "", c, flags=re.I)
    c = re.sub(r"<br\s*/?>", "\n", c)
    c = re.sub(r"<img[^>]*src=\"([^\"]+)\"[^>]*>", lambda m: f"\n@@IMG@@{m.group(1)}\n", c)
    c = re.sub(r"<[^>]+>", "", c)
    c = html.unescape(c)
    blocks = []
    for line in c.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("@@IMG@@"):
            blocks.append({"type": "img", "value": line[7:]})
        elif line.startswith("@@H@@"):
            blocks.append({"type": "h", "value": line[5:].strip()})
        else:
            blocks.append({"type": "p", "value": line})
    return blocks


def _shape(n):
    blocks = _bb_blocks(n.get("contents", ""))
    img = next((b["value"] for b in blocks if b["type"] == "img"), "")
    text = " ".join(b["value"] for b in blocks if b["type"] == "p")
    return {
        "gid": n["gid"], "title": n["title"], "url": n["url"], "author": n.get("author", ""),
        "date": datetime.fromtimestamp(n["date"], tz=timezone.utc).isoformat(),
        "feed": n.get("feedlabel", ""), "image": img, "excerpt": text[:260],
        "is_patch": bool(PATCH_RE.search(n["title"])), "blocks": blocks,
    }


async def fetch_steam_news(count: int = 40):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(STEAM_NEWS, params={"appid": STEAM_APPID, "count": count, "maxlength": 0,
                                            "feeds": "steam_community_announcements"})
        items = r.json().get("appnews", {}).get("newsitems", [])
    return [_shape(n) for n in items]


def _walk_videos(node, out):
    if isinstance(node, dict):
        vr = node.get("videoRenderer")
        if vr and vr.get("videoId"):
            out.append(vr)
        for v in node.values():
            _walk_videos(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk_videos(v, out)


def _txt(o):
    if not o:
        return ""
    if "simpleText" in o:
        return o["simpleText"]
    return "".join(r.get("text", "") for r in o.get("runs", []))


async def youtube_search(query: str, limit: int = 6):
    url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    async with httpx.AsyncClient(timeout=20, headers=UA, follow_redirects=True) as c:
        page = (await c.get(url, cookies={"CONSENT": "YES+1"})).text
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", page, flags=re.S)
    if not m:
        return []
    data = json.loads(m.group(1))
    found = []
    _walk_videos(data, found)
    out, seen = [], set()
    for v in found:
        vid = v["videoId"]
        if vid in seen:
            continue
        seen.add(vid)
        out.append({
            "video_id": vid, "title": _txt(v.get("title")), "channel": _txt(v.get("ownerText")),
            "duration": _txt(v.get("lengthText")), "published": _txt(v.get("publishedTimeText")),
            "views": _txt(v.get("shortViewCountText")) or _txt(v.get("viewCountText")),
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        })
        if len(out) >= limit:
            break
    return out
