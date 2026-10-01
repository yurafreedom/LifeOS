# JENKIN — completeness and hosting backlog (plan)

Date: 2026-10-01 20:55 (Europe/Kyiv). Baseline `69477c9` (`integration/jenkin-combined-20261001`).
Evidence: `Outputs/Discoveries/jenkin-completeness-hosting-discovery_20261001-205516.md`. Status: **PROPOSED**.
Nothing here is approved or started unless it cites an existing approval.

## 0. Rules for this backlog

**Existing IDs keep their plans.**
- Finance: L1–L8 (`jenkin-loan-document-plan_20261001-163647.md`) and F1–F5.
- Security: S2 follow-ups, I1, I2.
- GTD: G3–G6 (`lifeos-gtd-completion-plan_20260930-131011.md`).
- Product: the design-plan items (Inbox, Events, smart capture, Documents metadata, phone checklist).

This backlog only orders them and adds slices for gaps that **no plan covers**:
- **U-** product usability gaps;
- **A-** account gaps;
- **H-** hosting.

**No duplicates.**
- Currency, `fin_accounts`, the Finance Overview tab and obligations stay in **F1/L1**.
- Reminders stay in **L6**.
- Bank work stays in **F4/F5**.

**Owner decisions** are named with the prefix **Q-** so they do not collide with the OD-, U- and E- registers.

**Concurrent work.** `feat/jenkin-usability-followup-20261001` exists with no commits and an unknown scope. Before
starting U1/U2, the owner should confirm that they are not already that branch's scope.

**Standing constraints (AGENTS.md):**
- Discovery → Plan → Implementation for each slice.
- Agents migrate only `lifeos_test` or a disposable `*_test` database, plus the owner-authorized `lifeos_preview*`
  via the launcher.
- Never migrate `lifeos_dev`.
- No new dependency or migration without the slice's approval.

## 1. Slices

Size: **S** ≤ 1 day, **M** 1–3 days, **L** > 3 days (agent effort, rough).

### 1.1 Correctness and truthfulness fixes (no decision needed)

**U0 — small truthfulness defects** (S, frontend only, no migration):
1. The Tasks category sort uses the category the user chose (`tagLabel`, falling back to `tag`); add a regression test.
2. Finance «в итогах» either filters to the labelled month in Kyiv time, or the label stops claiming a month.
   - Pick the variant that matches the existing AA finance month semantics.
   - If the two disagree, stop and ask (**Q-U0-1**).
3. Remove the dead Home-seed `onOpenTask` wiring and its stale comments.
4. Make the hard-coded RU strings in Medications, Finances and `window.prompt` localisable, at RU/UK parity.

Each item is independent and can be its own commit.

### 1.2 Everyday usability (frontend; snapshot-additive, no migration)

**U1 — create the missing life records** (M). Depends on owner decisions:

| Decision | Question |
|---|---|
| **Q-U1-1** | Habit model: replace the dateless `week[7]` with dated completions (recommended: `completions: ['YYYY-MM-DD']`, Kyiv day, streak derived, legacy `week` read-only and never backfilled) or keep the weekly grid. |
| **Q-U1-2** | Minimal medication fields at creation (name, form, dose, time slots; inventory optional). |
| **Q-U1-3** | Pet profile minimal fields; what "feed now", meal history and restock mean (or hide them until defined, rather than fix 7000 g). |

Scope:
- add, edit and archive a habit;
- add a medication through the existing `MedConfigDrawer`;
- create a pet profile;
- empty states with a first action;
- replace dead buttons with working actions or remove them.

**Excluded:** Health (U3), reminders, notifications.

**U2 — navigation and preferences** (S–M):
- **Locale persistence:**
  - device-local, mirroring `lifeOsTheme` / `lifeOsFont`;
  - pre-paint safe;
  - **Q-U2-1**: device-local vs account profile — recommended device-local first.
- **Mobile LIFE drawer:** "more" opens a sheet with every route in `LIFE_ROUTES`.
- **Placeholder routes** `monthly` / `annual` / `investments`:
  - **Q-U2-2**: hide them until planned (recommended) or keep them labelled "planned".
  - Must not be confused with System Review monthly/annual.

**U3 — Health** (Discovery only first). There is no requirement or plan, so there is nothing to build until the owner
defines scope (**Q-U3-0**). Health data is sensitive, so it should follow the plaintext-data plan §1.

