# JENKIN — product completeness and hosting readiness (discovery)

Date: 2026-10-01 20:55 (Europe/Kyiv). Read-only discovery: no application code, dependency, migration,
database, DNS, registrar, hosting or SMTP change was made. No deployment was made.
Companion plan: `Outputs/Plans/jenkin-completeness-hosting-backlog_20261001-205516.md`.

**Revised 2026-10-01 21:34 (Europe/Kyiv)** at the owner's request, as a documentation correction only. Changed:
- concurrent-work facts (§0);
- evidence levels: runtime-confirmed defects vs static findings awaiting reproduction (§1.0, §1.6);
- the launcher's existing automatic backup, and historical-key recovery (§2.5);
- the split between mandatory security gates and product recommendations (§2.7, §3);
- the split between single-owner local/private use and a public multi-user service (§3);
- which facts may be discussed, and which values must never be shared (§2.8).

No application code was changed by this revision.

## 0. Baseline and method

- **Inspected commit:** `69477c9365f06d6ac2831f124aa03b7a23fb5214` — tip of
  `integration/jenkin-combined-20261001`, equal on `origin` at inspection time. This is the latest completed
  integration. It contains main `5e858bb`, the Calendar and branding integration `83cba06`, S1 `f7a43eb`, S2 `8c54d70`,
  L2 `daa8f55`, the launcher `aa488ab`, and the product overview and update history work (§92–§93).
- **Not merged into `main`** (`origin/main` = `5e858bb`). Not deployed anywhere.
- **Concurrent work, preserved and not touched:**
  - The canonical checkout is on `handoff/jenkin-cloud-20260930`, with another session's staged branding files and the
    owner's untracked inputs.
  - The S1, S2, L2, launcher and combined worktrees hold only untracked QA ZIPs.
- **Concurrent work, rechecked 2026-10-01 21:34 +0300** (after `git fetch --prune`; replaces the 20:55 observation):
  - `feat/jenkin-usability-followup-20261001` (worktree `LifeOS_usability-followup`) now has two pushed commits on
    `69477c9`:
    - `03c00b8`: persisted RU/UK locale (`lifeOsLocale`, device-local, pre-paint), a sync chip that no longer
      overlaps content, and 12 px Home hints;
    - `eec7aeb`: report `Outputs/Implementations/jenkin-usability-followup_20261001.md` and master context §94.
    - It is not merged into the integration branch or `main`.
  - **L1 observation:** at 21:34 +0300, no local or `origin` branch name matched `l1`, `obligation` or a
    loan slice other than `feat/jenkin-loan-engine-l2-20261001` (`daa8f55`, which is L2). No worktree is on an L1
    branch either. This shows only that no L1 branch was **visible in Git** at that moment. It does not prove that no
    L1 work exists elsewhere (an unpushed session, another machine).
  - **L1 recheck at 21:38 +0300 (before committing this revision):**
    - a new local branch `feat/jenkin-finance-l1-20261001` now exists, checked out in the worktree
      `/Users/yurasachenko/LifeOS/LifeOS_finance-l1`;
    - it is at `69477c9` with no commits and a clean tree, and it is not on `origin`.
    - Treat L1 as **started by another session**. Its scope is the approved L1 plan until its report says otherwise.
  - **Rule:** recheck branches, worktrees and the latest master-context section immediately before scheduling any
    slice that could overlap active work.
- **Records read:**
  - `AGENTS.md`;
  - `LIFEOS_MASTER_CONTEXT.md` §78–§93;
  - `docs/product/JENKIN_PRODUCT_OVERVIEW.md`;
  - the JENKIN plans: product design, security/finance roadmap and decisions, loan-document plan, decisions and L2
    spec, and the plaintext-data plan;
  - the GTD completion plan;
  - both runbooks;
  - the S1, S2 and combined implementation reports.
- **Code:** a static trace of `apps/web/src` and `apps/api/app`. Surprising claims were spot-checked by hand:
  - the Habits add button;
  - the category sort;
  - the locale state;
  - mobile "more";
  - the AA production guard;
  - CSRF coverage;
  - account-delete UI absence;
  - the source-map flag.
- **Not run:** tests, browser, and the live API. Latest recorded results are web 943 tests on `ca5408c` and backend
  1323 + 1 skipped on `4514e80` (master context §92–§93). This discovery claims nothing beyond static evidence.
- **Classification:**
  - **complete** — a new, empty account can perform the workflow end to end and it persists.
  - **partial** — a usable core exists with named gaps.
  - **missing** — no working path; a page may still render.
  - **externally blocked** — needs facts, credentials or a third party only the owner can supply.
