# DISCOVERY for LifeOS ChatGPT browser handoff prompt

**Дата:** 2026-08-10 12:58:24 EEST
**Фаза:** A — Discovery, read-only аналіз перед створенням handoff-промпта
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Branch:** `design-sync-setup`
**Запит:** створити комплексний професійний промпт, з яким розробку LifeOS можна продовжити у браузерному ChatGPT.

## 1. Executive verdict

1. **VERIFIED:** канонічний runtime уже не є експортом Claude Design. Поточна система складається з React/Vite frontend у `apps/web` та FastAPI/PostgreSQL backend у `apps/api` (`apps/web/package.json:1-23`, `apps/api/pyproject.toml:1-24`, HEAD `67a1456`).
2. **VERIFIED:** frontend захищений auth gate і зберігає спільний state v2 на сервері через cookie-authenticated API та optimistic revision control (`apps/web/src/App.jsx:494-529`, `apps/web/src/context/LifeDataContext.jsx:262-380`, `apps/web/src/repositories/stateSyncCoordinator.ts:20-205`, HEAD `67a1456`).
3. **VERIFIED:** backend має основу multi-account із таблицями users/sessions/user_snapshots, але UI/API створення другого та наступних акаунтів ще немає: bootstrap навмисно закривається після першого користувача (`apps/api/app/models/user.py:11-25`, `apps/api/app/models/session.py:11-29`, `apps/api/app/models/user_snapshot.py:12-30`, `apps/api/app/services/auth.py:51-77`, HEAD `67a1456`).
4. **VERIFIED:** `ARCHITECTURE.md` частково застарів: він називає browser Babel та `ui_kits/life-os` runtime і описує snapshot у localStorage (`ARCHITECTURE.md:7-13`, `ARCHITECTURE.md:15-32`, `ARCHITECTURE.md:99-111`), тоді як HEAD використовує Vite та server-backed repository (`apps/web/package.json:6-22`, `apps/web/src/repositories/serverStateRepository.ts:27-45`).
5. **VERIFIED:** у репозиторії немає tracked Dockerfile, Compose, systemd unit, nginx config або GitHub Actions deployment workflow (повний `git ls-files` grep на HEAD `67a1456` → 0 збігів). VPS-пакування й deploy runbook ще треба реалізувати окремо.
6. **VERIFIED:** останній зафіксований audit на цьому самому HEAD має verdict `STATIC/OFFLINE GREEN; LOCAL RUNTIME INCOMPLETE`: frontend 6/6 files і 28/28 tests, backend static gates green, але browser→API→PostgreSQL E2E не виконано (`Outputs/Audits/pf-01-batch-3-1-local-verification_audit_2026-07-21_232305.md:1-25`, `:68-124`).

## 2. Evidence basis and repository state

- **VERIFIED:** `git rev-parse HEAD` → `67a1456c6165e9bdf36382a98c9713c4ed981314`.
- **VERIFIED:** останні зміни canonical runtime: `6c7039a chore(web)`, `102aea4 feat(api)`, `67a1456 feat(sync)`; `git log -- apps/web apps/api ARCHITECTURE.md Outputs/backlog-tasks` на HEAD `67a1456`.
- **VERIFIED:** worktree вже містить user-owned changes/untracked artifacts: modified `.DS_Store`; untracked `AGENTS.md`, `BATCH1-FIX-PROMPT.md`, `CLAUDE.md`, `MASTER-PROMPT.md`, `lifeos-ui-map.md`, `tests/` та `Outputs/*`. Їх не можна перезаписувати або включати до майбутнього commit без окремої перевірки.
- **VERIFIED:** `MASTER-PROMPT.md` і `CLAUDE.md` не tracked. Тому новий prompt не повинен автоматично використовувати ці назви.

## 3. Actual stack

### 3.1 Frontend