**U4 — first-run orientation** (S, after U1/U2): an honest first-run panel on Home linking to the first action of each
module. No fake data and no tour library.

**GTD (existing plan, unchanged):**
- **G3** reference edit/delete (S): ready, with one tiny decision (no «вернуть во входящие» recommended).
- **G4 / G5 / G6:** blocked on **OD-G4-0..3**, **OD-G5-0** and **OD-G6-0**.
- The stale «недельный обзор задач» copy is fixed together with OD-G5-0 (point it to G5, or rewrite it).

**Tasks lifecycle gap** (S, **Q-T-1**): expose «закрыть без выполнения» and «в архив» in the Tasks detail for undated
tasks, reusing the Calendar closure semantics (OD-1). The decision is only whether undated closure is allowed.

**Waiting direct create** (S, **Q-W-1**): a "new waiting" action outside Clarify. It touches the Clarify-only creation
assumption, so it needs a decision.

**Goals and projects maintenance** (S–M, **Q-GP-1**):
- goal edit, delete and progress (manual percentage, or a derived one);
- project rename, delete and un-archive.

These need semantics decisions: Project ≠ Goal stays frozen.

**Design-plan items (unchanged order and decisions):** Inbox → Events (+ DST rule §85) → smart capture.

### 1.3 Account completion (needed before inviting others)

**A1 — account deletion UI and owner rules** (M, backend + frontend; a migration only if a re-auth audit field is
needed). Decisions:
- **Q-A1-1:** require the current password (recommended yes).
- **Q-A1-2:** the owner cannot delete the account while members exist (recommended), or ownership transfers first.

Danger Zone flow:
- export reminder;
- typed confirmation;
- re-auth;
- erasure;
- logout.

Tests for cascade completeness against `EXPORT_TABLES`.

**A2 — email change with re-verification** (M; likely a migration for `pending_email` and a token purpose). This is
the APPROVED S1 follow-up. Rules:
- the old address stays in force until the new one is verified;
- the old address is notified;
- other sessions are revoked;
- it is throttled.

It needs mail (E-01) to work in production. Locally, the `file` mail backend.

**A3 — demo-seed detector** (S, APPROVED S1 follow-up): read-only listing for a manual clean-up (D-06).

**I1a — recovery codes** (M, migration). APPROVED in I1, and recommended first by the design plan §7: shown once,
stored hashed, single-use, throttled, audited. Passkeys/TOTP (I1b) follow as their own slice.

### 1.4 Finance (approved plan; order only)

- **L1** (next per plan, not started) → **L3** (needs verified S2 interfaces, now available on the integration
  branch, and decisions **U-2, U-3, U-4, U-5, U-7**) → **L4** → **L6**.
- **L5** stays BLOCKED_EXTERNAL.
- **L7** and **L8** come later.
- **F1** items that L1 does not name (`fin_accounts`, the Overview tab) should be folded into L1's Discovery
  explicitly, or recorded as F1-remainder, so nothing falls between them.
- L3 introduces system dependencies (OCRmyPDF/Tesseract), which affect hosting packaging (H1). Its Discovery must state
  the image and runtime impact.
- **Transaction delete, income and full edit** belong with F1's "Transactions" tab. They are a candidate **F1-T**
  slice after L1, not part of U0.

### 1.5 Hosting

**H0 — external facts and decisions** (owner; no code). The full list is in §3.