- **Evidence levels** (§1.0; the summary is in §1.6):
  - **runtime-confirmed** — reproduced in a running build and recorded in a report;
  - **static** — read from code (including the "verified" spot-checks above, which were also static reads). A static
    finding is a hypothesis about behaviour until it is reproduced. A slice that fixes one must reproduce it first,
    and drop it if it does not reproduce.

Persistence fact used throughout: every LifeDataContext mutator persists through
`StateSyncCoordinator.enqueue` → `PUT /api/v1/state` (`apps/web/src/context/LifeDataContext.jsx:222-226`,
`apps/api/app/routes/state.py:30-57`). A workflow is missing when its **mutator** is missing, not when sync is.
New accounts start empty (`apps/web/src/context/lifeData/initialState.js:11-44`); demo data is test-only.

## 1. Current-state matrix

### 1.0 Evidence level of this matrix

Every row is **static** unless it says otherwise. This discovery ran no build, browser or API (§0). The only row with
runtime evidence is locale persistence. It was reproduced and fixed on the usability-followup branch (§1.2).

### 1.1 GTD: capture → clarify → organise → review → engage

| Capability | Status | Evidence | Gap / note |
|---|---|---|---|
| Capture (Quick Notes) | **complete** | `QuickNotesPage.jsx:25-33`, `LifeDataContext.jsx:621-626` | No dedicated Inbox route; «заметки» is the inbox. Inbox is OWNER-wanted, planned (design plan §5). |
| Clarify, six outcomes | **complete** | `domain/clarify.ts:101-107,239-271,301-351`; `app/clarifyHandlers.js:16-44`; `ClarifyPanel.jsx:323-352` | Delegate stores `waiting_for = null` by contract (OD-G1-2). |
| References | **partial** | create only; read-only list `QuickNotesPage.jsx:87-94`; no `domain/reference.ts` | Edit and delete are planned as **G3**, not built. |
| Projects | **partial** | create `ProjectsPage.jsx:23-32`; forecast, complete and archive at `LifeDataContext.jsx:537-597` | No rename, delete or un-archive; archive is a dead end (`domain/projects.ts:121-125`). |
| Next actions, task↔project link | **missing** (requirement not accepted) | no `project_id` / `next_action` anywhere; `LifeProject` `projects.ts:5-13` | **G4**, blocked on owner acceptance **OD-G4-0..3**. |
| Waiting For | **partial** (lifecycle complete) | `domain/waiting.ts:255-351`; `WaitingItemModal.jsx:136,197-240`; `TasksPage.jsx:193-334` | Created only via Clarify→Delegate: there is no "new waiting" action (`ru.js:129`). No follow-up dates, by decision OD-G1-3. |
| GTD Weekly Review | **missing** (requirement not accepted) | none; AA Review disclaims it (`ReviewPage.jsx:11`) | **G5**, blocked on **OD-G5-0**. Stale RU/UK copy promises a «недельный обзор задач» (`ru.js:1521`, `uk.js:1455`, shown at `ReviewView.jsx:109`, analytics builds only). |
| Action selection (Focus Now / Engage) | **missing** (requirement not accepted) | no contexts, energy or next-action fields; the Home task card is a weekly done/total count (`HomePage.jsx:131-146`) | **G6**, blocked on **OD-G6-0**. The nearest tool is the Tasks filters. Dead Home-seed `onOpenTask` wiring remains (`App.jsx:196-203`). |
| Tasks | **partial** (core complete) | create via Quick Add / ⌘K (`TopBar.jsx:44`, `App.jsx:121-177`) or a Calendar day; edit, schedule and reschedule (`TaskDetailModal.jsx:83-108,283-303`, `taskDetailSave.js`); complete, delete; filters (`domain/tasks.ts:184-207`) | Gaps: (a) close-without-completing and archive exist only in Calendar Day details (`DayDetails.jsx:232-240`), so **undated tasks can never be closed or archived**; (b) **category sort is ineffective** — it sorts on `tag` (`TasksPage.jsx:65`), but Quick Add with a category stores `tag: null` and the category in `tagLabel` (`domain/tasks.ts:315`); (c) `TasksPage` ignores its `onAdd` prop (no in-page add). |
| Calendar | **complete** (tasks only) | `CalendarPage.jsx`, `DayDetails.jsx:146-243`, Kyiv day `useKyivToday` | Events are not a separate entity (planned; DST rule in §85). |
| History | **complete** | `CalendarHistory.jsx:5-9`; restore `CalendarPage.jsx:348` | Lists completed, closed-unresolved and archived tasks. Reachable only from Calendar. |
| Goals | **partial** | `addGoal` `LifeDataContext.jsx:599-607` | No edit, delete or progress update; `pct` stays 0 forever, so the Home goal card never progresses. |

