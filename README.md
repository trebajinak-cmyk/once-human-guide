# expo

A small starter for a mobile app with a backend: **FastAPI with MongoDB**
behind an **Expo + expo-router** app in strict TypeScript. The app runs as a
web preview in the browser, in Expo Go on a phone, and as a native build.
Nothing app-specific is built yet; it is a skeleton to build on.

Versions are not written down here. Every package is at whatever
`package.json` pins; open that file only when a version actually matters.

## Layout

```
expo/
  backend/   FastAPI + motor (async MongoDB) + Pydantic v2 — python, /root/.venv
  frontend/  Expo + expo-router (file-based routes under app/)
  memory/    test_credentials.md — logins the testing subagent reads
  tests/     backend pytest package
```

## Running

Supervisor runs everything in the pod (see "Pod conventions"). By hand, from
two terminals:

```bash
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload   # http://localhost:8001
cd frontend && yarn expo start --port 3000                             # web preview + Expo Go QR
```

## How the app reaches the backend

Every backend route lives under `/api`, because the backend mounts one
`APIRouter(prefix="/api")`. The public preview URL sits in front of both
servers: `/api/*` is forwarded to the backend on `8001`, everything else to
Metro on `3000`.

The app reads that URL from `EXPO_PUBLIC_BACKEND_URL` in its `.env` (filled in
by the platform) and calls `EXPO_PUBLIC_BACKEND_URL + "/api/..."`. The URL has
to be absolute because the same bundle runs on a phone in Expo Go, where a
relative `/api` has nothing to reach. So: never `localhost`, never a port,
never a relative path. Only `EXPO_PUBLIC_*` names are visible to the app, and
Metro bakes their values in at bundle time, so a `.env` change takes effect
only after you restart the Metro program (`expo`).

## Backend

FastAPI, async throughout. The venv is `/root/.venv` (`python` on PATH);
dependencies come from `backend/requirements.txt`.

- **Entry point.** `backend/server.py` creates `app`, creates
  `api_router = APIRouter(prefix="/api")`, registers routes **on the router**,
  then calls `app.include_router(api_router)`. CORS is open. Never attach a
  route to `app` directly; it lands outside `/api` and the phone cannot reach
  it.
- **The route pattern.** Copy the `status` route: a Pydantic model for the
  body and one for the response (`StatusCheckCreate`, `StatusCheck`), an
  `async def` handler decorated with
  `@api_router.post("/status", response_model=StatusCheck)`, and an awaited
  motor call inside. FastAPI validates the body before your handler runs; a bad
  body gets an automatic `422` with `{"detail": [...]}`.
- **Growing.** When `server.py` gets crowded, move models to `backend/models/`
  and routes to `backend/routers/`, one module per resource, each exporting an
  `APIRouter` that `server.py` mounts with `api_router.include_router(...)`.
- **MongoDB.** `server.py` creates `client = AsyncIOMotorClient(MONGO_URL)` and
  `db = client[DB_NAME]`; routers import `db` from there (or from
  `backend/lib/db.py` once you split files). Collections are attributes:
  `await db.status_checks.find({}, {"_id": 0}).to_list(1000)`. Motor connects
  lazily, so importing `server` never waits on Mongo.
- **Ids.** Documents use a string `id` from `uuid4`, not `ObjectId`, which
  cannot be turned into JSON. Keep the `uuid4` default-factory pattern and
  leave `_id` out of every response.
- **Config.** `backend/.env` holds `MONGO_URL` and `DB_NAME`, loaded with
  `python-dotenv`. Mongo runs in the pod, so `MONGO_URL` is `localhost`. Add
  new secrets here and read them with `os.environ`.
- **Dates.** Store aware UTC (`datetime.now(timezone.utc)`, never `utcnow()`);
  motor returns datetimes without a timezone, so attach one before comparing.
- **Quick check.** `cd /app/backend && python -c 'import server'` catches
  syntax and import errors without waiting for the supervisor log.

## Frontend

- The app is built with Expo, React Native and React, written in strict
  TypeScript. The version is as per mentioned in `package.json`. Check there
  if it matters. Metro, the dev server, listens on port `3000` and
  does two jobs at once: it serves the web preview you see in the browser, and
  it serves the manifest that Expo Go downloads when a phone scans the QR
  code. The import alias `@/*` points at the root of the app folder, so
  `@/src/theme` means `frontend/src/theme.ts`.
- **Routing** is expo-router, file-based: every file under `app/` is a screen
  (`app/profile/settings.tsx` is `/profile/settings`), `_layout.tsx` files
  define navigators, typed routes are on. Non-screen code (components, hooks,
  the API module, utilities) goes under `src/`. `app/index.tsx` is a
  placeholder; replace it.
- **Root layout.** `app/_layout.tsx` wraps the app in `ErrorBoundary` →
  `QueryClientProvider` → `KeyboardProvider` → `<Stack>`. Keep those when you
  rewrite it; add your route groups and login gating inside the `Stack`.
- **Theme.** `src/theme.ts` holds the color tokens (keys match the `color`
  block of `/app/design_guidelines.json`), `useTheme()` and `makeStyles()`.
  Every color in a `.tsx` file comes from it; see `TEMPLATE.md` §5.
