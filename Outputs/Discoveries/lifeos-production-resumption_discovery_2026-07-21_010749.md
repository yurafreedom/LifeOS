# DISCOVERY for Life OS production resumption

**Phase:** A — Discovery
**Date:** 2026-07-21
**Status:** complete, read-only product/code analysis; no feature code changed
**Repository:** `/Users/yurasachenko/LifeOS_DesignSystem`
**Basis HEAD:** `f82ec642747eca051be904a1cccf2ddb83ac1910` (`design-sync-setup`)
**Working tree:** dirty; all pre-existing changes treated as user-owned and preserved

Evidence labels used below:

- **VERIFIED (HEAD `f82ec64`)** — present in the checked-in source at current HEAD.
- **VERIFIED (WT atop HEAD `f82ec64`)** — present in the current working tree, including uncommitted work.
- **ASSUMED** — a bounded inference, with the reason stated.
- **UNKNOWN** — requires a product or infrastructure decision from the owner.

## 1. Executive verdict

1. **VERIFIED (HEAD `f82ec64`, `ARCHITECTURE.md:7-13`; `ui_kits/life-os/index.html:44-47,52-112`):** this is already a React application, not a static image export. It uses React 18 in the browser, Babel Standalone, global `window.*` components, hash routing, CSS custom properties, and `localStorage`.
2. **VERIFIED (HEAD `f82ec64`, `README.md:24-33`; `ARCHITECTURE.md:15-97`):** the repository serves two roles simultaneously: a design-system package/specimen library (`preview/`, tokens, assets) and a high-fidelity working application under `ui_kits/life-os/`.
3. **VERIFIED (WT atop HEAD `f82ec64`, `ui_kits/life-os/index.html:44-47`; command `rg --files` for manifests returned exactly 0 hits):** there is no `package.json`, lockfile, bundler config, deploy config, Dockerfile, or server config. React and Babel development artifacts are loaded from CDNs at runtime.
4. **VERIFIED (WT atop HEAD `f82ec64`, `ui_kits/life-os/lib/storage.js:18-79`; `ui_kits/life-os/LifeDataProvider.jsx:185-209`):** user data is browser-local. Deploying the current directory to a server would serve the interface, but would not create server-side persistence, account access, cross-device sync, backups, or an API.
5. **ASSUMED (based on the verified component and CSS inventory):** a full visual rewrite would waste substantial finished work. The likely efficient route is to preserve the design tokens, CSS, JSX markup, assets, pure calculation helpers, and state semantics while moving the app into a conventional production React build and then deciding whether persistence remains local-only or moves behind an API.
6. **UNKNOWN:** the final architecture cannot be chosen safely until the owner decides whether Life OS is (a) one browser on one device, or (b) a private server-backed application available from multiple devices. That decision determines whether a backend is optional or mandatory.

## 2. What actually exists

### 2.1 Runtime shape

| Area | Finding | Evidence |
|---|---|---|
| React runtime | React 18.3.1 and ReactDOM development UMD builds load from unpkg | **VERIFIED (WT atop HEAD `f82ec64`)** — `ui_kits/life-os/index.html:44-45` |
| JSX compilation | Babel Standalone compiles browser-loaded `.jsx` files at runtime | **VERIFIED (WT atop HEAD `f82ec64`)** — `ui_kits/life-os/index.html:47,52-112` |
| Script graph | Exactly 51 `type="text/babel"` script tags; ordering is manually encoded in HTML | **VERIFIED (WT atop HEAD `f82ec64`)** — `ui_kits/life-os/index.html:52-112`; `rg -n 'type="text/babel"' ... | wc -l` → `51` |
| Module system | No ES `import` or `export`; 73 global assignments were grep-counted | **VERIFIED (WT atop HEAD `f82ec64`)** — representative assignments `i18n.jsx:1198-1200`, `LifeDataProvider.jsx:479`, `App.jsx:489`; grep `^\s*(import|export)` → 0, `window.*=` → 73 |
| Routing | A custom hash router dispatches 15 route IDs | **VERIFIED (WT atop HEAD `f82ec64`)** — `ui_kits/life-os/App.jsx:20-34,337-405` |
| Styling | 4,777-line app stylesheet plus token styles; dark/light/paradise themes | **VERIFIED (WT atop HEAD `f82ec64`)** — `ui_kits/life-os/styles.css`; `ARCHITECTURE.md:99-110,217-226` |
| Locales | RU and UA are active; RU is the default context locale | **VERIFIED (WT atop HEAD `f82ec64`)** — `ui_kits/life-os/i18n.jsx:1169,1198-1200`; `App.jsx:180` |
| Network/API | No `fetch`, XHR, WebSocket, Axios, Supabase, or Firebase call exists in application JS/JSX | **VERIFIED (WT atop HEAD `f82ec64`)** — grep across `ui_kits/life-os/**/*.{js,jsx}` → exactly 0 hits |