| Area | Finding |
|---|---|
| Runtime | **VERIFIED:** React `18.3.1` + React DOM `18.3.1` (`apps/web/package.json:14-16`, HEAD `67a1456`). |
| Build | **VERIFIED:** Vite `8.1.5`; `dev`, `build`, `preview` scripts (`apps/web/package.json:6-12`, `:18-22`). |
| Language | **VERIFIED:** mixed JSX/JavaScript product UI plus TypeScript API/repository boundary; TypeScript `7.0.2` (`apps/web/src/App.jsx:1-26`, `apps/web/src/api/client.ts:1-79`, `apps/web/package.json:18-22`). |
| Quality | **VERIFIED:** ESLint `10.7.0`, Vitest `4.1.10`, `typecheck`, `lint`, `test`, `build` commands (`apps/web/package.json:6-23`). |
| Routing | **VERIFIED:** custom hash routing, not React Router; 15 top-level route IDs (`apps/web/src/app/routes.js:1-17`, `apps/web/src/App.jsx:43-53`, `:210-224`). |
| Styling | **VERIFIED:** one canonical stylesheet with CSS variables/themes (`apps/web/src/main.jsx:1-17`, `apps/web/src/styles.css:8-12`, `:82-135`, `:218-245`). |
| i18n | **VERIFIED:** custom React context; RU primary and UA secondary; EN reserved, not enabled (`apps/web/src/context/LocaleContext.jsx:3-8`, `:1286-1322`). |
| Charts | **VERIFIED:** repository dependencies contain no chart library; chart components live under `apps/web/src/pages/home/`; native SVG is used in product components (complete dependency list `apps/web/package.json:14-23`; SVG matches in `apps/web/src/pages`/`components`). |

### 3.2 Backend

| Area | Finding |
|---|---|
| Runtime | **VERIFIED:** Python `>=3.11,<3.12` (`apps/api/pyproject.toml:1-6`). |
| HTTP | **VERIFIED:** FastAPI `0.139.2` + Uvicorn `0.51.0` (`apps/api/pyproject.toml:7-16`). |
| Persistence | **VERIFIED:** PostgreSQL via Psycopg `3.3.4`, SQLAlchemy `2.0.51`, Alembic `1.18.5` (`apps/api/pyproject.toml:6-15`). |
| Validation/config | **VERIFIED:** Pydantic `2.13.4`, pydantic-settings `2.14.2`; `LIFEOS_` env prefix (`apps/api/pyproject.toml:11-14`, `apps/api/app/config.py:13-29`). |
| Authentication | **VERIFIED:** Argon2 password support through pwdlib; opaque random session token, only SHA-256 hash stored; HttpOnly SameSite=Lax cookie (`apps/api/pyproject.toml:11`, `apps/api/app/security/sessions.py:9-26`). |
| API docs | **VERIFIED:** `/docs` exists outside production and is disabled in production (`apps/api/app/main.py:22-27`). |
| Bot/AI | **VERIFIED:** no aiogram, Telegram bot, LLM SDK, or AI pipeline exists in canonical `apps/web`/`apps/api` file inventory on HEAD `67a1456`. |

### 3.3 Deployment target

- **ASSUMED:** final target remains a conventional VPS because this is the user's explicit project decision in the conversation. This assumption is not represented by tracked deployment files yet.
- **VERIFIED:** server configuration requires PostgreSQL URL, strong bootstrap token, allowed hosts/origins, session settings and snapshot limit (`.env.example:1-9`, `apps/api/app/config.py:21-29`).
- **VERIFIED:** production rejects insecure cookies and wildcard hosts/origins; production cookie name is `__Host-lifeos_session` (`apps/api/app/config.py:60-73`).
- **UNKNOWN:** domain, Linux distribution, reverse proxy, TLS automation, process manager layout, backup policy, PostgreSQL provisioning, secrets location and deploy user. Those decisions must not be invented by browser ChatGPT.

## 4. Canonical file and responsibility map

### 4.1 Production frontend: `apps/web`

