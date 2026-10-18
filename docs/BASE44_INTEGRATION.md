# Once Human Guide – workflow Emergent + GitHub + Base44

## Role každé služby
| Služba | Role |
|---|---|
| **Emergent** | Hlavní vývoj mobilní aplikace (Expo/Android/iOS) + backend (FastAPI, MongoDB, AI). Odtud se dělá Android build (Publish → Deploy → Android build). |
| **GitHub** (`trebajinak-cmyk/once-human-guide`) | Jediný zdroj pravdy a záloha kódu. Ukládání přes **Save to GitHub** po každé větší změně. |
| **Base44** | Doplňková aplikace (web/admin panel, rychlé prototypy, zadávání příkazů), která **čte data z backendu této aplikace přes AI Bridge API** – needituje stejný kód. |

> Neupravujte stejné soubory zároveň v Emergentu i v Base44 – vzniknou konflikty. Base44 používejte jako samostatného klienta API.

## AI Bridge API (po nasazení použijte produkční URL z Emergent Publish)
- `GET  /api/bridge/manifest` – popis API
- `GET  /api/openapi.json` – OpenAPI schéma (import do Base44 / ChatGPT Actions)
- `GET  /api/bridge/search?q=<text>&category=weapons|armor|deviations|weapon_mods|armor_mods`
- `GET  /api/items/{category}/{slug}` – detail položky (statistiky, vlastnosti, set bonusy)
- `GET  /api/news?patch_only=true` – oficiální novinky a patche (Steam)
- `GET  /api/guides`, `GET /api/guides/{id}` – návody + videa
- `GET  /api/map` – interaktivní mapa (markery)
- `GET  /api/builds/creators` – videa Anestic & Doomeris
- `POST /api/builds/generate` `{goal, keyword, lang}` – AI build
- `POST /api/bridge/ask` `{question, lang}` + hlavička `X-Bridge-Token` – AI odpověď
- `GET  /api/bridge/export` – kompletní export dat (JSON)

## Prompt pro Base44 (zkopírujte)
```
Vytvoř aplikaci "Once Human Guide – Studio" napojenou na externí REST API.
BASE_URL = <produkční URL>/api
Používej endpointy: /bridge/search, /items/{category}/{slug}, /news?patch_only=true,
/guides, /map, /builds/generate (POST), /bridge/ask (POST, hlavička X-Bridge-Token: <token>).
Data neukládej natrvalo, vždy je načítej živě z API. Design: tmavý, zlaté akcenty, karty zbraní
s rarity barvou (Legendary zlatá, Epic fialová, Rare modrá).
Funkce: vyhledávání v databázi, detail karty, novinky, AI dotazy, generátor buildů.
```

## Doporučený postup zálohy
1. Emergent: po dokončení funkce → **Save to GitHub** (větev `main`).
2. Base44: připojte stejný GitHub účet jen pro vlastní (oddělený) repozitář Base44 aplikace.
3. Android build vždy z Emergentu (Publish → Deploy → Android build).
