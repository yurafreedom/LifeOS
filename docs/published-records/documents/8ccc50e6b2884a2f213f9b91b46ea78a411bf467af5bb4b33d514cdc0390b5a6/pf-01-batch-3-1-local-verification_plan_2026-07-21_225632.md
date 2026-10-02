# PLAN for PF-01 Batch 3.1 — local pre-deploy verification

**Дата:** 2026-07-21 22:56:32 Europe/Kiev
**Фаза:** B — Plan (read-only, крім report artifacts)
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Branch:** `design-sync-setup`
**Basis:** `Outputs/Discoveries/pf-01-batch-3-1-local-verification_discovery_2026-07-21_223736.md`
**Мета:** виконати максимально повну локальну перевірку PF-01 без VPS, Docker, pytest і підключення Codex до PostgreSQL.

Позначки доказів:

- **VERIFIED (HEAD `67a1456`)** — факт повторно перевірений у committed code на поточному HEAD.
- **VERIFIED (local command, 2026-07-21)** — факт отриманий read-only локальною командою.
- **PLANNED** — команда/перевірка ще не запускалася; буде виконана лише після approval цього Plan.
- **USER-RUN** — команда навмисно не виконується Codex через repository policy.
- **N/A** — інваріант не належить до цього стеку/verification-only scope.

## 1. Scope і результат

### 1.1 Codex-run після approval

1. Створити ignored Python 3.11 venv `apps/api/.venv` і встановити лише hash-locked `requirements-dev.lock`.
2. Виконати повні frontend deterministic gates.
3. Виконати backend static/import/config/metadata/Alembic-offline gates.
4. Запустити Vite на `127.0.0.1:5173` через тимчасовий mock API на `127.0.0.1:8001` і пройти browser smoke.
5. Зберегти повний Audit + summary в `Outputs/Audits/` і `Outputs/Summaries/`.

### 1.2 Вихід зі scope

- **BINDING:** жодного tracked source/config/test/migration change, `git add`, commit, push або deploy.
- **BINDING:** не зупиняти й не сигналити PID `48273`, який займає порт 8000; використовувати 8001.
- **BINDING:** не запускати pytest, Docker, PostgreSQL service, `createdb`, live Alembic upgrade, Uvicorn із реальною БД або browser→FastAPI→PostgreSQL flow.
- **BINDING:** не читати, не видаляти й не змінювати cookies/localStorage/profile браузера напряму; працювати лише через видимий UI.
- Якщо gate виявить defect у tracked code, **STOP**: задокументувати факт і запропонувати окремий Discovery/Plan на fix, без імпровізованого редагування.

## 2. Files і процеси

### 2.1 Tracked files to modify

**Немає.** Function signatures before/after: **N/A**. DB migration: **немає**. Dependencies у manifest/lock: **не змінюються**.

### 2.2 Локальні ignored/temporary artifacts

| Artifact | Дія | Evidence / cleanup |
|---|---|---|
| `apps/api/.venv/` | створити Python 3.11 venv | ignored (`apps/api/.gitignore:2`, `.gitignore:14`); залишити для подальшої розробки |
| `apps/web/dist/` | може бути перегенерований `vite build` | build output; після audit не stage/commit |
| `/private/tmp/lifeos-local-verify-*/mock_server.py` | створити мінімальний mock | видалити лише точний власний temp-dir після smoke |
| mock process `127.0.0.1:8001` | запустити на час smoke | PID записати; завершити лише цей PID |
| Vite process `127.0.0.1:5173` | запустити з proxy override | PID записати; завершити лише цей PID |

`VITE_API_PROXY_TARGET` є runtime override і не потребує source edit (`apps/web/vite.config.js:4-13`, VERIFIED).

## 3. Gate 0 — preflight і isolation

Перед будь-якою mutation:

```bash
git rev-parse HEAD
git status --short
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:8001 -sTCP:LISTEN
/opt/homebrew/bin/python3.11 --version
node --version
npm --version
```

Очікування:

