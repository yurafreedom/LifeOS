# JENKIN security & finance discovery — reconciled with the integrated application (S0)

Date: 2026-10-01 (Europe/Kyiv) · Base: `integration/jenkin-calendar-branding-20261001` @ `83cba06e1d7226e3554d8f736889e5b8e6c1bcfd`
(fetched live and verified as an ancestor) · Work branch: `feat/jenkin-account-security-20261001`.

The earlier security/finance discovery existed only in an owner chat, not in the repository. It was
**reconstructed from source** using the findings and requirements the owner restated on 2026-10-01. Every
finding below was treated as a hypothesis until code inspection or an executable reproduction settled it.
"Evidence" names the file (as it was at `83cba06`) and, where one exists, the test that now pins the behaviour.

Status vocabulary: **CONFIRMED → FIXED** (reproduced or established from code; fixed in S1),
**CONFIRMED → IMPLEMENTED** (a capability was missing; built in S1), **DISPROVED** (the hypothesis does not
hold against the integrated code), **PARTIAL**, **REMAINING** (true and deliberately left for a later slice),
**BLOCKED_EXTERNAL** (needs facts or access outside the repository).

The obsolete gate "security work waits for the JENKIN integration" is **resolved and removed**: the
integration branch exists, its HEAD `83cba06` was verified, and S1 was built on it.

## 1. Account isolation across tabs (checkpoint 1)

| ID | Finding (hypothesis) | Status | Evidence |
|---|---|---|---|
| S-01 | A tab that loaded account A keeps saving its snapshot after another tab signs in as B; the shared cookie makes the server accept A's payload as B's. | **CONFIRMED → FIXED** | `dependencies.py::get_current_user` derived the account only from the cookie; nothing on the request named the account the sender believed it was. `stateSyncCoordinator.ts` PUTs with whatever cookie exists. Both accounts at revision 7 → a PUT with `expected_revision: 7` from tab A would succeed against B. Fix: `X-LifeOS-Account` binding, 409 `session_user_mismatch` before the route body. Tests: `apps/api/tests/test_account_binding.py` (equal revisions), `apps/web/src/test/account-isolation.test.ts`. |
| S-02 | Queued Adaptive Analytics writes of A are replayed into B. | **CONFIRMED → FIXED** | `analyticsRepository.replayQueuedWrite` posted with the ambient cookie. Fix: replay is bound to the record's owner (`{ account: record.user_id }`); a refusal releases the record unchanged. |
| S-03 | The account-scoped providers are reused across an account change, so A's state can be shown labelled as B. | **CONFIRMED → FIXED** | `App.jsx::AuthGate` rendered `AnalyticsProvider` / `LifeDataProvider` without a `key`; a change of `user` re-ran effects inside the same component instances. Fix: keyed by `account id : auth generation`; a different account requires an explicit choice on the "switched" screen. |
| S-04 | Late responses from the previous account can enter the new account's state. | **CONFIRMED → FIXED** | No generation guard existed in `api/client.ts`. Fix: `api/accountBinding.ts` — generation bump aborts every request and turns any late settlement into `AccountChangedError`. |
| S-05 | No cross-tab notification or foreground revalidation. | **CONFIRMED → FIXED** | None in `AuthContext.jsx`. Fix: BroadcastChannel (`storage` fallback), focus / visibility / pageshow / online revalidation via unbound `GET /auth/me`. |
| S-06 | Missing identity should fail closed. | **CONFIRMED → FIXED** | Header absent on a protected route → 428 `account_binding_required` (protects old cached bundles). `test_every_protected_route_is_bound` enumerates the app's routes. |

## 2. Sync, logout, local data (checkpoint 2)

| ID | Finding | Status | Evidence |
|---|---|---|---|
| S-07 | `dispose()` does not stop the analytics replay loop. | **CONFIRMED → FIXED** | `analyticsSyncCoordinator.ts::flushAsLeader` had no `disposed` check inside `for (;;)`; a disposed coordinator kept replaying. Fix: check after every await, abort controller, interrupted record released with attempts unchanged. |
| S-08 | Cancellable requests are not aborted on disposal. | **CONFIRMED → FIXED** | Neither coordinator passed a signal. Both now own an `AbortController`. |
| S-09 | Queue records are not bound to an owner. | **DISPROVED (hardened)** | v1 records already carried `user_id` and every read filtered by it. Hardened in IndexedDB v2: owner required on enqueue and checked on update; records without a well-formed owner are quarantined, never replayed, never shown. |
| S-10 | One Web Lock name for every account. | **CONFIRMED → FIXED** | `'aa-write-queue'` → `'aa-write-queue:<user>'`. The lock only de-duplicates; authorization is the server's. |
| S-11 | Voluntary logout silently loses unsaved snapshot edits. | **CONFIRMED → FIXED** | Logout unmounted the provider and disposed the coordinator with pending edits. Fix: logout guard saves first; otherwise retry / download / keep a device copy / confirmed discard. |
| S-12 | Logout claims success when the server failed. | **CONFIRMED → FIXED** | `AuthContext.logout` set `anonymous` in its `catch`; the copy said "local data hidden". Fix: stays signed in, says the session is still active. |
| S-13 | Expired sessions lose unsaved edits or could replay them elsewhere. | **CONFIRMED → FIXED** | Fix: unsaved/in-flight payload kept per account (`pendingSnapshotStore`), offered back only to the same account as a compare-and-swap restore. |
| S-14 | Exports are not invalidated by an account change. | **CONFIRMED → FIXED** | `exportAccount` had no signal / generation. Now bound, generation-checked, aborted on unmount. |
| S-15 | Private API responses are cacheable. | **PARTIAL → FIXED** | Export, retention and a few AA routes set `no-store`; `/state`, `/auth/me` and most AA reads did not. `PrivateNoStoreMiddleware` covers every `/api` response except `/api/healthz`. |
| S-16 | Legacy `lifeOsState` is imported automatically into a new account. | **DISPROVED (in part)** | Import required a click. But it was offered to *any* new account without an ownership confirmation, the stored decision was written and never read, and imported data stayed on the device for the next account. All three **FIXED**. |

