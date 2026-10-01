# JENKIN — completeness and hosting backlog (plan)

Date: 2026-10-01 20:55 (Europe/Kyiv). Baseline `69477c9` (`integration/jenkin-combined-20261001`).
Evidence: `Outputs/Discoveries/jenkin-completeness-hosting-discovery_20261001-205516.md`. Status: **PROPOSED**.
Nothing here is approved or started unless it cites an existing approval.

**Revised 2026-10-01 21:34 (Europe/Kyiv)** at the owner's request, as a documentation correction. This revision does
not authorise deployment or any slice. Changed:
- concurrent work and the U0/U2 coordination (§0, §1.1–§1.2);
- the database policy for restore tests, and the default isolated worktree for H2 (§0);
- reconciled GTD decision statuses (§1.2);
- H2: the existing launcher backup, scheduling, success verification and historical KEKs (§1.5, §6.1);
- mandatory gates vs recommendations, by deployment mode (§2);
- which facts may be discussed (§3).

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

**Concurrent work** (rechecked 2026-10-01 21:34 +0300; discovery §0):
- `feat/jenkin-usability-followup-20261001` has pushed `03c00b8` and `eec7aeb` (report
  `jenkin-usability-followup_20261001.md`, master context §94). It is unmerged. Its scope:
  - persisted RU/UK locale;
  - the sync chip's layout;
  - 12 px Home hints;
  - verification of the launcher backup restore.
- **L1:**
  - at 21:34, no L1 branch was visible;
  - at **21:38 +0300**, a local branch `feat/jenkin-finance-l1-20261001` had appeared, in the worktree
    `LifeOS_finance-l1`, at `69477c9` with no commits and not pushed.
  - Treat L1 as **active in another session**. H2 must not touch finance tables, migrations or `apps/api`.
- **Before scheduling any slice:** recheck branches, worktrees and the newest master-context section. Do not start a
  slice that overlaps a branch with recent commits until that branch's scope is known.

**Standing constraints:**
- Discovery → Plan → Implementation for each slice.
- **Database policy, as written:**
  - `AGENTS.md` says "Database validation may use `lifeos_test` only."
  - `apps/api/tests/conftest.py` refuses any database whose name does not end in `_test`.
  - The preview launcher accepts only `lifeos_preview_<suffix>`. It refuses `lifeos`, `lifeos_dev`, `lifeos_test`,
    `postgres` and the templates.
  - Therefore agent validation, including restore tests, uses `lifeos_test`.
  - Earlier text in this backlog allowed "a disposable `*_test` database" for agents. AGENTS.md does not say that,
    so that wording is withdrawn. Whether to widen AGENTS.md is an open question (**Q-DB-1**, §1.5).
- Never migrate or restore into `lifeos_dev` or `lifeos_preview_personal`. The owner runs anything against their
  real data.
- No new dependency or migration without the slice's approval.
- **Isolated worktrees:** the owner has authorised parallel isolated development (2026-10-01). Slices that can run
  alongside other active work — **H2 by default** — use their own worktree under `/Users/yurasachenko/LifeOS/`
  without asking again. This is an explicit owner authorisation, which AGENTS.md's worktree rule requires.

## 1. Slices

Size: **S** ≤ 1 day, **M** 1–3 days, **L** > 3 days (agent effort, rough).

### 1.1 Correctness and truthfulness fixes (no decision needed)

**U0 — small truthfulness defects** (S, frontend only, no migration).
- Items 1–2 are **static findings awaiting reproduction** (discovery §1.6). Each must first be reproduced in a running
  build on the then-current integration tip. Drop an item that does not reproduce.
- **Coordination:** base U0 on whichever integration tip contains `03c00b8` (or on that branch once integrated). It
  touches different files from the usability-followup scope, but RU/UK string parity work (item 4) must merge on
  top of that branch's `ru.js` / `uk.js` changes.

Items:
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
- **Locale persistence — DONE elsewhere; removed from U2.**
  - `03c00b8` on `feat/jenkin-usability-followup-20261001` already implements it: device-local `lifeOsLocale`,
    pre-paint `<html lang>`, and login/setup following it.
  - **Do not start a duplicate implementation.**
  - Former Q-U2-1 is settled by that owner-requested implementation (device-local). An account-level locale
    would be a later, separate request.