### 1.2 Life modules

| Capability | Status | Evidence | Gap / note |
|---|---|---|---|
| Habits | **missing** for a new account | empty-state `+ добавить привычку` has no handler (`HabitsGrid.jsx:57`, verified); the provider exposes only `toggleHabitToday` (`LifeDataContext.jsx:609-618,874`) | No create, edit or delete. The model is a dateless 7-slot `week` array that never rolls over. `streak` and `best` are stored values and never recomputed. Needs an owner decision on the habit model. |
| Medications | **missing** create; **partial** for existing records | no `addMedication`; edit, archive, inventory and `takeDose` work (`MedConfigDrawer.jsx:64-107`, `LifeDataContext.jsx:709-756`) | `snoozeDose` and `skipDose` only log an activity (`LifeDataContext.jsx:757-768`). Empty-state text is hard-coded RU (`MedicationsPage.jsx:128-132`). |
| Health | **missing** | static skeleton (`HealthPage.jsx:9-35`); `/api/healthz` is liveness only | No requirement or plan defines health records. Needs Discovery and owner scope. |
| Pet profile creation | **missing** | `dog = {}` renders text only, with no create action (`DogPage.jsx:22-31`); `updateDog` merges into existing slices (`LifeDataContext.jsx:703-706`) | Even with an existing profile: "feed now" has no handler (`:133-137`), meal history is `href="#"` (`:141-143`), restock is fixed at 7000 g (`:166-168`), and the name placeholder writes `'буква'` (`:84-86`). |
| Person profile | **complete** for its fields | `ProfilePage.jsx`, `profile/cards/*`, `updateProfile` | Weight edits never append to the history the sparkline reads; "add section" is disabled. |
| Home | **partial**, honest | snapshot-derived (`HomePage.jsx:95-199`) | The budget card is fixed at "not set"; its CTA leads to Settings, which has no budget setting. The trend chart always gets `[]`. Streak can never fill because habits cannot be created. |
| Onboarding / first run | **missing** | no first-run code; bootstrap lands on Home | Modules with add paths are usable. Habits, medications, dog and health have no first step. |
| Placeholder routes | **missing** | `monthly`, `annual`, `investments` → `PlaceholderPage` (`App.jsx:254-259`), still in the sidebar (`Sidebar.jsx:55-57`) | Copy says "Sprint 4 построит этот раздел". |
| Mobile navigation | **partial** | 5 fixed slots; "more" → Settings (`MobileBottomNav.jsx:26`, verified) | Habits, goals, projects, profile, health, dog, finances and medications are unreachable on a phone except by typing a hash. |
| Locale persistence | **missing on `69477c9`; fixed on an unmerged branch** — **runtime-confirmed** | `useStateApp('ru')` (`App.jsx:441`); reproduced on `69477c9` in a real build (usability-followup report §1) | Fixed by `03c00b8` on `feat/jenkin-usability-followup-20261001` (device-local `lifeOsLocale`, pre-paint `<html lang>`). It is not merged. **Do not start a second locale implementation.** |

### 1.3 Authentication and account

| Capability | Status | Evidence | Gap / note |
|---|---|---|---|
| Bootstrap first owner | **complete** | `routes/auth.py:64-83`, `services/auth.py:66-97`; UI `/?bootstrap=1` (`LoginPage.jsx:66-67,140-150`) | Requires the server's bootstrap token. Closed once any user exists. |
| Login / logout / sessions | **complete** | `auth.py:86-123`; `account_security.py:87-117`; `SecuritySection.jsx:123-185` | Network throttles are shared behind a NAT (S1 §7.5). |
| Invitations (owner-only) | **complete** | `account_security.py:143-177`; `AuthActionPage.jsx:140-209` | Without mail, the owner gets a one-time manual link (A-09). |
| Email verification | **complete** (mail-dependent) | `account_security.py:62-84`, `auth.py:195-211` | Returns 503 `mail_unavailable` without a mail backend. Verification gates nothing. |
| **Email change** | **missing** | no endpoint or UI; the email is shown as `read-only` (`SettingsPage.jsx:95`) | APPROVED S1 follow-up ("email-change flow with re-verification"), not built. |
| Password change | **complete** | `account_security.py:41-59` | Revokes other sessions. |
| Password recovery | **complete in code / externally blocked in production** | `auth.py:142-189`; `LoginPage.jsx:22-58,155-157` | Disabled mail gives an honest 503 for every address. Real delivery needs E-01/E-02. |
| Recovery codes / passkeys / TOTP | **missing** | none | I1 (APPROVED, not started). The design plan recommends recovery codes first. |
| Account export | **complete** | `routes/export.py:21-33`; `ExportSection.jsx` | The general export uses a server temp file (plaintext plan §6a). |
| **Account deletion** | **partial** (API only) | `DELETE /api/v1/account` (`routes/account.py:18-35`); **no UI calls it** (verified: no frontend reference) | No password re-check. Deleting the owner leaves members without an owner while bootstrap stays closed. |
| Onboarding after first login | **missing** | — | See §1.2. |
| Diia / BankID | **externally blocked** | — | E-09; the OWNER says do not implement. |

