# LifeOS — PRE-0 Development Baseline

**Task:** PRE-0 · Development baseline gate (Phase B plan §23)
**Executed:** 2026-09-08 14:08:41 (local)
**Mode:** environment setup + existing-suite execution only. No implementation.

---

## 1. Verdict

```
PRE0_STATUS=PASS
BACKEND_TESTS=11 passed / 0 failed / 0 skipped
BACKEND_RUFF=PASS (All checks passed!)
ALEMBIC_HEADS=20260721_0001 (single head, as expected)
FRONTEND_TESTS=28 passed / 0 failed (6 test files)
TYPECHECK=PASS (exit 0)
LINT=PASS (exit 0)
BUILD=PASS (exit 0)
UNCLASSIFIED_FAILURES=0
APPLICATION_CODE_CHANGED=NO
LOCKFILES_CHANGED=NO
DB_SCHEMA_IMPLEMENTATION_CHANGED=NO
READY_FOR_PR_MERGE=YES
READY_FOR_SLICE_0=YES
```

**Every mandatory check is green on the first run. No environment repair was required, and no failure of any kind was encountered.** The repository is reproducibly testable from its committed lockfiles, which is precisely what this gate exists to prove.

---

## 2. Start state

| Item | Value |
| --- | --- |
| Worktree | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem-adaptive-analytics-import` |
| Branch | `design/adaptive-analytics-import` |
| Start HEAD | `da99de3c41c6f8afc04fede756d9d42f97b7de3c` |
| Design tag | `adaptive-analytics-design-accepted` → `d4960286ec94f35472600e59c0d533dc50a64351` (annotated, unmoved) |
| Open PR | [yurafreedom/LifeOS#1](https://github.com/yurafreedom/LifeOS/pull/1) — `design/adaptive-analytics-import` → `main` |
| Working tree at start | `M .DS_Store` only (pre-existing, user-owned, untouched throughout) |

---

## 3. Environment

| Component | Version |
| --- | --- |
| macOS | 26.3 (build 25D125) |
| Architecture | `arm64` (Apple silicon) |
| Python (backend venv) | **3.11.15** — satisfies `requires-python >=3.11,<3.12` |
| Python (system default) | 3.14.7 — **not used**; `python3.11` invoked explicitly |
| PostgreSQL | **18.3 (Homebrew)**, `postgresql@18` service running, accepting connections on `:5432` |
| Node | **v22.20.0** |
| npm | **11.11.0** |
| pip (in venv) | 26.1.2 |

---

## 4. Dependency setup

### 4.1 Backend — `apps/api`

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install --require-hashes -r requirements-dev.lock
```

Installed from the **committed hashed lockfile** with `--require-hashes` (no unlocked substitute). Result: **success**. Installed versions match `pyproject.toml` pins exactly:

| Package | Locked | Installed |
| --- | --- | --- |
| alembic | 1.18.5 | 1.18.5 |
| fastapi | 0.139.2 | 0.139.2 |
| httpx | 0.28.1 | 0.28.1 |
| psycopg[binary] | 3.3.4 | 3.3.4 |
| pwdlib[argon2] | 0.3.0 | 0.3.0 |
| pydantic | 2.13.4 | 2.13.4 |
| pytest | 9.1.1 | 9.1.1 |
| ruff | 0.15.22 | 0.15.22 |
| SQLAlchemy | 2.0.51 | 2.0.51 |
| uvicorn[standard] | 0.51.0 | 0.51.0 |

`.venv/` is ignored by `apps/api/.gitignore:2` and remained untracked.

### 4.2 Frontend — `apps/web`

```bash
npm ci
```

Result: **success** — 120 packages added, 121 audited, ~2s.

**`package-lock.json` was not mutated.** SHA-256 verified identical before and after:

```
before: 79429eb58206ea569d673ed0afdb36fd86f4a89f05bc025e893e5bb7641dd82f
after:  79429eb58206ea569d673ed0afdb36fd86f4a89f05bc025e893e5bb7641dd82f
```

`node_modules/` and `dist/` are ignored by `apps/web/.gitignore:1-2` and remained untracked.

---

## 5. Test database

A **local, disposable** PostgreSQL database was created solely for the suite:

- Database: `lifeos_test` (name ends in `_test`, as `apps/api/tests/conftest.py` requires — it raises `pytest.UsageError` otherwise)
- Host: `127.0.0.1:5432` (local Homebrew instance)
- Auth: local socket/trust; **no password exists or was used**
- Connection string shape (user redacted): `postgresql+psycopg://<local-user>@127.0.0.1:5432/lifeos_test`

