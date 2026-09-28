# AUDIT for PF-01 Batch 3.1 — local pre-deploy verification

**Дата:** 2026-07-21 23:23:05 Europe/Kiev
**Фаза:** C — verification audit, без tracked implementation
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Branch:** `design-sync-setup`
**Approved Plan:** `Outputs/Plans/pf-01-batch-3-1-local-verification_plan_2026-07-21_225632.md`
**Overall verdict:** **STATIC/OFFLINE GREEN; LOCAL RUNTIME INCOMPLETE**

Позначки доказів:

- **VERIFIED** — команда реально виконана на HEAD `67a1456`; actual output зафіксовано нижче.
- **MOCK NOT RUN** — browser scenario не виконувався; очікування не зараховане як result.
- **USER-RUN REQUIRED** — policy забороняє Codex запускати цей DB/runtime layer.
- **N/A** — шлях не належить до цього проекту.

## 1. Executive verdict

1. **PASS:** frontend dependency tree, strict TypeScript, ESLint, 6/6 test files, 28/28 tests і production build.
2. **PASS:** backend locked Python 3.11 environment, `pip check`, syntax для 35/35 Python files, Ruff і complete import graph.
3. **PASS:** Settings security matrix, PostgreSQL metadata compilation без connection, Alembic topology та offline SQL.
4. **PASS:** exact frontend security/storage counts залишилися на approved baseline.
5. **BLOCKED / NOT RUN:** MOCK browser smoke. Vite реально відповідав HTTP 200, але Codex in-app Browser двічі аварійно завершив нову blank tab до завантаження LifeOS URL. Жоден UI scenario не оголошений green.
6. **USER-RUN REQUIRED:** PostgreSQL pytest, live Alembic check/upgrade і browser→FastAPI→PostgreSQL. Без цього проект ще не має повного pre-deploy verdict.
7. **PASS:** жоден tracked `apps/web`/`apps/api` file не змінено; commit/push/deploy відсутні.

## 2. Preflight і environment isolation

### 2.1 Repository state

Actual:

```text
HEAD:   67a1456c6165e9bdf36382a98c9713c4ed981314
branch: design-sync-setup
```

Existing user-owned status перед і після audit однаковий за tracked project scope: `.DS_Store` modified; instruction/report/design/test artifacts untracked. `git diff --exit-code -- apps/web apps/api` → exit 0 після всіх перевірок.

### 2.2 Toolchain

```text
Python 3.11.15
Node v22.20.0
npm 11.11.0
```

Порти 5173 і 8001 були вільні на preflight. Existing PID 48273/port 8000 не зупинявся, не сигналився і не використовувався.

### 2.3 Locked venv

Створено `apps/api/.venv` через `/opt/homebrew/bin/python3.11`; path ignored через `apps/api/.gitignore:2` на HEAD. Install:

```bash
.venv/bin/python -m pip install --require-hashes -r requirements-dev.lock
```

Перша sandboxed спроба не мала DNS; після approved network escalation той самий hash-locked command успішно встановив exact versions. Manifest/lock не змінювалися.

Actual dependency consistency:

```text
No broken requirements found.
```

Pip повідомив лише environment warning про disabled user cache; install у `.venv` завершився exit 0.

## 3. Frontend deterministic gates

Виконано з `apps/web`.

| Gate | Exit | Actual result |
|---|---:|---|
| `npm ls --depth=0` | 0 | React 18.3.1, React DOM 18.3.1, ESLint 10.7.0, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.10 |
| `npm run typecheck` | 0 | no diagnostics |
| `npm run lint` | 0 | no diagnostics |
| `npm run test` | 0 | 6 files passed; 28 tests passed |
| `npm run build` | 0 | 81 modules transformed; build completed in 1.03 s |

Actual test summary:

```text
Test Files  6 passed (6)
Tests       28 passed (28)
Duration    3.57s
```

Actual build artifacts:

```text
dist/index.html                   2.03 kB │ gzip:   0.89 kB
dist/assets/index-peODzM-h.css  124.84 kB │ gzip:  21.81 kB
dist/assets/index-D67jDXey.js   397.13 kB │ gzip: 113.07 kB │ map: 982.00 kB
```