| Path | Responsibility |
|---|---|
| `apps/web/src/main.jsx` | **VERIFIED:** browser entrypoint; imports canonical CSS and mounts `App` under `React.StrictMode` (`:1-17`). |
| `apps/web/src/App.jsx` | **VERIFIED:** top-level UI composition, hash navigation, local appearance preferences, provider wiring, auth gate and route dispatch (`:43-224`, `:350-417`, `:494-529`). |
| `apps/web/src/app/routes.js` | **VERIFIED:** single registry of 15 top-level routes (`:1-17`). |
| `apps/web/src/context/AuthContext.jsx` | **VERIFIED:** session boot, login, one-time bootstrap, logout, session expiry (`:7-94`). |
| `apps/web/src/context/LifeDataContext.jsx` | **VERIFIED:** canonical user snapshot shape, hydration/import, all server-persisted domain mutations, sync recovery/export/reset (`:103-130`, `:262-380`, `:386-710`). |
| `apps/web/src/api/client.ts` | **VERIFIED:** sole fetch boundary, same-origin path enforcement, stable API/network error mapping (`:46-79`). |
| `apps/web/src/api/auth.ts` | **VERIFIED:** typed frontend calls for `/me`, login, bootstrap and logout (`:3-37`). |
| `apps/web/src/api/state.ts` | **VERIFIED:** GET/PUT state calls; PUT sends expected revision, schema version 2 and payload (`:1-20`). |
| `apps/web/src/repositories/stateRepository.ts` | **VERIFIED:** state/envelope types and repository interface (`:1-15`). |
| `apps/web/src/repositories/serverStateRepository.ts` | **VERIFIED:** response validation; maps only typed `404 state_not_initialized` to missing snapshot (`:5-45`). |
| `apps/web/src/repositories/stateSyncCoordinator.ts` | **VERIFIED:** 500 ms debounce, serialized saves, revision conflicts, offline retry, session expiry and reset exclusivity (`:4-205`). |
| `apps/web/src/repositories/legacyLocalImport.ts` | **VERIFIED:** compatibility boundary for one-time import of the retired local snapshot; production state writes no longer belong in localStorage (caller `LifeDataContext.jsx:311-375`). |
| `apps/web/src/pages/` | **VERIFIED:** route-level surfaces: home, tasks, notes, profile, dog, finances, health, medications, habits/goals wrappers and placeholders (`apps/web/src/App.jsx:350-417`). |
| `apps/web/src/components/` | **VERIFIED:** shared product UI/chrome/modals/widgets; component inventory is present in current `find apps/web/src` output on HEAD `67a1456`. |
| `apps/web/src/data/` | **VERIFIED:** seed/reference data for initial user state and calendar/profile/dog/medication content; initial tree consumes these in `LifeDataContext.jsx:90-130`. |
| `apps/web/src/lib/` | **VERIFIED:** pure domain helpers for activity, calendar, finance and medication math; current file inventory on HEAD `67a1456`. |
| `apps/web/src/styles.css` | **VERIFIED:** design tokens and all canonical application styles (`:8-18`, `:82-135`, `:218-245`, `:335-350`). |
| `apps/web/src/test/` | **VERIFIED:** 6 Vitest files with 28 statically inventoried cases covering API client, migration/import, repository, sync and smoke routing/auth. Last execution passed 28/28 on this HEAD (`Outputs/Audits/...232305.md:68-94`). |
| `apps/web/vite.config.js` | **VERIFIED:** local dev `127.0.0.1:5173`; `/api` proxies to `VITE_API_PROXY_TARGET` or `127.0.0.1:8000`; build output `dist` with sourcemaps (`:3-27`). |

### 4.2 Production backend: `apps/api`