Supplied via the `LIFEOS_TEST_DATABASE_URL` environment variable at invocation time only. **No credentials were written to any repository file, and none appear in this report.**

The pre-existing local `lifeos_dev` database was **not** touched. No remote or shared database was contacted at any point.

`conftest.py` runs `alembic upgrade head` against this database on the session-scoped `engine` fixture and `TRUNCATE`s `user_snapshots, sessions, users CASCADE` around every test, so the database is fully disposable.

---

## 6. Backend baseline results

### 6.1 `python -m pytest`

```
platform darwin -- Python 3.11.15, pytest-9.1.1, pluggy-1.6.0
rootdir: apps/api   configfile: pyproject.toml   testpaths: tests
plugins: anyio-4.14.2
collected 11 items

tests/test_auth.py ........................................ 3 PASSED
tests/test_health.py ..................................... 1 PASSED
tests/test_security.py ................................... 5 PASSED
tests/test_state_isolation.py ............................ 1 PASSED
tests/test_state_revision_conflict.py .................... 1 PASSED

======================== 11 passed, 2 warnings in 3.09s ========================
```

**11 passed · 0 failed · 0 skipped · exit 0 · 3.09s**

Full list:

| Test | Result |
| --- | --- |
| `test_bootstrap_creates_only_first_account_and_session` | PASSED |
| `test_login_is_case_insensitive_and_logout_revokes_session` | PASSED |
| `test_login_uses_generic_error_for_unknown_email` | PASSED |
| `test_health_checks_database` | PASSED |
| `test_unsafe_route_rejects_cross_site_request` | PASSED |
| `test_json_endpoint_rejects_wrong_content_type` | PASSED |
| `test_state_body_limit_rejects_before_json_parsing` | PASSED |
| `test_unsafe_route_rejects_missing_source_headers` | PASSED |
| `test_production_requires_secure_cookie` | PASSED |
| `test_snapshots_are_isolated_by_authenticated_user` | PASSED |
| `test_state_replace_uses_compare_and_swap` | PASSED |

### 6.2 `ruff check .`

```
All checks passed!
```
**exit 0.**

### 6.3 `alembic heads`

```
20260721_0001 (head)
```

**Single head, exactly as Phase B §23.3 expects.** `alembic current` against `lifeos_test` also reports `20260721_0001 (head)`, confirming the migration applied cleanly.

### 6.4 Warnings (non-blocking, informational)

Two deprecation warnings surfaced. Neither is a failure and neither is fixed here:

1. `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` — emitted by `fastapi/testclient.py`, a **third-party** deprecation. No action inside PRE-0.
2. `DeprecationWarning: No path_separator found in configuration; falling back to legacy splitting … Consider adding path_separator=os to Alembic config` — Alembic 1.18 advising a future `alembic.ini` key.

**Classification for both: PRE-EXISTING, NON-BLOCKING, THIRD-PARTY/CONFIG-ADVISORY.** Item 2 is a one-line `alembic.ini` addition that a future maintenance task may take; changing it here would be an unrelated config edit outside PRE-0's remit.

---

## 7. Frontend baseline results

### 7.1 `npm test` (vitest run)

```
RUN  v4.1.10
Test Files  6 passed (6)
     Tests  28 passed (28)
  Duration  527ms (transform 678ms, import 631ms, tests 352ms)
```

**28 passed · 0 failed · 6 files · exit 0.** Suites: `api-client`, `legacy-import`, `smoke`, `state-migration`, `state-repository`, `state-sync-coordinator`.

### 7.2 `npm run typecheck` (`tsc --noEmit`)

No diagnostics. **exit 0.**

### 7.3 `npm run lint` (`eslint src vite.config.js`)

No findings. **exit 0.**

### 7.4 `npm run build` (`vite build`)

```
vite v8.1.5 building client environment for production...
✓ 81 modules transformed.

dist/index.html                   2.03 kB │ gzip:   0.89 kB
dist/assets/index-peODzM-h.css  124.84 kB │ gzip:  21.81 kB
dist/assets/index-D67jDXey.js   397.13 kB │ gzip: 113.07 kB │ map: 982.00 kB

✓ built in 502ms
```

**exit 0 · 81 modules · 502ms.**

| Output | Raw | Gzip |
| --- | --- | --- |
| `index.html` | 2.03 kB | 0.89 kB |
| CSS bundle | 124.84 kB | 21.81 kB |
| JS bundle | 397.13 kB | 113.07 kB |
| JS sourcemap | 982.00 kB | — (sourcemaps enabled in `vite.config.js`) |

**Total shipped payload ≈ 523 kB raw / ≈ 136 kB gzip.** Recorded as the reference point for Slice 1–2, which add analytics primitives and will grow the bundle.

