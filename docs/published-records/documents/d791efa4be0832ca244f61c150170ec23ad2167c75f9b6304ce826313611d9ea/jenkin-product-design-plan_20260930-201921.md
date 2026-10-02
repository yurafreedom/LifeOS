# JENKIN — Product and Design Plan (owner requirements, 2026-09-30)

Date: 2026-09-30 (Europe/Kyiv) · Branch: `fix/lifeos-completion-audit` · Base HEAD `6d35179`
(`origin/main` 5e858bb is an ancestor). Status: **plan**. Only §2 is implemented, in the
same local commit as this file. Everything else is proposed and not started.

This file records the owner's new JENKIN requirements. It does **not** replace the GTD
roadmap (G3–G6, `Outputs/Plans/lifeos-gtd-completion-plan_20260930-131011.md`), the
Calendar cube plan, or any completed report. Those stay historical and authoritative for
their scope.

Every item below is labelled:

- **OWNER** is a requirement the owner stated.
- **REC** is a recommendation from the implementing agent. It is not accepted until the
  owner says so.
- **UNVERIFIED** is an external integration whose availability, terms, API and legal basis
  nobody has checked. Nothing in this category may be built from this plan.

## 1. Product name

- **OWNER:** The visible product name is **JENKIN**.
- **OWNER:** Preserve storage identifiers, snapshot/export compatibility, authentication
  behaviour and historical document names. Plan the technical naming and the GitHub
  repository rename separately, and do not perform a remote rename in this task.

### 1.1 Done now (visible surface only, see §2)

- The sidebar wordmark, the collapsed-logo tooltip, the logo button's accessible name and
  the login card show JENKIN.
- `index.html` has `<title>JENKIN</title>`, plus `application-name` and
  `apple-mobile-web-app-title`.
- The RU/UK copy that names the product says JENKIN (14 keys per locale, for example
  «Самопроверка JENKIN» and «Доход в JENKIN не моделируется»).

### 1.2 Deliberately unchanged (technical identifiers, compatibility)

| Identifier | Where | Why it stays |
|---|---|---|
| `lifeOsTheme`, `lifeOsScene`, `lifeOsSidebar`, `lifeOsSfx` | localStorage (device preferences) | Renaming would silently reset every device's theme, sidebar and sound settings |
| `lifeOsState` | legacy localStorage import | The legacy import reads exactly this key |
| `lifeos-adaptive-analytics` | IndexedDB write queue | A renamed DB would orphan queued, unsent analytics writes |
| `lifeos-account.zip`, `lifeOsState*.json`, `lifeos-system-review-*`, `lifeos-aa-queue-*`, `lifeos-analytics-queue-*` | export/download file names | Owner-held exports and any tooling that matches these names |
| `LIFEOS_*` / `VITE_LIFEOS_*` env vars, `LIFEOS_TIME_ZONE` | backend/frontend config and code | Deployment configuration; a rename needs a coordinated env change |
| `lifeos_dev`, `lifeos_test` | local PostgreSQL | Owner data and the test gate |
| `@life-os/web`, repo `yurafreedom/LifeOS`, checkout `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` | package, GitHub, disk | Repository identity, covered by the separate plan in §1.3 |
| `LIFEOS_MASTER_CONTEXT.md`, `Outputs/**/lifeos-*` | docs | Historical names (OWNER) |
| Backend strings: FastAPI `title="LifeOS API"`, System Review DOCX/PDF export labels («Самопроверка LifeOS», «правило LifeOS»), DOCX `dc:creator` and PDF `/Producer` `LifeOS` | `apps/api` | Out of this frontend pass. **Visible inconsistency:** the in-app Self-check says JENKIN, but a downloaded System Review export still says LifeOS |

### 1.3 Technical rename, as a separate later plan (REC)

1. **R1, backend-visible strings:** rename the System Review export labels, DOCX creator,
   PDF producer and API title to JENKIN. Existing export tests pin these strings, so the
   change needs its own tests. Already-downloaded files do not change.