| Path | Responsibility |
|---|---|
| `apps/api/app/main.py` | **VERIFIED:** FastAPI app factory, engine/session creation, body limit, trusted hosts, stable HTTP errors and router registration (`:12-46`). |
| `apps/api/app/config.py` | **VERIFIED:** env parsing and production security invariants (`:13-78`). |
| `apps/api/app/db.py` | **VERIFIED:** engine/session factory and per-request SQLAlchemy session lifecycle (`:10-26`). |
| `apps/api/app/dependencies.py` | **VERIFIED:** request settings and current-user resolution boundary; imported by auth/state routes (`apps/api/app/routes/auth.py:7-13`, `apps/api/app/routes/state.py:7-13`). |
| `apps/api/app/routes/health.py` | **VERIFIED:** DB-aware `GET /api/healthz`; returns 503 `database_unavailable` on SQLAlchemy failure (`:16-24`). |
| `apps/api/app/routes/auth.py` | **VERIFIED:** `POST /api/v1/auth/bootstrap`, `/login`, `/logout`, `GET /me`; unsafe operations enforce JSON/same-origin rules (`:21-91`). |
| `apps/api/app/routes/state.py` | **VERIFIED:** authenticated `GET/PUT /api/v1/state`, typed missing state and 409 revision conflict (`:15-59`). |
| `apps/api/app/services/auth.py` | **VERIFIED:** first-user bootstrap with PostgreSQL advisory lock, login, session resolve/touch and revoke (`:39-131`). |
| `apps/api/app/services/state.py` | **VERIFIED:** user-scoped snapshot read and atomic compare-and-swap replace via PostgreSQL insert/update (`:17-63`). |
| `apps/api/app/models/` | **VERIFIED:** users, hashed sessions and one JSONB snapshot per user (`user.py:11-25`, `session.py:11-29`, `user_snapshot.py:12-30`). |
| `apps/api/app/schemas/` | **VERIFIED:** strict auth schemas and snapshot v2 envelope/replace contract (`schemas/auth.py:7-27`, `schemas/state.py:7-29`). |
| `apps/api/app/security/` | **VERIFIED:** password, session cookie/token and same-origin/content-type controls (`security/sessions.py:9-36`, `security/origin.py:8-42`). |
| `apps/api/app/middleware/body_limit.py` | **VERIFIED:** bounded body buffering for only `PUT /api/v1/state`, stable 413 above configured limit (`:5-58`). |
| `apps/api/alembic/` | **VERIFIED:** schema migration environment plus one initial migration. Current raw `alembic heads`: `20260721_0001 (head)`; raw `alembic branches`: empty. |
| `apps/api/tests/` | **VERIFIED:** 11 statically inventoried pytest tests for auth, security, health, tenant isolation and revision conflicts. **NOT RUN in this Discovery** under local verification policy. |
| `apps/api/requirements*.lock` | **VERIFIED:** hash-locked runtime/dev dependency inputs present in tracked inventory. |

### 4.3 Non-canonical/reference areas

- **VERIFIED:** `ui_kits/life-os/` is the pre-Vite high-fidelity source/reference described by stale `ARCHITECTURE.md:28-96`; it is not the canonical runtime after commit `6c7039a`.
- **VERIFIED:** root `README.md` is an older brand/design specification, not a current runtime map (`README.md:22-33` even says no codebase was provided).
- **VERIFIED:** root `assets/`, `preview/`, `screenshots/`, `colors_and_type.css` and `uploads/` are design/reference/artifact areas, not import roots used by `apps/web/src/main.jsx:1-17`.
- **ASSUMED:** these reference sources should be preserved, but product changes should target `apps/web`/`apps/api` unless a task explicitly requests design-system synchronization.

## 5. Runtime and data flow

```text
Browser
  -> apps/web/src/main.jsx
  -> App / AuthProvider / AuthGate
  -> HttpOnly same-origin session cookie
  -> GET/POST /api/v1/auth/*
  -> LifeDataProvider
  -> ServerStateRepository
  -> GET/PUT /api/v1/state
  -> FastAPI routes/services
  -> SQLAlchemy
  -> PostgreSQL users + sessions + user_snapshots(JSONB)
```

1. **VERIFIED:** unauthenticated browser renders `LoginPage`; authenticated browser mounts `LifeDataProvider` and `AppShell` (`apps/web/src/App.jsx:494-516`).
2. **VERIFIED:** missing server snapshot results in either explicit legacy import decision or creation of a fresh v2 state with `expected_revision=0` (`apps/web/src/context/LifeDataContext.jsx:300-375`).
3. **VERIFIED:** every shared state mutation changes the context tree; a provider effect enqueues the new snapshot (`apps/web/src/context/LifeDataContext.jsx:350-354`, `:386-710`).
4. **VERIFIED:** sync is debounced and compare-and-swap protected. Network errors retain pending payload; 409 freezes writes; 401 expires the UI session (`apps/web/src/repositories/stateSyncCoordinator.ts:37-205`).
5. **VERIFIED:** server never accepts a frontend-selected user ID. Current authenticated user supplies `user.id`, and state service filters/writes by that ID (`apps/api/app/routes/state.py:18-48`, `apps/api/app/services/state.py:17-63`).
6. **VERIFIED:** database stores one complete JSONB snapshot per user, not normalized task/finance/health tables (`apps/api/app/models/user_snapshot.py:12-30`). This is an intentional current foundation, not evidence that all future data modeling is complete.