- **Storage.** `import { storage } from "@/src/utils/storage"`: `getItem`,
  `setItem`, `removeItem` for ordinary data; `secureGet`, `secureSet`,
  `secureRemove` for tokens. Never import AsyncStorage, SecureStore, MMKV or
  `expo-sqlite/kv-store` directly.
- **Uploads.** `import { uploadForm } from "@/src/utils/upload"` for every
  file upload: `uploadForm(url, { fields, files: { image: { uri, name, mimeType } } })`.
  Never append `{ uri, name, type }` to a `FormData` yourself and never set
  `Content-Type`; that passes in the web preview and throws
  `Unsupported FormDataPart implementation` on a phone (see `TEMPLATE.md` §9).
- **Data.** TanStack Query is wired (`src/query-client.ts`, provider in the
  root layout). Use `useQuery` and `useMutation` against one typed API module
  (`src/api.ts`, see `TEMPLATE.md` §4), not fetch inside `useEffect`. Nothing
  generates types across the Python boundary: write a TypeScript interface
  mirroring each Pydantic model and change both in the same edit.
- **Error boundary.** `src/components/error-boundary.tsx` is mounted once at
  the root; a render crash shows a reload screen instead of a blank app. Do not
  add more.
- **testIDs.** `constants/testIds/` is the registry (`auth.js` ships); one file
  per feature, re-exported from `index.js`. React Native uses `testID`, with
  kebab-case values by role.
- **`app.json`** is yours: name, slug, scheme, icon/splash, plugins,
  permissions. `ios.bundleIdentifier` and `android.package` are set by the
  platform; leave them unless the user asks.
- **Packages.** `yarn expo install <package>` for SDK-matched versions. Never
  npm; avoid plain `yarn add` for Expo/RN packages. The `preinstall` guard
  refuses `expo-av`, `expo-barcode-scanner`, `expo-background-fetch` and
  `expo-file-system/legacy`.

## TypeScript

`tsconfig.json` extends `expo/tsconfig.base` with `strict: true`. In the pod:

```bash
cd /app/frontend && yarn tsc --noEmit
```

Metro only transpiles, so this is the only place type errors show up. Lint
with `yarn lint` from the same directory (`expo lint`).

## When the build is complete (tier 1)

Run three checks once, in the same turn: a curl smoke over the key `/api`
endpoints through `EXPO_PUBLIC_BACKEND_URL` (status plus one field, and one
request that should fail); `yarn tsc --noEmit` from the app dir; and one
happy-path walk through the core journey on the web preview at a phone
viewport. All clean → restart Metro and finish. Any failure is a real bug: fix
it, re-run that check, then hand over to the testing subagent. No typecheck,
lint or smoke passes while still building; tier 1 runs exactly once.

## Testing

**Backend (pytest).** Specs in `tests/` at the template root as `test_*.py`.
The ini lives in `backend/`, so pass it explicitly or its settings are skipped:

```bash
cd /app && pytest -c backend/pytest.ini tests
```

`backend/pytest.ini` sets `addopts = -n 2 --dist loadscope`, so tests already
run in parallel; do not pass your own `-n`. Serial is `-n 0`, never
`-p no:xdist` (it errors, because `addopts` still passes `-n`). Tests hit the
live uvicorn process on `8001`, the same app the preview shows.

**Frontend (web preview).** The testing subagent drives `http://localhost:3000`
with Playwright at a phone viewport and writes
`/app/test_reports/iteration_N.json`. It cannot open Expo Go, so native-only
chrome (native tabs, SF Symbols, permission prompts) is checked by following
`TEMPLATE.md` §6 to §8, not by screenshot. Give it every login through
`memory/test_credentials.md`.

## Pod conventions

In the Emergent pod this template runs under supervisord; these override the
local-run notes above.

- Programs: `expo` (Metro, `/app/frontend`), `backend` (uvicorn,
  `/app/backend`), `mongodb`. After changing
  `.env` or `app.json`, or installing a dependency, restart and wait:

  ```bash
  sudo supervisorctl restart expo backend
  for i in $(seq 60); do curl -sf http://localhost:8001/api/ >/dev/null && break; sleep 1; done
  for i in $(seq 90); do curl -s -m 2 http://localhost:3000/status | grep -q 'packager-status:running' && break; sleep 2; done
  ```

- Status only after a restart you triggered: `sudo supervisorctl status expo
  backend`. Logs: `/var/log/supervisor/expo.err.log`,
  `expo.out.log`, `backend.err.log`, `backend.out.log`.
- In a browser, open the preview URL. On a phone,
  scan the Expo Go QR code. The backend answers on `8001` directly, or through
  the preview URL under `/api`.
- Mongo runs in the pod (`mongod --bind_ip_all`); `MONGO_URL` is `localhost`.
- Both servers reload on code edits (Fast Refresh, uvicorn `--reload`), so
  normal iteration needs no restart. You still restart after `.env`,
  `app.json` or package changes, and always restart Metro before handing the
  preview back to the user.
- Protected, never edit (relative to the app dir): `metro.config.js`,
  `scripts/**`, `tsconfig.json`, `eslint.config.js`, the platform keys in
  `.env`, and `backend/pytest.ini`. Never create `eas.json`.