2. **R2, GitHub repository rename** (`yurafreedom/LifeOS` → name to be chosen by the owner).
   GitHub redirects the old URL, but local `origin` remotes, CI, badges and the master
   context should be updated in the same step. The owner performs it or explicitly
   authorises it.
3. **R3, package and doc identifiers** (`@life-os/web`, README/ARCHITECTURE titles): these
   are cosmetic and can be done at any time.
4. **R4, storage keys: recommendation is never rename them.** If the owner insists, use a
   read-new-then-old migration with no deletion of the old key for at least one release.
   IndexedDB needs a drain-then-switch step. Export filenames can gain a `jenkin-` prefix
   only if import and any tooling accept both names.
5. Historical documents keep their names forever (OWNER).

## 2. Interface changes implemented now (OWNER)

The implementation report is
`Outputs/Implementations/jenkin-interface-pass_20260930-201921.md`.

1. **Tasks filter:** the chip row is replaced by one native, labelled `<select>`
   («показать» / «показати»). It keeps every filter in the old order: all, today, overdue,
   routine, important, Waiting, Completed. Waiting still opens the Waiting lists.
2. **Sort** stays a separate control (the existing «сортировать» trigger, unchanged).
3. **Task title size** equals the date/deadline metadata size (`--text-sm`, 12 px) on the
   Tasks page. Before this change the title inherited the 16 px body size, because
   `.task-title-btn` resets `font`. The Home task list is unchanged.
4. **Sidebar account block:** the email stays at 12 px. It wraps, first before «@» and then
   anywhere if still too wide, and is never clipped or shrunk. The full address is in
   `title`. The sync status is always on its own line below the email.
5. **Branding:** see §1.1.

## 3. Calendar: nested redesign (OWNER intent; waiting for the prototype)

- **OWNER:** A nested Calendar redesign is wanted.
- **OWNER constraint:** The redesign **waits for the owner's visual prototype.** Agents must
  not redesign Calendar geometry, layout or navigation on their own. The current cube
  Calendar (PR #17, Kyiv-day follow-up §83) stays as it is.
- **REC, preparation only:** when the prototype arrives, run Discovery → Plan →
  Implementation. The Discovery should map the prototype's levels (for example year → month
  → day, or whatever the prototype defines) onto the existing routes (`#/calendar/…`), the
  Day Manager, the History and closure semantics (OD-1), and `useKyivToday`. It must not
  change the task schedule model without an owner decision.
- **Open:** whether Events (§4) appear inside the nested Calendar and how they look next to
  tasks. That decision belongs with the prototype.

## 4. Events

- **OWNER:** Events are a product concept to add.
- **REC:** treat an Event as a separate record, not a Task. It has a start (and optional end
  or all-day), a title and optional notes. It has no done/closure lifecycle, and Clarify
  should not turn a capture into a Task when the owner means an appointment. This keeps
  "Project is not Goal"-style separation.
- **Open owner decisions:** recurrence (none, or simple rules); reminders (none until
  notifications exist); relation to tasks (none, "prepare for" link, or other); whether a
  past event needs an outcome; storage (snapshot collection vs server table: REC is a
  snapshot collection first, which needs no migration).
- **UNVERIFIED:** any external calendar sync (Google, iCloud, CalDAV). Not planned.

## 5. Dedicated Inbox

- **OWNER:** A dedicated Inbox is wanted.
- **Current state:** capture lands in Quick Notes («заметки»), and Clarify processes it
  (§79 of the master context). There is no separate Inbox route.
- **REC:** Inbox should be a route that shows only unprocessed captures, with Clarify as the
  primary action and an honest count («в инбоксе: N»). Quick Notes stays for notes kept as
  notes. The data model can stay the current Quick Notes collection plus the existing
  Clarify processed state. Re-labelling it would not be a new store.
- **Open owner decisions:** whether «заметки» and Inbox are one list or two views; whether
  the Sidebar count moves to Inbox; whether Inbox Zero is a stated goal (it is still only
  an unaccepted proposal, see §79).

## 6. Smart capture