### 2.2 Functional surfaces

**VERIFIED (WT atop HEAD `f82ec64`, `ui_kits/life-os/App.jsx:337-404`):** the route dispatcher exposes Home, Calendar, Notes, Profile, Tasks, Habits, Goals, Health, Dog, Finances, Monthly, Annual, Investments, Medications, and Settings.

**VERIFIED (WT atop HEAD `f82ec64`, `ui_kits/life-os/LifeDataProvider.jsx:211-474`):** the central provider already implements mutations for:

- tasks: add, update, delete, toggle complete (`:211-249`);
- transactions and inclusion filters (`:251-302`);
- goals: add (`:304-316`, currently uncommitted working-tree work);
- quick notes (`:318-328`);
- profile and dog data (`:330-340`);
- medications, inventory, dose logs, snooze/skip, mode styles, pharmacy notes (`:342-442`);
- activity-history pruning, JSON export, and hard reset (`:444-460`).

**VERIFIED (WT atop HEAD `f82ec64`, `ui_kits/life-os/App.jsx:392-397`; `pages/PlaceholderPage.jsx:1-15`; `pages/HealthPage.jsx:4-35`):** Monthly, Annual, and Investments are explicit placeholders, and Health is a four-card empty skeleton.

**VERIFIED (WT atop HEAD `f82ec64`, `ui_kits/life-os/TopBar.jsx:7,31-38`; `ui_kits/life-os/README.md:60`):** the top search input is a dead control: typing updates local state, but no consumer searches or routes.

**VERIFIED (HEAD `f82ec64`, `ARCHITECTURE.md:172,179,184,195,197,199-200`):** documented unfinished work also includes Sprint 4 finance surfaces, a bot-conversation no-op, backend migration, a medication-modal layout issue, complete historical finance aggregation, calendar density wiring, and additional calendar event sources.

### 2.3 Reusable assets versus prototype-only parts

| Classification | Items | Verdict |
|---|---|---|
| Preserve directly | design tokens, `styles.css`, theme rules, logos, scene images, preview specimens | **VERIFIED (HEAD `f82ec64`)** — `README.md:24-33`; `ARCHITECTURE.md:19-28` |
| Port with light adaptation | JSX markup/components, route map, locale dictionaries, categories, data shapes | **ASSUMED** — these are already React-compatible but require ES module boundaries and dependency imports |
| Reuse as pure logic | `lib/activity.js`, `lib/calendar.js`, `lib/finance.js`, `lib/medMath.js` | **VERIFIED (HEAD `f82ec64`)** — inventory at `ARCHITECTURE.md:36-41`; purity must be checked per helper during implementation |
| Replace for production | browser Babel runtime, development UMD React, manual 51-script load order, global `window.*` dependency graph | **VERIFIED/ASSUMED** — current mechanism at `index.html:44-112`; replacement is required for deterministic builds, not a visual redesign |
| Product decision required | `localStorage` state versus server API/database | **UNKNOWN** — depends on single-device versus multi-device requirements |

## 3. State lifecycle and production implications

### 3.1 Persisted keys

| Key | Writers | Readers | Clear/TTL | Restart/reload | Corrupt/blocked storage | Production implication |
|---|---|---|---|---|---|---|
| `lifeOsState` | Provider effect → throttled `LifeStorage.save` | Provider initializer → `migrate(load())` | no TTL; hard reset clears | survives browser reload on the same origin/profile | parse/write errors are silently swallowed; falls back to seeds/in-memory | **VERIFIED (WT atop HEAD `f82ec64`)** — `lib/storage.js:18-79`, `LifeDataProvider.jsx:163-194,457-460`; silent failure can look like successful saving |
| `lifeOsTheme` | `useTheme.setTheme` | pre-paint script + hook initializer | removed for system mode; no TTL | survives same browser | exceptions swallowed | **VERIFIED (WT atop HEAD `f82ec64`)** — `index.html:10-19`, `App.jsx:55-62,152-157` |
| `lifeOsSidebar` | collapse effect | collapse initializer | no clearer/TTL | survives same browser | exceptions swallowed | **VERIFIED (WT atop HEAD `f82ec64`)** — `App.jsx:36-51` |
| `lifeOsScene` | manual scene setter (uncommitted) | pre-paint script + theme hook | removed for auto; no TTL | survives same browser | exceptions swallowed | **VERIFIED (WT atop HEAD `f82ec64`)** — `index.html:20-36`, `App.jsx:68-78,160-165` |

