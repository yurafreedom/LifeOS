# PF-01 Batch 3 — static expected-count STOP audit

**Дата:** 2026-07-21 22:22:13 Europe/Kiev
**Фаза:** C — implementation, after green executable gates / before staging
**HEAD basis:** `102aea4cbdd04f1bb4b9b076879d7fb7aecfe5ec`
**Scope:** approved 33 paths (`16 new + 16 modified + 1 deleted`)
**Вердикт:** STOP — три Plan counts потребують арифметичної поправки; implementation defects за цими gates не виявлені.

## 1. Green executable gates

- **VERIFIED:** `npm run typecheck` → PASS.
- **VERIFIED:** `npm run lint` → PASS.
- **VERIFIED:** `npm run test` → PASS, `6 passed (6)` files / `25 passed (25)` tests.
- **VERIFIED:** `npm run build` → PASS, Vite 8.1.5, 81 modules transformed.

## 2. Counts that match approved intent

| Gate | Expected | Actual | Verdict |
|---|---:|---:|---|
| `find apps/web/src -name '*.ts'` | 12 | 12 | PASS |
| `find apps/web/src/test -name '*.test.*'` | 6 | 6 | PASS |
| source files with `fetch(` | 1 | 1 (`api/client.ts`) | PASS |
| API files with `/api/v1` | 2 | 2 (`auth.ts`, `state.ts`) | PASS |
| `user_id` source files | 0 | 0 | PASS |
| `LifeStorage` source files | 0 | 0 | PASS |
| read of legacy `lifeOsState` | 1 | 1 (`legacyLocalImport.ts:9`) | PASS |
| write/remove of legacy `lifeOsState` | 0 | 0 | PASS |
| `StateSyncCoordinator` files | 3 | 3 (provider, implementation, test) | PASS |
| `VITE_` / `DATABASE_URL` / `BOOTSTRAP_TOKEN` in frontend src | 0 | 0 | PASS |
| Bootstrap CSS/package import patterns | 0 | 0 | PASS |

## 3. Three stale Plan counts

### 3.1 `bootstrap_token`

- **Plan expected:** exactly 1 file, `api/auth.ts`.
- **Actual:** exactly 4 files:
  1. `apps/web/src/api/auth.ts` — required snake_case server wire field;
  2. `apps/web/src/pages/LoginPage.jsx` — i18n key reference `auth_bootstrap_token`;
  3. `apps/web/src/context/LocaleContext.jsx` — approved RU/UK label key;
  4. `apps/web/src/test/api-client.test.ts` — required exact request-shape assertion.
- **Security verdict:** PASS. Grep for actual env/secret names `VITE_|DATABASE_URL|BOOTSTRAP_TOKEN` is zero; no token value is stored, logged or bundled.
- **Proposed corrected gate:** `rg -l 'bootstrap_token' apps/web/src` → exactly 4 named files above; separately retain zero secret-name/value gate.

### 3.2 `LifeDataContext`

- **Plan expected:** 16 files (the pre-change caller inventory).
- **Actual:** 19 files.
- **Delta is planned behavior:** `SyncStatus.jsx` is a new display consumer; `smoke.test.jsx` and `state-migration.test.ts` import the context/module for the approved regressions.
- **Production caller delta:** only `SyncStatus.jsx`; the other two are tests.
- **Proposed corrected gate:** exactly 19 files, matching the exhaustive list captured in command output; no unknown production consumer.

### 3.3 local preference operations

- **Plan expected:** preserve 9 operation hits.
- **Actual current implementation:** 8 operation hits.
- **VERIFIED baseline HEAD:** the same strict operation grep on `git show HEAD:apps/web/src/App.jsx` is also exactly 8. Broad grep returns comments as extra hits, which caused the Plan miscount.
- **Behavior verdict:** PASS; all four reads/writes pairs for sidebar, theme and scene are byte-for-byte preserved apart from line movement caused by imports/root composition.
- **Proposed corrected gate:** strict operation grep → exactly 8 on HEAD and working tree.

## 4. Sign-off effect

Approval changes only the three verification expectations:

1. `bootstrap_token`: 1 → 4 classified files;
2. `LifeDataContext`: 16 → 19 classified files;
3. local preference operations: 9 → 8, explicitly equal to HEAD baseline.

No source edit, scope path, dependency, API, behavior contract, delivery mode or commit message changes. After approval, Phase C continues with diff review, task log/observation, final gates, staging and commit-only delivery.

WAITING FOR: approval of the three corrected static counts and Continue for PHASE C.