- **OWNER:** Smart capture is wanted.
- **REC, local and deterministic first:** parse explicit dates and times in RU/UK text («завтра
  в 10», «15 октября», «в пятницу») into a *suggested* schedule. The user confirms it; it is
  never applied silently. A missing date stays missing. Parsing uses Europe/Kyiv.
- **REC, later and opt-in:** any LLM-based classification must be explicitly enabled, must
  show what is sent, and must never auto-create tasks or events without confirmation.
- **Rule:** preserve Quick Notes on cancellation or persistence failure (AGENTS.md).

## 7. Account recovery and passkeys

- **OWNER:** account recovery and passkeys are wanted.
- **Current state:** email + password with server sessions and a one-time bootstrap token.
  There is no password reset, no email sending, and no second factor.
- **REC, order:** (1) recovery codes generated at setup and shown once, stored hashed. This
  needs no email infrastructure. (2) WebAuthn passkeys as an additional sign-in method next
  to the password. This needs a server table, a migration and a library choice, so it is
  **not** allowed without an explicit task. (3) email-based reset only after an outbound
  email provider is chosen.
- Authentication behaviour is unchanged by this task (OWNER).

## 8. Documents

- **OWNER:** A Documents area is wanted.
- **REC:** start with metadata records (title, kind, issuer, number as optional free text,
  issue/expiry date, notes). Each record can have an optional file attachment later. The
  first useful feature is "expiring soon" (passport, insurance, licences).
- **Constraints:** file storage needs a backend store, quotas, export and delete coverage,
  and a privacy review (Privacy/Export/Delete §46). Document numbers are sensitive personal
  data: never put them in URLs, and exclude them from analytics.
- **UNVERIFIED and not planned:** fetching documents from **Diia**, or verifying identity
  through **BankID**. Neither availability for a personal app, nor the API terms, nor the
  legal basis have been checked.

## 9. Phone-number-change workflow

- **OWNER:** A workflow for changing a phone number is wanted.
- **REC:** a guided checklist, not automation. The owner lists the services where the number
  is registered (bank, Diia, mobile operator, messengers, delivery services, doctors…) and
  ticks each one off as updated. The checklist keeps an honest "not yet / done / not needed"
  state and a date. It could be a reusable "life admin checklist" template.
- **Not planned:** sending messages, calling APIs or changing numbers on external services on
  the owner's behalf (outbound automation, see §10).

## 10. Explicitly out of scope (OWNER: do not implement)

- **HELSI** (Ukrainian medical e-system) integration: UNVERIFIED.
- **BankID** identity verification: UNVERIFIED.
- **Diia** integration: UNVERIFIED.
- **Private-key storage** (crypto wallets, signing keys, e-signature keys) in any form.
- **Outbound automation** (sending messages, emails or requests to third parties on the
  owner's behalf).

These can come back only as a separate Discovery that first checks the external facts, and
then with an explicit owner decision.

## 11. Relationship to the existing roadmap

- GTD **G3–G6** (plan `lifeos-gtd-completion-plan_20260930-131011.md`) are unchanged and not
  started. The G5/G6 requirement-acceptance decisions (OD-G4-0, OD-G5-0, OD-G6-0) are still
  open.
- Inbox (§5) and smart capture (§6) touch the capture side of GTD. Plan them so that
  Clarify's six outcomes and their contract (§66 of the master context) stay intact.
- Suggested order once the owner confirms it (REC): the §1.3 R1 backend brand strings (small)
  → Inbox (§5) → Events (§4) together with the nested Calendar once the prototype exists
  (§3) → smart capture (§6) → recovery codes, then passkeys (§7) → Documents metadata (§8) →
  phone-change checklist (§9).

## 12. Environment gap to report with this plan

`lifeos_dev` (the owner's local dev DB) was read-only checked on 2026-09-30:
`alembic_version = 20260721_0001`, while the repository head is `20260930_0009`. It is
**not** at the current schema. `lifeos_test` being at `20260930_0009` says nothing about
`lifeos_dev`. Upgrading `lifeos_dev` is the owner's decision. Agents migrate only
`lifeos_test`.