`apps/web/dist/` залишено як ignored build output (`apps/web/.gitignore:2`); не staged.

### 3.1 Exact frontend security/storage gates

| Pattern | Expected | Actual | Verdict |
|---|---:|---:|---|
| test files | 6 | 6 | PASS |
| `it/test` cases | 28 | 28 | PASS |
| production `fetch(` | 1 | 1 | PASS |
| frontend `user_id` | 0 | 0 | PASS |
| legacy `localStorage.getItem('lifeOsState')` | 1 | 1 | PASS |
| legacy `setItem/removeItem('lifeOsState')` | 0 | 0 | PASS |
| secret-like frontend `VITE_*` names | 0 | 0 | PASS |

The sole fetch boundary remains `requestJson` (`apps/web/src/api/client.ts:46-78`, VERIFIED HEAD). No static user-id tenant selector or frontend secret name was found.

## 4. Backend static gates

### 4.1 Syntax, Ruff, imports

Inventory on HEAD: 35 Python files = 27 `app/` + 6 `tests/` + 2 `alembic/`.

| Gate | Exit | Actual |
|---|---:|---|
| `py_compile` for all 35 files | 0 | no syntax errors |
| `.venv/bin/ruff check app tests alembic` | 0 | `All checks passed!` |
| import graph | 0 | `imports-ok 3` |

Import graph included `Settings`, `create_app`, all three route modules, auth/state services, `Base`, `User`, `UserSession`, `UserSnapshot`. No server started and no engine query executed.

### 4.2 Settings security matrix

Actual:

```text
sqlite rejected
prod_insecure rejected
prod_wildcard_host rejected
prod_wildcard_origin rejected
settings-matrix-ok
```

Additionally verified:

- development cookie name `lifeos_session`;
- trailing slash origin normalized;
- valid production settings produce `__Host-lifeos_session`.

Rules come from `apps/api/app/config.py:21-73` on HEAD.

### 4.3 SQLAlchemy PostgreSQL metadata, no DB connection

Actual:

```text
TABLE users
INDEX uq_users_email_lower CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email))
TABLE sessions
INDEX ix_sessions_expires_at CREATE INDEX ix_sessions_expires_at ON sessions (expires_at)
INDEX ix_sessions_user_id CREATE INDEX ix_sessions_user_id ON sessions (user_id)
TABLE user_snapshots
metadata-ddl-ok 3
```

Exactly 3 model tables compile under PostgreSQL dialect. No engine/socket was created.

## 5. Alembic topology й offline SQL

### 5.1 Required raw topology output

`alembic heads` actual:

```text
20260721_0001 (head)
```

`alembic branches` actual:

```text

```

**VERIFIED:** current repository topology has one head, `20260721_0001`, and no branch points.

### 5.2 Required raw offline SQL output

Command used dummy PostgreSQL URL on port 1 and `--sql`; offline code path is `apps/api/alembic/env.py:23-32`. No connection was opened.

```sql
BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 20260721_0001

CREATE TABLE users (
    id UUID NOT NULL,
    email VARCHAR(320) NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE sessions (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    token_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_sessions PRIMARY KEY (id),
    CONSTRAINT fk_sessions_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_sessions_expires_at ON sessions (expires_at);
CREATE INDEX ix_sessions_user_id ON sessions (user_id);

CREATE TABLE user_snapshots (
    user_id UUID NOT NULL,
    schema_version INTEGER NOT NULL,
    revision BIGINT DEFAULT 1 NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT pk_user_snapshots PRIMARY KEY (user_id),
    CONSTRAINT ck_user_snapshots_payload_object CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT ck_user_snapshots_revision CHECK (revision > 0),
    CONSTRAINT ck_user_snapshots_schema_version CHECK (schema_version > 0),
    CONSTRAINT fk_user_snapshots_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO alembic_version (version_num)
VALUES ('20260721_0001') RETURNING alembic_version.version_num;

COMMIT;
```