## 3. Honest production state (checkpoint 3)

| ID | Finding | Status | Evidence |
|---|---|---|---|
| S-17 | New production accounts receive fabricated medications, dose logs, transactions, body data, pet profile and notes. | **CONFIRMED → FIXED** | `lifeData/initialState.js::buildInitialState` returned the demo tree. Now empty; demo lives in `demoState.js` (test fixture only). |
| S-18 | Snapshot migration reseeds demo data into real accounts. | **CONFIRMED (new) → FIXED** | `migrate.js` reseeded 15 transactions into v1 snapshots and default goals/habits when absent. |
| S-19 | Hardcoded bank/Telegram credentials, fake balances, false integration status, dead exports. | **CONFIRMED → FIXED** | `SettingsPage.jsx` (masked fake tokens, "7 pending", fixed sync time, dead toggles), `ExportSection` (dead CSV/MD), `data/dashboard-seed.js` ($4,000 budget, invented 6-month history), Finances' seeded cap. |
| S-20 | Empty accounts crash some pages. | **CONFIRMED (new) → FIXED** | `ProfilePage` / `DogPage` crashed on `{}`. Blank profile structure; honest pet empty state. |
| S-21 | Snapshot amounts are shown as `$` while AA records them as `UAH`. | **CONFIRMED → REMAINING** | `FinancesPage.jsx` prefixes `$`; `analytics/financeTransaction.ts` records `unit_code: 'UAH'`. Owner decision: historical currency is **not silently reinterpreted**. Resolved in F1 with explicit per-transaction currency. |

## 4. Access management (checkpoint 4)

| ID | Finding | Status | Evidence |
|---|---|---|---|
| S-22 | No login throttling. | **CONFIRMED → IMPLEMENTED** | `services/auth.py` had none. DB-backed per-address and per-network windows (`services/throttle.py`). |
| S-23 | No password change, recovery or email verification. | **CONFIRMED → IMPLEMENTED** | Routes absent. |
| S-24 | No session management. | **CONFIRMED → IMPLEMENTED** | Sessions were created/deleted only by login/logout. |
| S-25 | No private account model: any second account required DB access; no owner role. | **CONFIRMED → IMPLEMENTED** | Only `/auth/bootstrap` (first user) existed. |
| S-26 | No authentication audit trail. | **CONFIRMED → IMPLEMENTED** | — |
| S-27 | CSRF relies on SameSite cookies only. | **DISPROVED** | `security/origin.py::enforce_same_origin` (Origin/Referer + `Sec-Fetch-Site`) and `require_json_content_type` were already applied to every mutating route; all new routes use both (`test_new_mutating_routes_refuse_cross_site_requests`). |
| S-28 | Password hashing is weak. | **DISPROVED** | `pwdlib` recommended (Argon2id) with dummy-hash timing equalisation; preserved unchanged. |

## 5. Remaining findings (not S1)

| ID | Finding | Status |
|---|---|---|
| R-01 | Snapshots, AA facts and profile data are stored in plaintext at rest. | REMAINING → S2 (separate migration plan for existing data). |
| R-02 | No passkeys / TOTP. | REMAINING → I1. |
| R-03 | No email-change flow (verification is tied to the current address). | REMAINING (not requested). |
| R-04 | `lifeos_dev` is at `20260721_0001`, not the repository head. | BLOCKED (owner decision; agents migrate only `lifeos_test`). |
| R-05 | Production mail: SMTP host, sender and public URL are not configured. | BLOCKED_EXTERNAL. |
| R-06 | Deployment facts (reverse proxy hops, host names, TLS) are unknown. | BLOCKED_EXTERNAL; `trusted_proxy_hops` defaults to 0. |
| R-07 | Two pre-existing backend assertions fail under a UTC DB session time zone (see the S1 report). | REMAINING (test-only, unrelated to S1). |
| R-08 | Home's six-month trend now shows its empty state because income is not recorded. | REMAINING → F1/F3 (planned vs received income). |

## 6. Finance discovery (inputs for S2 and F1–F5)

What exists today: snapshot `transactions[]` (amount, category, date, description, source label, inclusion
flag; no currency), AA facts `finance.transaction_amount` / `finance.monthly_spend` (UAH), membership
overrides, category policies, the System Review finance context (Slice 7), retention (Slice 8). There are **no**
accounts, obligations, loans, contractual terms, schedules, payments or documents, and no bank connector code.
The owner's personal examples (loans, balances, rates) are historical discussion inputs — **not** a verified
ledger and **not** repository fixtures. No figure from them was written anywhere.

The approved architecture and acceptance criteria are in
`Outputs/Plans/jenkin-security-finance-roadmap_20261001-104806.md`; decisions and external prerequisites are in
`Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md`.
