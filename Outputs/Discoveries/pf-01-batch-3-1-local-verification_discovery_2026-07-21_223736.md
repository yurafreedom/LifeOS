# DISCOVERY for PF-01 Batch 3.1 — local pre-deploy verification

**Дата:** 2026-07-21 22:37:36 Europe/Kiev
**Фаза:** A — Discovery (read-only, крім цього report artifact)
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Branch:** `design-sync-setup`
**Запит:** виконати максимум локальних перевірок без VPS
**Статус:** DISCOVERY COMPLETE; verification commands/service startup ще не виконувалися

Evidence labels:

- **VERIFIED (HEAD `67a1456`)** — re-read from committed file/line.
- **VERIFIED (local command, 2026-07-21)** — read-only environment command was executed.
- **UNKNOWN** — requires the approved Plan/runtime prerequisite.
- **PROHIBITED FOR CODEX** — repository verification policy reserves it for the user.

## 1. Current repository state

- **VERIFIED (command):** HEAD is `67a1456`; branch is `design-sync-setup`.
- **VERIFIED (command):** no tracked PF-01 implementation file is dirty after Batch 3. Existing `.DS_Store` modification and untracked instruction/report/design/test artifacts predate this task and remain user-owned.
- **VERIFIED (HEAD `67a1456`):** frontend exposes `dev`, `build`, `preview`, `lint`, strict `typecheck`, and Vitest scripts (`apps/web/package.json:6-22`).
- **VERIFIED (HEAD `67a1456`):** backend pins Python `>=3.11,<3.12`, FastAPI, PostgreSQL/psycopg, SQLAlchemy, Alembic, Uvicorn, pytest and Ruff (`apps/api/pyproject.toml:1-34`).
- **VERIFIED (HEAD `67a1456`):** API integration tests are PostgreSQL-only and refuse a database whose name does not end in `_test`; they apply Alembic and truncate only `user_snapshots`, `sessions`, and `users` around tests (`apps/api/tests/conftest.py:31-66`).

## 2. Local machine readiness

| Prerequisite | Evidence | Verdict |
|---|---|---|
| Node/npm | **VERIFIED command:** Node `v22.20.0`, npm `11.11.0` | READY |
| Frontend dependencies | **VERIFIED command:** `apps/web/node_modules` exists | READY; integrity still to verify with `npm ls` |
| Python 3.11 | **VERIFIED command:** `/opt/homebrew/bin/python3.11` → `3.11.15` | READY |
| API virtualenv | **VERIFIED command:** `apps/api/.venv` executable absent | NOT READY |
| Python packages under 3.11 | **VERIFIED command:** FastAPI/SQLAlchemy/Alembic/psycopg/pytest/Ruff/Uvicorn absent | NOT READY; install from locked dev requirements needed |
| API runtime env | **VERIFIED command:** `apps/api/.env` absent | NOT READY |
| API test env | **VERIFIED command:** `apps/api/.env.test` absent | NOT READY; tests actually read `LIFEOS_TEST_DATABASE_URL` from process env (`apps/api/tests/conftest.py:31-39`) |
| PostgreSQL binaries | **VERIFIED command:** Homebrew PostgreSQL `18.3`; data dir `/opt/homebrew/var/postgresql@18` exists | INSTALLED |
| PostgreSQL listener | **VERIFIED command:** nothing listens on `127.0.0.1:5432` | STOPPED / UNKNOWN cluster readiness |
| Docker | **VERIFIED command:** CLI `29.4.3`; Desktop context selected but daemon socket absent | NOT AVAILABLE; no Docker path should be planned |
| Port 8000 | **VERIFIED elevated read-only command:** PID 48273 is a 24-day-old `python -m http.server 8000 --bind 127.0.0.1` | OCCUPIED; do not stop without separate authority |
| Port 5173 | **VERIFIED command:** no listener | AVAILABLE |

