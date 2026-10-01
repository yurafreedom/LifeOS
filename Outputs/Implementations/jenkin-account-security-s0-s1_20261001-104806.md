# JENKIN S0/S1 — security and account foundation

Date: 2026-10-01 (Europe/Kyiv) · Branch `feat/jenkin-account-security-20261001` (pushed; **not merged, no PR,
not deployed**) · Base `integration/jenkin-calendar-branding-20261001` @ `83cba06e1d7226e3554d8f736889e5b8e6c1bcfd`
(fetched live, verified ancestor; the remote branch had no later commits).

Related records: discovery `Outputs/Discoveries/jenkin-security-finance-discovery_20261001-104806.md`,
decisions `Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md`, roadmap
`Outputs/Plans/jenkin-security-finance-roadmap_20261001-104806.md`, artifacts
`Outputs/Implementations/jenkin-account-security_20261001/`.

## 0. Preconditions and checkout

- `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` (§65, §84–§87), `module-boundaries.md`, the integration
  report and every auth / state / queue / export / initial-state / legacy-import / Settings / Finance source were
  read first.
- The canonical checkout `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` was on
  `handoff/jenkin-cloud-20260930` with **another session's staged files** (`JENKIN_BRANDING_HANDOFF.md`,
  `design-references/jenkin-branding/**`) and untracked files. Switching branches would have mixed that work into
  this branch. The task explicitly allowed an isolated checkout, so the work used the Git worktree
  `/Users/yurasachenko/LifeOS/LifeOS_account-security` (branch created from `origin/integration/...`). The
  canonical checkout, its index, `main`, other branches and the recovery stash were not touched. Remove the
  worktree after review with `git worktree remove /Users/yurasachenko/LifeOS/LifeOS_account-security`.
- No previous security/finance discovery existed in the repository; it was reconstructed from source (S0).

## 1. Commits

| Commit | Scope |
|---|---|
| `6d9182e` | feat(api): bind every protected request to the client's expected account (+ no-store middleware, two-account tests) |
| `2cb524f` | feat(web): account-isolated tabs, safe sync, honest logout and legacy import |
| `7cdc62b` | feat(web): new accounts start empty; remove fabricated and dead UI |
| `c2406c9` | feat(api): private invitations, recovery, verification, sessions, throttling, audit (migration `20261001_0010`) |
| `b91d552` | feat(web): account security UI — recovery, verification, invites, sessions |
| `bd94e4c` | fix(web): browser-QA findings in the S1 account flows |
| `23ccccc` | test(api): compare instants as instants and Kyiv dates in Kyiv (the two pre-existing UTC assertions) |
| (docs) | docs: S0 discovery, decision register, roadmap, S1 report, master context §88, module boundaries, QA artifacts |

The docs commit cannot name its own SHA; verify the branch tip live with
`git ls-remote origin feat/jenkin-account-security-20261001`.

## 2. Implemented behaviour

### Checkpoint 1 — account isolation
- **Server** (`app/dependencies.py`): `get_current_user` now requires `X-LifeOS-Account`; missing → 428
  `account_binding_required`; different from the session's account → 409 `session_user_mismatch`. It runs as a
  dependency, before any route body, so no read, write, import, export, replay or deletion happens. The header is
  never authorization — ownership is still the server session. `/auth/me` is the only unbound authenticated route
  (identity discovery); logout honours an optional binding so a stale tab cannot sign out the other account.
  `test_every_protected_route_is_bound` walks every route of the app.
- **Client** (`api/accountBinding.ts`, `api/client.ts`): every request carries the tab's expected account; binding
  another account starts a new generation that aborts every request of the previous one; a response that settles
  late raises `AccountChangedError` (name `AbortError`) and never reaches state. Export and System Review downloads
  use the same bound fetch.
- **AuthProvider**: revalidates with `GET /auth/me` on BroadcastChannel `lifeos-auth` notices (storage-event
  fallback; messages are hints only), focus / visibility / pageshow / online, and on any refused bound request.
  Same account → nothing; another account → the old tree unmounts (its unsaved edits kept for it only) and an
  explicit **"switched"** screen offers the new account; no session → login with a notice. Providers are keyed by
  `account id : generation`, so state is never relabelled. An in-flight request already authenticated as A may
  complete for A on the server; its response is discarded on the client.