- **Mobile LIFE drawer:** "more" opens a sheet with every route in `LIFE_ROUTES`.
- **Placeholder routes** `monthly` / `annual` / `investments`:
  - **Q-U2-2**: hide them until planned (recommended) or keep them labelled "planned".
  - Must not be confused with System Review monthly/annual.
- **Coordination:** the mobile drawer touches the phone layout that `03c00b8` just changed (the sync chip row under
  the top bar below 1024 px). Start U2 from a base that contains `03c00b8`, and re-verify the chip contract in
  module-boundaries.

**U3 — Health** (Discovery only first). There is no requirement or plan, so there is nothing to build until the owner
defines scope (**Q-U3-0**). Health data is sensitive, so it should follow the plaintext-data plan §1.

**U4 — first-run orientation** (S, after U1/U2): an honest first-run panel on Home linking to the first action of each
module. No fake data and no tour library.

**GTD decision status, reconciled with existing owner approvals** (master context §40, §79, §82; GTD plan §7;
design plan §11). Approvals that are already granted are **not** asked again.

| Decision | Status | Source |
|---|---|---|
| OD-1: task outcomes «Выполнить» / «Закрыть без выполнения» / «В архив», mutually exclusive; restore keeps the id | **APPROVED** 2026-09-29 | master context §40 |
| OD-G1-1..3: Waiting resolution model, person entered in Clarify, no follow-up date | **APPROVED** 2026-09-30 (G1 implemented) | §79 status update, §81 |
| OD-G2-1: «сегодня» = Kyiv `schedule.date`; undated tasks only under «все» | **APPROVED** 2026-09-30 (G2 implemented) | §82 |
| G3: whether to add «вернуть во входящие» (re-clarify) | **open, but small**. The plan recommends "no". Implement without it unless the owner says otherwise. | GTD plan §4 |
| OD-G4-0..3: task↔project link and next action | **open** — requirement not accepted | GTD plan §7; design plan §11 |
| OD-G5-0: GTD Weekly Review | **open** — requirement not accepted | same |
| OD-G6-0: Focus Now / Engage | **open** — requirement not accepted | same |

- **G3** reference edit/delete (S): ready.
- **G4 / G5 / G6:** blocked on the open OD-G4-0..3, OD-G5-0 and OD-G6-0 only.
- The stale «недельный обзор задач» copy follows OD-G5-0: point it to G5, or rewrite it.

**Tasks lifecycle gap** (S, no new decision; a static finding awaiting reproduction):
- Expose «закрыть без выполнения» and «в архив» in the Tasks detail for undated tasks.
- OD-1 already defines these outcomes with no date condition, and OD-G2-1 already places undated tasks under «все».
  The former **Q-T-1 is withdrawn**: this is a UI exposure of approved semantics.
- **Stop and ask only** if History (which is reached from Calendar) cannot list an undated closure without
  inventing a date for it. That would be a genuine new semantics question.

**Waiting direct create** (S, **Q-W-1**, genuinely open): a "new waiting" action outside Clarify.
- OD-G1-2 approved entering the person **inside Clarify**. It did not decide whether Waiting items may be created
  without a captured note.
- So this is a new question, not a repeat of OD-G1-2.

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