**Recommendation:** preserve the existing long-running port-8000 process and use API port **8001** for verification. Vite already supports a transient proxy override through `VITE_API_PROXY_TARGET` (`apps/web/vite.config.js:4-13`), so no source/config edit is required.

## 3. Verification layers that Codex can execute

### 3.1 Frontend deterministic gates

All are available immediately and do not require VPS/DB:

1. `npm ls --depth=0` — installed dependency integrity.
2. `npm run typecheck` — strict TypeScript source/tests (`apps/web/package.json:11`).
3. `npm run lint` — ESLint source/config (`apps/web/package.json:10`).
4. `npm run test` — current 6-file mocked/unit/SSR suite (`apps/web/vite.config.js:24-27`; test names inventoried in `apps/web/src/test/*`).
5. `npm run build` — production bundle (`apps/web/package.json:8`).
6. Static security/storage/count gates from Batch 3: one fetch boundary, no `user_id`, no frontend secret env names, one legacy read, zero legacy writes/deletes.

### 3.2 Backend static/offline gates after ignored venv setup

The locked Python environment can be created under ignored `apps/api/.venv` using Python 3.11 and `requirements-dev.lock`; this changes no tracked file (`apps/api/.gitignore:1-7`). After install Codex can run:

1. `python -m py_compile` over every committed `apps/api/**/*.py`.
2. `ruff check app tests alembic` against the configured Python 3.11 baseline (`apps/api/pyproject.toml:29-34`).
3. Import graph checks for `Settings`, `create_app`, routers, services, models, and migration module without constructing a DB engine.
4. Pydantic settings positive/negative checks using explicit dummy values: PostgreSQL dialect, origin normalization, production secure-cookie/wildcard rejection (`apps/api/app/config.py:13-73`).
5. SQLAlchemy PostgreSQL DDL compilation from metadata without a connection.
6. `alembic heads` and `alembic branches` after dependencies exist; raw output must be captured before any topology claim.
7. Offline `alembic upgrade head --sql` using a dummy PostgreSQL URL; this compiles migration SQL without contacting a database.
8. `pip check` for installed dependency consistency.

### 3.3 Local browser smoke without real PostgreSQL

The Browser skill can test the real Vite UI against a **temporary in-memory mock API** on port 8001, stored outside the repository under `/private/tmp`:

- auth boot error and retry;
- exact `?bootstrap=1` screen;
- bootstrap double-submit protection;
- first state creation and route shell;
- navigation across all 15 routes;
- RU/UK and dark/light/paradise UI controls;
- task/habit mutations and visible sync phases;
- logout/login and page reload against the temporary mock;
- forced offline/409 paths if the mock exposes deterministic toggles.

This is a frontend runtime smoke only. It must be reported as **MOCK**, never as proof of real FastAPI/PostgreSQL integration.

## 4. Verification that Codex cannot execute under repository policy

- **PROHIBITED FOR CODEX:** `pytest` of any flavor, even locally; policy reserves the suite for the user.
- **PROHIBITED FOR CODEX:** any command that connects to or mutates PostgreSQL, including creating the `_test` database, applying live migrations, health checks that execute `SELECT 1`, or real API browser flows.
- **PROHIBITED FOR CODEX:** Docker build/compose.
- **N/A:** bot/tgtest, external APIs and VPS.

The user-run PostgreSQL suite is still the only evidence for real auth/session/isolation/CAS behavior. Existing tests cover 10 explicit cases across bootstrap, login/logout, generic auth errors, origin/content type/body limit, production cookie security, DB health, tenant isolation, and revision conflicts (`apps/api/tests/test_auth.py`, `test_health.py`, `test_security.py`, `test_state_isolation.py`, `test_state_revision_conflict.py`).

## 5. Alembic honesty note

**UNKNOWN:** live Alembic head/branch count has not been asserted. The repo contains one visible migration file, `apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py`, but filename inventory is not valid topology evidence. `alembic heads` and `alembic branches` cannot run until the Python 3.11 venv is installed; Phase C must paste their raw outputs.