**H1 — production packaging** (M, repo-only, no provisioning). The reference deployment is in-repo:
- a reverse-proxy config template serving `apps/web/dist` and proxying `/api`;
- TLS by the proxy;
- security headers: CSP after an inventory of inline scripts and fonts, HSTS without apex `includeSubDomains`,
  `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy;
- a process definition (systemd unit and/or a container image; **Q-H1-1**);
- a uvicorn production command (1 worker; proxy-header flags per runbook §2);
- a complete `.env.production.example` with no values for secrets;
- a logging configuration (structured stdout, no personal data);
- a source-map decision (**Q-H1-2**);
- a `config-check` style startup validation runbook.

No new runtime dependency is expected. A container base image or a proxy choice is a decision, not a dependency.

**H2 — encrypted backup and verified restore drill** (M, tooling + runbook; no app or schema change):
- a backup command:
  - takes `pg_dump -Fc` of a named database;
  - encrypts it to an off-host recipient key, so the backup host cannot decrypt;
  - writes a manifest (database, Alembic revision, size, checksum, keyring KEK ids — never key material);
- retention pruning;
- a restore drill that:
  - restores into a disposable `*_restored` database;
  - checks the Alembic revision and row counts;
  - runs `documents-verify --deep` with a separately supplied keyring;
  - drops the restored database.

Works for `lifeos_preview_personal` locally (owner-run) and later for production. Decisions:
- **Q-H2-1:** encryption tool — `age` CLI recommended, a new system tool, so it needs approval.
- **Q-H2-2:** retention — for example 7 daily, 4 weekly, 6 monthly; it must be compatible with KEK retirement
  (runbook §6).

**H3 — operations** (S–M):
- **Housekeeping:** a scheduled housekeeping command for sessions, throttle rows and audit events (moved out of the
  login path, which stays as a fallback).
- **Health:** a readiness probe distinct from liveness, only if needed.
- **Monitoring runbook:** uptime, certificate expiry, disk and database growth, backup success alert.

**H4 — security review gate** (S agent work + external): a threat-model page, read-only `pip-audit` / `npm audit`
reports, a header and TLS checklist, and the independent-review scope from discovery §2.7. Findings become their own
fix slices.

**H5 — AA production guard re-verification** (S, decision **Q-H5-0**): prove export and erasure coverage for every
`aa_*` table, then either keep analytics off in hosted builds or relax the guard deliberately.

**H6 — release path** (owner-driven):
- PR `integration/jenkin-combined-20261001` → `main` (merge commit);
- the first `released` entry in `releaseNotes.json` with a real date;
- a tag;
- deployment from that tag.

**H7 — staging then production rollout** (BLOCKED_EXTERNAL on H0). See the deployment prompt in §6.2.

## 2. Dependencies and priority

```
Local value now:     U0 ─► U2 ─► U1 (Q-U1-*) ─► U4         G3 (anytime)
Data safety:         H2 (local personal DB first) ─► H1 ─► H3
Finance (approved):  L1 ─► L3 (U-2..U-7) ─► L4 ─► L6
Before inviting:     A1, A2 (needs E-01 in prod), I1a, U2-drawer, plaintext-plan decision
Before public:       H0 facts ─► H1 + H2 + H3 + H4 + H5 + H6 ─► H7 staging ─► H7 production
Decision-blocked:    G4/G5/G6 (OD-*), U3 Health (Q-U3-0), Events/Inbox (design plan), L5 (E-11 provider)
```

| Priority | Slice | Why |
|---|---|---|
| P0 | L1 (in plan) | Approved next finance slice. |
| P0 | H2 | The owner's real data has no backup today; it is also a hosting prerequisite. No external facts needed. |
| P1 | U0, U2, G3 | Small and decision-light; they remove daily friction. |
| P1 | H1, H3, H6 | In-repo hosting readiness; no provisioning. |
| P1 | U1 | Habits, medications and pet are unusable in an empty account; needs Q-U1-*. |
| P2 | A1, A2, I1a, H4, H5 | Required before inviting others or exposing the app publicly. |
| P2 | L3 → L4 | Approved finance outcome; heavy, with open U- decisions. |
| P3 | U4, Q-T-1, Q-W-1, Q-GP-1, G4–G6, Events, Inbox, U3 | Decision-gated or lower value. |

## 3. External facts and credentials needed

These are named here, but the **values must never be sent in chat or written into reports or Git**. Secrets go
directly into the host's secret store or a 0600 environment file, by the owner.

| ID | Fact / credential | Kind | Where it goes |
|---|---|---|---|
| H0-1 | Hosting provider and region (data residency for health and finance data) | decision | plan only |
| H0-2 | Authoritative DNS provider for `sachenkolabs.tech`; existing apex MX, SPF, DMARC and CAA records (existence only) | fact | plan |
| H0-3 | Public IP or target hostname for the `jenkin` record (after provisioning) | fact | DNS, by the owner |
| H0-4 | TLS: proxy auto-ACME (recommended) or provider-managed | decision | H1 config |
| E-01 | SMTP host, port, security mode; username/password | fact + **secret** | host secret store |
| E-01 | Sender address and its SPF include / DKIM records / DMARC policy | fact | DNS, by the owner |
| E-02 | Public app URL (proposed `https://jenkin.sachenkolabs.tech`) | fact | `LIFEOS_PUBLIC_APP_URL` |
| E-03 | Proxy topology (same-host proxy recommended; any CDN in front?) | fact | runbook §2 table |
| E-06 | Keyring location, escrow holder, rotation authority | decision + **secret** | host file 0400 / offline escrow |
| E-11 (security) | Document limits and memory/disk headroom | decision | `LIFEOS_DOCUMENT_*` |
| H0-5 | Backup storage location (off-host), retention, backup recipient public key (the private key held offline by the owner) | decision + **secret** | H2 config |
| H0-6 | PostgreSQL: managed or self-hosted; version ≥ 16; database name and role | decision; password is a **secret** | `LIFEOS_DATABASE_URL` in the secret store |
| H0-7 | Bootstrap token for the production database (≥ 32 characters, generated on the host) | **secret** | host secret store; never shared |
| H0-8 | Monitoring and alert destination (email or other) | decision | H3 |
| E-04 | Whether and how the owner's existing data moves (`lifeos_dev` at `20260721_0001`, or `lifeos_preview_personal`) into production | decision | owner-run |
| Q-H5-0 | Analytics in the hosted build: on or off | decision | build and environment |
| H0-9 | Independent reviewer: who and what scope | decision | H4 |