- **L1** (active: worktree `LifeOS_finance-l1` created by 21:38 +0300, no commits yet — recheck) → **L3** (needs verified S2 interfaces, now available on the integration
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

**H2 — scheduled, encrypted, separated backups with verified restore** (M; tooling + runbook; no application or
schema change).

**What already exists, and H2 keeps unchanged.** The preview launcher already backs up automatically before every
migration of an existing database:
- a `pg_dump -Fc`, plus a 0600 copy of the database's existing keyring, with a manifest;
- it fails closed;
- backups go to `~/.jenkin-preview/backups/` and are never pruned (`f525ce2`; discovery §2.5).
- One such backup was restored and decrypted in a real run (usability-followup report §4.6).

H2 does **not** replace, prune or move these pre-migration backups.

**The gap H2 closes:**
- **scheduled** backups, so the recovery point no longer depends on when a migration happens;
- **encrypted** backups;
- **separated** backups: the keyring is never stored next to the dumps;
- **off-host** copies;
- **retention coordinated with KEK retirement**;
- a **success check** on every run;
- a **practised restore**.

**Scope:**
1. **Backup command** (Python 3.11 stdlib with `pg_dump`, like `scripts/preview/`):
   - one explicitly named database; refuses `lifeos_dev`;
   - streams the dump into an encryptor that targets a recipient **public** key, so the backup host cannot decrypt;
   - writes to a configured destination directory, which may be an external drive, a NAS, or a synced folder (the
     data is encrypted);
   - the manifest records: database, Alembic revision, created_at with offset, size, SHA-256 of the ciphertext, and
     the **set of `kek_id`s used by the dumped records** (ids only, read from the same snapshot via
     `pg_export_snapshot` + `pg_dump --snapshot`, or the union of reads before and after the dump);
   - files 0600 in a 0700 directory; atomic rename; never overwrites.
2. **Keyring backup**, separate from dumps. This is event-driven (after every add, activate or retire, per key
   runbook §3), not daily:
   - the keyring is encrypted to the backup recipient (or a second recipient the owner chooses);
   - it goes to a **different destination** from the dumps;
   - its manifest lists KEK ids and check values from `keyring-check`, never key bytes.
3. **Historical-key coverage check:** for every retained dump, every `kek_id` in its manifest must be present in
   the newest keyring backup's manifest (compared by id and check value). Any missing key is reported as **"backup
   not recoverable"**. A backup that uses an older, non-active KEK is **fine** as long as the key is escrowed.
4. **Retention pruning:**
   - an explicit policy, dry-run by default;
   - never prunes the newest successful backup;
   - never touches the launcher's pre-migration backups;
   - prints, for each KEK, the newest retained backup that still needs it. This lets the owner know when
     `keyring-retire-key --confirm-no-backups-need-it` (key runbook §5) is actually true.
5. **Scheduling on macOS (local):**
   - a per-user `launchd` LaunchAgent template (`~/Library/LaunchAgents/…plist`, `StartCalendarInterval`), plus
     install and uninstall commands;
   - no new dependency; `cron` is not used;
   - launchd runs a missed calendar job when the Mac wakes. The job must cope with PostgreSQL not running: fail
     clearly and record the failure, with no silent skip;
   - the owner installs it; the agent only lints the plist (`plutil -lint`) and tests the command it runs.
   - **Production scheduling is deployment-specific** (a systemd timer, the provider's scheduler, or managed-database
     snapshots plus this tool). It is defined in H1/H7, not here.
6. **Backup-success verification on every scheduled run:**
   - `pg_dump` and the encryptor exit 0;
   - the plaintext stream is also fed to `pg_restore --list`, which must succeed (archive structure valid, checked
     without the private key);
   - the ciphertext is non-empty and its SHA-256 is re-read from disk and equals the manifest;
   - the historical-key coverage check (3) passes;
   - the result is written to a status file (last success and last failure, with reason);
   - a `status --max-age <hours>` command exits non-zero when the last success is stale or the last run failed.
   - The launcher may print the same warning at start (an optional small tooling change).
   - A macOS notification (`osascript`, built in) on failure is optional.
7. **Restore drill** (needs the private identity, so it is owner-run on real data):
   - decrypt, then restore into a target whose name ends in `_test`; the target is never the source, never
     `lifeos_dev` and never `lifeos_preview*`;
   - the target must be absent or empty, or the drill must be given an explicit `--replace` (needed for
     `lifeos_test`);
   - check that the Alembic revision equals the manifest;
   - report row counts;
   - verify documents with `app.services.documents.rotation.verify(deep=True)` against a separately supplied
     keyring, or by parsing the CLI output. Judge it as follows:
     - **recoverable** = zero failures;
     - records on non-active keys are reported, **not** failed;
     - the drill never runs `documents-rotate` on a restored copy;
     - `documents-verify` exits 1 for both "on other keys" and "FAILED", so the exit code alone is not the verdict
       (discovery §2.5);
   - drop the target unless `--keep` is passed.
   - **Agent validation** of the drill uses `lifeos_test` (§0 database policy), with synthetic data, a generated test
     keyring with **two** KEKs (one retired after a rotation, to prove historical-key recovery), and a generated
     test age identity, all in a temp directory.
8. **Runbook** `Outputs/Runbooks/jenkin-backup-restore-runbook.md`, covering:
   - local use for `lifeos_preview_personal`;
   - key separation: backup identity vs S2 keyring vs database credentials;
   - retention vs KEK retirement;
   - recoverability vs rotation completion;
   - RPO/RTO;
   - drill cadence;
   - what a dump exposes;
   - how the launcher's pre-migration backups relate to scheduled ones.

**"Regular backup coverage" may be claimed only when all of these are true:**
- the schedule is installed;
- at least one scheduled run has succeeded and passed check (6);
- a restore drill of a **scheduled** backup has passed;
- the staleness check fires on a forced failure.

Until then, report coverage as "tooling available, not yet in regular use".

**Decisions:**
- **Q-H2-1:** encryption tool. `age` CLI is recommended: a system tool detected at runtime, with no Python
  dependency. It needs approval.
- **Q-H2-2:** retention, for example 7 daily, 4 weekly, 6 monthly. It is coupled to KEK retirement: the escrowed
  old KEK lives until the last retained backup that needs it expires.
- **Q-H2-3:** backup destination(s) for dumps and for keyring backups. The dumps and keyring backups must use
  different destinations, at least one off the Mac's internal disk.
- **Q-H2-4:** schedule time and frequency (for example daily at 03:00 Kyiv, catching up on wake).
- **Q-DB-1:** may agents create other disposable `*_test` databases, or is it `lifeos_test` only? AGENTS.md
  currently says `lifeos_test` only, and H2 follows that unless the owner widens it.

**Worktree:** isolated by default (§0). There is no need to ask again.

**H3 — operations** (S–M):
- **Housekeeping:** a scheduled housekeeping command for sessions, throttle rows and audit events (moved out of the
  login path, which stays as a fallback).
- **Health:** a readiness probe distinct from liveness, only if needed.
- **Monitoring runbook:** uptime, certificate expiry, disk and database growth, and a backup-staleness alert
  (it consumes H2's `status --max-age`).

**H4 — security review gate** (S agent work + external): a threat-model page, read-only `pip-audit` / `npm audit`
reports, a header and TLS checklist, and the independent-review scope from discovery §2.7. Findings become their own
fix slices.

**H5 — AA production guard re-verification** (S, decision **Q-H5-0**): prove export and erasure coverage for every
`aa_*` table, then either keep analytics off in hosted builds or relax the guard deliberately.
- **Until H5 is done, the guard (`config.py:122-125`) stays exactly as it is.**
- No other slice may relax it, including as a side effect of hosting work.

**H6 — release path** (owner-driven):
- PR `integration/jenkin-combined-20261001` → `main` (merge commit);
- the first `released` entry in `releaseNotes.json` with a real date;
- a tag;
- deployment from that tag.

**H7 — staging then production rollout** (BLOCKED_EXTERNAL on H0). See the deployment prompt in §6.2.

## 2. Dependencies and priority

```
Local value now:     U0 (reproduce first) ─► U2 (drawer, placeholders; base ⊇ 03c00b8) ─► U1 (Q-U1-*) ─► U4
                     G3 and the Tasks lifecycle exposure (anytime)
Data safety:         H2 (local personal DB first; isolated worktree) ─► H1 ─► H3
Finance (approved):  L1 ─► L3 (U-2..U-7) ─► L4 ─► L6
Private hosted:      H0 facts ─► H1 + H2 + H3 + dependency audit + H6 ─► H7 (staging ─► production)
Public multi-user:   the above + H4 independent review + A1 erasure path + plaintext-plan decision
                     + E-01 mail (for self-service recovery)
Decision-blocked:    G4/G5/G6 (OD-G4-0..3, OD-G5-0, OD-G6-0), U3 Health (Q-U3-0), Inbox (design plan §5),
                     L5 (provider)
```

### 2.1 Mandatory security and data-safety gates

These are gates, not preferences. They apply per deployment mode (discovery §3):

| Gate | Local | Private hosted | Public multi-user |
|---|---|---|---|
| H2: scheduled, encrypted, separated backups, with a success check and a restore drill passed | before relying on it for real data | yes | yes |
| Key escrow covering every KEK used by any retained backup | once real documents exist | yes, if documents are enabled | yes, if documents are enabled |
| H1: TLS, production config refusals, `__Host-` cookie, security headers, logging without personal data | — | yes | yes |
| H3: monitoring, including backup staleness | — | yes | yes |
| Read-only dependency audit (part of H4) | — | yes | yes |
| AA production guard **kept** until H5 verifies it | — | yes | yes |
| H6: deploy only a tagged `main` release | — | yes | yes |
| H4: independent security review | — | recommended | yes |
| A1: a working erasure path for other users, the owner-deletion rule, and re-auth | — | — | yes |
| Plaintext-data plan: an owner decision to accept or mitigate | — | — | yes |

### 2.2 Product recommendations (prioritised, not gates)

| Priority | Slice | Why |
|---|---|---|
| P0 | L1 (in plan) | The approved next finance slice. It was started in another session by 21:38 +0300; recheck its state before scheduling. |
| P0 | H2 | Also a gate (§2.1). The launcher's pre-migration backups exist, but there is no scheduled, separated or off-host copy. |
| P1 | U0, G3, Tasks lifecycle exposure | Small, and need no new decisions. U0 items are reproduced first. |
| P1 | U2 (drawer, placeholders) | Daily phone use once hosted. Locale is already done on the usability-followup branch. |
| P1 | H1, H3, H6 | In-repo readiness for hosting; no provisioning. |
| P1 | U1 | Empty-account creation for habits, medications and pet; needs Q-U1-*. |
| P2 | A2 email change, I1a recovery codes | Recommended before others are invited (strongly for I1a); not gates. |
| P2 | L3 → L4 | The approved finance outcome; heavy, with open U- decisions. |
| P3 | U4, Q-W-1, Q-GP-1, G4–G6, Events, Inbox, U3 | Gated on decisions, or lower value. |

## 3. External facts and credentials needed

**May be discussed** in chat, plans and reports:
- non-secret infrastructure facts: provider, region, DNS provider, which record types exist, the public hostname, the
  public IP, ports, proxy topology, the PostgreSQL version;
- **public** keys: the backup recipient key, DKIM public records, and KEK ids and check values.

**Must never be sent in chat or written into reports, logs or Git:**
- private keys, credentials and tokens;
- personal data.

The owner places these directly into the host's secret store or a 0600 / 0400 file (discovery §2.8).

| ID | Fact / credential | Kind | Where it goes |
|---|---|---|---|
| H0-1 | Hosting provider and region (data residency for health and finance data) | decision | plan only |
| H0-2 | Authoritative DNS provider for `sachenkolabs.tech`; existing apex MX, SPF, DMARC and CAA records | fact (not secret) | plan |
| H0-3 | Public IP or target hostname for the `jenkin` record (after provisioning) | fact (not secret) | DNS, by the owner |
| H0-4 | TLS: proxy auto-ACME (recommended) or provider-managed | decision | H1 config |
| E-01 | SMTP host, port, security mode | fact (not secret) | config |
| E-01 | SMTP username and password | **secret** | host secret store |
| E-01 | Sender address and its SPF include / DKIM public record / DMARC policy | fact (not secret) | DNS, by the owner |
| E-02 | Public app URL (proposed `https://jenkin.sachenkolabs.tech`) | fact | `LIFEOS_PUBLIC_APP_URL` |
| E-03 | Proxy topology (same-host proxy recommended; any CDN in front?) | fact | runbook §2 table |
| E-06 | Keyring location, escrow holder, rotation authority | decision | plan |
| E-06 | The keyring file itself (KEK bytes) | **secret** | host file 0400 / offline escrow |
| E-11 (security) | Document limits and memory/disk headroom | decision | `LIFEOS_DOCUMENT_*` |
| H0-5 | Backup destinations (dumps and keyring backups separate), retention, schedule | decision | H2 config |
| H0-5 | Backup recipient **public** key | fact (**not secret**; may be shared) | H2 config |
| H0-5 | Backup **private** identity | **secret** (held offline by the owner) | never on the backup host |
| H0-6 | PostgreSQL: managed or self-hosted; version ≥ 16; database name and role | decision / fact | plan |
| H0-6 | Database password | **secret** | `LIFEOS_DATABASE_URL` in the secret store |
| H0-7 | Bootstrap token for the production database (≥ 32 characters, generated on the host) | **secret** | host secret store; never shared |
| H0-8 | Monitoring and alert destination (email or other) | decision | H3 |
| E-04 | Whether and how the owner's existing data moves (`lifeos_dev` at `20260721_0001`, or `lifeos_preview_personal`) into production | decision | owner-run |
| Q-H5-0 | Analytics in the hosted build: on or off (guard kept until H5) | decision | build and environment |
| H0-9 | Independent reviewer: who and what scope | decision | H4 |

## 4. Recommended next slice after L1: **H2 — scheduled, encrypted backups and verified restore**

**Before scheduling:** recheck live Git. At 21:34 +0300, no L1 branch was visible. By 21:38 +0300, another session had
created `feat/jenkin-finance-l1-20261001` (worktree `LifeOS_finance-l1`, no commits). L1 is therefore in progress,
and H2 can run **in parallel** in its own worktree, because the two do not overlap.

**Why H2 rather than L3 or U-slices:**
1. **Real data at risk.**
   - The launcher already backs up the database and its existing keyring automatically, but only **before a
     migration**.
   - Between migrations, nothing copies the owner's data.
   - Existing copies sit on the same disk as the live database, unencrypted, with the keyring in the same directory
     as the dump.
   - Once the owner bootstraps `lifeos_preview_personal` and stores real documents and obligations, losing that
     disk loses the data and every backup at once.
2. **No blockers.** H2 needs no external facts, no migration and no application change. Hosting reuses it, and only
   the scheduler differs.
3. **No overlap.** It touches `scripts/` and `Outputs/Runbooks/` only. It does not touch L1's tables or the
   usability-followup scope.
   - The launcher change it might make is optional (a staleness warning). If the launcher is being changed
     elsewhere, skip it.
   - It runs in its own worktree (§0).
4. **L3 is not ready to start immediately.** It still needs owner decisions U-2/U-3/U-4/U-5/U-7 and a heavy
   system-dependency choice. Running **L3 Discovery in parallel** (read-only) to collect those decisions is
   recommended.

If the owner prefers a user-visible slice instead, the next best is **U0 + U2's drawer**. Both are small and need no
new decisions, and locale is already done.

## 5. Things this plan does not authorise

- Provisioning any service.
- DNS or registrar access.
- Purchasing anything.
- Migrating `lifeos_dev`.
- Merging into `main`.
- Deploying.
- Reading secrets.

## 6. Proposed prompts

### 6.1 Implementation prompt — H2 (after L1, or in parallel; recheck live work first)

```text
Task: JENKIN H2 — scheduled, encrypted, separated database backups with verified restore (tooling + runbook only).

Read AGENTS.md, LIFEOS_MASTER_CONTEXT.md (newest sections, at least §89–§94), Outputs/Runbooks/jenkin-document-
keys-runbook.md (§3–§8), Outputs/Discoveries/jenkin-completeness-hosting-discovery_20261001-205516.md §2.5/§2.8 and
Outputs/Plans/jenkin-completeness-hosting-backlog_20261001-205516.md §0 and §1.5 H2. Verify live Git state first:
fetch; record origin/main, the latest completed integration tip, every active branch/worktree with recent commits
(L1, usability-followup, anything newer) and whether any of them touches scripts/preview/ or Outputs/Runbooks/.
Base on the latest completed integration commit; branch feat/jenkin-backup-restore-h2-<date>.
Worktree: create an isolated worktree /Users/yurasachenko/LifeOS/LifeOS_backup-h2 by default — parallel isolated
development is already owner-authorised; do not ask again. Never touch other worktrees or the canonical checkout.

Existing behaviour to keep unchanged: scripts/preview/launcher.py backup_before_migration (automatic pre-migration
pg_dump + existing keyring copy, fail-closed, never pruned). H2 must not prune, move or rewrite those backups.

Scope:
1. Backup command (Python 3.11 stdlib + pg_dump): one explicitly named database; refuse lifeos_dev; stream into an
   encryptor to a recipient PUBLIC key; plaintext stream also through `pg_restore --list` as a structural check;
   manifest (database, alembic revision, created_at with offset, size, SHA-256 of ciphertext re-read from disk, the
   set of kek_ids used by dumped documents/document_versions read from the same snapshot — ids only); 0600 files,
   0700 dirs, atomic rename, never overwrite; destination configurable.
2. Keyring backup, event-driven and SEPARATE from dumps (different destination): encrypted; manifest of KEK ids and
   check values from `keyring-check`, never key bytes.
3. Historical-key coverage check: every kek_id of every retained dump must be present in the newest keyring backup;
   report "not recoverable" otherwise. A backup on an older, non-active KEK is fine.
4. Retention pruning: explicit policy, dry-run default, never the newest success, never the launcher's backups;
   print per KEK the newest retained backup that still needs it.
5. macOS scheduling: a per-user launchd LaunchAgent template (StartCalendarInterval) with install/uninstall
   commands; owner installs; you only `plutil -lint` it and test the command it runs. Fail loudly when PostgreSQL
   is down. Production scheduling is out of scope (deployment-specific; H1/H7).
6. Success verification: status file (last success / last failure + reason) and `status --max-age <h>` that exits
   non-zero when stale or failed; optional macOS notification via osascript on failure.
7. Restore drill: decrypt with an explicitly supplied identity; restore only into a target whose name ends in
   `_test`, never the source, lifeos_dev or lifeos_preview*; an existing target needs --replace. Check alembic
   revision vs manifest, row counts, and documents via app.services.documents.rotation.verify(deep=True) with a
   separately supplied keyring: recoverable = zero failures; records on non-active keys are reported, not failed;
   never run documents-rotate on a restored copy (documents-verify exits 1 for both cases — do not use its exit
   code as the verdict). Drop the target unless --keep.
8. Runbook Outputs/Runbooks/jenkin-backup-restore-runbook.md: local use for lifeos_preview_personal, key
   separation (backup identity vs S2 keyring vs DB credentials), retention vs KEK retirement, recoverability vs
   rotation completion, RPO/RTO, drill cadence, what dumps expose, relation to launcher pre-migration backups, and
   the exact conditions for claiming "regular backup coverage".

Decisions to obtain BEFORE coding (stop and ask, unless already answered in the record): Q-H2-1 encryption tool
(recommended `age` CLI detected at runtime; no Python dependency), Q-H2-2 retention, Q-H2-3 destinations, Q-H2-4
schedule, Q-DB-1 only if you need a database other than lifeos_test.

Constraints: no application code, no migration, no new Python/npm dependency; never read or print the bootstrap
token, keyring contents, DB passwords or backup identities; public recipient keys and KEK ids may appear in
reports. Agent validation uses lifeos_test only (AGENTS.md; conftest requires `_test`), synthetic data, a generated
test keyring with two KEKs (rotate, keep the old one escrowed, restore an older backup and prove it is recoverable
while not on the active key; then remove the old KEK from the supplied keyring and prove the drill reports "not
recoverable"), and a generated test age identity in a temp directory. Never touch lifeos_dev or
lifeos_preview_personal; the owner runs the first real backup, installs the schedule and runs the first real drill.
Do not change the AA production guard. Validation: unit tests for manifest/retention/coverage/refusals/status;
the end-to-end drill above; ruff on new Python; plutil -lint; git diff --check. Write
Outputs/Implementations/jenkin-backup-restore-h2_<timestamp>.md with exact commands and honest NOT RUN items
(e.g. a real launchd firing, owner data), add a master-context section, update module-boundaries for the tooling
boundary. Commit and push the feature branch; no merge, no PR unless asked.
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
- State the deployment mode (private owner-only, or public multi-user) and apply that column of backlog §2.1.
- H1 packaging, H2 backup/restore (with "regular coverage" conditions met on the target), H3 operations and the
  read-only dependency audit are merged. For public multi-user, the H4 independent review, the A1 erasure path and
  the plaintext-plan decision are also done; list open findings and get the owner's explicit accept/fix decision
  for each. The AA production guard stays on unless H5 has verified it and the owner lifted it.
- Owner has supplied (as facts, not secrets in chat): hosting provider/region, DNS provider, proxy topology
  (E-03), sender address and that SPF/DKIM/DMARC records are published (E-01, only if mail is in scope), public URL (E-02), keyring
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
