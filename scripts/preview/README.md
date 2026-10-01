# JENKIN local preview launcher (macOS)

One command opens a production build of JENKIN against the real API and a
dedicated, persistent preview database:

```sh
./scripts/preview.sh
```

It runs in the foreground of one terminal. It prepares dependencies, applies
forward-only migrations to the preview database, builds the frontend, starts
the API and `vite preview` as its own child processes, waits until both are
ready and then opens the browser. **Ctrl+C stops both services.** Accounts,
tasks and documents are kept.

The launcher never runs tests, lint or typecheck. Use the normal repository
checks for those (they use `lifeos_test`, never the preview database).

## Commands

| Command | What it does |
| --- | --- |
| `./scripts/preview.sh` | Previews **this checkout**, meaning the checkout that contains the script, with its working tree as-is (uncommitted and staged changes included, never modified). |
| `./scripts/preview.sh --ref <branch-or-commit>` | Fetches `origin/<branch>` (or finds or fetches the commit) and previews it in a managed worktree at `~/.jenkin-preview/worktrees/<name>`. |
| `./scripts/preview.sh --source <path>` | Previews another local checkout's working tree (read-only use). |
| `./scripts/preview.sh status` | Shows the running instance: URL, source, commit, database, PIDs and health. |
| `./scripts/preview.sh stop` | Stops the running instance from any terminal. |
| `./scripts/preview.sh token` | Copies the first-account bootstrap token to the clipboard without showing it. |
| `./scripts/preview.sh logs` | Shows the end of the latest run's logs. |

Options: `--db-suffix <name>` uses `lifeos_preview_<name>`, `--port` / `--api-port`
choose the ports, and `--no-open` skips opening the browser.

The launcher never picks `main` or a historical SHA by itself. Every run prints
the exact path, branch, commit and working-tree state it previews.

URL: `http://127.0.0.1:4710/` (API on `127.0.0.1:8710`, reached only through the
preview proxy). If a port is taken by another program, the launcher reports
that program and uses the next free pair. It never stops that program. Browser
storage is per port, so a different port means separate local preferences.

## First-time setup (once)

Prerequisites already on the owner's Mac: Python 3.11 (Homebrew), Node ≥ 20.19
(nvm), npm, Git, and a running local PostgreSQL that the current macOS user
can reach on `127.0.0.1:5432` without a password (trust auth). Its role must be
allowed to create a database.

1. Run `./scripts/preview.sh`. The first run creates
   `~/.jenkin-preview/config.env`, a launcher-owned Python venv and the
   `lifeos_preview` database. It applies migrations, builds, starts the
   services and opens `/?bootstrap=1`.
2. The bootstrap token is already on the clipboard. Paste it into the token
   field and create the first (owner) account. If the clipboard was
   overwritten, run `./scripts/preview.sh token` again.

If PostgreSQL needs a password, put it in `~/.pgpass`
(`127.0.0.1:5432:*:<role>:<password>`, `chmod 600`). The launcher never stores
or prints passwords. If the server is down, start your existing service
(`brew services start postgresql@18`). The launcher does not start or change
PostgreSQL.

## Where things live

Everything private lives outside the repository in `~/.jenkin-preview/` (mode
0700, files 0600). You can override the location with `JENKIN_PREVIEW_HOME`.
An in-repository location is refused unless it is Git-ignored.

| Path | Contents |
| --- | --- |
| `config.env` | Non-secret settings: PostgreSQL host, port, role, database name, ports, analytics flag, mail mode |
| `secrets/bootstrap-token` | Persistent local bootstrap token (generated once) |
| `secrets/keyring-<db>.json` | S2 document keyring for that database (generated once, never replaced). **Back it up.** Without it, encrypted documents cannot be read |
| `venvs/<lock-hash>/` | API dependencies from `apps/api/requirements.lock` (hash-checked), shared by revisions with the same lock |
| `builds/<content-hash>/` | Cached production builds (latest 4 kept) |
| `worktrees/<ref>/` | Managed worktrees for `--ref` (reused when clean; never erased) |
| `mail/<db>/` | Development `.eml` files (S1 file mail backend). Nothing is ever sent |
| `logs/<run>/`, `logs/latest` | `pip`, `npm`, `migrate`, `build`, `api`, `web` logs (latest 20 runs) |
| `run/` | Lock and runtime state of the running instance |

Persistent application data (accounts, snapshots, tasks and S2 encrypted
documents) lives in the PostgreSQL database `lifeos_preview`.

## Safety rules the launcher enforces

- **Database.** It uses only `lifeos_preview` or `lifeos_preview_<suffix>` on a
  loopback server. `lifeos_dev`, `lifeos_test` and every other name are refused
  both in the launcher and in its database helper. It creates the preview
  database and marks it with a comment. It never writes to an existing
  database that has tables and lacks that marker.
- **Migrations.** Upgrades are forward-only. If the database is newer than (or
  has diverged from) the previewed revision, the launcher refuses and suggests
  `--db-suffix r<sha>`, which gives that revision a separate database. It never
  downgrades, truncates, resets or reseeds anything.
- **Environment.** Inherited `LIFEOS_*`, `VITE_*` and libpq targeting variables
  are dropped. The API runs from an empty directory, so no checkout's `.env` is
  read. Mail is the development file backend (or disabled). The app has no bank
  integration.
- **Encrypted documents (S2).** The launcher detects support from the previewed
  revision's code (`documents_enabled`, `keyring_file` and the
  `keyring-generate` command). It generates the keyring once with that
  revision's own CLI. If document records exist but the keyring is missing, it
  refuses to start.
- **Sources.** It never resets, cleans, stashes or checks out another checkout.
  Git status reads use `GIT_OPTIONAL_LOCKS=0`, and Python runs with
  `PYTHONDONTWRITEBYTECODE`. A managed worktree is moved to a new commit only
  when it is clean. A dirty one is reported and left alone. `npm ci` runs only
  when `node_modules` does not match `package-lock.json`.
- **Processes.** A single `flock` lock identifies the live launcher. A recorded
  PID is signalled only when its start time and command line still match. A
  stale record therefore cannot cause the launcher to kill an unrelated process
  that reused the PID.
- **No side effects.** It never pushes, merges or deploys.

## Troubleshooting

- *"database schema … is newer"*: the revision is older than the preview data.
  Run the suggested `--db-suffix` command.
- *"managed worktree … has local changes"*: inspect it with
  `git -C ~/.jenkin-preview/worktrees/<name> status`. Remove it yourself with
  `git worktree remove <path>` once you no longer need it.
- *A service failed*: the launcher prints the end of its log. Full logs are
  under `~/.jenkin-preview/logs/latest/`.
- *Signed out in another local JENKIN*: dev and QA servers on `127.0.0.1` share
  the `lifeos_session` cookie name. Signing in on one origin replaces the
  session of the other.