## 6. Current persisted state and user-facing capability

### 6.1 Snapshot contract

**VERIFIED:** initial state v2 contains `profile`, `dog`, `medications`, `doseLogs`, `pharmNotes`, `modeStyles`, `tasks`, `transactions`, `categoryOverrides`, `goals`, `habits`, `quickNotes`, `activityLog` (`apps/web/src/context/LifeDataContext.jsx:103-130`, HEAD `67a1456`).

### 6.2 Implemented mutation surface

- **VERIFIED:** tasks — add, toggle complete, edit, delete; subtasks/notes are carried by task editor (`LifeDataContext.jsx:397-435`; `App.jsx:375-393`, `:480-484`).
- **VERIFIED:** quick notes — add/delete and UI promotion into a task draft (`LifeDataContext.jsx:515-525`; `App.jsx:375-383`).
- **VERIFIED:** finances — add expense-like transaction, toggle individual inclusion, toggle category inclusion (`LifeDataContext.jsx:437-488`).
- **VERIFIED:** goals — add a minimal 0% goal (`LifeDataContext.jsx:490-502`).
- **VERIFIED:** habits — toggle today's cell through shared persisted context (`RelocatedPages.jsx:14-25`; `LifeDataContext.jsx:504-512`). The observation at `claude_observations.md:17-21` is stale after commit `67a1456`; its reported local fallback still exists only for standalone component use (`HabitsGrid.jsx:14-39`).
- **VERIFIED:** profile and dog — update nested slices (`LifeDataContext.jsx:527-536`).
- **VERIFIED:** medications — update/delete/status/inventory/dose/snooze/skip/mode and pharmacy-note mutations are exported by the provider (`LifeDataContext.jsx:539-710`).
- **VERIFIED:** maintenance — prune activity, export server/pending JSON, reload server version and hard reset (`LifeDataContext.jsx:680-710`).

### 6.3 Known incomplete product areas

- **VERIFIED:** `monthly`, `annual`, `investments` render `PlaceholderPage` (`apps/web/src/App.jsx:405-410`).
- **VERIFIED:** health route renders a dedicated `HealthPage`, but its business data is not part of the provider mutation API (`apps/web/src/App.jsx:399-400`; provider export `LifeDataContext.jsx:697-710`).
- **VERIFIED:** normal account registration/invitation/admin user creation is absent from auth routes (`apps/api/app/routes/auth.py:21-91`). Only the first account can be bootstrapped; existing accounts can log in.
- **VERIFIED:** there is no canonical VPS deployment configuration in tracked files.
- **ASSUMED, based on current mutation inventory:** goals lack edit/delete/progress commands; habits lack create/edit/delete; finances lack edit/delete and an explicit income workflow; new-medication creation is not exported. Browser ChatGPT must re-check the relevant page/context before turning any of these into a task.
- **UNKNOWN:** product priority/order after the handoff. The prompt should contain a fillable “Current task” block rather than silently choose the next feature.

## 7. Design and product invariants safe to carry forward

The root design documents contain contradictions, so only principles re-anchored in current code are safe.