Exact source counts: 3 `op.create_table`, 3 `op.create_index` (`apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py:21-64`, VERIFIED HEAD).

**Runtime note:** real local/VPS environment still needs `alembic upgrade head` before app start. This audit did not apply migrations.

## 6. MOCK browser smoke — honest failure report

### 6.1 What was actually verified

- Vite started on `127.0.0.1:5173` with `VITE_API_PROXY_TARGET=http://127.0.0.1:8001`.
- Escalated host-side `curl -I http://127.0.0.1:5173/` returned `HTTP/1.1 200 OK`.
- A temporary standard-library mock file was created and passed Python 3.11 `py_compile`.

### 6.2 Blocking condition

The Codex in-app Browser twice created a new tab that immediately became `This page crashed` with a blank-page failure before LifeOS URL loaded. A fresh tab was attempted after the documented browser-recovery check; the same condition repeated. The only user-open tab was unrelated (`chatgpt.com`) and was not claimed or inspected.

### 6.3 Result

**MOCK BROWSER NOT RUN — in-app browser blank-tab crash.**

Therefore the following Plan scenarios have **no runtime verdict**, not PASS:

1. server-unavailable/retry;
2. neutral login vs `?bootstrap=1`;
3. bootstrap validation/double-submit;
4. initial snapshot creation;
5. all 15 routes;
6. visible save/reload;
7. locale/theme/paradise;
8. 409 conflict recovery;
9. offline retry;
10. reset cancel/confirm;
11. logout/login.

The mock process was never started because the browser blocker occurred first. Vite was stopped with its owned session; temp directory `/private/tmp/lifeos-local-verify.pXo4s8` was validated then removed. Final elevated `lsof` returned no listener on 5173 or 8001.

## 7. USER-RUN REQUIRED — real local PostgreSQL suite

Repository policy forbids Codex from running these commands. They intentionally mutate only a dedicated local test database. Review the URL before Enter.

### 7.1 One-time local PostgreSQL test database

```bash
brew services start postgresql@18

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
createdb lifeos_pf01_test

export LIFEOS_TEST_DATABASE_URL="postgresql+psycopg://$(id -un)@127.0.0.1:5432/lifeos_pf01_test"
test "$(psql "$LIFEOS_TEST_DATABASE_URL" -Atqc 'select current_database()')" = "lifeos_pf01_test" \
  || { echo 'STOP: wrong test database'; exit 1; }
```

If `createdb` says the database already exists, do not drop it automatically: first inspect its name/owner and confirm it is disposable.

### 7.2 Full API tests

```bash
cd /Users/yurasachenko/LifeOS_DesignSystem/apps/api
LIFEOS_TEST_DATABASE_URL="$LIFEOS_TEST_DATABASE_URL" .venv/bin/pytest -v
```

Expected static inventory: 11 real test functions in 5 `test_*.py` modules. Fixture additionally rejects any database name not ending `_test`, applies Alembic, and truncates `user_snapshots`, `sessions`, `users` (`apps/api/tests/conftest.py:31-66`).

### 7.3 Live Alembic consistency

Only against the disposable test DB:

```bash
cd /Users/yurasachenko/LifeOS_DesignSystem/apps/api
LIFEOS_DATABASE_URL="$LIFEOS_TEST_DATABASE_URL" \
LIFEOS_BOOTSTRAP_TOKEN='local-test-only-token-at-least-32-chars' \
.venv/bin/alembic current
```

For a real dev database, configure `LIFEOS_DATABASE_URL` and then run:

```bash
.venv/bin/alembic check
.venv/bin/alembic upgrade head
```

`alembic check` may compare metadata against the connected database; verify the URL is local/dev before running.

## 8. USER-RUN REQUIRED — real browser→FastAPI→PostgreSQL

Use a separate **dev** DB, not the `_test` DB that pytest truncates:

Terminal 1:

