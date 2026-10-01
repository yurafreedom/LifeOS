# JENKIN local preview launcher — implementation report

Date: 2026-10-01 · Branch `feat/jenkin-preview-launcher-20261001`. The branch is
based on `f7a43eb`, the S1 tip (`origin/feat/jenkin-account-security-20261001`).
It was built in the worktree `/Users/yurasachenko/LifeOS/LifeOS_preview-launcher`.

## Why a worktree

The canonical checkout was on `handoff/jenkin-cloud-20260930` with 37 staged
files and 3 untracked files from another session. AGENTS.md forbids switching
branches over unfinished work, and the owner's task explicitly allowed an
isolated worktree. The canonical index, status and stash list were snapshotted
before the work and were verified identical afterwards.

## Delivered

- `scripts/preview.sh`: a bash wrapper. It finds Python 3.11 (and loads nvm if
  `node` is missing), then hands over to the launcher.
- `scripts/preview/launcher.py`: the orchestrator, written with the Python 3.11
  standard library only. Commands are `start` (default), `status`, `stop`,
  `token`, `logs` and `help`. Options are `--ref`, `--source`, `--db-suffix`,
  `--port`, `--api-port` and `--no-open`.
- `scripts/preview/dbtool.py`: database checks and creation. It runs inside the
  launcher venv (psycopg plus the revision's own Alembic scripts).
- `scripts/preview/README.md`: first-time setup, everyday use, data locations,
  safety rules and troubleshooting.
- `.gitignore`: adds `.jenkin-preview/`, for a state directory deliberately
  placed inside a checkout. The default location is outside the repository.

No dependency and no migration were added. The launcher uses tools that already
exist: Python 3.11, Node and npm, Git, PostgreSQL, and macOS `open`, `pbcopy`,
`ps` and `lsof`.

## How it works (as built)

1. **Source.** By default, the launcher previews the checkout that contains the
   script, with its working tree as-is.
   - `--ref NAME` runs `git fetch --no-tags origin +refs/heads/NAME:refs/remotes/origin/NAME`.
     A commit is resolved locally first and fetched only if it is missing.
     The result goes into a managed worktree at
     `~/.jenkin-preview/worktrees/<name>`, registered with Git and marked with
     `<name>.managed.json`.
   - A clean managed worktree is moved to the new commit with
     `checkout --detach`. A dirty one is refused, never erased.
   - The launcher never falls back to `main`.
   - The header shows the path, kind, ref, branch, commit and subject, plus the
     number of uncommitted and staged paths.
2. **Isolation from checkouts.**
   - Git status reads run with `GIT_OPTIONAL_LOCKS=0`, so the index is not
     rewritten.
   - Python runs with `PYTHONDONTWRITEBYTECODE=1`, and the build output goes to
     `~/.jenkin-preview/builds`.
   - The API and Alembic run from an empty directory (`run/cwd`), so no
     checkout's `.env` is read.
   - Inherited `LIFEOS_*`, `VITE_*`, `PGHOST`/`PGDATABASE`/… and `PYTHONPATH`
     are dropped.
3. **Dependencies.**
   - API: a launcher-owned venv keyed by sha256(`requirements.lock` + Python
     version), created with `pip --require-hashes`. The latest 3 are kept.
   - Web: `npm ci` runs only when `node_modules/.package-lock.json` disagrees
     with `package-lock.json`. Missing platform-specific optional packages are
     tolerated.
4. **Database** (lifeos_preview, or lifeos_preview_<suffix> with `--db-suffix`):
   - Only these names are accepted, and only on a loopback host. They are
     checked in the launcher and again in the database helper. The helper also
     verifies `current_database()` and `inet_server_addr()`.
   - The database is created when missing and marked with
     `COMMENT ON DATABASE … 'jenkin-preview-launcher'`. An unmarked existing
     database is adopted only if it has zero tables. Otherwise it is refused.
   - Plan: the revision's own Alembic `ScriptDirectory` is compared with
     `alembic_version`.
     - Empty database: `upgrade head`.
     - Current version is an ancestor of head: `upgrade head`.
     - Equal: nothing to do.
     - Newer, unknown or diverged: refused, with a ready `--db-suffix r<sha>`
       command.
   - The launcher never downgrades, truncates or reseeds. Credentials come from
     libpq (trust auth or `~/.pgpass`). No password is stored or printed.
5. **Runtime configuration.** Values are fed to the API by environment, and
   names are feature-detected from the revision's `app/config.py`:
   - `LIFEOS_ENVIRONMENT=development` and the bootstrap token from
     `secrets/bootstrap-token` (0600, generated once, never printed).
   - `LIFEOS_ALLOWED_HOSTS=["127.0.0.1","localhost"]`.
   - `LIFEOS_ALLOWED_ORIGINS` set to the exact web origin pair for the chosen
     port.
   - `LIFEOS_COOKIE_SECURE=false`.
   - `LIFEOS_AA_WRITE_ENABLED` and the build flag `VITE_LIFEOS_ANALYTICS_ENABLED`
     follow `PREVIEW_ANALYTICS` (default true, matching earlier QA builds).
   - S1 and later revisions also get `LIFEOS_PUBLIC_APP_URL` (the web origin),
     `LIFEOS_MAIL_BACKEND=file` and `LIFEOS_MAIL_FILE_DIR=~/.jenkin-preview/mail/<db>`.
6. **S2 (encrypted documents).**
   - Support is detected only when the revision has `documents_enabled` and
     `keyring_file` in its config and `keyring-generate` in `app/cli.py`. These
     names were read from the S2 code; none were invented.
   - Without a keyring, the launcher counts rows in
     `documents`/`document_versions`/`document_blobs`. If any exist, it refuses
     to start. If none exist, it runs that revision's
     `python -m app.cli keyring-generate <path> --key-id preview-YYYYMMDD` once.
   - An existing keyring is never replaced. The API then gets
     `LIFEOS_DOCUMENTS_ENABLED=true` and `LIFEOS_KEYRING_FILE`.
   - S2 stores document blobs in PostgreSQL, so no file storage directory is
     needed.
7. **Build.**
   - The cache key is a content hash of the tracked and untracked (non-ignored)
     files under `apps/web`, plus any local `apps/web/.env*`, the build flags
     and the Node version.
   - The build runs `vite build --outDir <tmp> --emptyOutDir` and is moved into
     place only on success. The latest 4 builds are kept.
   - A cached build is reused whenever its content hash matches, even across
     checkouts and revisions.
8. **Services and readiness.**
   - The API runs as `uvicorn --factory app.main:create_app --app-dir <api>` on
     `127.0.0.1:<api>`. The web side runs as
     `vite preview --outDir <build> --host 127.0.0.1 --port <web> --strictPort`,
     using the repository's proxy with `VITE_API_PROXY_TARGET`.
   - Each runs in its own session, as a child of the launcher.
   - Readiness checks:
     - API: `GET /api/healthz` returns `"ok"` (database checked), within 90 s.
     - Web: `GET /` contains `id="root"` and `GET /api/healthz` succeeds
       through the proxy, within 45 s.
   - The browser opens only after readiness, at `/?bootstrap=1` when no account
     exists. In that case the token is placed on the clipboard via `pbcopy`.
9. **Process ownership.**
   - An `flock` on `run/launcher.lock` (not inherited by children) is the
     authority on whether a launcher is alive. `run/instance.json` records each
     PID with its `ps lstart` and a command marker.
   - Signals go to recorded processes only when the start time and command
     still match and the process leads its own group.
   - A second start of the same source, commit and database reports the running
     instance and opens it. A different source is refused with the `stop` hint.
   - On Ctrl+C, SIGTERM or SIGHUP, the launcher stops web, then API (SIGTERM,
     then SIGKILL after 10 s) and removes the state file.
   - If either service exits, the launcher stops the other, prints the end of
     its log and exits 1.

## Verification (actually run, 2026-10-01, synthetic data only)

| Scenario | Result |
| --- | --- |
| First startup (empty `~/.jenkin-preview`, no `lifeos_preview`) | PASS. Venv created from the hashed lock, `npm ci`, database created and marked, `empty → 20261001_0011`, build, API and preview ready, bootstrap detected, token copied to clipboard |
| Account and data via the real API through the proxy (Origin checked) | PASS. Bootstrap 201, `PUT /api/v1/state` 201, `GET` returns the task |
| Repeated startup | PASS in about 3.4 s. Venv, node_modules and build reused, schema current, account and task still present |
| Already running, same source | PASS. Reported and reused, exit 0 |
| Already running, different source | PASS. Refused with `stop` hint, exit 1 |
| Ctrl+C (SIGINT to the launcher) | PASS. Launcher, API and web all gone, ports free, state removed |
| `stop` from another terminal | PASS |
| Build cache invalidation and reuse | PASS. A new untracked file under `apps/web/src` triggered a rebuild (new hash). Removing it reused the old build |
| Occupied port (foreign listener on 4710) | PASS. Occupant named (`Python (pid …)`), fell back to 4711/8711 with origins configured, login worked, foreign process untouched. With explicit `--port 4710` it refused, exit 1 |
| API failure (scratch worktree with `raise` in `main.py`) | PASS. Log tail shown, nothing left listening, state removed |
| Build failure (syntax error in a web source) | PASS. Log tail shown, no partial build kept, no service started |
| Web service killed mid-run | PASS. Detected, API stopped, exit 1 |
| Launcher SIGKILLed (orphans) | PASS. `status` reports the leftovers. `stop`, and also the next start, stop them after the identity check |
| Forged stale state pointing at an unrelated live process (one record with the real start time but a wrong marker, one with a wrong start time) | PASS. Not signalled, state discarded |
| Refusal of `lifeos_dev`, `lifeos_test`, `lifeos_previewx` and non-loopback host `10.0.0.5` | PASS in the launcher. `dbtool ensure` on `lifeos_dev`/`lifeos_test` was also refused (exit 2), and those databases carry no marker |
| `--ref main` against the 0011 preview database | PASS. Refused with no downgrade (and now refused before `npm ci`). `--ref main --db-suffix r5e858bb` created a separate database at 0009 and ran |
| `--ref feat/jenkin-account-security-20261001` | PASS. Fetched, managed worktree, same preview database, existing account present |
| Clean managed worktree on another commit | PASS. Moved to the fetched commit |
| Dirty managed worktree | PASS. Refused, file left modified (then restored by hand) |
| `--source` canonical checkout (37 staged + 3 untracked) | PASS. Previewed as-is (on `lifeos_preview_canon`, because its head 0009 is older). `git status --porcelain`, `.git/index` mtime and size, and the stash list were identical before and after |
| S2: read-only overlay copy of the S2 session's uncommitted files on a scratch worktree, `--db-suffix s2qa` | PASS. Separate venv (S2 lock adds cryptography and pypdf), `empty → 20261001_0012`, keyring generated (0600), encrypted PNG upload 201, download sha256 equal |
| S2 restart | PASS. The same keyring file was reused (sha256 unchanged) and the document still decrypted |
| S2 keyring missing while records exist | PASS. Refused to start with a restore instruction, generated nothing |
| S2 committed revision `--ref 13c9f1f` (local commit, not on origin), `--db-suffix s2ref` | PASS. Managed worktree, 0012, keyring generated, upload and download equal, persistence across restart |
| Real browser open | PASS. `open` was called after readiness. In Chrome the production login page rendered and sign-in reached the real API. See the browser note below |
| Repository checks for changed files | `ruff check` (repo config, ruff 0.15.22): pass. `bash -n scripts/preview.sh`: pass. No app code changed, so the API/web suites were not rerun |

Browser note: my synthetic `PUT /state` payload was minimal, so the app
correctly refused it ("State collection medications is invalid"). I deleted
that synthetic snapshot row. A further UI click was blocked by the session's
permission policy, so full in-app UI rendering after login was not
re-inspected. The launcher behaviour itself (build, proxy, sign-in round trip)
was verified.

Not verified: a missing PostgreSQL server, or a password-only role (the error
paths are implemented and classified, not exercised); a terminal window closed
with SIGHUP (it uses the same handler as SIGTERM, which was verified).

## State left on this machine (all synthetic)

- `~/.jenkin-preview/`: config, bootstrap token, keyrings for `s2qa`/`s2ref`,
  2 venvs, builds, managed worktrees `main`,
  `feat-jenkin-account-security-20261001` and `13c9f1f`.
- Databases `lifeos_preview` (QA account `preview-qa@example.com`),
  `lifeos_preview_canon`, `lifeos_preview_r5e858bb`, `lifeos_preview_s2qa` and
  `lifeos_preview_s2ref`. They contain only synthetic QA data.
- These were not dropped, because dropping databases is the owner's call. With
  the QA account present in `lifeos_preview`, the owner's first run will show
  the login page instead of bootstrap. The one-time cleanup command is in the
  final summary.

## Notes and limits

- The launcher is on a feature branch. Until it is merged into the branch
  checked out in the canonical checkout, run it from this worktree with
  `--source /Users/yurasachenko/LifeOS/LifeOS_DesignSystem`, or with `--ref`.
- Local JENKIN servers on `127.0.0.1` share the `lifeos_session` cookie name, so
  signing in on one port signs out the other.
- `npm ci` in a non-managed checkout only happens when its `node_modules` is
  stale. It is the normal lockfile install, but it affects that checkout's
  ignored `node_modules`.