### 1.4 Finance and documents

| Capability | Status | Evidence | Gap / note |
|---|---|---|---|
| Record an expense | **complete** (minimal) | `FinancesPage.jsx:117-130,207-226`, `addTransaction` `LifeDataContext.jsx:449-469` | Always today's date. Description = category name. |
| Edit / delete a transaction | **partial / missing** | amount only via `window.prompt` with an RU-only label (`FinancesPage.jsx:284-288`); no delete mutator or UI | — |
| Income | **missing** | `LifeIncomeCats` unused (`data/categories.js:41-57`) | The list also carries an owner-specific seed category `cortexmd`. |
| Include / exclude from totals | **complete** | `FinancesPage.jsx:276-283`, `SettingsPage.jsx:149-152` | — |
| Monthly figure truthfulness | **partial — defect** | the subtitle shows the current month (`FinancesPage.jsx:173`), but `inTotals` sums all transactions with no date filter (`:95`) | A truthfulness issue, independent of F1. |
| Currency | **partial** (owner decision D-07) | `$` labels (`FinancesPage.jsx:101-104,174…`) vs `₴` / UAH in AA | Explicit currency is part of **F1**; do not duplicate. |
| Budgets, accounts, balances | **missing** | `cap = null` (`FinancesPage.jsx:105`) | `fin_accounts` and an Overview tab are in **F1**. Budgets are in no plan. |
| Finance analytics mirror | **partial** — preview only | front flag off by default (`app/routes.js:21-24`); `aa_write_enabled=False` and **refused in production** (`config.py:122-125`) | The guard's message says "until account export and erasure exist". `aa_*` tables are now in `EXPORT_TABLES` (`services/export.py:70+`) and cascade from `users`, so the stated reason looks **outdated**. Lifting it needs its own verified slice and an owner decision. |
| Documents (S2) | **complete in code / externally blocked in production** | routes `documents.py:296-507`; UI `FinanceDocuments.jsx`; export `export.py:36-54` | Off by default (`config.py:71`); the UI shows "not enabled". Activation needs E-06 and E-11. No single-version delete. |
| Document → loan linkage | **missing** (planned **L1/L3**) | `FinanceDocuments.jsx:19-21` states it | — |
| Obligations / loans | **missing** (planned **L1**, **L4**) | no `fin_*` tables or migration (head `20261001_0012`) | — |
| L2 engine | **complete as a library, not wired** | only tests import `services/finance/calc` | Wiring is L1 (term mapping) and L4. |
| System Review obligations | **partial**, AA-gated | `aa_finance_contexts`; `simulate_payoff` (`consequences.py:208`) | Unavailable in production while the AA guard stands. U-1 decides its relation to `fin_obligations`. |
| Banks, Telegram, notifications | **externally blocked / not planned** | honest "не подключено" (`SettingsPage.jsx:166-189`) | F4/F5 need E-07 and E-08. Telegram and notifications have no plan. |

### 1.5 Summary

- **Complete:** capture; Clarify; Calendar and History; the core of Tasks; Waiting lifecycle; the account security core
  (bootstrap, login, sessions, password, invitations, verification and recovery code); export; Documents (code); the
  L2 library.
- **Partial:** references; projects; Waiting creation; Tasks edge cases; goals; profile; Home; medications for
  existing records; finance operations; mobile navigation; account deletion.
- **Missing:** next actions and Weekly Review and Engage (decisions pending); habits, medication creation, pet creation,
  Health, onboarding, placeholder routes, email change, passkeys/recovery codes, income/budgets, obligations and
  loans. Locale persistence is fixed on an unmerged branch (§1.2).
- **Externally blocked:** production mail delivery (E-01/E-02/E-03), document activation (E-06/E-11), assisted
  extraction (L5, provider), banks (E-07/E-08), Diia (E-09), real-document accuracy claims (E-12).

### 1.6 Confirmed runtime defects vs static findings awaiting reproduction

**Runtime-confirmed** (reproduced in a running build; see the cited report):

| Defect | Evidence | State |
|---|---|---|
| Locale resets to RU on reload | usability-followup report §1 (baseline `69477c9`) | fixed by `03c00b8`, unmerged |
| Sync chip covers content at 390 and 768 px | same report §1 | fixed by `03c00b8`, unmerged (found there, not by this discovery) |
| Home empty hints below 12 px | same report §1 | fixed by `03c00b8`, unmerged (found there, not by this discovery) |

