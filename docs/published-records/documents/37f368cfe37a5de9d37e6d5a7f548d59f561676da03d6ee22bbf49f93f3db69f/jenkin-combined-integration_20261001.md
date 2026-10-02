# JENKIN combined integration — S2 documents + L2 engine + preview launcher

Date: 2026-10-01 (Europe/Kyiv) · Branch `integration/jenkin-combined-20261001` (pushed; **not merged into
`main`, no PR, not deployed**) · Stable worktree `/Users/yurasachenko/LifeOS/LifeOS_combined` (owner-requested;
keep it — it is the everyday preview checkout).

## 1. Inputs (verified live before merging)

| Input | Tip | Remote | Commits over the S1 base |
|---|---|---|---|
| Common base: `feat/jenkin-account-security-20261001` (S1) | `f7a43eb0f8d36342bcb2c8c952900b56edfd123d` | equal | — |
| `feat/jenkin-encryption-documents-20261001` (S2) | `8c54d70f643a4cfd5df6b95f65fff1d6b070b2bd` | equal | 6 |
| `feat/jenkin-loan-engine-l2-20261001` (L2) | `daa8f55088f40773e919d91838b59c76f764d885` | equal | 4 |
| `feat/jenkin-preview-launcher-20261001` | `aa488abb7da11aed0f02acf6d1ab716b869e4877` | equal | 2 |

- **S2 remote discrepancy resolved:** `git ls-remote origin` returns `refs/heads/feat/jenkin-encryption-documents-20261001`
  at `8c54d70…`, identical to the local branch. The earlier failed lookup was not reproducible; the branch is on GitHub.
- S2's worktree `/Users/yurasachenko/LifeOS/LifeOS_encryption-documents` was clean apart from one untracked Finder
  archive (`Outputs/Implementations/jenkin-encryption-documents_20261001.zip`), which was left alone and not
  committed. No S2/L2/launcher process was running; no further push of S2 was needed.
- The S1 base already contains the design history: `5e858bb` (main), `83cba06` (JENKIN calendar/branding integration,
  §87), `727e658` (branding assets), `bb3c147`/`d396fa9` (JENKIN shell handoff). All remain ancestors.
- The reported historical tips (launcher `aa488ab`, L2 `daa8f55`) were still the live tips; nothing later was dropped.
- The canonical checkout (`handoff/jenkin-cloud-20260930`, 37 staged + 3 untracked files from another session),
  its index, the other worktrees and the stashes were not touched.

## 2. Merge graph

Base: the S2 tip (largest input, owns the only migration and the dependency-lock changes).

| Commit | What |
|---|---|
| `19f5c35f9f7011cdc38480738bd5014d7d68a930` | `--no-ff` merge of L2 `daa8f55`. One conflict, `LIFEOS_MASTER_CONTEXT.md` (both appended a section); resolved by keeping both. `module-boundaries.md`, roadmap and decisions auto-merged additively (reviewed) |
| `7a632ac723e81cdecab8419fd7069e62cfa1b657` | `--no-ff` merge of the launcher `aa488ab`. Same single master-context conflict; both sections kept |
| `f525ce2f8b163ffb42a3c6c28335667c1240a83c` | Integration fix: pre-migration backup in the launcher (§3) |
| (docs commit) | This report, master context §92 and renumbering, module boundaries |

No code file conflicted. No whole-file ours/theirs, no rebase, no force-push, no source reset.

- **Migrations:** single head `20261001_0012` (S2). L2 and the launcher add none. Chain unchanged:
  … `20260930_0009` → `20261001_0010` → `20261001_0011` (S1) → `20261001_0012` (S2).
- **Dependency locks:** only S2 changed `requirements.lock` / `requirements-dev.lock` (`cryptography==50.0.2`,
  `pypdf==6.19.0`); L2 is pure standard-library Python; `package-lock.json` unchanged by every input.
- **Master-context numbering:** S2 and the launcher both wrote "89"; L2 was deliberately unnumbered. Final order:
  §89 S2, §90 L2, §91 launcher (each renumbered heading says so), §92 this integration. The launcher's own report
  still says "§89" — historical record, not edited.

## 3. Integration fix — backup before migrating a preview database