- **VERIFIED:** orange is the `accent/stakes` family (`apps/web/src/styles.css:122-135`); current task/calendar components distinguish `stakes` explicitly (`apps/web/src/components/CalendarView.jsx:141`, `apps/web/src/pages/TasksPage.jsx:34-39`).
- **VERIFIED:** today in calendar is blue, not stakes orange (`apps/web/src/components/CalendarView.jsx:15`, `:89-99`; `apps/web/src/styles.css:199-202`).
- **VERIFIED:** Onest is display and Work Sans is body/“mono”; JetBrains Mono is retired (`apps/web/src/styles.css:8-12`, `:335-350`).
- **VERIFIED:** themes include dark, light, system and explicit paradise; paradise scene may be auto/day/night (`apps/web/src/App.jsx:73-187`, `apps/web/src/components/SettingsPage.jsx:175-227`).
- **VERIFIED:** RU and UA are the only enabled locales (`apps/web/src/context/LocaleContext.jsx:1286-1322`).
- **VERIFIED:** current UI uses density tokens defined at stylesheet root (`apps/web/src/styles.css:14-20`).
- **VERIFIED:** `ARCHITECTURE.md:99-111` explicitly records not-clinical-decision-support and other deliberate visual constraints, but its persistence line `:110` is retired. Each design claim from that document must be checked against `apps/web/src` before use.

## 8. Authentication, multi-account and security boundaries

1. **VERIFIED:** account isolation exists at the snapshot key and route dependency: one `user_snapshots.user_id` primary key/FK, and state handlers derive it from authenticated `User` (`apps/api/app/models/user_snapshot.py:20-25`, `apps/api/app/routes/state.py:18-48`).
2. **VERIFIED:** email uniqueness is case-insensitive (`apps/api/app/models/user.py:14-25`).
3. **VERIFIED:** session DB row contains token hash, not the raw cookie token (`apps/api/app/models/session.py:18-29`, `apps/api/app/security/sessions.py:9-26`).
4. **VERIFIED:** unsafe auth/state routes enforce source origin and JSON content type (`apps/api/app/routes/auth.py:31-80`, `apps/api/app/routes/state.py:32-45`, `apps/api/app/security/origin.py:15-42`).
5. **VERIFIED:** snapshot PUT is capped by middleware, default 5 MiB (`apps/api/app/config.py:27-29`, `apps/api/app/middleware/body_limit.py:5-58`).
6. **VERIFIED:** current user snapshot JSONB has no application-layer encryption (`apps/api/app/models/user_snapshot.py:23-25`; complete `apps/api/app/security` inventory contains only origin/password/session modules).
7. **VERIFIED:** multi-account storage/auth foundation is implemented, but user provisioning beyond account #1 is not. The handoff prompt must not call the whole multi-user lifecycle “finished.”

## 9. Verification baseline and honest browser-chat constraints

- **VERIFIED:** last audit on the same HEAD reports frontend typecheck/lint/28 tests/build green and backend 35-file py_compile/Ruff/import green (`Outputs/Audits/pf-01-batch-3-1-local-verification_audit_2026-07-21_232305.md:68-124`).
- **VERIFIED:** current Alembic topology re-run during this Discovery: raw `heads` = `20260721_0001 (head)`; raw `branches` = empty.
- **NOT RUN:** no build, tests, server, DB or browser E2E were run during this read-only Discovery.
- **UNKNOWN:** current real PostgreSQL integration and browser→API→DB behavior. The prior audit explicitly leaves these user-run (`...audit...md:17-25`).
- **ASSUMED:** browser ChatGPT may lack direct filesystem/terminal access. The final prompt should require it to request files and command outputs, label unseen facts `UNKNOWN`, and never report a command as passed unless the user supplies real output or a connected tool ran it.

## 10. Prior-decision safety

- **VERIFIED:** `6c7039a` deliberately established the Vite production build; do not return to browser Babel.
- **VERIFIED:** `102aea4` deliberately established first-user bootstrap, auth sessions and user-isolated JSONB state; do not substitute localStorage as primary persistence.
- **VERIFIED:** `67a1456` deliberately established per-account frontend synchronization and persisted habits; do not treat the stale habit observation as current behavior.
- **VERIFIED:** `Outputs/backlog-tasks/claude_observations.md:11-15` already records the stale architecture runtime. The new handoff should compensate, not silently rely on the ghost file map.
- **VERIFIED:** `Outputs/backlog-tasks/claude_observations.md:23-27` says the initial backend intentionally returns `404 state_not_initialized` until first revision-0 PUT; do not recreate an empty snapshot during bootstrap.

