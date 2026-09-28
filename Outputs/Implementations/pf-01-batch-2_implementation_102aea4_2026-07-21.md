# IMPLEMENTATION SUMMARY for PF-01 Batch 2

**Task:** authenticated multi-account API and PostgreSQL state service
**Phase:** C — Implementation complete
**Date:** 2026-07-21
**Branch:** `design-sync-setup`
**Implemented HEAD:** `102aea4cbdd04f1bb4b9b076879d7fb7aecfe5ec`
**Commit:** `102aea4 feat(api): add authenticated multi-account state service`
**Delivery:** commit-only; not pushed or deployed
**Approved Plan:** `Outputs/Plans/pf-01-batch-2_plan_2026-07-21_132405.md`

Evidence labels:

- **VERIFIED (HEAD `102aea4`)** — checked in committed source at the cited file and line.
- **VERIFIED (static command, HEAD `102aea4`)** — command completed locally without a live database.
- **USER-RUNTIME REQUIRED** — prohibited locally by repository verification policy or deferred to deployment.
- **N/A** — proven outside this API-only Batch.

## 1. Verdict

**VERIFIED (HEAD `102aea4`):** PF-01 Batch 2 is implemented and committed as one atomic 45-file change (`git show --stat HEAD` → `45 files changed, 3555 insertions(+)`). The commit adds the approved FastAPI app factory without a module-level DB connection (`apps/api/app/main.py:12-29`), one-time account bootstrap and opaque sessions (`apps/api/app/services/auth.py:39-77`), authenticated user-scoped snapshots with atomic revision comparison (`apps/api/app/services/state.py:17-63`), same-origin request checks (`apps/api/app/security/origin.py:15-42`), and the additive three-table Alembic migration (`apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py:21-73`).

**VERIFIED (HEAD `102aea4`):** no frontend file, StaticFiles mount, CORS middleware, Docker/VPS file, Telegram handler, billing path, or domain normalization was added. The application registers only health, auth, and state routers (`apps/api/app/main.py:43-45`).

## 2. Implemented behavior

| Caller | Result | Evidence on HEAD `102aea4` |
|---|---|---|
| VPS/local health probe | `GET /api/healthz` executes `SELECT 1`; 200 when ready and typed 503 on SQLAlchemy failure. | VERIFIED `apps/api/app/routes/health.py:16-24` |
| Initial owner | `POST /api/v1/auth/bootstrap` requires JSON + allowed origin; advisory lock, zero-user check, user and session occur in one transaction; no snapshot is created. | VERIFIED `apps/api/app/routes/auth.py:31-50`; `apps/api/app/services/auth.py:51-77` |
| Returning account | Login canonicalizes email, uses dummy Argon2 verification for missing/inactive users, cleans expired sessions, and returns one new cookie-backed session. | VERIFIED `apps/api/app/services/auth.py:80-97`; `apps/api/app/security/passwords.py:8-26` |
| Browser logout/me | Logout deletes only the hash-matched session and clears the cookie; `/me` depends on a valid active session. | VERIFIED `apps/api/app/routes/auth.py:74-91`; `apps/api/app/services/auth.py:100-131` |
| Uninitialized state client | Authenticated GET returns typed `state_not_initialized` 404; bootstrap itself does not create a snapshot. | VERIFIED `apps/api/app/routes/state.py:18-29`; no `UserSnapshot` reference in `apps/api/app/services/auth.py:1-131` |
| First state writer | `expected_revision=0` uses `INSERT ... ON CONFLICT DO NOTHING RETURNING`, producing revision 1 and HTTP 201. | VERIFIED `apps/api/app/services/state.py:21-37`; `apps/api/app/routes/state.py:37-59` |
| Later state writer | Positive expected revision uses `UPDATE ... WHERE user_id=:authenticated_user AND revision=:expected`, increments exactly once, and returns current revision on 409. | VERIFIED `apps/api/app/services/state.py:38-63`; `apps/api/app/routes/state.py:46-59` |
| Cross-account/body owner attempt | Request schema has `extra="forbid"` and no `user_id`; route passes only the authenticated user's UUID. | VERIFIED `apps/api/app/schemas/state.py:7-19`; `apps/api/app/routes/state.py:37-47` |
| Oversized state writer | Path-scoped ASGI middleware rejects content-length or streamed bodies over the configured 5 MiB cap before FastAPI body validation. | VERIFIED `apps/api/app/middleware/body_limit.py:5-38`; `apps/api/app/config.py:27-29` |

