# Cloud Browser — Performance Handoff to ChatGPT

> **Copy everything below this line into ChatGPT.** It contains the full context, mission, constraints, and verification rules needed to implement maximum performance optimizations across the platform.

---

## MISSION

**Make every single client on the home page as fast as technologically possible.**

The "home page" is the Dashboard (`src/pages/Dashboard.jsx`, route `/`), branded "Connection Hub." Every client (project) lands here first. The goal is to minimize time-to-interactive, time-to-first-paint, and perceived latency for every client viewing this page and every downstream page — without breaking any existing functionality, security, or data isolation.

Target: the home page and all client-facing pages should feel instant (sub-200ms perceived interaction, sub-1s full load on a cold connection) regardless of how many projects, API keys, sessions, or jobs a client has.

---

## WHAT THIS SYSTEM IS

Cloud Browser is an enterprise-grade, self-hosted browser-automation platform. Two halves:

1. **Control plane** — this Base44 app (React + Tailwind + Vite, BaaS backend). Pages, entities, backend functions, workflows, agents. Published at https://cloud-browser.base44.app
2. **Browser engine** — a separate Node.js/Playwright service (repo: `browser-engine/`) deployed on Railway. The control plane talks to it over authenticated HTTP/WebSocket.

The control plane is what you are optimizing. The engine is out of scope for direct edits here (it requires an external operator deploy), but control-plane calls to it can be made faster.

---

## ARCHITECTURE & FILE MAP (control plane only)

**Frontend (React + Tailwind + Vite, ESM only):**
- `src/App.jsx` — router. Auth wrappers, ProtectedRoute, Layout. DO NOT rewrite wholesale; edit surgically.
- `src/components/Layout.jsx` — sidebar + outlet shell wrapping every authenticated page.
- `src/pages/Dashboard.jsx` — THE HOME PAGE. Loads `ApiKey.list` + `Project.list` in parallel on mount. This is the primary optimization target.
- `src/pages/Projects.jsx`, `Sessions.jsx`, `Jobs.jsx`, etc. — downstream client pages.
- `src/components/` — UI components. shadcn/ui primitives live in `src/components/ui/`.
- `src/api/base44Client.js` — pre-initialized Base44 SDK. All entity/API calls go through `base44.entities.*` and `base44.functions.invoke(...)`.

**Data layer (Base44 entities — JSON schemas in `base44/entities/*.jsonc`):**
- `Project` — a client. Fields: name, description, status, api_key_id, default_session_config, color.
- `ApiKey`, `Session`, `Job`, `Step`, `Result`, `Screenshot`, `LogEntry`, `Schedule`, `Proxy`, `Profile`, `Webhook`, `AuditLog`, `Template`, `Setting`, `SystemEnhancement`, and ~30 more.
- Every entity has built-ins: `id`, `created_date`, `updated_date`, `created_by_id`.
- RLS (row-level security) is configured per entity under an `rls` key — most are owner-or-admin. DO NOT weaken RLS.

**Backend functions (`base44/functions/<name>/entry.ts`):**
- HTTP handlers for external APIs / heavy logic. Called from frontend via `base44.functions.invoke("name", payload)`.
- Relevant to performance: `createApiKey`, `createProject`, `getMetrics`, `getObservabilityMetrics`, `engineHealth`, `runJob`.
- Shared logic lives in `base44/shared/` (e.g., `engineClient.ts`, `costCalculator.ts`, `crypto.ts`).

**Key SDK patterns:**
```js
import { base44 } from "@/api/base44Client";
base44.entities.Project.list("-created_date", 50)          // sort, limit
base44.entities.Project.filter({status:"active"}, "-created_date", 10)
base44.entities.ApiKey.list("-created_date", 50)
const res = await base44.functions.invoke("createApiKey", { name, scopes });
```

---

## CURRENT HOME PAGE BEHAVIOR (Dashboard.jsx)

On mount it fires two parallel calls:
```js
const [keys, projs] = await Promise.all([
  base44.entities.ApiKey.list("-created_date", 50).catch(() => []),
  base44.entities.Project.list("-created_date", 50).catch(() => []),
]);
```
Then renders: a header, a "new key" banner, a CAPTCHA solver card, a "Full Connection Package" card, endpoint copy blocks, the API keys list, and the projects list. There is **no pagination, no virtualization, no skeleton loading, no caching, no prefetch, no code-splitting, and no optimistic UI**. Every navigation re-fetches from scratch.

---

## PERFORMANCE ENHANCEMENT AREAS (implement all that apply)

### 1. Home page (Dashboard.jsx) — primary target
- **Skeleton loaders** instead of a spinner: show the page structure immediately, fill data as it arrives.
- **Stale-while-revalidate caching** of `ApiKey.list` and `Project.list` results (use `@tanstack/react-query`, already installed) so returning clients see last-known data instantly while a refresh runs in the background.
- **Prefetch downstream data** on hover/focus of project rows (e.g., prefetch `Session`/`Job` counts for the Projects page) using react-query's `prefetchQuery`.
- **Defer non-critical cards** (Captcha Solver, Connection Package, API Docs link) with `React.lazy` + `Suspense` so the critical path (projects + keys) renders first.
- **Paginate or cap** the keys/projects lists with a "show more" pattern instead of always loading 50.
- **Optimistic UI** for key generation/regeneration so the UI updates before the round-trip completes.