**Static findings awaiting reproduction.** These are likely defects read from code, but they have not been observed
at runtime:
- the Tasks category sort uses `tag` while Quick Add stores the category in `tagLabel`;
- the finance «в итогах» total sums every transaction under a monthly label;
- undated tasks have no close or archive action;
- the empty-state `+ добавить привычку` button has no handler;
- the dog page's "feed now", meal-history link, fixed 7000 g restock and `'буква'` placeholder;
- `snoozeDose` / `skipDose` only log an activity;
- the mobile "more" slot leads to Settings;
- the Home budget card CTA leads to a Settings page with no budget setting;
- weight edits do not feed the sparkline history;
- account deletion has no UI and no re-authentication;
- the stale «недельный обзор задач» copy.

**Static observations that are not defects** (a capability is absent by plan or by decision): next actions, Weekly
Review, Engage, Health, income, budgets, obligations, recovery codes and email change.

## 2. Hosting readiness

### 2.1 Proposed address `jenkin.sachenkolabs.tech`

- **Status:** proposed only (§93). Nothing is configured: no DNS record, certificate, host or mailbox is assumed.
- **Suitability:** suitable. A dedicated subdomain lets the API's `__Host-lifeos_session` cookie (Secure, Path=/, no
  Domain) stay host-only.
- **HSTS:** must be set on the subdomain without `includeSubDomains` on the apex, unless the owner decides that for
  all of `sachenkolabs.tech`.
- **Configuration values:**
  - `LIFEOS_PUBLIC_APP_URL=https://jenkin.sachenkolabs.tech`
  - `LIFEOS_ALLOWED_ORIGINS=["https://jenkin.sachenkolabs.tech"]`
  - `LIFEOS_ALLOWED_HOSTS=["jenkin.sachenkolabs.tech"]`, plus any internal health-check host the proxy uses.
- **Facts needed (from the owner, not from registrar access):**
  - which DNS provider is authoritative;
  - whether the apex already has MX, SPF or DMARC records (a second SPF record would break mail);
  - whether CAA records exist (they constrain the certificate authority).

### 2.2 Runtime and PostgreSQL

- **Shape:** two processes plus PostgreSQL:
  - a reverse proxy that terminates TLS, serves `apps/web/dist` and proxies `/api` on the same origin;
  - uvicorn `app.main:create_app` (factory);
  - PostgreSQL ≥ 16 (CI-equivalent verification used 16).
- **The FastAPI app does not serve the SPA**, so a separate static server is required. The client calls relative
  `/api` paths, so the setup must be same-origin. **There is no CORS middleware**, by design.
- **No deployment artefact exists in the repo:** no Dockerfile, compose file, systemd unit, proxy config or CI.
  `scripts/preview.sh` is a loopback macOS development launcher: `vite preview`, environment `development`, insecure
  cookie. It must never be used as a production server.
- **Python 3.11 is pinned** (`>=3.11,<3.12`), with hashed lock files. Node ≥ 20.19 is needed only to build.
- **Workers:** a single uvicorn process is recommended at first.
  - Throttling is DB-backed and multi-process safe.
  - `TransferSlots` is per process, so N workers allow N × 4 concurrent document transfers and multiply the memory
    budget.
- **Database pool:** `create_engine(..., pool_pre_ping=True)` with SQLAlchemy defaults, and no settings
  (`db.py:10-11`). This is enough for one worker.
- **Migrations:** Alembic, linear, head `20261001_0012`.
  - Downgrade of `0012` refuses while documents exist (A-22).
  - Rollback is therefore **restore from the pre-migration backup**, or a forward fix — not a downgrade.
- **Analytics in a hosted build:**
  - The default web build has analytics off. The backend refuses `aa_write_enabled` in production.
  - A hosted JENKIN therefore has **no Adaptive Analytics, no System Review obligations and no finance mirror**, unless
    a separate slice re-verifies the guard and the owner lifts it.
  - **The guard stays in place** until that separate verification (H5) is done. This discovery's observation that
    its stated reason looks outdated is static and unverified, and it is not a reason to relax the guard.
  - The owner should decide this explicitly.

### 2.3 HTTPS, cookies, origin, proxy

What is implemented:
- **Production mode** (`LIFEOS_ENVIRONMENT=production`, `config.py:118-153`):
  - requires `cookie_secure`;
  - forbids `*` hosts and origins;
  - requires https `public_app_url`;
  - refuses the `memory` and `file` mail backends and SMTP security `none`;
  - renames the cookie to `__Host-`;
  - disables `/docs`.