## 3. File-to-Plan mapping — complete 45-file inventory

Every committed file maps to Plan §4; there are no unmapped files.

| Files | Plan section and implemented purpose |
|---|---|
| `.gitignore` | §4 Existing files — root env/Python cache, venv and coverage ignores while preserving design-sync rules. |
| `.env.example` | §4 New root/API build files — safe development variable template. |
| `Outputs/backlog-tasks/task_log.md` | §4 Existing files — required duration/token/diff task entry. |
| `Outputs/backlog-tasks/claude_observations.md` | §4 Existing files — architecture drift and habits persistence observations only. |
| `apps/api/.gitignore` | §4 New root/API build files — API-local venv/cache/coverage ignores. |
| `apps/api/pyproject.toml` | §3 + §4 — Python 3.11 constraint and exact runtime/dev pins. |
| `apps/api/requirements.lock` | §3 + §4 — production transitive dependency graph with hashes. |
| `apps/api/requirements-dev.lock` | §3 + §4 — production/dev transitive graph with hashes, including unsafe build-tool pins. |
| `apps/api/alembic.ini` | §4 Database build files — deterministic Alembic config. |
| `apps/api/alembic/env.py` | §4 + §7 — offline/online migration environment and complete metadata import. |
| `apps/api/alembic/script.py.mako` | §4 — migration template. |
| `apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py` | §7 — additive users/sessions/user_snapshots schema and reverse-order downgrade. |
| `apps/api/app/__init__.py` | §4 New application files — package marker. |
| `apps/api/app/main.py` | §2.3, §2.8, §4 — API-only factory, middleware and routers. |
| `apps/api/app/config.py` | §2.4-2.6, §4 — typed fail-closed environment and cookie policy. |
| `apps/api/app/db.py` | §2.3, §4 — lazy engine/session factory and request session lifecycle. |
| `apps/api/app/dependencies.py` | §2.4, §4 — cookie-to-session-to-current-user dependency. |
| `apps/api/app/middleware/__init__.py` | §4 — package marker. |
| `apps/api/app/middleware/body_limit.py` | §2.6, §4 — pre-parse state PUT size cap. |
| `apps/api/app/models/__init__.py` | §4, §7 — complete ORM metadata exports. |
| `apps/api/app/models/base.py` | §4, §7 — declarative base. |
| `apps/api/app/models/user.py` | §2.2, §7 — canonical-email user model and unique lower-email index. |
| `apps/api/app/models/session.py` | §2.4, §7 — hashed-token, TTL session model and indexes. |
| `apps/api/app/models/user_snapshot.py` | §2.1, §2.6, §7 — one JSONB snapshot per user with revision/schema checks. |
| `apps/api/app/schemas/__init__.py` | §4 — package marker. |
| `apps/api/app/schemas/auth.py` | §2.2, §2.6, §4 — forbidden-extra bootstrap/login/session schemas. |
| `apps/api/app/schemas/errors.py` | §4-§6 — stable error and revision-conflict schemas. |
| `apps/api/app/schemas/state.py` | §2.1, §2.6, §4 — schema-v2 object/version/revision contract. |
| `apps/api/app/routes/__init__.py` | §4 — package marker. |
| `apps/api/app/routes/health.py` | §4, §6 — database-backed health mapping. |
| `apps/api/app/routes/auth.py` | §2.4-2.5, §4, §6 — bootstrap/login/logout/me mapping and cookie calls. |
| `apps/api/app/routes/state.py` | §2.1, §2.5-2.6, §4, §6 — authenticated GET/PUT and 404/409/201 mapping. |
| `apps/api/app/services/__init__.py` | §4 — package marker. |
| `apps/api/app/services/auth.py` | §2.2-2.4, §4, §8 — bootstrap/auth/session transactions. |
| `apps/api/app/services/state.py` | §2.1, §2.3, §4, §8 — own-user reads and atomic insert/update CAS. |
| `apps/api/app/security/__init__.py` | §4 — package marker. |
| `apps/api/app/security/passwords.py` | §2.2, §2.7, §4 — email normalization, Argon2 and dummy verification. |
| `apps/api/app/security/sessions.py` | §2.4, §4 — CSPRNG token, SHA-256 storage hash and cookie helpers. |
| `apps/api/app/security/origin.py` | §2.5, §4 — Fetch-Metadata, exact Origin/Referer and JSON checks. |
| `apps/api/tests/conftest.py` | §10-§11 — guarded `_test` PostgreSQL migration/cleanup fixtures. |
| `apps/api/tests/test_auth.py` | §10-§11 — bootstrap, login, cookie/token storage, me/logout tests. |
| `apps/api/tests/test_health.py` | §10-§11 — DB health success test. |
| `apps/api/tests/test_security.py` | §10-§11 — origin, content type, body cap and production-cookie tests. |
| `apps/api/tests/test_state_isolation.py` | §10-§11 — A/B isolation and client `user_id` rejection. |
| `apps/api/tests/test_state_revision_conflict.py` | §10-§11 — initial revision, monotonic update, stale 409 and winner preservation. |

