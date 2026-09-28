# DISCOVERY for PF-01 — local run and current persisted data

**Дата:** 2026-07-22 03:39:51 Europe/Kiev
**Фаза:** A — read-only usage discovery
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Branch:** `design-sync-setup`
**Запит:** як локально запустити систему і які дані вже можна додавати/зберігати

Позначки:

- **VERIFIED (HEAD `67a1456`)** — факт перевірений у committed code на вказаному file:line.
- **VERIFIED (local command, 2026-07-22)** — поточний стан локального Mac.
- **LIMITATION** — UI/production layer ще не завершений; це не припущення про майбутню реалізацію.

## 1. Коротка відповідь

Систему вже можна запускати локально як повний ланцюжок:

```text
Browser → Vite/React :5173 → FastAPI :8001 → PostgreSQL :5432
```

Після входу більшість робочих змін автоматично записуються на сервер у персональний JSONB snapshot. Але прямо зараз PostgreSQL не запущений і runtime env не налаштований, тому перед першим стартом потрібна одноразова локальна підготовка.

## 2. Що вже готово на цьому Mac

| Компонент | Current state | Evidence |
|---|---|---|
| Frontend packages | READY | **VERIFIED command:** `apps/web/node_modules` exists |
| Backend venv | READY | **VERIFIED command:** `apps/api/.venv/bin/python` → Python 3.11.15 |
| PostgreSQL data directory | PRESENT | **VERIFIED command:** `/opt/homebrew/var/postgresql@18` exists |
| PostgreSQL listener 5432 | STOPPED | **VERIFIED command:** no listener |
| Runtime `.env` | ABSENT | **VERIFIED command:** root `.env` and `apps/api/.env` absent |
| Frontend 5173 | FREE | **VERIFIED command:** no listener |
| API 8001 | FREE | **VERIFIED command:** no listener |
| Port 8000 | OCCUPIED | **VERIFIED command:** existing PID 48273, do not stop implicitly |

Vite normally proxies `/api` to 8000, but supports a runtime override (`apps/web/vite.config.js:4-13`, VERIFIED). Therefore local API should run on **8001** without source changes.

## 3. Найпростіший локальний запуск

Потрібні два Terminal windows і браузер. Commands below are user-run; Codex не запускає PostgreSQL за repository policy.

### 3.1 Terminal 1 — PostgreSQL + FastAPI

Start local PostgreSQL:

```bash
brew services start postgresql@18
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
```

Create a development database once:

```bash
createdb lifeos_dev
```

If the database already exists, do **not** drop it; simply continue. Then configure this terminal session:

```bash
cd /Users/yurasachenko/LifeOS_DesignSystem/apps/api

export LIFEOS_ENVIRONMENT=development
export LIFEOS_DATABASE_URL="postgresql+psycopg://$(id -un)@127.0.0.1:5432/lifeos_dev"
export LIFEOS_BOOTSTRAP_TOKEN="$(openssl rand -hex 32)"
export LIFEOS_ALLOWED_HOSTS='["localhost","127.0.0.1"]'
export LIFEOS_ALLOWED_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]'
export LIFEOS_COOKIE_SECURE=false

printf 'Bootstrap token: %s\n' "$LIFEOS_BOOTSTRAP_TOKEN"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001
```

Why these values:

- API requires PostgreSQL `postgresql+psycopg://`, not SQLite (`apps/api/app/config.py:21-36`, VERIFIED).
- Bootstrap token must be at least 32 characters (`apps/api/app/config.py:23`; `apps/api/app/schemas/auth.py:7-12`, VERIFIED).
- `create_app` wires auth, health and state routes (`apps/api/app/main.py:12-46`, VERIFIED).
- Alembic must create the three server tables before first request.

Keep Terminal 1 running. The final line is the API process.

### 3.2 Terminal 2 — React/Vite

```bash
cd /Users/yurasachenko/LifeOS_DesignSystem/apps/web
VITE_API_PROXY_TARGET=http://127.0.0.1:8001 npm run dev
```

The `dev` script is Vite (`apps/web/package.json:6-12`, VERIFIED). Keep Terminal 2 running.

### 3.3 Browser — create the first account

