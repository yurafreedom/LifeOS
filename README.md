# JENKIN

JENKIN is a personal operating system for everyday life: tasks and delegated
items, a nested calendar, quick notes with clarification, projects and goals,
manual finance tracking, encrypted financial documents, health and medications,
and a profile — in Russian and Ukrainian.

It is a server-backed, multi-account web application (React + FastAPI +
PostgreSQL). **LifeOS** is the earlier name and still appears in technical
identifiers (`@life-os/web`, `LIFEOS_*`, `lifeOs*` storage keys, this
repository's name) for compatibility.

> **Status.** The JENKIN work lives on the integration branch
> `integration/jenkin-combined-20261001`; it is not merged into `main` and is not
> deployed anywhere. No formal release has been published — the current build
> (`0.1.0`) is an unreleased development build. See [`CHANGELOG.md`](CHANGELOG.md).

## Start here

| Read | For |
|---|---|
| [Product & architecture overview](docs/product/JENKIN_PRODUCT_OVERVIEW.md) (RU) | what JENKIN is, modules, implemented vs planned, architecture, data, security, encryption, finance roadmap |
| [Module boundaries](Outputs/architecture/module-boundaries.md) | where each responsibility lives in the code ("I want to change X — where do I go?") |
| [Local preview](scripts/preview/README.md) | one-command local run on a dedicated preview database |
| [Release notes](CHANGELOG.md) · [process](docs/product/RELEASE_NOTES_PROCESS.md) | update history (generated) and how to add an entry; in the app: Settings → About → update history (`#/updates`) |
| [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) | repository rules for contributors and coding agents |
| [LIFEOS_MASTER_CONTEXT.md](LIFEOS_MASTER_CONTEXT.md) | long-lived operational context and decision history |

## Run locally

Requirements: Python 3.11, Node.js ≥ 20.19, a local PostgreSQL.

```bash
./scripts/preview.sh            # production build + real API → http://127.0.0.1:4710/
./scripts/preview.sh status     # also: stop, logs, token
```

The launcher only creates and migrates `lifeos_preview` /
`lifeos_preview_<suffix>` databases (`--db-suffix <name>`); see
[scripts/preview/README.md](scripts/preview/README.md) for first-time setup and
bootstrap of the first account.

Manual development: `apps/api` runs with
`uvicorn --factory app.main:create_app` (needs `LIFEOS_DATABASE_URL` and a
32+ character `LIFEOS_BOOTSTRAP_TOKEN`); `apps/web` runs with `npm run dev`
(Vite on `127.0.0.1:5173`, proxying `/api` to `127.0.0.1:8000`).

A future hosted address has been proposed (`https://jenkin.sachenkolabs.tech`),
but no DNS, hosting, certificates or mail are configured.

## Checks

```text
apps/api:  python -m pytest · ruff check . · alembic heads · alembic current
apps/web:  npm test · npm run typecheck · npm run lint · npm run build · npm run release-notes -- --check
repo root: git diff --check
```

Backend tests need `LIFEOS_TEST_DATABASE_URL` pointing at a disposable `*_test`
database; without it they are skipped, not passed.

## Repository layout

| Path | What |
|---|---|
| `apps/web` | React application (Vite, Vitest, ESLint, TypeScript checking) |
| `apps/api` | FastAPI service, SQLAlchemy models, Alembic migrations, pytest suite |
| `scripts/preview*` | local preview launcher |
| `docs/product` | product overview and release-notes process |
| `docs/design-system` | the original Life OS design-system specification (brand, content and visual rules) used with `SKILL.md`, `colors_and_type.css`, `assets/`, `preview/`, `ui_kits/` |
| `design-references/` | approved JENKIN logo and font packages and design handoffs (references, not runtime code) |
| `Outputs/` | discoveries, plans, runbooks and implementation reports |
| `ARCHITECTURE.md` | historical reference for the original browser-only prototype |