## 4. Verification results

### Python/dependency gates

**VERIFIED (static command, HEAD `102aea4`):** all commands completed green in an isolated Python 3.11 environment at `/private/tmp/lifeos-lock-venv`; it is outside the repository.

```text
python -m compileall -q app tests alembic                 → PASS
ruff check app tests alembic                              → All checks passed!
import create_app/models/dependencies/services            → imports-ok
python -m pip check                                       → No broken requirements found.
create_app(...).openapi()                                 → openapi-ok 6
PostgreSQL metadata DDL compile                           → metadata-ddl-ok 3 3
git diff --cached --check                                 → PASS
staged file count                                         → exactly 45
commit diff                                               → +3555 / -0
```

### Static expected-count gates

```text
find apps/api/app -name '*.py'                            → exactly 27
rg user_id apps/api/app/schemas                           → exactly 0 files
rg pg_advisory_xact_lock apps/api/app                     → exactly 1: services/auth.py
rg expected_revision apps/api/app                         → exactly 2: schemas/state.py, services/state.py
rg UserSnapshot routes services                           → exactly 1: services/state.py
rg set_cookie|delete_cookie apps/api/app                  → exactly 1: security/sessions.py
rg StaticFiles|.mount apps/api/app                        → exactly 0
rg CORSMiddleware apps/api/app                            → exactly 0
rg sensitive logger patterns apps/api/app                 → exactly 0
rg private-key/credential URL pattern                     → exactly 0
git status --short --untracked-files=all -- apps/api       → exactly 41 new API files
```

### Alembic topology — raw output

**VERIFIED (static command, HEAD `102aea4`):** `alembic heads` and `alembic branches` were run live against the committed migration scripts. Branch output had zero lines.

```text
$ alembic -c alembic.ini heads
20260721_0001 (head)

$ alembic -c alembic.ini branches
<zero output lines>
```

### Alembic offline upgrade — raw emitted SQL

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

