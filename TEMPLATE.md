# expo — what is in this template

Read this once. It holds every fact about the template you would otherwise
learn by opening files. README.md explains how to work; this file explains
what is here. You do not need to open `package.json`, `yarn.lock`,
`tsconfig.json`, `metro.config.js`, `eslint.config.js`, `scripts/`,
`constants/`, `src/utils/storage/`, `src/components/error-boundary.tsx`,
`src/query-client.ts` or `app/+html.tsx`; they are described below.

## 1. What is already running

When your session starts, everything is up: the supervisor programs `expo`,
`backend` and `mongodb` are running and the preview URL already loads. The
"preview must work before the first ask_human" rule is already met, so do not
check `supervisorctl status`, curl a health endpoint, or restart anything at
the start. The testing subagent should not either.

- **Metro** (program `expo`, `yarn expo start --port 3000`) serves the app two
  ways at once: a **web preview** at the pod's preview URL, and an **Expo Go QR
  code** for phones.
- **Backend**: FastAPI under uvicorn on port `8001` (program `backend`).
- **MongoDB**: in-pod (program `mongodb`).
- The preview URL fronts both: `/api/*` goes to the backend on `8001`,
  everything else to Metro on `3000`.

**Paths and env.** The app's `.env` holds `EXPO_PUBLIC_BACKEND_URL`, the public
preview URL with no port and no trailing slash (see §4). `backend/.env` holds
`MONGO_URL` and `DB_NAME`. The alias `@/*` points at the app dir root, not
`src/`: write `@/src/theme`, `@/src/utils/storage`. The backend interpreter is
`/root/.venv/bin/python` (`python` on PATH). The package manager is yarn, at
the version `packageManager` in `package.json` pins; never npm.

**Versions.** None are written here. Every package is at whatever
`package.json` pins; open that file only when a version matters.

**Testing subagent.** It reads logins from `memory/test_credentials.md`, tests
the **web preview** with Playwright at a phone viewport, and writes
`/app/test_reports/iteration_N.json`. It cannot open Expo Go, so native-only
chrome (native tabs, SF Symbols, permission prompts) is only verified by
following §6 to §8 exactly.

## 2. Already installed — do not install these

- **Core**: Expo, React Native, React, `expo-router` with typed routes on,
  `@expo/metro-runtime`, `react-native-web` (the web preview).
- **Expo modules**: `expo-blur`, `expo-constants`, `expo-font`, `expo-haptics`,
  `expo-image`, `expo-linear-gradient`, `expo-linking`, `expo-secure-store`,
  `expo-splash-screen`, `expo-status-bar`, `expo-symbols` (SF Symbols, iOS
  only), `expo-system-ui`, `expo-web-browser`.
- **RN libraries**: `react-native-reanimated` + `react-native-worklets`,
  `react-native-gesture-handler`, `react-native-keyboard-controller`
  (`KeyboardProvider` already mounted), `react-native-safe-area-context`,
  `react-native-screens`, `react-native-webview`,
  `@react-native-async-storage/async-storage` (use the `storage` helper, never
  import it directly).
- **Data/utils**: `@tanstack/react-query`, `date-fns`, `dayjs`.
- **Dev**: `typescript`, `eslint` + `eslint-config-expo`, `expo-doctor`.
- **Backend** (`backend/requirements.txt`): `fastapi`, `uvicorn`, `motor`,
  `pymongo`, `pydantic` v2, `python-dotenv`, `requests`, `pandas`, `numpy`,
  `python-multipart`, `boto3`, `typer`, `emergentintegrations`, `pytest` +
  `pytest-xdist`, and for auth `pyjwt`, `python-jose`, `passlib`, `bcrypt`,
  `cryptography`, `email-validator`.
- **Fonts**: only `assets/fonts/SpaceMono-Regular.ttf`. For a custom font, put
  its `.ttf` under `assets/fonts/` and load it with `useFonts` from
  `expo-font`. Never `@expo-google-fonts/*`.

**Not installed**; run `yarn expo install <package>` first: icon packs like
`@react-native-vector-icons/<family>` (never `@expo/vector-icons`),
`@gorhom/bottom-sheet`, `react-native-svg`, `expo-camera`, `expo-location`,
`expo-image-picker`, `expo-notifications`, `expo-file-system` (only present
transitively, add it yourself), `react-native-maps`, charts
(`victory-native`, `react-native-gifted-charts`), `lottie-react-native`,
`@shopify/react-native-skia`.

**Blocked**; the `preinstall` guard refuses them, use the replacement:
`expo-av` → `expo-audio` / `expo-video`; `expo-barcode-scanner` →
`expo-camera`; `expo-background-fetch` → `expo-background-task`;
`expo-file-system/legacy` → `expo-file-system`.