### 7.5 `npm audit` (observation only — NOT fixed)

3 vulnerabilities in the transitive dev-dependency tree (1 moderate, 2 high):

| Package | Severity | Advisory |
| --- | --- | --- |
| `brace-expansion` 4.0.0–5.0.8 | high | GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 — DoS via unbounded expansion |
| `nanoid` <3.3.18 | high | GHSA-2v37-7h3g-55p8 — infinite loop when size is zero |
| `postcss` ≤8.5.22 | moderate | GHSA-fxqj-rqcc-2cmp — arbitrary `.map` read via sourceMappingURL |

**Classification: PRE-EXISTING, NOT BLOCKING, OUT OF PRE-0 SCOPE.** All three are transitive build-tooling dependencies, not runtime application dependencies. `npm audit fix` would rewrite `package-lock.json`, which this task is explicitly forbidden to do. **Recommended as a separate, dedicated dependency-hygiene task** before or alongside Slice 0 — it is unrelated to Adaptive Analytics and should not be bundled into an AA slice.

---

## 8. Failure classification

| # | Failure | Classification | Action |
| --- | --- | --- | --- |
| — | *(none)* | — | — |

**Zero failures were encountered across all six mandatory checks.** No test failed, no check exited non-zero, and no retry was needed.

**No environment repair was necessary.** Every prerequisite (Python 3.11, PostgreSQL 18, Node 22, npm 11) was already present and correctly configured on the machine; the only setup actions were creating the venv, installing from lockfiles, and creating the empty `lifeos_test` database.

Three **non-failure advisories** are recorded above for completeness: two deprecation warnings (§6.4) and three npm audit findings (§7.5). None affects the baseline verdict.

---

## 9. Repository cleanliness

Verified from the repository root after all installs, tests and builds:

```
$ git status --short
 M .DS_Store

$ git diff --stat
 .DS_Store | Bin 6148 -> 6148 bytes
 1 file changed, 0 insertions(+), 0 deletions(-)
```

| Check | Result |
| --- | --- |
| Application source changed | **NO** — zero tracked files under `apps/`, `ui_kits/`, `preview/` modified |
| Lockfiles changed | **NO** — `package-lock.json`, `requirements.lock`, `requirements-dev.lock`, `package.json`, `pyproject.toml` all unmodified (verified by `git diff --name-only`) |
| Migrations added/changed | **NO** — still exactly one revision, `20260721_0001` |
| `.DS_Store` | **untouched** — the pre-existing user-owned modification was neither staged, restored, nor deleted |
| Generated artifacts tracked | **NO** — all ignored and untracked |

Generated-but-ignored artifacts now present locally (confirmed via `git check-ignore`):

| Path | Ignored by |
| --- | --- |
| `apps/api/.venv/` | `apps/api/.gitignore:2` |
| `apps/web/node_modules/` | `apps/web/.gitignore:1` |
| `apps/web/dist/` | `apps/web/.gitignore:2` |
| `apps/api/.pytest_cache/`, `apps/api/.ruff_cache/` | `apps/api/.gitignore` |

---

## 10. Reproduction recipe

For any future maintainer or CI job, from a clean checkout:

```bash
# backend
cd apps/api
python3.11 -m venv .venv && . .venv/bin/activate
pip install --require-hashes -r requirements-dev.lock
createdb lifeos_test                       # any local DB whose name ends in _test
export LIFEOS_TEST_DATABASE_URL='postgresql+psycopg://<local-user>@127.0.0.1:5432/lifeos_test'
python -m pytest                           # expect 11 passed
ruff check .                               # expect: All checks passed!
alembic heads                              # expect: 20260721_0001 (head)

# frontend
cd ../web
npm ci                                     # package-lock.json must not change
npm test                                   # expect 28 passed / 6 files
npm run typecheck                          # expect exit 0
npm run lint                               # expect exit 0
npm run build                              # expect exit 0
```

---

## 11. Gate outcome

Phase B §23's acceptance gate required: dependencies installed from lockfiles; all four web commands and both API commands executed; results recorded; every failure classified; no unclassified failure remaining.

**All six conditions are met.**

- `READY_FOR_PR_MERGE=YES` — PR #1 contains no application-code change relative to what was just proven green; the suites pass at its exact HEAD (`da99de3`).
- `READY_FOR_SLICE_0=YES` — a green reference now exists, so any failure introduced by Slice 0 is attributable.

**This report authorises nothing beyond the gate.** Slice 0 remains unstarted, no AA table or migration exists, and PR #1 remains unmerged pending owner review.
