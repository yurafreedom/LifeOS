# PF-01 Batch 3 — Vitest scope STOP audit

**Дата:** 2026-07-21 22:00:56 Europe/Kiev
**Фаза:** C — implementation paused on unplanned verification boundary
**HEAD:** `102aea4cbdd04f1bb4b9b076879d7fb7aecfe5ec`
**Branch:** `design-sync-setup`
**Вердикт:** STOP — для чесного запуску п’яти погоджених TypeScript suites потрібен один додатковий modified path.

## 1. Evidence

- **VERIFIED (HEAD `102aea4`, `apps/web/vite.config.js:26-29`):** Vitest discovery має `include: ['src/test/**/*.test.{js,jsx}']`; `.test.ts` файли не виявляються.
- **VERIFIED (approved Plan, `Outputs/Plans/pf-01-batch-3_plan_2026-07-21_191900.md:481-500`):** verification contract вимагає шість suites, п’ять із них мають `.test.ts` paths.
- **VERIFIED (approved/corrected scope):** `apps/web/vite.config.js` не входить до погоджених 32 paths.
- **VERIFIED command:** `npm run typecheck` — PASS після source/test fixes.
- **VERIFIED command:** `npm run lint` — PASS.
- **VERIFIED command:** `npm run test` — формально PASS, але реально `Test Files 1 passed (1), Tests 3 passed (3)`; виконано лише `smoke.test.jsx`. Це не задовольняє Plan і не може бути заявлено як green Batch 3 test gate.
- **VERIFIED:** `npx vitest --help --expand-help` у Vitest 4.1.10 не має CLI option, що перевизначає config `test.include`; positional filters не розширюють discovery include.

## 2. Proposed minimal correction

Додати до scope один існуючий файл:

```js
// apps/web/vite.config.js
include: ['src/test/**/*.test.{js,jsx,ts,tsx}'],
```

Наслідок scope:

- було після попередньої поправки: `16 new + 15 modified + 1 deleted = 32`;
- стане: **`16 new + 16 modified + 1 deleted = 33`**.

Жоден інший path, dependency або behavior contract не змінюється. Це test-discovery config only; dev server/proxy/build config лишаються untouched.

## 3. Rejected workaround

- Імпортувати п’ять `.test.ts` suites зі `smoke.test.jsx` технічно змусило б assertions виконатися, але Vitest усе одно звітував би один discovered file. Це приховує реальну конфігураційну проблему й суперечить expected six-file gate.
- Перейменувати тести в JSX суперечить погодженим paths і exact 12 TypeScript files gate.
- Додати окремий config/aggregator створює зайвий новий path і має більший scope.

## 4. Current implementation state

- Зміни є лише в уже погоджених implementation paths; `vite.config.js` не змінено.
- Старий `storage.js` видалено після zero-external-caller grep; browser `lifeOsState` не змінювався й не видалявся.
- `Outputs/backlog-tasks/*` ще не змінені; build, expected-count gates, staging і commit ще не виконані.
- Push/deploy/live DB не виконувалися.

## 5. Sign-off requested

Погодження цього audit означає:

1. додати `apps/web/vite.config.js` як 33-й дозволений path;
2. змінити тільки Vitest `include` на `{js,jsx,ts,tsx}`;
3. продовжити Phase C з усіма попередніми 13 sign-offs без інших змін;
4. повторно запустити typecheck, lint, усі 6 test files і build до будь-якого commit.

WAITING FOR: явне погодження 33-го path `apps/web/vite.config.js` і Continue для PHASE C.