### Checkpoint 2 — sync, logout, local data
- `StateSyncCoordinator`: dispose aborts the PUT; in-flight payloads stay "unsaved"; `session_user_mismatch` is not a
  revision conflict (no freeze).
- `AnalyticsSyncCoordinator`: `disposed` checked after every await; abort controller; interrupted or
  binding-refused records are released with attempts unchanged; replay bound to `record.user_id`; Web Lock
  `aa-write-queue:<user>` (de-duplication only — authorization is the server's).
- IndexedDB `lifeos-adaptive-analytics` v2: owner required on enqueue, owner-checked updates, ownerless v1 records
  `quarantined` (never replayed, never listed). v1 records already carried owners, so they keep them.
- Unsaved edits (pending or in flight) are stored as `lifeOsPendingSnapshot:<user id>` when the provider unmounts
  (expiry, switch, "sign out keeping a copy"), validated against the key's owner, and offered only to the same
  account: restore (CAS against the base revision; refused if the server moved on), download, decide later, or
  confirmed discard.
- Voluntary logout: saves first (bounded 5 s); otherwise a dialog — retry, download, sign out keeping a device copy
  for this account, or confirmed discard. A failed logout keeps the tab signed in and says the session is still
  active. Centralised expiry: only `401 not_authenticated` / `409 session_user_mismatch` trigger revalidation;
  domain errors never log anyone out.
- `PrivateNoStoreMiddleware`: `Cache-Control: no-store`, `Pragma: no-cache`, `Vary: Cookie` on all `/api`
  responses except `/api/healthz`; exports keep their own `no-store`.
- Legacy `lifeOsState`: offered only to an account without a recorded decision; nothing is previewed, downloaded
  or imported before "these are my data, import into <email>" is ticked; import retires the copy to
  `lifeOsStateRetired` (recoverable); declining leaves it untouched. Settings → Export manages the copy
  (ownership-confirmed download, retire, restore, confirmed permanent delete).

### Checkpoint 3 — honest production state
- `buildInitialState()` is empty with a blank profile structure; the old seeds live only in
  `context/lifeData/demoState.js` (tests). Server reset creates the same empty state. Migration no longer reseeds
  demo transactions / goals / habits. Existing owner snapshots are not modified; no automatic cleanup (D-06).
- Removed: `data/dashboard-seed.js` ($4,000 budget, 47-day streak, 84 % goal, 23/30 tasks, six invented months),
  Finances' seeded cap, Settings' masked fake Telegram/monobank tokens, fixed sync time and "7 pending",
  notification toggles that did nothing, fake category budgets, dead add-category / accent / density controls, dead
  CSV/MD exports. Telegram, monobank and notifications are honest "not connected / not available" panels.
- Home derives streak, nearest goal and weekly tasks from the account; budget says "not set"; the 6-month trend
  shows its empty state (income is not recorded); categories derive from real transactions. Sidebar habit/goal
  counts are real. Pet page: honest empty state (it crashed on `{}`); Profile renders blank fields.

### Checkpoint 4 — access management
- Migration `20261001_0010`: `users.role` (owner|member) + `email_verified_at` + `password_changed_at`;
  `sessions.device_label`; `auth_tokens`, `account_invitations`, `auth_throttle`, `auth_audit_events`. Owner
  assignment is deterministic: exactly one historical user → owner; several → no one (operator runs
  `python -m app.cli grant-owner <email>`); bootstrap creates the owner.
- Invitations: owner only; email-bound; single use; 7 days; token digest only; re-inviting supersedes; delivery
  reported honestly — `sent`, `manual` (no mail backend: link shown once to the owner), `failed`; acceptance
  creates an **empty, verified member** and signs in.
- Password change verifies the current password (throttled), keeps this session, revokes the others and voids
  outstanding reset links. Recovery: 202 `accepted` for every address, mail sent after the response, 1 h
  single-use links, expired / replayed / superseded links fail identically, reset revokes every session and proves
  the mailbox; 503 `mail_unavailable` for every address when the server cannot send mail at all.
- Email verification: 24 h single-use links bound to the address they were sent to; send reports
  sent / unavailable / failed truthfully.
- Sessions: list with coarse device labels; revoke one (another account's id is "not found"); revoke all others.
- Throttling (`services/throttle.py::POLICIES`): login per address 5/15 min and per network 30/15 min; recovery per
  address 3/h (silent) and per network 10/h; token guessing per network 20/15 min; password-change 5/15 min per
  account; verification mail 3/h; invitations 20/24 h. Identical for unknown addresses; `Retry-After` on 429.
- Audit events (login ok/failed/throttled, logout, session revocations, password change, reset requested /
  delivery failed / completed, verification sent / verified, invitation created / revoked / accepted, account
  bootstrapped / deleted): coarse network and device only; never passwords, tokens, links or content; 365-day
  retention; in the account export; erased with the account except one anonymous `account_deleted` row.
- Mail interface `app/mail`: disabled (default), memory (tests), file (development `.eml`), SMTP (production;
  config validation refuses memory/file and `smtp_security=none` in production and requires host, sender and an
  https public URL). Links put the token in the URL fragment; the client scrubs it from history on read.
- Every new mutating route enforces same-origin + JSON content type (SameSite is not relied on).
- UI: login "forgot password", reset / verify / invitation pages, Settings → Security (verification, password,
  sessions, owner invitations, recent security events). RU/UK copy for every state.

## 3. Findings

Fixed / implemented: S-01 … S-08, S-10 … S-20, S-22 … S-26 (discovery §1–§4). Disproved: S-09 (queue records
already had owners — hardened anyway), S-16 in part (no automatic import; ownership confirmation was missing),
S-27 (CSRF already had origin checks), S-28 (Argon2id hashing). Found during browser QA and fixed (`bd94e4c`):
first-snapshot race between two tabs of a new account; wrong "expired" notice after a sign-out elsewhere; Logout
waiting forever on a hung save; 11 px text in the new section; missing `import_projects` label.
Remaining: R-01 … R-08 (discovery §5).

## 4. Verification

Environment: macOS, Python 3.11.15 (the canonical checkout's venv, no editable install), Node from the worktree's
own `npm ci`, local PostgreSQL. **Only `lifeos_test` was used**; `lifeos_dev` was never connected to.

| Check | Result |
|---|---|
| Baseline before changes | backend 750 passed + 1 skipped (Kyiv session zone); frontend 849 passed / 55 files |
| `apps/api: python -m pytest` (Europe/Kyiv session zone, `PGTZ`) | **807 passed, 1 skipped** |
| `apps/api: python -m pytest` (UTC session zone, `PGTZ=UTC`) | **807 passed, 1 skipped** (after the test-only fix) |
| `apps/api: ruff check .` | All checks passed |
| `alembic heads` / `current` (lifeos_test) | `20261001_0010 (head)` / `20261001_0010 (head)` |
| Migration upgrade → downgrade `20260930_0009` → upgrade (lifeos_test, CLI) | PASS; plus `test_account_security_migration.py` (round trip, sole-user owner, ambiguous users → no owner) |
| `apps/web: npm test` | 882 passed / 58 files |
| `npm run typecheck`, `npm run lint`, `npm run build` (default and analytics-enabled) | PASS |
| `git diff --check` | PASS |

### 4.1 Backend results

- +57 backend tests: `test_account_binding.py` (12), `test_account_access.py` (42), `test_account_security_migration.py` (3).
- Pre-existing UTC-only failures — the integration report listed two, from a cloud run. Reproduced locally with
  unmodified copies under `PGTZ=UTC`: `test_aa_deletion.py::test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore`
  (the same instant spelled `+00:00` vs `Z`) and
  `test_aa_legacy_import.py::test_legacy_import_is_honest_idempotent_and_does_not_backfill_other_layers` (a Kyiv
  business date read in the UTC session zone). Neither is caused by crossing midnight. Both were **test defects**:
  the production contract (`occurred_at` = local midnight of the requested zone; the API may spell UTC as `Z`) is
  correct. Fixed in a separate test-only commit; the suite now passes under both zones.
- Tests run with `LIFEOS_AA_WRITE_ENABLED=false` in the process environment (the owner's ignored `.env` would
  otherwise leak into a gate test) and `LIFEOS_TEST_DATABASE_URL=…/lifeos_test`.

### 4.2 Real browser (Chromium via Claude in Chrome, production build, real API on lifeos_test, file mail adapter)

Synthetic accounts only (`qa-owner@`, `qa-member@`, `qa-legacy@example.com`); no real mail, no bank requests.

1. Bootstrap → owner; empty Home with honest empty cards (screenshot 01).
2. Settings → Security: owner invites `qa-member@example.com`; "sent" only after the file adapter wrote the
   message; 7-day expiry shown (02).
3. Invitation link while signed in as the owner → refused with a sign-out prompt; the token was removed from
   the address bar on load. Signing out in tab B moved tab A to signed-out via BroadcastChannel.
4. Acceptance → member signed in; the first-snapshot race between the two tabs was found here and fixed.
5. **Stale tab**: tab B (member) with an edit whose PUT is in flight; tab A signs in as the owner by a raw API
   call (no broadcast). A raw replay of tab B's write bound to the member → **409 `session_user_mismatch`**. Both
   server snapshots stayed at **revision 1 (equal)** with no foreign data. Tab B's next in-app read was refused →
   "switched" screen (03), member data hidden, the unsaved note stored only under the member's key.
6. "Open owner" → owner data only, no recovery prompt; owner logout confirmed by the server.
7. Member signs in → recovery prompt (04) → restore → saved on the server; local copy removed.
8. Logout with the server failing (502) → stays signed in, "session still active". Offline edit + Logout →
   resolution dialog (05); "keep copy" with the server failing → error, still signed in; after recovery → signed
   out, copy kept for the member only.
9. Legacy `lifeOsState` + new invited account → prompt with no preview and Import disabled until ownership is
   confirmed (06); import → data present, copy retired, decision recorded; Settings → Export shows the retired copy.
10. Forgot password (generic answer; unknown address → same 202, no mail file) → reset link → new password →
    replay 400 → sessions revoked → login with the notice. Old password rejected.
11. Expired session (session rows deleted server-side) with an offline edit → reconnect → 401 → login with the
    "expired" notice; the edit kept for that account only.
12. API log contained no token from any link; the audit table contained no token or password.
13. Matrix (`browser-matrix-README.md`, `browser-matrix.csv`): Settings → Security 80 configurations
    (1440/1024/768/390/320 × RU/UK × Current/DejaVu × dark/light/paradise-day/paradise-night) — 0 overflow, 0 text
    < 12 px; Home / Finances / monobank / Export+legacy / Categories / pet page 120 configurations — 0 overflow;
    the only text < 12 px is pre-existing Home styling. Narrow screenshots 07 (390 RU dark), 08 (320 UK DejaVu
    paradise-day).

Not run: Firefox/WebKit, screen readers, real SMTP delivery, real foreground focus switching (the automation
window reports `visibilityState: hidden`; the refused-request path and BroadcastChannel path were exercised
instead), multi-process throttling under load.

## 5. Production activation (BLOCKED_EXTERNAL)

Environment variables (all `LIFEOS_` prefixed): `MAIL_BACKEND=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`
(`starttls`|`ssl`), `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM` (verified sender with SPF/DKIM),
`PUBLIC_APP_URL` (https), `TRUSTED_PROXY_HOPS` (number of reverse proxies), optionally `INVITATION_TTL_SECONDS`,
`PASSWORD_RESET_TTL_SECONDS`, `EMAIL_VERIFICATION_TTL_SECONDS`, `AUDIT_RETENTION_DAYS`. Without SMTP the
product stays honest: recovery says mail is unavailable, invitations give a one-time manual link. A database
with several historical users needs `python -m app.cli grant-owner <email>`. `lifeos_dev` migration is the
owner's decision (it is at `20260721_0001`). None of these values were invented.

## 6. Next slice

S2 — encryption and document foundation (roadmap §S2): envelope AES-256-GCM with versioned wrapping keys and
AAD binding, no plaintext fallback, rotation/backup/custody runbook (needs E-06), encrypted document store
(validate PostgreSQL chunks vs object storage), 15 MB PDF/JPEG/PNG with content validation, export/erasure.