## 3. Where things are

`frontend/` is the app dir.

| Path | What it is |
|---|---|
| `backend/server.py` | FastAPI entry. Creates `app`, creates `api_router = APIRouter(prefix="/api")`, registers routes on the **router**, then `app.include_router(api_router)`. CORS open. Copy the `StatusCheck` route (string `uuid4` id). The Mongo `client`/`db` are built here. |
| `backend/models/`, `backend/routers/` | Do not exist yet. Create them when `server.py` gets crowded: models per resource, one `APIRouter` per resource mounted with `api_router.include_router(...)` above the final include. |
| `backend/.env` | `MONGO_URL`, `DB_NAME`; keep those values. Add new secrets below and read them with `os.environ`. |
| `backend/requirements.txt` | Add a pin for every package you install. |
| `backend/pytest.ini` | Pinned for the testing subagent. Never edit. |
| `frontend/app/_layout.tsx` | Root layout: `ErrorBoundary` → `QueryClientProvider` → `KeyboardProvider` → `<Stack screenOptions={{ headerShown: false }} />`, plus `LogBox.ignoreAllLogs(true)`. Keep all four when you rewrite it; add your groups (`(tabs)`, `(auth)`) and login gating inside the `Stack`. |
| `frontend/app/index.tsx` | Placeholder splash. Replace it. |
| `frontend/app/+html.tsx` | Web shell. Leave it. |
| `frontend/app.json` | Expo config, yours to edit: `name`, `slug`, `scheme`, icon/splash, `plugins`, `ios.infoPlist`, `android.permissions`. `ios.bundleIdentifier` / `android.package` are set by the platform; change only if the user asks. |
| `frontend/.env` | `EXPO_PUBLIC_BACKEND_URL` (read it) plus platform keys `EXPO_PACKAGER_PROXY_URL`, `EXPO_PACKAGER_HOSTNAME`, `EXPO_TUNNEL_SUBDOMAIN`, `METRO_CACHE_ROOT`, `EXPO_USE_FAST_RESOLVER`; never change those. New keys must start with `EXPO_PUBLIC_`. |
| `frontend/src/theme.ts` | Color tokens, `useTheme()`, `makeStyles()`, `setColorScheme()`. See §5. |
| `frontend/src/query-client.ts` | The one `QueryClient`. Import it for cache calls outside components. |
| `frontend/src/components/error-boundary.tsx` | App-level error boundary (reload screen on a render crash). Do not add more. |
| `frontend/src/utils/storage/` | The `storage` singleton: `getItem/setItem/removeItem` for plain key-value, `secureGet/secureSet/secureRemove` for tokens (keychain; AsyncStorage on web). Metro picks `index.web.ts` on web, so no `Platform.OS` checks. |
| `frontend/src/utils/upload.ts` | `uploadForm(url, { fields, files, headers })`: the only way to send a file. Builds the multipart body correctly for web and native; see §9. |
| `frontend/constants/testIds/` | `testID` registry, one file per feature re-exported from `index.js` (`auth.js` ships). |
| `frontend/metro.config.js`, `tsconfig.json`, `eslint.config.js`, `scripts/**`, `package.json` `main` | Protected. Never edit. |
| `frontend/eas.json` | Does not exist; never create it. Emergent manages builds. |
| `memory/test_credentials.md` | Write every seeded login here before calling the testing subagent. |
| `test_reports/`, `tests/` | Subagent reports; backend pytest package. |

## 4. How the app talks to the backend

The same bundle runs in a browser and on a phone in Expo Go. On the phone there
is no same-origin backend, so a relative `/api/...` goes nowhere. Every call is
therefore an absolute URL: `EXPO_PUBLIC_BACKEND_URL + "/api/things"`. Never
`localhost`, never a port, never a relative path. Only `EXPO_PUBLIC_*` names
reach the app, and Metro bakes their values in at bundle time, so a `.env`
change needs a Metro restart (§11).

Nothing generates types across Python and TypeScript. For each endpoint you
write a Pydantic model and a TypeScript interface that mirrors it, and you
change both in the same edit.

```python
# backend/routers/things.py — every route hangs off a router, never off app
router = APIRouter()

class Thing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@router.get("/things/{id}", response_model=Thing)         # ← braces, FastAPI style
async def get_thing(id: str):
    doc = await db.things.find_one({"id": id}, {"_id": 0})  # ← never leak _id
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    return Thing(**doc)
```