```bash
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
createdb lifeos_pf01_dev

cd /Users/yurasachenko/LifeOS_DesignSystem/apps/api
export LIFEOS_ENVIRONMENT=development
export LIFEOS_DATABASE_URL="postgresql+psycopg://$(id -un)@127.0.0.1:5432/lifeos_pf01_dev"
export LIFEOS_BOOTSTRAP_TOKEN="$(openssl rand -hex 32)"
export LIFEOS_ALLOWED_HOSTS='["localhost","127.0.0.1"]'
export LIFEOS_ALLOWED_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]'
export LIFEOS_COOKIE_SECURE=false

.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001
```

Before opening the bootstrap screen, print the temporary token locally:

```bash
printf '%s\n' "$LIFEOS_BOOTSTRAP_TOKEN"
```

Terminal 2:

```bash
cd /Users/yurasachenko/LifeOS_DesignSystem/apps/web
VITE_API_PROXY_TARGET=http://127.0.0.1:8001 npm run dev
```

Browser:

```text
http://127.0.0.1:5173/?bootstrap=1
```

Enter the generated bootstrap token manually; do not commit or paste it into chat. Then execute the 11 browser scenarios from the approved Plan section 8.3. Use a fresh disposable account/database if prior browser cookies create ambiguity.

## 9. Behavior matrix / remaining confidence

| Layer | Result | What it proves | What it does not prove |
|---|---|---|---|
| Frontend compile/lint/test/build | PASS | types, lint, 28 isolated behaviors, bundle | browser interaction/layout |
| Backend syntax/lint/import | PASS | Python graph and style | request/DB runtime |
| Settings matrix | PASS | configured validation/security rules | actual deployed env values |
| Metadata + Alembic offline | PASS | PostgreSQL SQL generation and single revision graph | live DB upgrade/drift |
| MOCK browser | NOT RUN | none | all UI runtime paths |
| PostgreSQL pytest | USER-RUN | pending | auth/isolation/CAS/health |
| Real browser→API→DB | USER-RUN | pending | production-like local flow |

## 10. Invariants checklist

- **Billing:** VERIFIED N/A — no credits/payment path.
- **Status state-machine:** VERIFIED N/A — no aiogram/domain transition edit.
- **FSM keys:** VERIFIED N/A.
- **Telegram callback_data ≤64 B:** VERIFIED N/A.
- **Multi-account isolation:** frontend `user_id` count 0 PASS; authoritative DB isolation pending USER-RUN.
- **Revision/CAS:** unit tests PASS; authoritative PostgreSQL CAS pending USER-RUN; browser 409 NOT RUN.
- **Secrets:** only dummy/generated instructions; no `.env`, real token or storage inspection.
- **Filesystem:** tracked source diff none; `.venv`/`dist` are ignored; temp mock removed.
- **Processes:** own Vite stopped; mock never started; 5173/8001 clear; port 8000 untouched.
- **Migration:** one head verified offline; live environment needs `alembic upgrade head`.

## 11. Plan adherence / changed-file map

### Tracked files changed

**None.** `git diff --exit-code -- apps/web apps/api` → exit 0.

### Local artifacts

- `apps/api/.venv/` — approved Plan §4; ignored, retained.
- `apps/web/dist/` — approved Plan §5; ignored, retained.
- `/private/tmp/lifeos-local-verify.pXo4s8` — approved Plan §8/§12; removed.
- This Audit and summary — mandatory output persistence; untracked Outputs artifacts, no commit.

No migration, dependency manifest, env file, test signature, fixture ID, API path, source symbol or user-owned dirty file was changed. No task-log entry/commit was created because the approved deliverable is a verification-only Audit, not a code task.

## 12. Observations and next action

New code observations: **none**. Browser crash is a tooling/runtime gap, not evidence of a LifeOS defect, so it was not added to `claude_observations.md`.

Minimum next step before deployment:

1. User runs §7 PostgreSQL pytest block and returns complete terminal output.
2. Then run §8 real local browser flow, or retry Codex browser smoke in a fresh browser session.
3. Only after both are green should we prepare VPS deployment Discovery/Plan.

WAITING FOR: user-run PostgreSQL/pytest output or command to retry browser verification in a fresh session.
