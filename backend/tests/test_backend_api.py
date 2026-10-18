"""Backend regression tests for Once Human Guide API.

Coverage: meta, items (all categories), item detail (weapons/armor sets), image proxy,
news (list + detail), guides (list + detail with videos+articles),
translate (cs), chat (SSE stream + history + delete), bridge (manifest, search, auth, ask).
"""
import json
import re
import time
import uuid

import pytest
import requests

CATEGORIES = ["weapons", "armor", "deviations", "weapon_mods", "armor_mods"]


# -------------------------------------------------- meta + items
class TestMeta:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert "Once Human" in r.json()["message"]

    def test_meta_counts_populated(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/meta")
        assert r.status_code == 200
        data = r.json()
        assert "sync" in data and "counts" in data
        for cat in CATEGORIES:
            assert data["counts"].get(cat, 0) > 0, f"category {cat} has 0 items"


class TestItems:
    @pytest.mark.parametrize("cat", CATEGORIES)
    def test_list_per_category(self, api_client, base_url, cat):
        r = api_client.get(f"{base_url}/api/items", params={"category": cat, "limit": 10})
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list) and len(docs) > 0
        for d in docs:
            assert d["category"] == cat
            assert "slug" in d and "title" in d
            assert "_id" not in d  # ObjectId must be excluded

    def test_list_filter_rarity(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/items", params={"category": "weapons", "rarity": "Legendary"})
        assert r.status_code == 200
        for d in r.json():
            assert d.get("rarity") == "Legendary"

    def test_list_search_query(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/items", params={"q": "socr"})
        assert r.status_code == 200
        titles = [d["title"].lower() for d in r.json()]
        assert any("socr" in t for t in titles)

    def test_get_weapon_detail_socr(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/items/weapons/socr-the-last-valor")
        assert r.status_code == 200
        d = r.json()
        assert d["title"].lower().startswith("socr")
        assert d["rarity"] == "Legendary"
        assert isinstance(d.get("features"), list) and len(d["features"]) > 0
        assert isinstance(d.get("stats"), list)
        assert d.get("wiki_url", "").startswith("https://once-human.fandom.com")

    def test_get_armor_set_lonewolf(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/items/armor/lonewolf-set")
        assert r.status_code == 200
        d = r.json()
        assert d["title"].lower().startswith("lonewolf")
        se = d.get("set_effects")
        assert isinstance(se, list) and len(se) >= 2
        assert all("pieces" in e and "effect" in e for e in se)

    def test_item_not_found(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/items/weapons/does-not-exist-xyz")
        assert r.status_code == 404


class TestImageProxy:
    def test_wikia_image_ok(self, api_client, base_url):
        url = ("https://static.wikia.nocookie.net/once-human/images/f/f0/"
               "SOCR_The_Last_Valor.png/revision/latest?cb=20240929215155")
        r = api_client.get(f"{base_url}/api/img", params={"u": url})
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 500

    def test_disallowed_host(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/img", params={"u": "https://evil.example.com/x.png"})
        assert r.status_code == 400


# -------------------------------------------------- news + guides
class TestNews:
    def test_news_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/news", params={"limit": 10})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        n0 = items[0]
        for k in ("gid", "title", "date", "excerpt", "is_patch"):
            assert k in n0

    def test_news_detail(self, api_client, base_url):
        items = api_client.get(f"{base_url}/api/news", params={"limit": 5}).json()
        gid = items[0]["gid"]
        r = api_client.get(f"{base_url}/api/news/{gid}")
        assert r.status_code == 200
        d = r.json()
        assert d["gid"] == gid and "title" in d

    def test_news_detail_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/news/nonexistent-gid-xxx")
        assert r.status_code == 404


class TestGuides:
    def test_guides_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/guides")
        assert r.status_code == 200
        d = r.json()
        assert set(d["groups"].keys()) >= {"basics", "combat", "world"}
        assert len(d["guides"]) >= 20
        ids = [g["id"] for g in d["guides"]]
        assert "shrapnel" in ids

    def test_guide_shrapnel_detail(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/guides/shrapnel", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "shrapnel"
        assert isinstance(d.get("videos"), list) and len(d["videos"]) > 0
        for v in d["videos"]:
            assert ("video_id" in v or "id" in v) and "title" in v
        assert isinstance(d.get("articles"), list)
        # Shrapnel has a wiki page, so articles should be present
        assert len(d["articles"]) > 0

    def test_guide_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/guides/does-not-exist")
        assert r.status_code == 404


# -------------------------------------------------- translate (uses LLM; may be slow)
class TestTranslate:
    def test_translate_en_passthrough(self, api_client, base_url):
        payload = {"key": "t_en", "lang": "en", "data": {"hello": "World"}}
        r = api_client.post(f"{base_url}/api/translate", json=payload)
        assert r.status_code == 200
        assert r.json()["data"] == payload["data"]

    def test_translate_cs(self, api_client, base_url):
        key = f"TEST_tr_{uuid.uuid4().hex[:8]}"
        payload = {"key": key, "lang": "cs", "data": {"title": "Weapons", "sub": "Legendary"}}
        r = api_client.post(f"{base_url}/api/translate", json=payload, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "data" in d
        assert isinstance(d["data"], dict)
        assert set(d["data"].keys()) == {"title", "sub"}


# -------------------------------------------------- chat SSE
class TestChat:
    def test_chat_stream_and_history(self, api_client, base_url):
        session_id = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        payload = {"session_id": session_id, "message": "What rarity is SOCR - The Last Valor?", "lang": "en"}
        r = requests.post(f"{base_url}/api/chat/stream", json=payload, stream=True, timeout=90)
        assert r.status_code == 200
        got_sources = got_text = done = False
        text_full = ""
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            try:
                ev = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            if "sources" in ev:
                got_sources = True
                assert isinstance(ev["sources"], list)
            if "t" in ev:
                got_text = True
                text_full += ev["t"]
            if ev.get("done"):
                done = True
                break
        assert got_sources and got_text and done, f"sources={got_sources} text={got_text} done={done}"
        assert len(text_full) > 10

        # verify history persisted
        time.sleep(1)
        h = api_client.get(f"{base_url}/api/chat/{session_id}")
        assert h.status_code == 200
        msgs = h.json()
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

        # cleanup
        d = api_client.delete(f"{base_url}/api/chat/{session_id}")
        assert d.status_code == 200
        assert d.json()["deleted"] >= 2

    def test_chat_empty_message(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/chat/stream",
                            json={"session_id": "x", "message": "   ", "lang": "en"})
        assert r.status_code == 400


# -------------------------------------------------- AI bridge
class TestBridge:
    def test_manifest(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/bridge/manifest")
        assert r.status_code == 200
        d = r.json()
        assert "endpoints" in d and "ask" in d["endpoints"]

    def test_search(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/bridge/search", params={"q": "socr"})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        assert any("socr" in i["title"].lower() for i in items)

    def test_ask_unauthorized(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/bridge/ask", json={"question": "hi", "lang": "en"})
        assert r.status_code == 401

    def test_ask_wrong_token(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/bridge/ask",
                            json={"question": "hi", "lang": "en"},
                            headers={"X-Bridge-Token": "wrong"})
        assert r.status_code == 401

    def test_ask_authorized(self, api_client, base_url, bridge_token):
        r = requests.post(f"{base_url}/api/bridge/ask",
                          json={"question": "What is Shrapnel in Once Human?", "lang": "en"},
                          headers={"X-Bridge-Token": bridge_token, "Content-Type": "application/json"},
                          timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert "answer" in d and len(d["answer"]) > 20
        assert "sources" in d and isinstance(d["sources"], list)


# -------------------------------------------------- sync
class TestSync:
    @pytest.mark.timeout(120)
    def test_sync(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/sync", timeout=120)
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d and "last_sync" in d
        for cat in CATEGORIES:
            assert d["counts"].get(cat, 0) != 0
