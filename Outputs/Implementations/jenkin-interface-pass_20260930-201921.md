# JENKIN interface pass: Tasks filter, title size, sidebar account block, visible branding

Date: 2026-09-30 (Europe/Kyiv) · Branch `fix/lifeos-completion-audit` · base HEAD `6d35179`
(`origin/main` 5e858bb is an ancestor, verified). The change is a local commit only. It is
not pushed, not merged and not deployed. Plan: `Outputs/Plans/jenkin-product-design-plan_20260930-201921.md`.

## Scope (owner-requested)

1. The Tasks filter chips become one accessible dropdown that keeps every filter, including
   Waiting and Completed.
2. Sorting stays a separate control.
3. The task-title font size matches the date/deadline metadata.
4. Sidebar account block: long emails fit without going below 12 px, and the sync status is
   on its own line.
5. The visible branding and the relevant page metadata say JENKIN.

This pass has no backend, schema, migration, dependency, storage-key, export-name,
snapshot or authentication change.

## Changes

- `apps/web/src/pages/TasksPage.jsx`: `.tasks-chips` is replaced by
  `<label class="tasks-filter">` wrapping a visible label («показать» / «показати») and a
  native `<select>` with options `all, today, overdue, routine, stakes, waiting, done` in
  the old order and with the old labels. The `filter` state and the filtering logic are
  unchanged. The chevron is `aria-hidden`. The sort trigger and popover are untouched.
  A native select was chosen because it is keyboard- and screen-reader-accessible without
  new code, and it opens the phone's own picker on mobile.
- `styles/pages-life.css`: the select has the sort trigger's geometry and tokens, plus a
  `:focus-visible` ring. It adds `.tasks-page .task-title-btn { font-size: var(--text-sm) }`.
  The root cause of the size mismatch was `.task-title-btn { font: inherit }`, which
  overrode `.task-title`'s 13 px, so titles rendered at the 16 px body size next to 12 px
  dates. The fix is scoped to the Tasks page; the Home list is unchanged.
- `styles/panels.css`: `.task-due` 12px → `var(--text-sm)` (the same value, now tied to the
  title's token).
- `styles/paradise.css`: the select joins the HUD-pill group (like the sort trigger). The
  label and chevron get light text with a shadow over the scene, and the native options
  are opaque and dark.
- `components/Sidebar.jsx` + `styles/shell.css`: `accountEmailParts` inserts `<wbr>` before
  «@». `.sb-foot-name` is 12 px with `overflow-wrap:anywhere` and its full address is in
  `title`. `.sb-foot-meta` is a flex column, so `.sb-foot-sub` (sync, 12 px) is always on
  its own line. The row aligns to the top when the email wraps.
- Branding: the sidebar wordmark is `JENKIN` (the SVG is `aria-hidden`, and the button's
  `aria-label` and collapsed tooltip say JENKIN). The login shows `auth-brand` JENKIN.
  `index.html` has `<title>JENKIN</title>`, `application-name` and
  `apple-mobile-web-app-title`. The RU/UK product mentions (14 keys each) say JENKIN.
- Locale: +1 key `tasks_filter_label` in RU/UK. The dictionary pin moves 1818/1817 →
  1819/1818.
- Tests: new `src/test/jenkin-ui.test.jsx` (11 tests: RU/UK select options and label, no
  chips, sort separate, title/date token, email wrap point and title, sync line order,
  12 px floor, branding, unchanged storage keys and export names). Two assertions were
  updated for the new markup and copy (`clarify-ui`, `analytics-system-review`).

## Validation

- `apps/web`: `npm test` shows **738 passed / 53 files**. `npm run typecheck`, `npm run lint`
  and `npm run build` PASS. `git diff --check` is clean.
- Backend: not rerun, because no backend file changed. `alembic heads` = `20260930_0009`.
- Browser (production `vite preview` + API on **lifeos_test**, disposable user with a
  71-character email; test credentials only in the session scratchpad):
  - Filter select, driven through its `change` event: all 6 rows, today 0, overdue 0 (seed
    tasks are undated), routine 3, stakes 2, Waiting shows the Waiting view, done 1 (the
    completed row). The sort label is unchanged after every switch.
  - Matrix: 320 / 390 / 768 / 1440 × RU / UK × dark / light / paradise-day /
    paradise-night: 32 measured configurations from 16 full iframe loads, with UK switched
    in place after each RU measurement. Every configuration had 0 horizontal document overflow. Filter and
    sort were inside the viewport, the select text was not clipped, title and date were
    both 12px, and the RU/UK label was correct. Where the sidebar shows (≥641 px), the
    email was 12 px with 0 overflow and inside the sidebar, and sync was 12 px on its own
    line below it. The 71-character address wraps to 4 lines at 12 px.
  - Visual spot checks: 390 light UK (Tasks) and 1440 paradise-day (Tasks and sidebar).
  - Document title "JENKIN"; sidebar logo `aria-label` "JENKIN".
- Not verified: the native option popup's rendering (OS-drawn, not capturable), the login
  page visually (covered by a source test only), and a screen-reader run.

## Observed, not changed

- Paradise-day: an unchecked `.task-check` border (`rgba(255,255,255,0.22)`) is almost
  invisible on the cream task card. This existed before this pass (no `.task-check` rule
  was touched) and needs a separate fix.
- Backend System Review DOCX/PDF exports still say «Самопроверка LifeOS» / «правило
  LifeOS», so they differ from the in-app JENKIN copy (plan §1.3 R1).
- `lifeos_dev` is at `20260721_0001`, not the head `20260930_0009` (read-only check). It is
  not current; see plan §12.