Open exactly:

```text
http://127.0.0.1:5173/?bootstrap=1
```

Enter:

1. your email;
2. a password of at least 12 characters;
3. the bootstrap token printed in Terminal 1.

The setup form is enabled only by exact query `bootstrap=1` (`apps/web/src/pages/LoginPage.jsx:9-14,59-95`, VERIFIED). Password/token limits are enforced server-side (`apps/api/app/schemas/auth.py:7-12`, VERIFIED).

Bootstrap creates only the **first** user and a session; further bootstrap calls are closed if any user exists (`apps/api/app/services/auth.py:51-77`, VERIFIED). After that use the normal URL:

```text
http://127.0.0.1:5173/
```

### 3.4 Stop the local system

- press `Ctrl+C` in Terminal 2;
- press `Ctrl+C` in Terminal 1;
- optionally stop PostgreSQL: `brew services stop postgresql@18`.

The saved database remains in `lifeos_dev` for the next run.

## 4. How saving works

The backend stores one `user_snapshots` row per account, keyed by `user_id`, with:

- `schema_version`;
- monotonically increasing `revision`;
- the complete LifeOS `payload` as PostgreSQL JSONB;
- create/update timestamps (`apps/api/app/models/user_snapshot.py:12-30`, VERIFIED).

On first login with no snapshot, the frontend creates the initial seeded state on the server (`apps/web/src/context/LifeDataContext.jsx:300-321`, VERIFIED). Later UI mutations enqueue automatic saves (`apps/web/src/context/LifeDataContext.jsx:350-354`, VERIFIED). Backend updates only when the client's expected revision matches, otherwise returns a conflict instead of silently overwriting newer data (`apps/api/app/services/state.py:21-63`; `apps/api/app/routes/state.py:32-59`, VERIFIED).

This means there is no separate “Save everything” button for normal work: make a change and wait until the sync indicator reports saved.

## 5. Data you can add/change now and save on the server

### 5.1 Tasks — broadly usable

You can:

- create a task with title, routine/important flag, category, date/time and notes (`apps/web/src/components/QuickAddModal.jsx:59-69,88-210`, VERIFIED);
- mark complete/reopen;
- edit title, importance, category, subtasks and notes;
- add/remove/toggle subtasks;
- delete a task (`apps/web/src/components/TaskDetailModal.jsx:10-67,78-176`, VERIFIED; mutation layer `apps/web/src/context/LifeDataContext.jsx:397-435`).

Calendar quick-add currently creates a task; it is not yet a separate full event model.

### 5.2 Quick notes — usable

You can add/delete notes and promote a note into a pre-filled task. A note stores text and capture time (`apps/web/src/pages/QuickNotesPage.jsx:8-80`; `apps/web/src/context/LifeDataContext.jsx:515-525`, VERIFIED).

### 5.3 Finances — usable but basic

You can:

- add a manual expense with amount and category;
- include/exclude individual transactions from totals;
- include/exclude an entire category from totals (`apps/web/src/pages/FinancesPage.jsx:58-73,185-229`; `apps/web/src/context/LifeDataContext.jsx:437-488`, VERIFIED).

**LIMITATION:** current UI has no transaction edit/delete and no finished income/account/import workflow. It is a basic expense logger, not yet full accounting.

### 5.4 Goals — minimal add path

You can add a goal title. A new goal starts at 0% with a current-quarter tag (`apps/web/src/components/GoalsWidget.jsx:20-70`; `apps/web/src/context/LifeDataContext.jsx:490-502`, VERIFIED).

**LIMITATION:** editing progress/value, renaming and deleting goals are not wired in current UI.

### 5.5 Habits — existing habits only

You can mark/unmark **today** for the existing habit list (`apps/web/src/components/HabitsGrid.jsx:14-40,70-100`; `apps/web/src/context/LifeDataContext.jsx:504-513`, VERIFIED).

**LIMITATION:** the visible empty-state add button has no persistence handler; create/edit/delete habit UX is not implemented.

### 5.6 Personal profile — editable and server-backed

The Profile page writes these groups into the server snapshot:

