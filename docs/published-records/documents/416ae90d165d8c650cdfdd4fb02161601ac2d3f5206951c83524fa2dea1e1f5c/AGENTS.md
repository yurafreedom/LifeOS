# LifeOS repository instructions

This file defines day-to-day operating rules for Codex and other coding agents.
Read `LIFEOS_MASTER_CONTEXT.md` for long-lived product, architecture and history
context. Current repository code and live Git state override mutable facts in
that document.

## Repository roles

- `LIFEOS_MASTER_CONTEXT.md`: canonical long-lived LifeOS context.
- `AGENTS.md`: canonical agent workflow and repository safety rules.
- `CLAUDE.md`: Claude-specific entry point; it must defer to this file rather
  than duplicate a conflicting policy.
- `Outputs/`: authored discovery, plan, audit and implementation records.
- `Outputs/architecture/module-boundaries.md`: where each responsibility lives
  and which facade paths callers must import. Keep it current when a boundary moves.
- `/Users/yurasachenko/LifeOS/design_handoff_*`: read-only design references,
  never development checkouts or runtime dependencies.

## Single canonical checkout

The normal LifeOS checkout is:

`/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`

- Use ordinary feature branches in this checkout.
- Do not create a Git worktree or copy/clone the repository for a normal task.
- Create a worktree only when the owner explicitly asks for one.
- Before switching branches, require a clean working tree. If unfinished work
  prevents switching, stop and ask the owner; do not work around it with a new
  worktree or stash.
- After a PR is merged: switch to `main`, fetch, fast-forward only, then delete
  the fully merged local feature branch.

## Safety and scope

Before changes, verify `pwd`, branch, HEAD, status, `origin/main`, and expected
ancestry. Preserve unexpected work and stop rather than overwriting it.

Do not use `git reset --hard`, blanket `git clean`, automatic stash operations,
rebase, force-push, or destructive branch deletion. Normal PR merges use merge
commits, not squash or rebase, unless the owner explicitly changes the policy.

Do not invent product semantics. Surface unresolved domain decisions. Preserve
Quick Notes on cancellation or persistence failure. Project is not Goal;
Actual is not Forecast; missing data is not zero.

Do not add dependencies or migrations unless the approved task requires them.
Never run `npm audit fix` as incidental cleanup. Keep the recovery stash object
`51184836ace557fbd9492527bd845329b17b2a76` untouched without explicit owner
authorization.

## Stack and validation

- Backend: Python 3.11, FastAPI, SQLAlchemy, PostgreSQL, Alembic, pytest, Ruff.
- Frontend: React 18, Vite, TypeScript checking, Vitest, ESLint.
- Architecture: server-backed, multi-account operational state; local execution
  is a development convenience, not the production source of truth.
- Database validation may use `lifeos_test` only. Never point tests or migration
  checks at production data.

Run relevant targeted checks while working. Before claiming a substantial
change complete, run from the appropriate package directories:

```text
apps/api:  python -m pytest
apps/api:  ruff check .
apps/api:  alembic heads
apps/api:  alembic current
apps/web:  npm test
apps/web:  npm run typecheck
apps/web:  npm run lint
apps/web:  npm run build
repo root: git diff --check
```

Report unavailable infrastructure honestly; never imply a check passed when it
was not run. Substantial implementations should add an accurate report under
`Outputs/Implementations/` and preserve completed reports as historical records.
