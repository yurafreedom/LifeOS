Report saved to: `Outputs/Plans/lifeos-production-foundation_plan_2026-07-21_011746.md`

PLAN for Life OS Production Foundation

Render Free підходить лише для staging: API засинає після 15 хвилин, cold start ≈1 хвилина, filesystem тимчасовий, а Free Postgres видаляється після 30 днів і не має backup.

Рекомендований production stack: React 18 + Vite, поступовий JS→TypeScript, FastAPI, SQLAlchemy/Alembic, PostgreSQL, cookie sessions.

Архітектура відразу multi-account: `users`, `sessions`, `user_snapshots`; owner береться тільки із сесії, stale writes блокуються optimistic revision/409.

Перший server-backed формат — versioned JSONB snapshot на користувача; нормалізація tasks/finance/medications виконується пізніше домен за доменом.

Послідовність: закрити dirty Batch 1 → production React build → auth/API/database → server sync + explicit localStorage import → Render staging.

Legacy `ui_kits/life-os` зберігається до parity QA; Calendar/GTD/Sprint 4 і redesign не входять у PF-01.

Перед Phase C потрібно затвердити 9 sign-off items, передусім stack, snapshot-first, `apps/web` + `apps/api`, Batch 1 first та Render staging-only.

Full: Outputs/Plans/lifeos-production-foundation_plan_2026-07-21_011746.md
