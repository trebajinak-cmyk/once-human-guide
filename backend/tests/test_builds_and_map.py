"""Iteration 2 regression: build planner (creators/generate/review) + interactive map."""
import time
import uuid

import pytest
import requests


# -------------------------------------------------- creators list
class TestCreators:
    def test_creators_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/builds/creators", timeout=90)
        assert r.status_code == 200
        vids = r.json()
        assert isinstance(vids, list) and len(vids) > 0, "no creator videos"
        channels = {v.get("channel", "").lower() for v in vids}
        # Expect Anestic and Doomeris content
        assert any("anestic" in c for c in channels), f"Anestic missing in {channels}"
        assert any("doomeris" in c for c in channels), f"Doomeris missing in {channels}"
        # Shape
        for v in vids[:3]:
            assert "video_id" in v and "title" in v and "channel" in v


# -------------------------------------------------- map endpoint
class TestMap:
    def test_map_structure(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/map", timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert d.get("title")
        assert d.get("image", "").startswith("http"), f"missing image url: {d.get('image')}"
        cats = d.get("categories")
        assert isinstance(cats, list) and len(cats) > 0
        for c in cats:
            assert {"id", "name", "count"} <= set(c.keys())
            assert c["count"] > 0
        markers = d.get("markers")
        assert isinstance(markers, list)
        # Expectation from problem statement: 131 markers (fuzzy +/- 20)
        assert len(markers) >= 100, f"too few markers: {len(markers)}"
        for m in markers[:20]:
            assert 0.0 <= float(m["x"]) <= 1.0, f"x out of 0..1: {m['x']}"
            assert 0.0 <= float(m["y"]) <= 1.0, f"y out of 0..1: {m['y']}"
            assert "cat" in m and "title" in m


# -------------------------------------------------- build generate (slow – LLM)
class TestBuildGenerate:
    @pytest.mark.timeout(120)
    def test_generate_cs(self, api_client, base_url):
        r = requests.post(f"{base_url}/api/builds/generate",
                          json={"goal": "endgame PvE shrapnel build", "keyword": "Shrapnel", "lang": "cs"},
                          timeout=120)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        b = r.json()
        # Required top-level keys
        for k in ("name", "keyword", "summary", "weapon", "armor", "weapon_mod", "armor_mods",
                  "deviation", "rotation", "tips", "creator_refs"):
            assert k in b, f"missing key {k}"
        # Weapon ref present with slug/title/image
        assert isinstance(b["weapon"], dict), f"weapon not resolved: {b['weapon']}"
        for fld in ("slug", "title"):
            assert b["weapon"].get(fld), f"weapon.{fld} missing"
        # Armor dict has 6 slots
        assert set(b["armor"].keys()) == {"Helmet", "Mask", "Top", "Gloves", "Bottoms", "Shoes"}
        # creator_refs include thumbnail url and video_id
        for cr in b.get("creator_refs", [])[:3]:
            assert cr.get("video_id") and cr.get("thumbnail", "").startswith("https://i.ytimg.com/")
        # Rotation/tips lists
        assert isinstance(b["rotation"], list)
        assert isinstance(b["tips"], list)
        # Store for review test
        pytest.generated_build = b


# -------------------------------------------------- build review
class TestBuildReview:
    @pytest.mark.timeout(120)
    def test_review_known_weapon(self, api_client, base_url):
        payload = {
            "build": {
                "weapon": {"slug": "socr-the-last-valor", "category": "weapons", "title": "SOCR - The Last Valor"},
                "armor_mods": {},
                "armor": {},
            },
            "lang": "cs",
        }
        r = requests.post(f"{base_url}/api/builds/review", json=payload, timeout=120)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        d = r.json()
        assert "review" in d and len(d["review"]) > 20