### 3.2 Failure modes

1. **VERIFIED (WT atop HEAD `f82ec64`, `lib/storage.js:33-70`):** rapid changes collapse into a 500 ms trailing write, and pending state flushes on `beforeunload`/page hide. This reduces ordinary loss but does not provide transactional durability.
2. **VERIFIED (WT atop HEAD `f82ec64`, `lib/storage.js:21-30,40-49`):** corrupt JSON, quota exhaustion, private-mode restrictions, or disabled storage produce no user-visible error.
3. **ASSUMED:** double-taps can create duplicate entities where IDs are time-based and controls remain active; no idempotency or server constraint exists. This needs per-flow verification before production hardening.
4. **VERIFIED (WT atop HEAD `f82ec64`, `LifeDataProvider.jsx:161-181`):** client snapshot migration exists only through version 2 plus an unversioned goals compatibility shim. Old/new deploy compatibility is therefore ad hoc rather than schema-tested.
5. **VERIFIED (WT atop HEAD `f82ec64`, `LifeDataProvider.jsx:82-109`; `data/medications.js`; `data/profile.js`; `data/dog.js`):** fresh state is populated from demo/seed data, including medications, finance records, and profile data. A production first-run/empty-account policy has not been defined.
6. **ASSUMED (security risk):** finance/health/medication data in `localStorage` is readable by any JavaScript executing on the same origin. Current runtime also depends on third-party CDN scripts (`index.html:40-47`). A production privacy model and CSP/dependency-bundling decision are required.

## 4. Git and prior-work audit

1. **VERIFIED (Git at HEAD `f82ec64`):** only two commits exist: `17dbd74 first commit` and `f82ec64 Add design-sync inputs for claude.ai/design import`. The latter touches only `.design-sync/*` and `.gitignore`; it does not intersect application code.
2. **VERIFIED (WT atop HEAD `f82ec64`, `git status --short`):** 10 tracked files are modified, including `App.jsx`, `LifeDataProvider.jsx`, `SettingsPage.jsx`, `i18n.jsx`, `index.html`, and `styles.css`. The tracked diff is `+533/-265`. Several instruction/prompt/report/test paths are untracked.
3. **VERIFIED (WT diff against HEAD `f82ec64`):** current uncommitted work hides the debug rail unless `?debug` is present (`App.jsx:9-14,423-447`), adds manual paradise day/night override (`App.jsx:68-78,112-168`; `index.html:20-36`), and adds persisted goal creation (`LifeDataProvider.jsx:100,113-123,176-181,304-316,462-474`; `GoalsWidget.jsx`; `RelocatedPages.jsx`).
4. **VERIFIED (untracked basis file `BATCH1-FIX-PROMPT.md:9-15,124-135,173-174`):** this work belongs to an unfinished “Batch 1 Revision 2”; the prompt explicitly says it must remain uncommitted until QA passes and must not include schema changes. Therefore its completion/QA status is **UNKNOWN** and it must not be folded into production migration silently.
5. **VERIFIED (untracked reports `Outputs/Discoveries/lifeos-refinement_discovery_2026-07-01.md:5-24`; `Outputs/Plans/lifeos-refinement_plan_2026-07-01.md:221-231`):** a prior Discovery and Plan exist for density, calendar, and GTD work. The Plan still ends waiting for approval and contains unresolved sign-off items. It is context, not proof of approved implementation.

## 5. Process/document conflict

1. **VERIFIED (WT atop HEAD `f82ec64`, `AGENTS.md:1-19`; `CLAUDE.md:1-19`):** both instruction files claim this is a Python/FastAPI/aiogram/PostgreSQL “warehouse-ai” repository deployed to `/app/vendoru`. The repository contains no such application structure.
2. **VERIFIED (HEAD `f82ec64`, `ARCHITECTURE.md:1-13`; `ui_kits/life-os/index.html:44-112`):** the actual project is a browser-run React Life OS app/design system.
3. **ASSUMED:** leaving the wrong instruction contract in place is a high process risk: future sessions may attempt Python checks, Alembic, bot smoke tests, or the wrong VPS deployment. Replacing it requires explicit approval and should be a separate, first-class housekeeping task before feature implementation.

## 6. Production-readiness gap matrix

