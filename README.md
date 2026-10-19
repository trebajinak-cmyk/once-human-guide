# Once Human Guide

Adaptive game companion for **Once Human**  
**App 5.5.0** · Shell **v19.2** · Data `2026-10-09-v19.2-372` · Patch **3.0.7** · 372 entit · SW `ohg-v19.2-307`

**Repo:** https://github.com/smus-rgb/once-human-guide

Spolupráce jen přes GitHub: [docs/COLLAB.md](docs/COLLAB.md). Merge do `main` jen PR. Labs větve `labs/*`.

---

## One-command install (automatic)

## Graphical installer (Start button)

```bash
# download
curl -fsSL https://raw.githubusercontent.com/smus-rgb/once-human-guide/main/install_gui.py -o install_gui.py
python3 install_gui.py
```

Windows:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/smus-rgb/once-human-guide/main/install_gui.py -OutFile install_gui.py
python install_gui.py
```

Click **START** — downloads everything, builds DB, optionally launches the app.

Needs only **Python 3.10+**.

### Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/smus-rgb/once-human-guide/main/bootstrap.py -OutFile bootstrap.py
python bootstrap.py
cd once-human-guide-app
.\start.bat
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/smus-rgb/once-human-guide/main/bootstrap.py -o bootstrap.py
python3 bootstrap.py
cd once-human-guide-app
./start.sh
```

Or install directly:

```bash
curl -fsSL https://raw.githubusercontent.com/smus-rgb/once-human-guide/main/install.py -o install.py
python3 install.py --dir ~/once-human-guide-app --launch
```

Then open **http://127.0.0.1:8000/ui**

The installer automatically:
1. Downloads all app + data files from GitHub  
2. Installs `fastapi` + `uvicorn`  
3. Builds SQLite database  
4. Creates `start.sh` / `start.bat`  

### Update later

```bash
cd once-human-guide-app
python3 updater.py
```

---

## Offline (no Python)

Open `once_human_guide_v19.html` (needs `modules/`, `ohg_data.js`, `ohg_sw.js` vedle). Fallback: `once_human_guide_v18.html`.

---

## API

| URL | Description |
|-----|-------------|
| http://127.0.0.1:8000/ui | App (v19 shell) |
| http://127.0.0.1:8000/docs | OpenAPI |
| http://127.0.0.1:8000/stats | Counts |
| http://127.0.0.1:8000/update/check | Update check (shell + data) |
| http://127.0.0.1:8000/audit | Data quality issues |
