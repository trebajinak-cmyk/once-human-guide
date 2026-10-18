# Once Human Guide – PRD

## Original problem statement
Czech user: mobile app – complete interactive Once Human guide ("studio guide" about everything in the game and how it works), verified data with detailed descriptions, live-updated per current patch + all news. Weapons & armor in a detailed beautiful card UI (reference: legendary SOCR card with gold frame, cinematic image, rarity ribbon, parchment stats). Real in-game images from the internet. Tutorials with videos for all mechanics/tips. Base on uploaded repo/ZIPs, verify authenticity of all data. Actively search missing info online; tool for communicating with third-party AI apps.

## User choices
AI assistant (Claude) + live news; embedded YouTube videos; real wiki images; Czech + English switch; use uploaded data but verify → wiki is used as the verified source of truth.

## Architecture
- Backend FastAPI + MongoDB
  - wiki.py: syncs once-human.fandom.com (Weapon, Armor, Deviation, Weapon Mod, Armor Mod categories) → parsed infobox stats, features, set effects, sections, images; runs at startup + every 6 h; POST /api/sync
  - feeds.py: Steam official news (appid 2139460) + YouTube search scrape
  - guides_data.py: 22 mechanic guides (CZ/EN) linked to live wiki articles + videos
  - AI: Claude Sonnet 5.5 (emergentintegrations), SSE streaming chat with live context (DB items + live wiki search + news), cached AI translation (/api/translate)
  - AI Bridge: /api/bridge/manifest, search, export, ask (X-Bridge-Token), OpenAPI at /api/openapi.json
  - /api/img proxy (wiki CDN blocks foreign referrers)
- Frontend Expo Router: tabs Home / Codex / Návody / AI (NativeTabs on iOS 26+), item legendary card, guide detail (YouTube WebView), news list/detail, settings (language, sync, bridge)

## Implemented (2026-10-18)
- All above; testing iteration 1: 30/30 backend, frontend all green

## Iteration 2 (2026-10-18)
- Build planner (local favourites, 6 armor slots + mods, active set bonuses, AI review), AI build generator using Anestic & Doomeris video descriptions as reference
- Weapon compare with highlighted better stats
- Interactive Nalcott map (131 wiki markers, category filter, pinch zoom)
- Share card / build as image (react-native-view-shot + expo-sharing; native only, web falls back to text)
- Testing iteration 2: 34/34 backend, frontend all green
- docs/BASE44_INTEGRATION.md – workflow Emergent + GitHub + Base44

## Backlog
- P1: Favourites / own build planner (weapon + armor + mods)
- P1: Interactive map of locations
- P2: Offline cache of codex, push of new patch (only on request)
- P2: Compare two weapons side by side