| Dimension | Current state | Gap/severity |
|---|---|---|
| Build and dependencies | CDN React development builds + Babel in browser; no manifest/lockfile | **High** — no reproducible, optimized artifact (`index.html:44-112`) |
| Module architecture | 73 `window.*` assignments and manual script order | **High** — brittle dependency graph; no static import validation |
| Data persistence | one localStorage snapshot, silent errors | **Critical if multi-device/server-backed**; acceptable only for explicit local-only MVP (`lib/storage.js:18-79`) |
| Authentication/authorization | no auth code or API | **Critical if reachable on the internet with private data**; grep found no network/auth layer |
| Product completeness | 3 placeholder finance routes, Health skeleton, dead search, documented deferred work | **High** for “finished product” (`App.jsx:386-403`; `HealthPage.jsx:4-35`; `TopBar.jsx:7,31-38`) |
| Tests | no tracked application test suite or test config; untracked `tests/` contains only metadata/venv artifacts in inspected paths | **High** — behavior is unguarded |
| CI/CD and hosting | no Docker/server/service/reverse-proxy config | **High** — server deployment path undefined |
| Observability | no error reporting, analytics, logs, or health check | **Medium/High** depending on backend choice |
| Accessibility/security hardening | not audited in this pass; `lang="en"` despite RU default (`index.html:3`) | **UNKNOWN**, requires dedicated audit |
| Documentation | architecture docs contain stale statements; root agent contract is for another repository | **High process risk** |

## 7. Viable continuation strategies

### Strategy A — static single-browser MVP

**ASSUMED:** package the current app into a conventional React SPA build, preserve `localStorage`, and deploy static files on the VPS. This is the shortest path to a URL, but data remains tied to one browser profile and there is no server backup or cross-device sync.

Use only if all are true:

- one trusted user;
- one primary browser/device;
- manual JSON export is an acceptable backup;
- no requirement to access the same state from phone and desktop.

### Strategy B — production personal web app

**ASSUMED / RECOMMENDED if “on a server” means real multi-device use:** migrate the frontend into a conventional React SPA build, define typed/domain schemas, add a private authenticated API and database, import existing local data once, then deploy frontend + API with backups and TLS. The exact backend stack is **UNKNOWN** and must be chosen in Phase B; the current repository provides no valid basis for selecting it automatically.

### Strategy C — full rewrite

**ASSUMED / NOT RECOMMENDED:** rebuild all screens and styles from scratch. There is no evidence that a visual rewrite is necessary; the existing component inventory, themed CSS, locales, assets, and interaction logic are substantial. Rewrite is justified only if the product requirements or design direction are being discarded.

## 8. Recommended decision order for Phase B

This is not yet an implementation plan; it is the decision sequence needed to make one safely.

1. **Product mode:** local-only static MVP or private multi-device application.
2. **User/auth scope:** only the owner, a household, or future multiple accounts.
3. **Data policy:** which finance/health/medication fields are real, what must be encrypted/backed up, and retention/export/delete requirements.
4. **Workstream priority:** first finish/QA the current uncommitted Batch 1, or freeze feature work and establish the production foundation first.
5. **Deployment target:** existing VPS/domain/OS/reverse proxy availability; current Life OS repo contains no valid server target.
6. **Instruction cleanup:** authorize replacement of the mismatched `AGENTS.md`/`CLAUDE.md` with Life OS-specific rules.

## 9. Risks if implementation resumes immediately

1. **VERIFIED:** uncommitted feature/design work already overlaps core files; a migration touching the same files risks merging unfinished Batch 1 with infrastructure changes.
2. **VERIFIED:** no reproducible build exists, so visual QA of current CDN/Babel behavior does not prove a future bundled build behaves identically.
3. **ASSUMED:** continuing Sprint 4/GTD/calendar feature work before deciding the persistence architecture increases later data-migration cost because every new client-only field becomes another API/schema migration concern.
4. **VERIFIED:** wrong project instructions can trigger invalid validation and deployment actions.
5. **UNKNOWN:** no production server/domain credentials, backup expectations, or privacy model were provided in this task.

## 10. Discovery conclusion

**VERIFIED + ASSUMED verdict:** Life OS should be treated as a mature interactive prototype/design system with a reusable React UI, not as a production application and not as a throwaway export. The safest likely path is an incremental productionization, not a visual rewrite: preserve the UI, establish a reproducible React build and module graph, then add only the persistence/server layer required by the chosen product mode.

**No code, dependency, Git commit, push, deploy, or runtime test was performed in this phase.** Only the two required Discovery artifacts are being added under `Outputs/`.

WAITING FOR: review of Discovery and answers to the product-mode, auth scope, workstream-priority, and deployment-target questions before Phase B Plan.