### 2. App-wide frontend performance
- **Code-split every page** with `React.lazy` in `src/App.jsx` so the initial bundle only ships the Dashboard. Each route is a dynamic import.
- **Memoize expensive lists** (`React.memo` on list rows, `useMemo` on derived counts/sorting).
- **Avoid layout thrash** — use `content-visibility: auto` on long offscreen lists.
- **Image optimization** — content images must use the `Image` component from `@/components/ui/image` (serves WebP + responsive srcset). Never raw `<img>`.
- **Bundle analysis** — ensure no unused heavy deps are imported on the home page (recharts, react-quill, three, leaflet, dnd should all be lazy-loaded only where used).

### 3. Data layer / query efficiency
- **Select only needed fields** where the SDK supports it; avoid pulling large `default_session_config` blobs for list views.
- **Denormalize counts** (session count, job count, cost total) onto the Project record or a lightweight summary endpoint so the home page doesn't fan out N queries per project.
- **Cache read-heavy, rarely-changing data** (system settings, capability registry, templates) with react-query + long `staleTime`.
- **Infinite scroll / virtualization** for long lists (Sessions, Jobs, Logs) using `@tanstack/react-query` infinite queries — never render thousands of rows.

### 4. Backend function latency
- **Parallelize independent I/O** inside functions (`Promise.all`), never sequential awaits for unrelated calls.
- **Add caching** to read-only functions (`getMetrics`, `getObservabilityMetrics`, `engineHealth`) — cache results for 30–60s in-memory or via a `Setting`/cache entity.
- **Stream large responses** rather than buffering — for job progress, live view, exports.
- **Reduce payload size** — return only the fields the caller needs; strip `default_session_config`, encrypted blobs, etc. from list responses.

### 5. Perceived performance
- **`ScrollToTop`** already exists — keep it.
- **Transition-based navigation** — use `startTransition` for route changes so the UI stays responsive during heavy renders.
- **Preconnect / dns-prefetch** to the engine host and any external image hosts in `index.html`.
- **Font preloading** — if custom fonts are added, preload them; currently the app uses system fonts (no web font cost).

---

## HARD CONSTRAINTS (do not violate)

1. **Non-destructive.** Never remove or rewrite working functionality. Additive changes only. Refactor only when a change can't land cleanly.
2. **Fail-closed security.** Never weaken RLS, auth, SSRF protection, API key hashing, or encryption to gain speed.
3. **No new npm packages** unless explicitly requested. Use only what's installed (react-query, lodash, date-fns, recharts, framer-motion, etc. are all available).
4. **ESM only.** No `require()` / `module.exports` — this is Vite ESM.
5. **Import rules:** use `@/` alias. `cn` from `@/lib/utils`. `createPageUrl` from `@/utils`. shadcn components imported one-per-file. Never import a name that collides with a local declaration (alias lucide icons if needed).
6. **Tailwind classes as literal strings** — no dynamic `bg-${color}-500` (the build purges them).
7. **Auth routes** (`/login`, `/register`, `/forgot-password`, `/reset-password`) and `ProtectedRoute` must stay intact and registered in `src/App.jsx`.
8. **Entity files** (`base44/entities/*.jsonc`) are full JSON objects — rewrite the whole file when editing, never partial.
9. **Don't touch the browser engine** (`browser-engine/*`) — it requires an external Railway deploy by an operator. Optimize control-plane calls to it, not the engine itself.
10. **Don't add speculative features.** Only performance work. No new pages, no new entities, no new buttons unless they directly serve the speed mission.

---

## VERIFICATION (prove it's faster)

Before claiming done, verify each change with **runtime evidence**, not assertions:
- **Lighthouse / Performance panel** on the home page before and after — show the LCP, TTI, and Total Blocking Time deltas.
- **Network waterfall** — confirm fewer round-trips, smaller payloads, and parallelized calls on the home page.
- **Bundle size** — confirm the initial JS bundle shrank after code-splitting (check the Vite build output).
- **Cold vs warm load** — confirm stale-while-revalidate makes warm loads near-instant.
- **No regressions** — every existing flow still works: login, create project, generate key, run job, view sessions. Run the existing test suites if available (`runTestSuite`, `runMasterReleaseSuite`).

---

## HOW TO START

1. Read `src/pages/Dashboard.jsx`, `src/App.jsx`, `src/components/Layout.jsx`, and `src/api/base44Client.js`.
2. Establish a baseline: Lighthouse the home page, note LCP/TTI/bundle size.
3. Implement in order of impact: (a) code-split routes, (b) react-query stale-while-revalidate on home page, (c) skeleton loaders, (d) prefetch on hover, (e) memoize lists, (f) defer non-critical cards.
4. Re-measure after each change. Keep what helps; revert what doesn't.
5. Never end a step with a broken build — every import must resolve, every route must still work.

**The bar: every client, on every page, feels instant — proven by before/after numbers, not by how the code looks.**