## 4. Recommended next slice after L1: **H2 — encrypted backup and verified restore drill**

**Why H2 rather than L3 or U-slices:**
1. **Real data at risk.**
   - Once the owner bootstraps `lifeos_preview_personal` and L1 stores real obligations, the only copy is one
     PostgreSQL database plus one keyring file on one Mac.
   - Losing either is unrecoverable for documents.
   - No scheduled backup exists.
2. **No blockers.** H2 needs no external facts, no migration and no application change, and it is reused unchanged
   for hosting (H7 cannot start without it).
3. **No overlap.** It does not touch L1's tables or any UI the usability-followup branch might own.
4. **L3 is not ready to start immediately.** It still needs owner decisions U-2/U-3/U-4/U-5/U-7 and a heavy
   system-dependency choice. Running **L3 Discovery in parallel** (read-only) to collect those decisions is
   recommended.

If the owner prefers a user-visible slice instead, the next best is **U0 + U2** (small, decision-light).

## 5. Things this plan does not authorise

- Provisioning any service.
- DNS or registrar access.
- Purchasing anything.
- Migrating `lifeos_dev`.
- Merging into `main`.
- Deploying.
- Reading secrets.

## 6. Proposed prompts

### 6.1 Implementation prompt — H2 (run after L1, or in parallel if the owner prefers)

```text
Task: JENKIN H2 — encrypted database backup and verified restore drill (tooling + runbook only).

Read AGENTS.md, LIFEOS_MASTER_CONTEXT.md (§89–§93), Outputs/Runbooks/jenkin-document-keys-runbook.md,
Outputs/Discoveries/jenkin-completeness-hosting-discovery_20261001-205516.md §2.5 and
Outputs/Plans/jenkin-completeness-hosting-backlog_20261001-205516.md §1.5 H2. Verify live Git state first:
record origin/main, the latest integration branch tip, and whether L1 has landed; base the branch on the
latest completed integration commit and name it feat/jenkin-backup-restore-h2-<date>. Work in the canonical
checkout only if it is clean; otherwise stop and ask whether an isolated worktree is authorised.

Scope:
1. A backup command under scripts/ (Python 3.11 stdlib + pg_dump/pg_restore, like scripts/preview/):
   pg_dump -Fc of ONE named database; refuse lifeos_dev; refuse any database name not explicitly passed;
   stream the dump into an encryptor writing to a recipient PUBLIC key (the decrypting key never lives on the
   backup host); write a manifest (database, alembic revision, created_at with offset, byte size, SHA-256 of the
   ciphertext, active/retired KEK ids from `keyring-check` output — never key material); files 0600 in a 0700
   directory; atomic rename; never overwrite.
2. Retention pruning by an explicit policy (daily/weekly/monthly counts) with a dry-run default; never prune
   the newest successful backup; print what would be removed.
3. A restore drill command: decrypt with an explicitly supplied identity file, restore into a NEW disposable
   database named <db>_restored_<timestamp> on loopback, verify alembic revision equals the manifest, report
   row counts for users, user_snapshots, documents, document_versions and aa_* tables, run
   `python -m app.cli documents-verify --deep` against the restored DB with a separately supplied keyring
   path, then drop the restored database (keep it only with --keep). Refuse to restore over an existing DB.
4. Runbook Outputs/Runbooks/jenkin-backup-restore-runbook.md: local use for lifeos_preview_personal, later
   production use, key separation (backup identity vs S2 keyring vs DB credentials), retention vs KEK
   retirement (key runbook §6), RPO/RTO statement, what backups expose (snapshots/AA are plaintext inside the
   encrypted dump), and the drill cadence.

Decisions to obtain BEFORE coding (stop and ask): Q-H2-1 encryption tool (recommended: `age` CLI as an
optional system tool detected at runtime, clear error if absent; no Python dependency added) and Q-H2-2
retention defaults. If the owner declines a new tool, propose the alternative and wait.

Constraints: no application code, no migration, no new Python/npm dependency, never read or print the
bootstrap token, keyring contents, DB passwords or backup identities; tests use lifeos_test or a disposable
*_test database only and synthetic data; never touch lifeos_dev or lifeos_preview_personal (the owner runs
the first real backup). Validation: unit tests for manifest/retention/refusals; an end-to-end drill on a
disposable database with synthetic documents and a generated test keyring and test age identity in a temp
directory; ruff on new Python; git diff --check. Write
Outputs/Implementations/jenkin-backup-restore-h2_<timestamp>.md with exact commands and honest NOT RUN items,
add a master-context section, update module-boundaries if a tooling boundary is added. Commit and push the
feature branch; no merge, no PR unless asked.
```