## 6. Risks and blockers

| Risk | Severity | Evidence / mitigation |
|---|---|---|
| Accidentally stopping unrelated port-8000 server | medium | Use 8001; do not signal PID 48273. |
| Installing with system Python 3.14 | high | Project explicitly requires `<3.12` (`apps/api/pyproject.toml:5`); create `.venv` with `/opt/homebrew/bin/python3.11`. |
| Calling mocked browser flow “full E2E” | high | Label MOCK; real DB suite remains user-run. |
| Test database destroys non-test data | critical | Fixture refuses non-`_test` names before migrations/truncate (`apps/api/tests/conftest.py:31-38`). |
| Browser local data contamination | medium | Do not inspect/delete browser storage; use explicit test account/mock state and record any visible persistence only. |
| Stale architecture docs | medium | Prior deliberate observation: `ARCHITECTURE.md` still describes browser Babel; commands must use live Vite files, not stale docs. |
| Network dependency install | medium | Requires owner approval; use hash-locked `requirements-dev.lock`, not unconstrained install. |

## 7. Complete behavior/test inventory

### Backend callers and shared state

- Auth routes share PostgreSQL users/sessions and cookie settings (`apps/api/app/routes/auth.py`; `apps/api/app/services/auth.py`).
- State routes share cookie-derived user identity and PostgreSQL snapshot revision (`apps/api/app/routes/state.py`; `apps/api/app/services/state.py`).
- Health executes a real DB query (`apps/api/app/routes/health.py:16-24`) and therefore is user-run only.
- Tests share an autouse truncate fixture and are not safe without the `_test` suffix guard (`apps/api/tests/conftest.py:31-66`).

### Frontend shared state

- `LifeDataContext` is shared across 19 source/test files; browser neighbor smokes must include tasks, finance, meds, goals, habits, calendar, preferences, auth switch, sync conflict and reset.
- Browser mock cannot prove database durability or cross-account row isolation; the authored PostgreSQL tests remain the regression bar.

## 8. Invariants checklist

- **Billing:** VERIFIED N/A; no credits/payment path.
- **Status state-machine:** VERIFIED N/A; no domain status transition task.
- **FSM keys:** VERIFIED N/A; no aiogram.
- **Telegram callback_data ≤64 B:** VERIFIED N/A.
- **Multi-account isolation:** static/client checks can prove no `user_id`; real isolation remains user-run PostgreSQL test.
- **Revision safety:** frontend unit race tests can run; real compare-and-swap remains user-run PostgreSQL test.
- **Secrets:** no real secret may be printed. Temporary bootstrap token must be generated for mock or local user-run env and never committed.
- **Files:** Discovery/Plan reports only; no source edit, dependency install, service start, DB command, stage, commit, push or deploy before Plan approval.

## 9. Open decisions / recommendation

1. **Python environment:** recommend creating ignored `apps/api/.venv` from hash-locked `requirements-dev.lock`.
2. **Port conflict:** recommend keeping PID 48273 untouched and using API/mock port 8001.
3. **Browser coverage:** recommend a temporary `/private/tmp` in-memory mock solely for frontend smoke, explicitly labeled MOCK.
4. **Real integration:** recommend Codex prepare an exact safe user-run command block for PostgreSQL start/database creation/pytest and browser FastAPI flow, but not execute it.
5. **Repository mutations:** recommend verification-only task — no tracked source changes and no commit unless a gate exposes a defect that is separately discovered/planned/approved.

## 10. Discovery conclusion

Maximum Codex-run local coverage is substantial: frontend dependency/type/lint/unit/build, backend locked-env static/import/config/DDL/Alembic-offline checks, and a real-browser Vite smoke against a temporary mock. The only hard gap is precisely the highest-value real integration layer — PostgreSQL pytest and browser→FastAPI→PostgreSQL — which repository policy assigns to the user.

WAITING FOR: review of Discovery and permission to prepare PHASE B Plan with the five recommended decisions above.
