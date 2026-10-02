# PF-01 — Local Run Summary
Full report: [pf-01-local-run-and-data_discovery_2026-07-22_033951.md](/Users/yurasachenko/LifeOS_DesignSystem/Outputs/Discoveries/pf-01-local-run-and-data_discovery_2026-07-22_033951.md)
Систему вже можна запустити як React `5173` → FastAPI `8001` → PostgreSQL `5432`.
Frontend dependencies і Python 3.11 `.venv` готові; зараз треба лише запустити PostgreSQL і створити `lifeos_dev`.
Точні copy-paste команди для двох Terminal windows наведені в розділі 3 повного звіту.
Перший акаунт створюється один раз через `http://127.0.0.1:5173/?bootstrap=1`.
Вже server-backed: tasks, quick notes, basic expenses, goals, habit marks, profile, dog data, existing medications і activity log.
Tasks мають найповніший CRUD; expenses можна додавати/виключати, але ще не edit/delete.
Goals поки можна тільки додавати; habits — тільки відзначати сьогодні; нові medications додавати ще не можна.
Theme/scene/sidebar зберігаються лише в конкретному browser; language після reload не зберігається.
Monthly/annual/investments — placeholders; second-account registration/invite flow ще відсутній.
Дані автоматично зберігаються одним JSONB snapshot на account із revision-conflict захистом.
Не вводьте критично чутливі medical/financial data до окремого production security/backup review.
WAITING FOR: `Continue`, якщо провести перший локальний запуск разом покроково.
Full: Outputs/Discoveries/pf-01-local-run-and-data_discovery_2026-07-22_033951.md