### 6.2 Deployment prompt — first staging then production (use only when H0 facts exist and H1/H2/H3/H4/H6 are done)

```text
Task: JENKIN first deployment to jenkin.sachenkolabs.tech — staging rehearsal, then production — strictly
following an owner-approved checklist. This task is authorised to act on the hosting account ONLY for the
steps the owner explicitly approves in this conversation; it must not buy services, change registrar
settings, or touch DNS unless the owner names the exact record and approves it at that step.

Preconditions to verify and report first (stop if any is missing):
- The release to deploy is a tag on main produced by H6 (merge commit, released entry in releaseNotes.json,
  CHANGELOG check passing). Record its SHA.
- H1 packaging, H2 backup/restore, H3 operations and H4 review findings are merged; list open H4 findings and
  get the owner's explicit accept/fix decision for each.
- Owner has supplied (as facts, not secrets in chat): hosting provider/region, DNS provider, proxy topology
  (E-03), sender address and that SPF/DKIM/DMARC records are published (E-01), public URL (E-02), keyring
  location and escrow holder (E-06), document limits (E-11), backup location/retention and recipient public
  key (H0-5), database choice (H0-6), analytics on/off (Q-H5-0), alert destination (H0-8).
- Secrets (DB password, SMTP password, bootstrap token, keyring, backup identity) are placed by the owner
  directly into the host secret store / 0600 environment file. Never ask for them in chat, never echo,
  log, commit or copy them into reports.

Steps (each reported with evidence; stop on the first failure):
1. Staging on a separate host name chosen by the owner (or a non-public port), synthetic data only:
   install from the tag; LIFEOS_ENVIRONMENT=production; alembic upgrade head on an EMPTY database;
   start; verify config refusals (insecure cookie, wildcard host, http public URL) by starting with a bad
   value once; healthz; TLS grade and headers (HSTS without apex includeSubDomains, CSP, frame-ancestors,
   no-store on /api); __Host- cookie attributes; CSRF refusal from a foreign Origin; X-Forwarded-For spoof
   test per mail/proxy runbook §2; SMTP: password reset and verification mail to an owner-chosen test
   mailbox; documents upload/download byte-equality if enabled; H2 backup + full restore drill including
   documents-verify --deep; rollback rehearsal (redeploy previous artefact + restore pre-migration backup).
2. Production: owner approves the DNS record; deploy the same artefact; empty database; owner performs
   bootstrap themselves; first backup + restore drill; monitoring and alerts confirmed firing once.
3. Owner data: only if the owner decided E-04, the owner runs the export/import or migration path; the agent
   provides commands, does not handle the data, and never migrates lifeos_dev itself.

Rollout/rollback rules: one uvicorn worker initially; migrations forward-only — rollback = previous artefact
plus restore from the pre-migration backup (0012 downgrade refuses with documents); keep the previous
artefact and the pre-deploy backup until the next successful drill.

Report: Outputs/Implementations/jenkin-deployment-<timestamp>.md with tag SHA, every check and result,
anything NOT RUN, open risks (plaintext snapshots/AA at rest, H-04 browser storage, synchronous mail, NAT-
shared throttles), and the next review date. No secrets, personal data or private hostnames beyond the
public URL.
```