## 11. Risks for the requested prompt

1. **High — stale-source risk:** a large prompt copied from `README.md`/`ARCHITECTURE.md` would recommend the wrong runtime and persistence.
2. **High — false-completion risk:** “multi-account ready” may be misread as finished signup/admin provisioning.
3. **High — browser hallucination risk:** browser ChatGPT can claim tests or files it cannot access unless the prompt enforces evidence labels and user-run command receipts.
4. **Medium — duplicate-source risk:** editing `ui_kits/life-os` instead of `apps/web` would fork the UI again.
5. **Medium — security risk:** exposing bootstrap token/password/database URL in chat. Prompt must prohibit pasting secrets and require redaction.
6. **Medium — data-contract risk:** snapshot is a whole JSONB document. Concurrent/new schema work must preserve `version: 2` and revision conflict behavior or introduce an explicitly approved migration.
7. **Medium — deployment gap:** no tracked VPS runbook/config exists, so a “deploy now” answer would require new architecture decisions.
8. **Low — user-file collision:** obvious filenames `MASTER-PROMPT.md`/`CLAUDE.md` are already user-owned untracked files.

## 12. Change-safety / blast radius for this task

- **VERIFIED N/A:** Discovery changes no shared symbol, route, API contract, state key, database schema or dependency.
- **VERIFIED N/A:** billing/credits do not exist in the inspected LifeOS canonical runtime; no money-charging path is touched.
- **VERIFIED N/A:** no FSM, Telegram callback_data or status state-machine is changed.
- **VERIFIED N/A:** no caller behavior changes and no runtime smoke is warranted for a documentation-only artifact.
- **BINDING NOT-TOUCHED for later implementation:** `apps/web/**`, `apps/api/**`, migrations, dependency manifests/locks, `.env*`, design source files, existing untracked prompt files, tests and deployment state.

## 13. Recommended content of the final prompt

The eventual standalone prompt should contain:

1. role and working language;
2. project purpose and current production direction;
3. exact current stack;
4. canonical vs legacy directory map;
5. frontend/backend ownership map;
6. auth + snapshot + synchronization data flow;
7. persisted data domains and current user capabilities;
8. incomplete areas/backlog, clearly separated from implemented scope;
9. design/product invariants reverified in code;
10. security and secret-handling rules;
11. VPS/local-development boundary without fabricated deploy commands;
12. evidence-first Discovery → Plan → Implementation workflow;
13. verification matrix for frontend, backend and user-run integration;
14. exact handoff protocol for browser ChatGPT when files/tools are unavailable;
15. fillable “Current task / constraints / acceptance criteria” block;
16. first-response instruction: inventory supplied files, identify missing evidence, then stop for task approval.

## 14. Open questions / sign-off candidates for Phase B

1. **Artifact location — recommendation:** create one new standalone file under `Outputs/Handoffs/`, e.g. `lifeos-chatgpt-browser-handoff_2026-08-10.md`, because `MASTER-PROMPT.md` and `CLAUDE.md` are existing user-owned untracked files. **Needs user approval in Plan.**
2. **Language — recommendation:** write operational instructions in Russian for easy browser use, keep code/file names and command names exact; user explanations in this Codex task remain Ukrainian per repository contract. **Needs user approval in Plan.**
3. **Scope — recommendation:** make the prompt self-contained but explicitly require fresh file attachments/verification for each task; do not paste full source code into it. **Needs user approval in Plan.**
4. **Commit message — UNKNOWN:** the user did not provide an exact task commit message. If Phase C must commit under repository policy, Plan should propose `docs(infra): add ChatGPT browser development handoff` and request explicit approval.

## 15. Discovery conclusion

**VERDICT:** enough current-code evidence exists to design the handoff prompt. The main design constraint is not missing architecture, but separating the canonical Vite/FastAPI server-backed system from stale Claude Design/browser-Babel documents and reference sources. No code or prompt artifact has been created in Phase A.

**WAITING FOR:** review of Discovery and command `Continue` to prepare PHASE B Plan.