INSERT INTO alembic_version (version_num) VALUES ('20260721_0001') RETURNING alembic_version.version_num;
COMMIT;
```

Expected migration counts are proven: three application `CREATE TABLE` statements, one unique lower-email index, two session lookup indexes, one token unique constraint, two cascade foreign keys, and three snapshot checks.

### Alembic offline downgrade — raw emitted SQL

```sql
BEGIN;
-- Running downgrade 20260721_0001 ->
DROP TABLE user_snapshots;
DROP INDEX ix_sessions_user_id;
DROP INDEX ix_sessions_expires_at;
DROP TABLE sessions;
DROP INDEX uq_users_email_lower;
DROP TABLE users;
DELETE FROM alembic_version WHERE alembic_version.version_num = '20260721_0001';
DROP TABLE alembic_version;
COMMIT;
```

## 5. Invariants checklist

- **Multi-account isolation — VERIFIED (HEAD `102aea4`):** schemas contain no owner UUID and all snapshot predicates use the authenticated `user.id` (`apps/api/app/routes/state.py:37-47`; `apps/api/app/services/state.py:21-51`).
- **Revision — VERIFIED (HEAD `102aea4`):** first write is conflict-safe insert; later writes include user and expected revision in one update predicate; no retry overwrites the winner (`apps/api/app/services/state.py:26-63`).
- **Bootstrap — VERIFIED (HEAD `102aea4`):** token comparison precedes a PostgreSQL transaction whose advisory lock, zero-user check, user insert and session insert are atomic (`apps/api/app/services/auth.py:51-77`).
- **Email — VERIFIED (HEAD `102aea4`):** application canonicalization is trim + casefold and migration adds unique `lower(email)` (`apps/api/app/security/passwords.py:8-9`; migration `:23-32`).
- **Password/session — VERIFIED (HEAD `102aea4`):** Argon2 helper handles real/dummy verification; the raw CSPRNG token is SHA-256 hashed before model persistence and only cookie helpers set/clear it (`apps/api/app/security/passwords.py:12-26`; `apps/api/app/security/sessions.py:9-36`).
- **CSRF/origin — VERIFIED (HEAD `102aea4`):** all four unsafe routes invoke `enforce_same_origin`; JSON bodies require `application/json` (`apps/api/app/routes/auth.py:31-85`; `apps/api/app/routes/state.py:32-47`).
- **Payload — VERIFIED (HEAD `102aea4`):** schema is literal v2, object-shaped, payload version-matched and unknown fields forbidden (`apps/api/app/schemas/state.py:7-29`).
- **Secrets — VERIFIED (HEAD `102aea4`):** root `.env` is ignored and the committed example contains placeholders only (`.gitignore:10-20`; `.env.example:1-9`).
- **Billing — N/A:** no credits, payment, subscription or paid export code exists in the committed API file inventory.
- **Status state-machine — N/A:** no business status transition code was added.
- **FSM keys — N/A:** no aiogram state or Telegram handler was added.
- **Telegram callback_data ≤64 B — N/A:** no Telegram keyboard/callback data exists in Batch 2.

## 6. Tests and runtime boundary

**USER-RUNTIME REQUIRED:** pytest was authored but not run, per the repository policy that forbids local DB calls and pytest execution. The guarded fixture refuses a database not ending in `_test`, runs the migration, and truncates only the three Life OS tables (`apps/api/tests/conftest.py:31-66`).

```bash
cd apps/api
LIFEOS_TEST_DATABASE_URL='postgresql+psycopg://.../lifeos_test' \
  .venv/bin/pytest tests/test_auth.py tests/test_health.py \
  tests/test_security.py tests/test_state_isolation.py \
  tests/test_state_revision_conflict.py -v
```

**USER-RUNTIME REQUIRED:** the initial server/database setup must populate all `LIFEOS_*` values and run `alembic upgrade head`. `alembic check` was not run because it requires a live database. Before public exposure, Batch 4 must add reverse-proxy throttling for login/bootstrap as approved in Plan §2.7.

**No live-bot or adjacent Telegram smoke:** N/A; the commit has no aiogram/Telegram code. The HTTP neighbor regression cases are authored in `apps/api/tests/test_security.py:1-60` but remain user-run with the dedicated test PostgreSQL database.

## 7. Observations

Two out-of-scope findings were logged without drive-by fixes:

1. `ARCHITECTURE.md:7-13` still describes the retired Babel-in-browser runtime; tracked Vite reality is `apps/web/package.json:5-20`.
2. Habit toggles remain component-local at `apps/web/src/components/HabitsGrid.jsx:21-31`, while the persisted context only initializes `habits` at `apps/web/src/context/LifeDataContext.jsx:107`.

Both entries are committed in `Outputs/backlog-tasks/claude_observations.md`; no frontend behavior was changed.

## 8. Commit and delivery state

```text
Commit: 102aea4cbdd04f1bb4b9b076879d7fb7aecfe5ec
Subject: feat(api): add authenticated multi-account state service
Branch: design-sync-setup
Files: 45
Net diff: +3555 / -0
Push: NOT RUN (commit-only Plan)
Deploy: NOT RUN (commit-only Plan)
Live DB: NOT CONTACTED
Pytest: NOT RUN by policy
```

Owner-owned `.DS_Store`, prompts, prior untracked reports, `lifeos-ui-map.md`, and `tests/e2e/.venv-e2e` were not staged or modified by this task.

WAITING FOR: Continue command for the next approved task.