- **Cookie:** HttpOnly, SameSite=Lax, 30 days, Path=/ (`security/sessions.py:17-36`).
- **CSRF:** `enforce_same_origin` (Sec-Fetch-Site, then Origin, then Referer; otherwise refuse) is applied on every
  mutating router, including state, documents, account, auth and AA (`security/origin.py:15-33`; verified in all 15
  route modules). JSON content type is required.
- **Private responses:** `/api` responses are `no-store`, `nosniff`, `Vary: Cookie`. Document downloads carry
  `CSP: default-src 'none'; sandbox`.
- **Proxy hops:** exactly one interpreter of `X-Forwarded-For`. The runbook recommends uvicorn proxy headers with
  `forwarded-allow-ips=127.0.0.1` and `LIFEOS_TRUSTED_PROXY_HOPS=0`.

Missing for public exposure:
- **No site-wide security headers:** no CSP, HSTS, `frame-ancestors` / X-Frame-Options, Referrer-Policy or
  Permissions-Policy. The proxy must add them, and the app's CSP needs a design pass first: inline pre-paint scripts
  in `index.html` and Google Fonts usage must be inventoried.
- **Source maps:** the build ships them (`vite.config.js:22` `sourcemap: true`). Exposing them publicly is an owner
  decision.
- **`.env.example` is stale:** 9 variables, none of the S1/S2 ones.
- **Logging:** no logging configuration (no `basicConfig` / `dictConfig`). Records with `extra={…}` are not
  structured, and the log level and format are undefined in production.

### 2.4 SMTP and domain email

- **Code is ready.** Settings: `smtp_host`, `smtp_port` (587), `smtp_username`, `smtp_password` (SecretStr),
  `smtp_security` (starttls/ssl), `smtp_timeout_seconds` (10), `mail_from` (`config.py:48-56`).
- **Sending is synchronous, with no queue or retry:**
  - the reset mail goes in `BackgroundTasks`, after the 202;
  - a delivery failure is only logged and audited as `password_reset_delivery_failed`;
  - verification and invitation mail are sent inline.
- **Needed (E-01, E-02):**
  - a transactional SMTP provider or mailbox;
  - a sender address on a domain the owner controls, for example `jenkin@` / `no-reply@sachenkolabs.tech` (the owner
    decides);
  - SPF include, DKIM records and a DMARC policy for that domain;
  - port and security mode.
- **Credentials** go into a secret store or a 0600 EnvironmentFile on the host, never into Git, reports or chat.

### 2.5 Key custody, encrypted backups, retention, restore

- **Keys (E-06, open):**
  - where the production keyring lives (a host file at 0400, or a secret mount);
  - who holds the offline escrow copy;
  - who may rotate keys;
  - how long database backups are retained, which decides when a retired KEK may be destroyed.
- **Runbook:** `Outputs/Runbooks/jenkin-document-keys-runbook.md` prescribes generation, escrow, permissions,
  rotation and lost-key handling, and a restore check (`documents-verify --deep` on a restored disposable DB). The
  roadmap still needs **the owner's review of the runbook**.
- **What already exists — the preview launcher's automatic pre-migration backup** (`scripts/preview/launcher.py`
  `backup_before_migration`, introduced by `f525ce2` and present on `69477c9`):
  - It runs **automatically** whenever `scripts/preview.sh` is about to migrate a database that already has a schema.
    This includes `lifeos_preview_personal`.
  - It takes a `pg_dump --format=custom`, plus a 0600 copy of that database's **existing** keyring
    (`~/.jenkin-preview/secrets/keyring-<db>.json`) when one exists. A manifest is written with a restore command.
  - It **fails closed:** without a complete dump, the migration does not run.
  - Backups go to `~/.jenkin-preview/backups/` (0700) and are never pruned.
  - A restore of one such backup into a fresh database and its decryption with the copied keyring were
    **runtime-verified**. All 40 tables matched, the documents were SHA-256-equal, and a different keyring was
    refused (usability-followup report §4.6). That backup was produced by calling the function directly, not through
    a real upgrade, because no newer migration exists.
- **The remaining gap is therefore narrower than "no backup":**
  - **No scheduled backup.** A backup happens only when a migration happens, so data written between migrations has
    no copy. The recovery point is "the last migration", which can be arbitrarily old.
  - **No separation and no off-host copy.** The launcher puts the dump and the keyring copy **in the same directory
    on the same disk** as the live database. One lost or stolen disk loses both, or exposes both. That contradicts key
    runbook §3, which says keys and database backups belong in different places with different access.
  - **Dumps are not encrypted** (0600 only).
  - **No retention** that is coordinated with key retirement (below).
  - **No backup-success signal** and **no practised, scheduled restore drill** for the owner's real database.
  - **No production backup tooling** of any kind.