- HEAD рівно `67a1456c6165e9bdf36382a98c9713c4ed981314` або **STOP** через parallel-session conflict.
- 5173 і 8001 вільні; 8000 не перевіряється для takeover і не використовується.
- Python `3.11.x`, не system Python 3.14; project constraint `>=3.11,<3.12` (`apps/api/pyproject.toml:5`, VERIFIED).
- Existing dirty/untracked user files не змінюються.

## 4. Gate 1 — locked backend environment

Потрібен network approval лише для hash-locked install:

```bash
cd apps/api
/opt/homebrew/bin/python3.11 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-dev.lock
.venv/bin/python -m pip check
```

Очікування: Python 3.11 venv; усі hashes прийняті; `pip check` → `No broken requirements found`. Якщо мережа або hash gate падає — report як environment blocker, не переходити до backend gates.

## 5. Gate 2 — frontend deterministic verification

Виконати з `apps/web`:

```bash
npm ls --depth=0
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected static/runtime counts на HEAD:

- `rg --files src/test -g '*.test.{js,jsx,ts,tsx}'` → рівно **6** files (VERIFIED local command).
- `rg '^\s*(it|test)\(' src/test ...` → рівно **28** cases (VERIFIED local command).
- Vitest має завершити 6/6 files і 28/28 tests green; `typecheck`, `lint`, `build` — exit 0.
- Bundle повинен створити `dist/` із JS/CSS sourcemaps, бо `outDir='dist'` і `sourcemap=true` (`apps/web/vite.config.js:20-23`, VERIFIED). Hash/розмір assets не фіксуються як brittle count.

Static security/storage gates:

| Gate | Expected exact count | Поточна підстава |
|---|---:|---|
| production `fetch(` у `src/` | 1 | VERIFIED local grep; централізований boundary у `apps/web/src/api/client.ts:46-78` |
| `user_id` у frontend `src/` | 0 | VERIFIED local grep |
| legacy `localStorage.getItem('lifeOsState')` | 1 | VERIFIED local grep |
| legacy `setItem/removeItem('lifeOsState')` | 0 | VERIFIED local grep |
| frontend `VITE_*SECRET|TOKEN|PASSWORD|DATABASE` | 0 | VERIFIED local grep |

Будь-яка зміна exact count від поточного HEAD — **STOP** і classify, а не автоматичне виправлення.

## 6. Gate 3 — backend static/import/config/DDL verification

### 6.1 Syntax і lint

Python inventory на HEAD: **35** files = 27 `app/` + 6 `tests/` + 2 `alembic/` (VERIFIED local command). Виконати:

```bash
cd apps/api
rg --files app tests alembic -g '*.py' -0 | xargs -0 -n1 .venv/bin/python -m py_compile
.venv/bin/ruff check app tests alembic
```

Очікування: 35/35 compile; Ruff exit 0. Оскільки tracked code не змінюється, фактичний Ruff результат і є HEAD baseline; red result фіксується як pre-existing gate failure, не ремонтується у цьому audit.

### 6.2 Import graph

Імпортувати без запуску сервера/DB:

```bash
PYTHONPATH=. .venv/bin/python -c "from app.config import Settings; from app.main import create_app; from app.routes import auth, health, state; from app.services import auth as auth_service, state as state_service; from app.models import Base, User, UserSession, UserSnapshot; print('imports-ok', len(Base.metadata.tables))"
```

Expected: `imports-ok 3`. Importing symbols не виконує database query; жоден endpoint не викликається.

### 6.3 Settings matrix

Одним isolated Python script створити `Settings(...)` з dummy values і перевірити:

| Case | Expected | Evidence |
|---|---|---|
| development + `postgresql+psycopg://...` | success; cookie `lifeos_session` | `apps/api/app/config.py:21-29,69-73` |
| SQLite URL | validation failure | `apps/api/app/config.py:31-36` |
| origin із trailing `/` | normalized without slash | `apps/api/app/config.py:46-58` |
| production + `cookie_secure=false` | validation failure | `apps/api/app/config.py:60-66` |
| production + wildcard host/origin | validation failure | `apps/api/app/config.py:60-66` |
| production valid | cookie `__Host-lifeos_session` | `apps/api/app/config.py:69-73` |

Dummy bootstrap token має бути ≥32 chars (`apps/api/app/config.py:23`, VERIFIED); значення не записувати у repo.

### 6.4 PostgreSQL metadata compilation без connection

Скомпілювати `CreateTable`/`CreateIndex` для `Base.metadata.sorted_tables` через SQLAlchemy PostgreSQL dialect; не створювати engine і не відкривати socket.

Expected exact metadata: **3 tables** — `users`, `sessions`, `user_snapshots`; constraints/index names звірити з migration (`apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py:21-64`).

## 7. Gate 4 — Alembic topology й exact offline SQL

Спочатку виконати з `apps/api` і вставити **raw output** в Audit:

```bash
.venv/bin/alembic heads
.venv/bin/alembic branches
```

До цього моменту head count лишається **UNKNOWN**. Видимий один migration file не є доказом topology.

Потім offline-only SQL із dummy PostgreSQL URL:

```bash
LIFEOS_DATABASE_URL='postgresql+psycopg://verify:verify@127.0.0.1:1/lifeos_verify' \
LIFEOS_BOOTSTRAP_TOKEN='local-verification-token-32-chars-minimum' \
.venv/bin/alembic upgrade head --sql
```

Offline path uses URL and `literal_binds` without `connect()` (`apps/api/alembic/env.py:16-32`, VERIFIED). Expected SQL must include exactly:

1. `CREATE TABLE users` + PK `pk_users`.
2. `CREATE UNIQUE INDEX uq_users_email_lower ... lower(email)`.
3. `CREATE TABLE sessions` + FK `fk_sessions_user_id ... ON DELETE CASCADE` + unique token constraint.
4. Indexes `ix_sessions_expires_at` and `ix_sessions_user_id`.
5. `CREATE TABLE user_snapshots` + JSONB payload, PK/FK і checks `ck_user_snapshots_payload_object`, `ck_user_snapshots_revision`, `ck_user_snapshots_schema_version`.
6. Alembic version-table update to the raw `heads` revision.

Migration source defines exactly 3 `op.create_table` and 3 `op.create_index` calls (`apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py:21-64`, VERIFIED local grep). `alembic check` is **USER-RUN only**, because it requires live database inspection.

## 8. Gate 5 — MOCK browser smoke

### 8.1 Mock contract

Тимчасовий standard-library Python server на 8001 реалізує лише current frontend contract:

- `GET /api/v1/auth/me`;
- `POST /api/v1/auth/bootstrap`, `/login`, `/logout`;
- `GET/PUT /api/v1/state`;
- test-only controls для наступного `PUT`: один `409` із `current_revision`, або deliberate connection drop для реального `NetworkError`.

Paths і payload contract підтверджені `apps/web/src/api/auth.ts:9-36` та `apps/web/src/api/state.ts:4-19` (VERIFIED). Mock веде request counters у process output; bootstrap double-submit проходить лише якщо counter збільшився рівно на 1. Це не backend implementation і не integration evidence.

### 8.2 Запуск

1. Запустити Vite на 5173 з `VITE_API_PROXY_TARGET=http://127.0.0.1:8001`, поки mock ще вимкнений.
2. Через in-app Browser відкрити `http://127.0.0.1:5173`; перед першою interaction прочитати актуальну browser API documentation і використовувати видимий UI/screenshot assertions.
3. Після boot-error check запустити власний mock на 8001 і натиснути UI retry.
4. По завершенні зупинити лише записані mock/Vite PIDs.

### 8.3 Browser scenarios («Ціль / Кроки / Очікую»)

1. **Ціль:** server-unavailable UX. **Кроки:** UI без mock → дочекатися auth boot result. **Очікую:** server error card + «повторити» (`apps/web/src/App.jsx:494-511`).
2. **Ціль:** neutral login vs explicit bootstrap. **Кроки:** після mock retry перевірити `/`, потім `/?bootstrap=0`, потім `/?bootstrap=1`. **Очікую:** перші два показують 2-field login; тільки exact `bootstrap=1` — confirm password + bootstrap token (`apps/web/src/pages/LoginPage.jsx:9-14,59-95`).
3. **Ціль:** bootstrap validation/single submit. **Кроки:** перевірити mismatch і short password; потім валідні дані й швидка повторна submit interaction. **Очікую:** local errors без request; валідний bootstrap count рівно 1, button busy/guard (`apps/web/src/pages/LoginPage.jsx:16-46,89-92`).
4. **Ціль:** first state initialization. **Кроки:** після auth обрати «почати заново», лише якщо import prompt природно з’явився; інакше дочекатися initialized shell. **Очікую:** server state revision створена й app shell видимий. Direct browser-storage inspection/injection заборонені.
5. **Ціль:** route neighbor regression. **Кроки:** пройти всі 15 hash routes з registry. **Очікую:** кожен route render без runtime error; registry `home…settings` має рівно 15 entries (`apps/web/src/app/routes.js:1-17`; render mapping `apps/web/src/App.jsx:350-417`).
6. **Ціль:** shared state/save. **Кроки:** додати quick note або task, дочекатися debounce. **Очікую:** `saving` → `saved`; PUT count +1; visible mutation зберігається після UI reload/login against same mock session.
7. **Ціль:** locale/theme/scene. **Кроки:** Settings → appearance; RU↔UK, dark/light/paradise controls. **Очікую:** visible copy/style/scene changes без route loss.
8. **Ціль:** revision conflict. **Кроки:** arm next-PUT 409, зробити UI mutation, перейти Settings. **Очікую:** «конфлікт версій», export/reload actions; після confirm reload server state coordinator unfreezes (`apps/web/src/components/SyncStatus.jsx:10-24`; `apps/web/src/context/LifeDataContext.jsx:672-684`).
9. **Ціль:** offline retry. **Кроки:** arm connection-drop for next PUT, зробити mutation, Settings → retry. **Очікую:** «немає зв’язку», pending payload збережено; retry → saved (`apps/web/src/repositories/stateSyncCoordinator.ts:78-124`).
10. **Ціль:** destructive reset guard. **Кроки:** Settings → danger → reset; спочатку cancel, потім confirm. **Очікую:** cancel нічого не змінює; confirm робить acknowledged replacement і показує success (`apps/web/src/components/SettingsPage.jsx:297-323`).
11. **Ціль:** session UX. **Кроки:** logout, потім login test account. **Очікую:** anonymous login screen, password очищений, login повертає shell (`apps/web/src/context/AuthContext.jsx:33-65`).

Усі browser assertions фіксуються actual visible text/screenshot/request-counter evidence. Verdict маркується **MOCK**, не E2E.

## 9. USER-RUN real PostgreSQL / pytest / FastAPI block

Codex підготує в Audit copy-paste commands, але **не виконає** їх. Planned safe sequence:

1. User запускає Homebrew PostgreSQL 18 і створює окрему БД, назва якої закінчується `_test`.
2. User задає `LIFEOS_TEST_DATABASE_URL` тільки на цю БД і окремо перевіряє `SELECT current_database()`.
3. User запускає з `apps/api`: `.venv/bin/pytest -v`.
4. Fixture повторно відмовляється працювати без suffix `_test`, потім сам застосовує Alembic і TRUNCATE лише `user_snapshots`, `sessions`, `users` (`apps/api/tests/conftest.py:31-66`, VERIFIED).
5. Для реального browser integration user окремо створює dev DB/env, запускає Uvicorn на 8001 і Vite proxy на 8001; жодного production/VPS credential.

Static inventory correction: Discovery сказав «10 explicit cases», але current grep по `apps/api/tests/test_*.py` дає **11** real test functions у 5 modules; дванадцятий `def test_*` match — fixture `test_database_url` у `conftest.py:31-39`. Audit використовуватиме коректний expected count 11. Це report correction, не code defect.

## 10. Behavior matrix і blast radius

Source symbols не редагуються, тому caller behavior delta для всіх callers — **none**. Перевірка покриває shared boundaries:

| Shared boundary / caller group | Static/unit | MOCK browser | Real DB evidence |
|---|---|---|---|
| `requestJson` → auth/state API | exact 1 fetch + Vitest | auth/state UI calls | USER-RUN pytest/browser |
| `AuthProvider` → `AuthGate`, Settings | import + Vitest | retry/bootstrap/login/logout | USER-RUN auth tests |
| `LifeDataProvider` → 15 routes | import + migration/repo/coordinator tests | full route + mutation neighbors | USER-RUN state isolation/CAS |
| `StateSyncCoordinator` → every mutation writer | 28-test suite | saved/offline/conflict/reset | USER-RUN CAS test |
| SQLAlchemy models → routes/services/migration | compile/import/DDL | not exercised | USER-RUN migration/pytest |
| Alembic revision graph | heads/branches/offline SQL | not exercised | USER-RUN `alembic check`/upgrade |

No shared state writer/reader is changed. Browser mock process owns only ephemeral test account/session/snapshot counters and is discarded after the audit.

## 11. Invariants checklist

- **Billing:** VERIFIED N/A — repo scope has no credits/payment path.
- **Status state-machine:** VERIFIED N/A — no aiogram/domain transition edit.
- **FSM keys:** VERIFIED N/A — no bot/FSM.
- **Telegram callback_data ≤64 B:** VERIFIED N/A.
- **Multi-account isolation:** no frontend `user_id` exact gate; real tenant isolation verdict remains USER-RUN DB test.
- **Revision/CAS:** unit + MOCK 409 path can be verified; authoritative DB atomicity remains USER-RUN.
- **Secrets:** generated/dummy tokens only; no `.env` creation, output of real secrets, cookie/storage inspection or commit.
- **Filesystem:** only ignored venv/dist, exact temp directory and Outputs reports; no source edits.
- **Processes/ports:** preserve PID 48273/8000; start/stop only own 5173/8001 processes.
- **DB destruction:** Codex opens no DB connection; user-run fixture suffix guard and explicit database-name verification are mandatory.

## 12. Rollback / cleanup

1. On any surprise, stop only processes whose PIDs were captured by this task.
2. Remove only the exact validated `/private/tmp/lifeos-local-verify-*` directory created by this task.
3. Keep `apps/api/.venv` as ignored reusable tooling; if install fails, report it rather than deleting an ambiguous path.
4. Leave `apps/web/dist` ignored and unstaged.
5. Confirm `git diff --exit-code -- apps/web apps/api` and compare final `git status --short` with preflight; any new tracked diff is failure.
6. No commit exists to revert; no database/VPS rollback applies.

## 13. BOT TESTS

- **Ціль:** N/A — project has no aiogram/Telegram bot.
- **Кроки:** none.
- **Очікую:** no bot process, tgtest or callback path started.
- **Neighbor regression:** covered by browser route/state scenarios 5–11 instead.

## 14. Consolidated SIGN-OFF ITEMS

Approval цього Plan підтверджує вже обрані рішення без нової architecture choice:

1. Створити ignored `.venv` через Python 3.11 і network-install hash-locked dev requirements.
2. Не чіпати порт 8000/PID 48273; використовувати 8001.
3. Виконати browser smoke лише через temporary mock і маркувати результат MOCK.
4. Не запускати Codex-ом PostgreSQL/pytest/live FastAPI integration; надати exact USER-RUN block.
5. Не змінювати tracked code і не commit; defect → окрема three-phase fix task.
6. Після browser smoke прибрати лише власний temp mock/processes, але залишити ignored `.venv`.
7. Phase C deliverable — Audit, не Implementation commit; тому task log/commit hash для verification-only audit не створюються.

WAITING FOR: approval Plan і команда `Continue` для виконання локального verification audit.