```ts
// frontend/src/api.ts — create this once; every hook goes through it
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface Thing { id: string; name: string; created_at: string }   // mirrors the model
const thing = await api<Thing>(`/things/${id}`);   // → <EXPO_PUBLIC_BACKEND_URL>/api/things/<id>
```

Backend details that bite:

- **Ids** are string `uuid4`, never `ObjectId`. `ObjectId` cannot be turned
  into JSON, so if it reaches a response the request fails with a 500. Read
  with a `{"_id": 0}` projection: `await db.things.find({}, {"_id": 0}).to_list(1000)`.
- **Everything is async**: `async def` handlers, `await` every motor call.
- **Validation is automatic**: a body that does not match the model gets a
  `422` with `{"detail": [...]}` before your handler runs.
- **Datetimes**: Mongo stores UTC but motor returns them with no timezone.
  Comparing one against `datetime.now(timezone.utc)` raises `TypeError` (a
  500). Store aware UTC (`datetime.now(timezone.utc)`, never `utcnow()`) and
  attach the timezone on read with `dt.replace(tzinfo=timezone.utc)`.

**Data fetching**: `useQuery` to read, `useMutation` to write, and invalidate
the affected key after a mutation. Not fetch-in-`useEffect`.

**Auth tokens**: one method and one key constant, used the same way on both
sides. Login saves with `await storage.secureSet(TOKEN_KEY, token)`;
`src/api.ts` reads with `await storage.secureGet(TOKEN_KEY, null)` for the
`Authorization: Bearer` header. A mismatch returns the fallback silently and
looks like a logged-out user. `storage` holds `string | number | boolean |
null`, does the JSON for you, and never throws (fallback on a miss, `false` on
a failed write).

## 5. Colors — `src/theme.ts`

Every color in the app comes from this file.