- identity;
- body metrics;
- body measurements: chest, waist, hips, neck, shoulders, sleeve, inseam, shoe;
- clothing sizes: shirt, pants, jacket, shoes, suit, T-shirt;
- food allergies, likes and dislikes (`apps/web/src/pages/ProfilePage.jsx:21-44`; `apps/web/src/profile/cards/MeasurementsCard.jsx:13-20`; `ClothingSizesCard.jsx:17-22`; `FoodPreferencesCard.jsx:21-73`, VERIFIED).

### 5.7 Dog profile — partly editable

You can save name, birth date, weight, feeding times/portions, food inventory reset and vet dates (`apps/web/src/pages/DogPage.jsx:63-189`; mutation layer `apps/web/src/context/LifeDataContext.jsx:533-537`, VERIFIED).

**LIMITATION:** not every displayed dog field is editable yet; for example breed is currently display-only.

### 5.8 Medications — strong existing-medication workflow

For seeded/existing medications you can save:

- status;
- current daily dose/unit and doses per day;
- schedule times;
- interval and half-life values;
- inventory and low-stock threshold;
- steady/up/down/PRN mode and titration settings;
- dose events, snooze and skip actions;
- pharmacist notes: add/edit/delete;
- soft archive of a medication (`apps/web/src/pages/medications/MedConfigDrawer.jsx:63-109,160-278`; `apps/web/src/context/LifeDataContext.jsx:539-639`, VERIFIED).

**LIMITATION:** adding a completely new medication is not exposed in the current UI.

### 5.9 Activity and maintenance

Most mutations append an activity-log entry in the same state update (`apps/web/src/context/LifeDataContext.jsx:386-395`, VERIFIED). Settings can export the snapshot, clear older activity entries and hard-reset the server state to seed defaults (`apps/web/src/context/LifeDataContext.jsx:641-695`; `apps/web/src/components/SettingsPage.jsx:285-343`, VERIFIED).

## 6. What is not server-backed yet

Theme, paradise day/night override and sidebar collapsed state are stored only in this browser's `localStorage` (`apps/web/src/App.jsx:55-70,73-187`, VERIFIED). They do not follow the account to another device.

**LIMITATION:** language currently starts as Russian on each full reload and is only React session state; it is not persisted server-side (`apps/web/src/App.jsx:519-529`, VERIFIED).

Monthly, annual and investments routes are placeholders (`apps/web/src/App.jsx:405-410`, VERIFIED). They cannot yet store dedicated planning/investment records. Health is mostly a presentation surface rather than a separate editable server model.

## 7. Account and privacy limitations

### Multi-account

The database/state architecture is account-scoped: each snapshot is keyed by `user_id` (`apps/api/app/models/user_snapshot.py:20-25`, VERIFIED). However current HTTP/UI supports only:

- one-time creation of the first account;
- login/logout of already existing accounts (`apps/api/app/routes/auth.py:21-91`, VERIFIED).

**LIMITATION:** there is no normal registration/invite/admin-create flow for a second account yet. Multi-account data isolation foundation exists, but account provisioning UX/API is the next missing piece.

### Sensitive data

Passwords use recommended password hashing and session tokens are stored as SHA-256 hashes (`apps/api/app/security/passwords.py:1-25`; `apps/api/app/security/sessions.py:9-26`, VERIFIED). The LifeOS snapshot itself is ordinary JSONB with no application-layer field encryption (`apps/api/app/models/user_snapshot.py:23-25`; `apps/api/app/services/state.py:21-49`; exhaustive grep found no encryption implementation).

For local development, use demo/non-critical medical and financial data until production HTTPS, database access, backups and sensitive-data protection are separately reviewed.

## 8. Recommendation

You can begin filling the system locally today, especially tasks, notes, expenses, profile/dog details and existing-medication records. Treat the local PostgreSQL database as the current source of truth and back it up before entering irreplaceable data.

The most useful next action is not new coding: first perform one successful local launch and create the first account. After that we can inspect the actual UI together and decide which missing CRUD path matters first: additional accounts, habits, goals, transactions or new medications.

WAITING FOR: review Discovery; if you want, send `Continue`, and I will guide the first local launch step by step without touching VPS.