- **What a database dump exposes** (plaintext-data plan): it holds S2 documents as ciphertext, but the snapshots
  (health, medications, notes, profile, tasks, transactions), the AA facts and the audit events are **plaintext**.
- **Requirement:**
  - every backup stored off the machine must be encrypted at rest, for example with age or GPG, to a recipient
    **public** key whose private key is held off-host;
  - the keyring backup must be stored separately from database dumps.

**Historical key recovery.** A database backup is recoverable only with **every KEK that its records use**. The
currently active key is not enough:
- Each `documents` / `document_versions` record names its `kek_id`. After a rotation (key runbook §5), backups made
  before it still hold records wrapped by the previous KEK.
- A KEK must therefore stay escrowed until the **last retained backup that uses it** has expired. Backup retention
  and key retirement are one policy: retiring or destroying a KEK while a retained backup needs it makes that backup
  partly unreadable, and the runbook says this cannot be recovered.
- Each backup's manifest should record the set of KEK ids its records use. This needs only the `kek_id` column,
  never key material. Ideally the set is read from the same snapshot as the dump. The key-escrow copy should be
  checked against that set by id and check value (`keyring-check`).
- **Data recoverability and rotation completion are separate checks:**
  - **Recoverable:** every record in the restored backup authenticates with the supplied keyring (no `FAILED:`
    lines).
  - **Rotation complete:** every record in the **live** database uses the **active** key. This is the exit-0
    condition of `documents-verify`.
  - An older backup that restores cleanly but uses a previous KEK is **recoverable and correct**. It is not a
    failure, and it must not be "fixed" by rotating the restored copy.
  - Note that `documents-verify` exits 1 in both cases ("NOT complete … on other keys" and "FAILED"). It also advises
    "Re-run documents-rotate", which is live-database advice. A restore drill must judge the failure list, not the
    exit code (backlog H2).


### 2.6 Capacity, monitoring, rollout and rollback

Capacity (estimates from configuration, not measured):
- per account: snapshot ≤ 5 MiB, documents ≤ 512 MiB and 1000 documents;
- document transfer memory ≈ 4 × 3 × 15 MiB ≈ 180 MiB per worker, plus the baseline (runbook §8);
- for an owner plus a few invitees, a small VM (about 2 vCPU, 2–4 GB RAM, 20–40 GB disk, plus backup storage of at
  least 2 × the database size) is adequate;
- **E-11** is still the owner's choice of document limits and headroom.

Monitoring — nothing exists. Needed:
- an uptime check on `/api/healthz` (database liveness only; there is no readiness split);
- certificate expiry, disk and database size, and backup success or failure alerts;
- log retention.

Housekeeping:
- expired sessions, throttle rows and audit events older than 365 days are purged only opportunistically on login
  (`services/auth.py:59-63,144`);
- AA retention is apply-only, by design;
- acceptable for one owner, but should become a scheduled job.

Rollout and rollback:
- nothing exists;
- the integration branch must first be merged to `main` through the normal PR, and a first `released` entry created
  per `RELEASE_NOTES_PROCESS.md`;
- rollback = the previous build artefact plus a database restore from the pre-migration backup, because downgrades
  are not data-preserving for documents.

### 2.7 Independent security audit

- **No independent (third-party) security audit is recorded in the repository.** The "independent review" in the S1
  and Calendar reports was another agent's review pass, not an external audit.
- **Before public exposure,** an external reviewer (or at minimum an owner-commissioned review outside the
  implementing agent) should cover:
  - session, cookie, CSRF and origin handling;
  - `X-LifeOS-Account` binding;
  - invitation, recovery and verification token flows and throttling;
  - the S2 envelope, AAD, keyring handling and rotation;
  - the upload parsers (pypdf, PNG/JPEG walkers);
  - export and erasure completeness;
  - the reverse-proxy, TLS and header configuration;
  - dependency CVEs (`pip-audit`, `npm audit` read-only — never `npm audit fix`);
  - backup encryption and the restore drill.
- **When this review is mandatory:** before a **public multi-user** service. For a single-owner private deployment,
  it is a strong recommendation, not a gate (§3).
- **Open findings that should be on the audit's list:**
  - H-04 (plaintext browser storage);
  - plaintext snapshots and AA at rest;
  - NAT-shared network throttles;
  - no site CSP/HSTS;
  - source maps;
  - account deletion with no re-authentication and the orphaned-owner case;
  - synchronous mail with no retry.

### 2.8 What may be discussed, and what must never be shared