Gap found in review: the launcher migrated an existing preview database forward with no backup, while the owner's
standing rule is "before migrating meaningful existing data, prepare a restricted backup and preserve the keys".

`scripts/preview/launcher.py::backup_before_migration` now runs whenever the plan is `upgrade` and the database
already has an `alembic_version`:
- `pg_dump --format=custom` into `~/.jenkin-preview/backups/<db>-<from>-to-<head>-<time>/database.dump`;
- a byte-identical copy of `secrets/keyring-<db>.json` (when present) next to it;
- `manifest.json` with a restore command; directory 0700, files 0600; never pruned;
- **fail closed:** no `pg_dump`, a failed or empty dump → the run stops before migrating.

An empty (new) database is migrated without a backup; a current database is not migrated, so no backup is taken.
README "Where things live" and "Safety rules" updated. Module boundaries gained a launcher block.

## 4. Verification (exactly what was run on the merged tree)

Databases: a disposable `lifeos_combined_test` (created, used, dropped) — `lifeos_test` and `lifeos_dev` were not
connected to. Preview databases only through the launcher.

| Check | Result |
|---|---|
| `apps/api: python -m pytest` (`PGTZ=UTC`) | **1323 passed, 1 skipped** (= S2 912 + L2 411) |
| same with `PGTZ=Europe/Kyiv TZ=Europe/Kyiv` | **1323 passed, 1 skipped** |
| L2 engine alone, `pytest tests/finance_calc` | **411 passed** |
| `ruff check .` (apps/api) and on `scripts/preview/*.py` | All checks passed |
| `alembic heads` / `alembic current` (disposable DB) | `20261001_0012 (head)` / `20261001_0012 (head)` |
| Round trip on the empty disposable DB: `downgrade 20260930_0009` → `upgrade head` | 3 + 3 steps, PASS. Refusal of a destructive downgrade with documents present is covered by S2's tests (passed) and was not forced on any real data |
| `apps/web: npm test` | **895 passed** (59 files) |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| `git diff --check` | PASS |

### 4.1 Launcher / preview (owner command from the combined checkout)

| Scenario | Result |
|---|---|
| `scripts/preview.sh --db-suffix personal`, first run | Source = `LifeOS_combined` @ integration branch, tree clean; created `lifeos_preview_personal`, migrated empty → `0012`, generated `keyring-lifeos_preview_personal.json` (0600), production build, real API + `vite preview` on 127.0.0.1:4710/8710, health OK direct and through the proxy, browser opened at `/?bootstrap=1`, token copied to the clipboard |
| Ctrl+C | SIGINT to the launcher, and separately SIGINT to the whole process group (what a terminal sends): "Preview stopped", exit 0, both services gone, ports free |
| Restart | "schema is current (0012)", "using existing keyring" (SHA-256 unchanged), cached build reused, no migration → no backup, no tests, no reset |
| `status` / `stop` | PASS |
| Backup path (scratch state home, disposable clone of the synthetic QA database at `0009`) | Backup written before `0009 → 0012`; dump lists 33 table-data entries in `pg_restore --list`; keyring copy byte-identical, 0600; the clone was dropped |

The personal database was **not** bootstrapped: no account exists in it, so the owner's first launch shows the
setup page. Account/document persistence was verified on a separate synthetic database (below), as the brief allows.

### 4.2 Real browser (Chrome, production build, real API, `--db-suffix combinedqa`)

| Scenario | Result |
|---|---|
| Bootstrap page | Renders (JENKIN Editorial logo, RU). **Submitting it was not browser-verified:** reading the stored bootstrap token into the session was refused by the agent permission policy. Bootstrap stays covered by backend tests |
| Login / logout / account security | Two synthetic accounts were inserted into the QA database (in-session passwords, `@example.com`); sign-in and sign-out through the UI; sidebar shows the bound account; requests without `X-LifeOS-Account` → 428; claiming another account id → 409 |
| Tasks | Filter dropdown (all/today/overdue/routine/important/**waiting**/done); task created through quick-add, "saved to server" |
| Calendar | Month grid with the Kyiv day (1 Oct) marked; History control present |
| Documents | Upload (synthetic PNG through the real file input), metadata edit (title + notes), version 2 upload, current/v1/v2 downloads: SHA-256 **equal** to the synthetic originals; `Content-Type` verified type; no title/note/filename strings in a `pg_dump` of the document tables (0 matches); inline delete confirmation mentioning backups → document, both versions and both blobs removed (0/0/0) |
| Cross-account isolation | Account B: 0 documents, no A tasks; A's document, metadata and version content → 404 |
| Restart persistence | Launcher stopped (process-group SIGINT) and restarted: same keyring; B's session still valid; A's task, title, notes, revision 3 and both versions' bytes unchanged |
| Matrix (iframes, real reload per config) | **176 configurations**: Documents 5 widths (1440/1024/768/390/320) × RU/UK × current/DejaVu × dark/light/paradise-day/paradise-night = 80; Tasks, Calendar, Home 1440/390 × same 16 = 96. **0 horizontal overflow**; correct locale in every frame; **0 text < 12 px inside route content** on Documents, Tasks and Calendar |
| Console errors / API log errors | none / none |