- The keys of `light` match the `color` block of `/app/design_guidelines.json`.
  Fill the values from there (or the user's brand colors). Keep every key, add
  more freely, never create a second theme file.
- Keys come in pairs: a plain key is a background, its `on` partner is the
  text/icon color on it (`surface`/`onSurface`, `brandPrimary`/`onBrandPrimary`,
  `success`/`onSuccess`). `muted` is subdued text on `surface`; `border`,
  `borderStrong`, `divider` are lines.
- Build style sheets with `makeStyles`, which gives you a hook:

  ```ts
  const useStyles = makeStyles((colors) => ({
    card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
  }));
  function Screen() { const styles = useStyles(); ... }
  ```

  For color props that are not styles (icon `color`, `placeholderTextColor`,
  `ActivityIndicator`) read `useTheme().colors` in the component. Never
  `StyleSheet.create` with colors at the top of a file; it cannot follow a
  theme change.
- A literal hex in a `.tsx` file is only for a color that must be identical in
  light and dark, such as a third-party brand mark.
- Dark mode: add a `dark` object to `themes` with every key filled and the
  device setting takes over. `setColorScheme("dark" | "light" | null)` is the
  in-app toggle; persisting the choice is the toggle's job.

## 6. Navigation and safe areas

**Routing.** expo-router is file-based: `app/profile/settings.tsx` is the route
`/profile/settings`, a `_layout.tsx` defines its folder's navigator, and
non-screen code lives under `src/`. Hooks: `useRouter()` (`push`, `replace`,
`back`, `setParams`), `useLocalSearchParams<T>()`, `useGlobalSearchParams()`,
`useSegments()`. Typed routes are on, so `router.push` to a path with no file
is a type error; create the file in the same edit.

**Which pattern.** Two to four main areas → tabs (max four, one-word labels,
selected clearly different from unselected). A linear flow → stack. Rarely
used admin/settings → modal or drawer. Never tabs for one screen; full-screen
modals and bottom sheets live outside the tab navigator.

**Native tabs on iOS 26+ (P0).** Define the check once in `src/navigation.ts`
and import it in the tabs layout and every tab screen:

```ts
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
```

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";   // "unstable" is only the path
<NativeTabs.Trigger name="index">
  <NativeTabs.Trigger.Icon sf="house.fill" />
  <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

The module exports only `NativeTabs`; importing `Icon` or `Label` from it gives
`undefined` and the bar silently shows raw route names. Never set
`backgroundColor` on `NativeTabs` (it kills Liquid Glass). Older iOS, Android
and web use the classic `<Tabs>` with a styled JS bar, imported from
`expo-router/js-tabs` (the bare `expo-router` export is deprecated in 57).

**Insets, never `SafeAreaView`.** The screen root is `flex: 1` with a
background, so it paints edge to edge; position content with
`useSafeAreaInsets()` padding, only on edges no navigator chrome already
handles (no top padding under a stack header, no bottom inset above a
non-absolute tab bar).

**Tab bar height.** Never set it on native. Web only:
`tabBarStyle: { ...(Platform.OS === "web" ? { height: 64 } : {}) }`, and
always `tabBarItemStyle: { alignSelf: "center" }`. For the JS `<Tabs>` bar
read `useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom`;
`BottomTabBarHeightContext` comes from `expo-router/js-tabs` too.
`@react-navigation/bottom-tabs` is not installed (expo-router 57 vendors it),
so never import from it. A default bar sits outside the viewport, so
content needs only normal 16–24 bottom spacing; only a `position: "absolute"`
bar needs `paddingBottom: tabBarHeightWithInsets`.

**Bottom spacing in tab screens (P0).** Native tabs float over content and the
web preview cannot show them, so a web screenshot never tells you what is
hidden under the bar. Inside a native-tabs screen `insets.bottom` already
includes the bar. In every tab screen:
`const bottomChrome = usesNativeTabs ? insets.bottom : 0;` Non-scrolling
content pads by `bottomChrome`; floating elements sit at
`bottom: bottomChrome + 16`. Never a literal `bottom` (16, 24, `spacing.lg`)
in a tab screen, and re-check floating elements whenever a screen moves into
`(tabs)/`. Modals and sheets outside the tabs pad with `insets.bottom`/`top`.

## 7. UI rules

- **React Native components only.** No HTML elements, `className`, CSS
  imports, `onClick` (use `onPress`), or web-only libraries (Three.js DOM,
  Spline, Framer Motion, D3). Styles through `StyleSheet.create` (which
  `makeStyles` does); `Platform.select()` for platform differences;
  `expo-image` for every image, never bare `Image`; `react-native-reanimated`
  for motion.
- **Sizes.** Touch targets at least 44pt iOS / 48pt Android; 8-point grid using
  the exact `spacing` and `radius_tokens` from `design_guidelines.json`; nothing
  overflows (clip it); minimal spacing at the top and bottom of a screen.
- **Headers** stay sticky and safe-area aware, including custom ones with a
  background image.
- **No `Alert`.** Use a bottom sheet or toast, mounted high enough that the tab
  bar never covers it. No `zIndex` on ordinary components; it breaks modals and
  sheets.
- **Floating buttons** at `bottom: bottomChrome + 16` (§6).
- **Chip rows (P0, the most common mistake).** One horizontal `ScrollView` or
  `FlatList` (`horizontal`, `showsHorizontalScrollIndicator={false}`). Chips
  never wrap; extra chips scroll off the right. Each chip has `flexShrink: 0`
  so it is not squashed. Gaps via `contentContainerStyle` (`gap` +
  `paddingHorizontal`), not flex. Chip 36pt, row 56pt. The selected chip
  changes only color or border, never size, padding or weight. The row is part
  of the sticky header above the list, identical in loading, empty, error and
  loaded states, and the list has enough `paddingTop` to clear header and row.
- **Feedback.** Activity indicators while loading, pull-to-refresh on lists,
  offline and background/foreground handling where it matters.
- **Keyboard.** `KeyboardProvider` is mounted; every screen with a text input
  follows the `expo-keyboard-experience` skill.
- **Icons.** `@react-native-vector-icons/<family>` (install first) or
  `expo-symbols` on iOS. Never emoji as icons.
- **testIDs** on every interactive element and every element showing
  user-facing info: kebab-case by role (`login-submit-button`), unique,
  registered under `constants/testIds/`.

## 8. Permissions, and features that need a real build

**Declare** permissions in `app.json` as soon as a feature needs them:
`expo.android.permissions` for Play review and `expo.ios.infoPlist` usage
descriptions for App Store review. Keep iOS descriptions under ten words and
say the benefit: "Scan receipts to automatically track expenses", not "This
app needs camera access".

**Ask at runtime** (camera, microphone, photos, location, contacts,
notifications, Bluetooth, motion, health) like this: check before requesting;
ask in context right after the user shows intent, with a short note on the
benefit first; handle granted, denied, undetermined and permanently blocked;
respect `canAskAgain` and ask at most once more; after a final denial always
show an "Open Settings" button that calls `Linking.openSettings()`, not just
text; ask for permissions one at a time as needed; and never dead-end the user,
a denial removes one capability, not the app.

**Native-build only.** Background audio playback or recording,
picture-in-picture video and push notifications do not work in Expo Go or the
web preview. After implementing one, say so, never claim it verified from the
preview, and tell the user to trigger a build before testing.

## 9. Traps

| What | Why it matters |
|---|---|
| `@/*` is the app dir root | `@/src/theme`, `@/src/utils/storage`, `@/constants/testIds`; `@/theme` does not resolve. |
| `EXPO_PUBLIC_*` baked in at bundle time | A `.env` edit does nothing until `sudo supervisorctl restart expo`. Unprefixed names never reach the app. |
| `LogBox.ignoreAllLogs(true)` | Runtime errors do not show in the preview. Read `/var/log/supervisor/expo.err.log`, `expo.out.log` and the browser console; a render crash shows the error boundary's reload screen. |
| Typed routes | `router.push("/nope")` fails typecheck. Route files only under `app/`. |
| `yarn add` for an Expo/RN package | May pick an SDK-mismatched version. Always `yarn expo install`; never npm. |
| Route on `app` instead of `api_router` | Lands outside `/api`; the ingress never forwards it from the phone. |
| Sync handler on the backend | Blocks the whole server. `async def` + `await` everywhere. |
| Raw Mongo doc in a response | `ObjectId` is not JSON → 500. Project `{"_id": 0}`. |
| Naive datetime from motor | `TypeError` against an aware `now()`. Attach the timezone on read (§4). |
| `strict: true` | Never loosen it; fix the type. `yarn lint` (`expo lint`) is useful but not a per-edit gate. |
| File upload with `form.append(f, { uri, name, type })` | Works in the web preview, throws `Unsupported FormDataPart implementation` on every phone: the native global fetch is `expo/fetch`. `fetch(fileUri).blob()` fails on Android too. Always `uploadForm` from `@/src/utils/upload` (reads the file through `expo/fetch`, no extra package); never set `Content-Type`. |
| Metro program is `expo` | `supervisorctl restart frontend` does nothing; there is no program by that name. |

## 10. Before you finish

- **Typecheck once**, as a named step when the build is complete:
  `cd /app/frontend && yarn tsc --noEmit`. Metro never
  typechecks, so this is the only place model/interface drift and bad imports
  show up. Also `cd /app/backend && python -c 'import server'`.
- **Curl** the key endpoints through the URL the phone uses:
  `API_URL=$(grep '^EXPO_PUBLIC_BACKEND_URL=' /app/frontend/.env | cut -d= -f2)`
  then `curl -s "$API_URL/api/things"`. Check the
  status and a field, plus one request that should fail.
- **Screenshot** the web preview with `screenshot_tool` at a phone viewport
  (390×844) through the main journey; note console errors and any response of
  400 or above; look for overflow and cropped or off-topic images. Native tabs
  and iOS-only chrome are not visible here; trust §6.
- **Handoff**: every seeded login into `memory/test_credentials.md`. If it is
  empty the subagent reports that instead of testing auth.
- Then run the gate your system prompt defines. Anything deeper is the testing
  subagent's job.
- **Restart Metro before you stop** for `ask_human` or `finish`, so the user
  sees your latest edit.

## 11. Restart — only after a config change

Fast Refresh and uvicorn `--reload` pick up code edits. Restart only after
changing `.env` or `app.json` or installing a dependency; never at session
start, never between edits.

```bash
sudo supervisorctl restart expo backend
for i in $(seq 60); do curl -sf http://localhost:8001/api/ >/dev/null && { echo "backend up"; break; }; sleep 1; done
for i in $(seq 90); do curl -s -m 2 http://localhost:3000/status | grep -q 'packager-status:running' && { echo "metro up"; break; }; sleep 2; done
```

Keep a `GET /api/` route so the first poll has something to hit. Status only
after a restart you triggered: `sudo supervisorctl status expo backend`.
Logs: `/var/log/supervisor/expo.err.log`, `expo.out.log`, `backend.err.log`,
`backend.out.log`.

## 12. Preview versus deployed

- This pod is the preview. The user deploys with the **Publish** button (top
  right) and generates iOS/Android builds there; Emergent manages the Expo
  account and EAS. Never suggest EAS CLI, a personal Expo account or external
  build tools.
- A mobile app has no hosted web frontend; `https://<app>.emergent.host` only
  says "details not found". The deployed app is tested via the Expo Go QR code
  in the deployment panel.
- `EMERGENT_PUSH_KEY` in `.env` is set from "placeholder" to its real value
  during deployment. Never edit it.
- New `.env` keys are copied to the deployment secrets store on first deploy
  and edited there afterwards (Deployment Panel → Secrets); a redeploy does not
  overwrite them.
- `ios.bundleIdentifier` / `android.package` in `app.json` are used by the
  build flow and must stay stable; `google-services.json` for push is tied to
  the Android package.