- **May be discussed in chat, plans and reports:**
  - non-secret infrastructure facts: the hosting provider and region, the DNS provider, which record types exist,
    the public hostname, the public IP once it is provisioned, ports, the proxy topology, and the PostgreSQL version;
  - **public** keys: an age or GPG recipient key, DKIM **public** records, and KEK **ids** and check values (never key
    bytes).
- **Must never enter chat, Git, reports or logs:**
  - private keys: the backup identity, the keyring file and KEK bytes, the TLS private key, the DKIM private key;
  - credentials: database and SMTP passwords;
  - tokens: the bootstrap token, session cookies, and invitation, reset or verification tokens;
  - any personal data from a real account, including the owner's.

  These go directly from the owner into a secret store or a 0600 / 0400 file on the host.

## 3. Blockers by deployment mode

The blockers differ by who can reach the app and who has an account. Three modes:
- **Local:** the owner alone, on the Mac, loopback only, through `scripts/preview.sh --db-suffix personal`.
- **Private hosted:** the owner alone, reachable over the internet; no other accounts are invited.
- **Public multi-user:** other people hold accounts.

A convenience feature is **not** a universal hosting blocker. In the table below:
- **Gate** = mandatory before that mode;
- **Rec.** = product recommendation;
- **—** = not relevant.

| Item | Local | Private hosted | Public multi-user |
|---|---|---|---|
| Owner bootstraps the personal DB. Bringing old `lifeos_dev` data forward is decision E-04, and agents must not migrate it. | owner action | owner action | owner action |
| Scheduled, encrypted, separated backups, with a success check and a practised restore (H2) | **Gate** for relying on it as the only copy of real data | **Gate** | **Gate** |
| Production packaging: TLS, `__Host-` cookie, production config, security headers (CSP/HSTS/frame-ancestors), logging (H1) | — | **Gate** | **Gate** |
| Key custody and escrow (E-06), with retention coordinated with KEK retirement (§2.5) | **Gate** once real documents are stored | **Gate** if documents are enabled | **Gate** if documents are enabled |
| Monitoring: uptime, certificate expiry, disk, backup staleness (H3) | Rec. (backup-staleness warning) | **Gate** | **Gate** |
| Source maps not publicly served, or a deliberate decision to serve them (Q-H1-2) | — | owner decision | owner decision |
| Dependency audit, read-only (`pip-audit`, `npm audit`) | Rec. | **Gate** | **Gate** |
| Independent security review (§2.7) | — | Rec. (strong) | **Gate** |
| AA production guard kept until H5 verifies it | stays as is (preview is not production) | **Gate** (keep) | **Gate** (keep) |
| A working erasure path for other users' data, and the owner-deletion rule (A1). The API exists; it needs a re-auth decision and a UI or an owner-run procedure. | — | — | **Gate** |
| Owner decision on the plaintext-data plan for other people's health and finance data | — | Rec. | **Gate** (a decision to accept or mitigate) |
| Production mail (E-01/E-02), for invitations, verification and recovery | — | Rec. (manual links work) | **Gate** for self-service recovery |
| Recovery codes (I1a) | — | Rec. | Rec. (strong) |
| Email change (A2) | — | Rec. | Rec. |
| Mobile navigation (U2 drawer) | — (loopback) | Rec. | Rec. |
| Empty-account creation for habits, medications, pet and Health (U1/U3) | Rec. | Rec. | Rec. |
| Daily-friction fixes (U0, Tasks lifecycle) | Rec. | Rec. | Rec. |
| Merge to `main` and a first release entry (H6) | — | **Gate** (deploy from a tag) | **Gate** |

**External facts for any hosted mode:**
- hosting choice and region;
- DNS records;
- TLS;
- proxy topology (E-03);
- key custody (E-06);
- capacity limits (E-11);
- backup storage location and retention.

SMTP (E-01/E-02) is needed only where the table says so.

**Local daily friction** (static findings awaiting reproduction, §1.6, unless marked otherwise):
- undated tasks cannot be closed or archived;
- category sort;
- finance totals labelled monthly but summed over all time;
- no transaction delete.

The UK-locale reset is runtime-confirmed and already fixed on an unmerged branch.

## 4. Inconsistencies found in the records (not fixed here)

- **ID collision:** `E-11` means "memory/backup headroom for documents" in the security register, and "AI provider
  account/key" in the loan register. Renaming the loan one (for example to `E-13`) would remove the ambiguity.
- **AA production guard:** the guard's reason ("until account export and erasure exist") appears outdated (§1.4).
  Verify before relying on either reading, and keep the guard until that verification (H5) is done.
- **Stale comments:** `App.jsx:343` and `TaskDetailModal.jsx:80` still describe Home seed rows.
- **Stale copy:** the weekly task review copy in System Review (§1.1).