Pre-existing finding (not caused by this integration, not changed): Home's empty-state hints
`.stat-context.is-empty` use `--text-xs` (11 px), 7 elements in every Home config; present in the S1 base
(`apps/web/src/styles/home.css`). The JENKIN shell's 11 px mono eyebrow/counter is part of the approved shell design.

Not verified: bootstrap form submission in the browser (above); clicking the browser's own file-save for downloads
(the same endpoints were fetched and hashed in-page instead); Firefox/WebKit; screen readers; real SMTP; a missing
PostgreSQL server for the launcher.

## 5. Exact encryption scope (unchanged from S2)

Server-side encryption at rest — **not end-to-end, not zero-knowledge**. AES-256-GCM envelope per document version
and per metadata write; DEKs wrapped by versioned KEKs from a restricted JSON keyring. Encrypted: file contents,
original file names, titles, notes, per-version digests. Readable in the database: ids, owner, version numbers,
verified type, size, timestamps, revision, KEK id. **Not encrypted:** snapshots (tasks, calendar, notes, health,
finance operations), analytics tables, browser storage, the account export's temporary file. The running API or
anyone with the keyring can decrypt. Production activation is BLOCKED_EXTERNAL on key custody/escrow/backup
retention (E-06) and capacity (E-11).

## 6. L2 status (stated plainly)

L2 is a **calculation library only**: `apps/api/app/services/finance/calc` with its tests. No table, route, UI,
extraction, chart or reminder uses it, and this integration did **not** wire it into any product surface. Loan
persistence, confirmed-term mapping, document extraction, charts and reminders remain future slices.

## 7. Everyday preview

```
/Users/yurasachenko/LifeOS/LifeOS_combined/scripts/preview.sh --db-suffix personal
```
→ http://127.0.0.1:4710/ (falls back to the next free port pair if 4710/8710 are taken, and says so).
Database `lifeos_preview_personal`; keyring `~/.jenkin-preview/secrets/keyring-lifeos_preview_personal.json`
(back it up — without it the documents cannot be read); bootstrap token `scripts/preview.sh token`.
Pre-migration backups: `~/.jenkin-preview/backups/`.

## 8. State left on this machine

- Worktree `/Users/yurasachenko/LifeOS/LifeOS_combined` (own `apps/api/.venv`, `apps/web/node_modules`) — keep.
- `lifeos_preview_personal` (empty schema at `0012`, no account) and its keyring — the owner's.
- `lifeos_preview_combinedqa` (two synthetic `@example.com` accounts, one synthetic task, no documents) and its
  keyring — synthetic QA, left for the owner to drop with the earlier QA databases
  (`lifeos_preview`, `_canon`, `_r5e858bb`, `_s2qa`, `_s2ref`), none of which were touched.
- `lifeos_dev` and `lifeos_test` were not connected to.

## 9. Remaining limitations and next slice

Not merged into `main`, not deployed; S2 production activation blocked on E-06/E-11; plaintext data outside
documents (see the S2 plaintext-data plan); passkeys, Diia/BankID, bank connectors not started; L2 not exposed.

**Next slice: L1 / F1 — finance persistence and confirmed-term mapping** (obligations, versioned contractual
terms, observations and payments in minor units with explicit currency; documents linked with provenance; every
term user-confirmed and mapped into the L2 input schema), **followed by L3 intake** (document → extraction →
concise editable review) on top of S2's document ids and encryption.
