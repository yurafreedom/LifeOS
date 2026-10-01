# JENKIN usability + verification follow-up

Date: 2026-10-01 (Europe/Kyiv) · Branch `feat/jenkin-usability-followup-20261001` (pushed; **not merged, no PR,
not deployed**) · Owner-requested worktree `/Users/yurasachenko/LifeOS/LifeOS_usability-followup` · Start:
`69477c9` = tip of `integration/jenkin-combined-20261001` (§93, latest completed integration checkpoint, equal to
`origin`) · Code commit `03c00b8` · Master context §94.

Not touched: the everyday combined worktree `LifeOS_combined` (stayed clean; its venv was used read-only as a
pytest interpreter, see §4), the L2/S1/S2/launcher worktrees, the canonical checkout and its staged files, the
owner's `~/.jenkin-preview` (token, keyrings, backups), `lifeos_preview_personal`, `lifeos_dev`, `lifeos_test` and
the earlier QA databases.

## 1. Issues reproduced before changing code (baseline `69477c9`, real API + production build)

| Issue | Reproduction |
|---|---|
| Locale not persisted | Locale was `useState('ru')` in `App()`. With candidate keys in `localStorage`, the setup page still rendered RU with `<html lang="ru">`; after choosing UK in Settings a reload returned to RU |
| Phone sync chip covers content | 390 px: the fixed chip (168×28 at top-right) intersected the greeting `h1` at rest; after scrolling 200 px it covered the first Home stat card (a button) and its hint text |
| Home empty hints < 12 px | `.stat-context.is-empty` computed 11 px (`--text-xs`) on Home (4 visible hints on a fresh account) |

Found while verifying the fixes (also reproduced on the baseline CSS, then fixed):
- **768 px (sidebar layout, chip still fixed):** the chip covered the DejaVu + UK greeting **at rest**, and the
  search field and stat cards after scrolling — 16/16 configurations. Tablets had the same defect as phones.
- **1024 px:** UK "на цей тиждень задач немає" was already ellipsized at 11 px; at 12 px two hints per locale would
  have been cut off.

## 2. Changes (`03c00b8`)

### 2.1 Persisted RU/UK locale
- New `apps/web/src/app/useLocalePreference.js`, following the `lifeOsFont`/`lifeOsTheme` convention:
  `localStorage.lifeOsLocale`; values validated against `LIFE_LOCALES` (`ru`, `uk`); missing, unreadable or invalid
  values (`en`, `UK`, `<img src=x>`, JSON, …) → RU and are never trusted; storage failures are swallowed.
- `App()` uses it instead of `useState('ru')`. `LifeLocaleContext` sits above `AuthProvider`, so the login,
  first-account setup, recovery/invite action pages and the boot screen all follow it.
- `<html lang>` follows the locale, and `index.html` sets it before first paint with the same two-value
  validation.
- **Tab behaviour (deliberate, kept):** the stored value is read once when a tab starts. There is no
  `storage` listener, matching theme and font: switching language in one tab never flips the text of another
  open tab mid-use; that tab picks the choice up on its next load. The locale is a device preference — not per
  account, not in the snapshot, unaffected by the account-isolated tab logic (S1).

### 2.2 Sync chip that cannot cover page text or controls
`styles/paradise.css` (end of the sync block); `SyncStatus.jsx`, the sync coordinator and their semantics are
unchanged (`role="status"` for offline/error/conflict; Settings keeps retry / export unsaved / load server
version; leaving with unsaved changes is still guarded).
- **saved / saving:** never `position: fixed` any more. Below 1024 px it takes its own right-aligned row under the
  top bar. From 1024 px it stays in the approved top-right spot, but `absolute`, so it scrolls away with the top
  bar instead of floating over content.
- **offline / error / conflict:** a sticky full-width band in the content column at every width — in flow at
  rest (covers nothing) and pinned at the top while scrolling, in the bottom nav's chrome (`--nav-bg` +
  `blur(14px)`), so it reads as chrome rather than a pill over text. While it shows, `html { scroll-padding-top:
  56px }` keeps focus moves and `scrollIntoView` below it. Reason: phones and the collapsed sidebar show no other
  status, so these states must stay visible while scrolling.
- Under `prefers-reduced-motion: reduce` the chip's saving pulse stops, mirroring the existing sidebar-dot rule
  (state is still shown by colour and text).

### 2.3 Home empty-state hints
`.stat-context.is-empty` no longer overrides the size: it inherits `.stat-context`'s 12 px `--text-sm` and only
mutes the colour. Empty hints also wrap (`white-space: normal; overflow-wrap: anywhere`) instead of ellipsizing,
so the action word ("задать" / "задати") is never cut off. Live (non-empty) context lines keep their one-line
ellipsis. The approved 11 px mono eyebrows (`tb-eyebrow`, `chart-card-eyebrow`, `aa-eyebrow`) were not changed.

### 2.4 Tests
New `src/test/usability-followup.test.jsx` (20 tests):
- locale validation, read/write/apply and storage failures;
- `index.html` pre-paint;
- `App` boot screen in the stored locale with an invalid value ignored;
- login and setup pages rendered in RU and UK from storage;
- no `storage` listener registered;
- chip CSS contract (no fixed layer; absolute ≥1024; row <1024; sticky band at every width; phone gutters;
  scroll padding; reduced-motion pulse; recovery role/actions unchanged);
- Home hint size and wrapping.

## 3. Isolated synthetic environment

- Launcher run from this worktree with `JENKIN_PREVIEW_HOME=<session scratch>` and DB `lifeos_preview_ufqa`
  (new) on ports **4730 / 8730**. All of its state — config, venv, build, keyring, logs and backups — lived in
  scratch.
- Bootstrap token: generated in-session with `secrets.token_urlsafe(40)` and pre-written to the scratch home.
  The owner's token, keyring and account were never read.
- QA account `ufqa-owner@example.com` with an in-session generated password.
- Synthetic documents generated in-session: two PNGs and one PDF.
- Restore target: a separate API on **8731** and web on **4731**.
- Side effect: on first run the launcher copied the disposable QA token to the macOS clipboard (its normal
  first-run behaviour).
- Cleanup: both synthetic databases I created (`lifeos_preview_ufqa`, `lifeos_preview_ufqa_restored`) and the
  disposable `lifeos_ufqa_test` were dropped after their contents were checked as synthetic only. All QA
  processes were stopped (ports 4730/8730/4731/8731/4799/9333/9334 free). The browser-saved files were moved out
  of `~/Downloads` into scratch.

## 4. Executed checks

### 4.1 Required and focused regressions

| Check | Result |
|---|---|
| `apps/web: npm test` | **963 passed / 61 files** (baseline 943/60 + 20 new) — re-run on the final tree, see §6 |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| `npm run release-notes -- --check`; `release-notes.test.jsx` | valid, CHANGELOG in sync; 41 passed (refs incl. `03c00b8` are ancestors of HEAD) |
| Focused backend: `test_crypto_envelope`, `test_document_rotation`, `test_document_validation`, `test_documents_api`, `test_export` | **100 passed** on a disposable `lifeos_ufqa_test` (created, dropped). Interpreter: `LifeOS_combined/apps/api/.venv` read-only (`PYTHONDONTWRITEBYTECODE=1`, no cache); `app` imported from this worktree (verified). No backend file changed, so the full suite was not re-run (last full run on the same backend code: 1323 + 1 skipped, §92) |
| `git diff --check` | PASS |

### 4.2 First-account setup through the real UI
`/?bootstrap=1` on the empty `lifeos_preview_ufqa`: email, password ×2 and the disposable token were **typed**
into the form and submitted with a click → landed on Home as `ufqa-owner@example.com` ("saved on server").
Later, after the locale fix, `/?bootstrap=1` rendered fully in UK (`створити перший акаунт`, `lang="uk"`;
screenshot 01).

### 4.3 Locale in the real browser
- Settings → оформление → UK → full reload: UK UI and sidebar, `lang="uk"`, stored `uk`.
- A second tab started in UK. Switching tab A to RU left tab B in UK (stored `ru`) until B reloaded, which then
  showed RU.
- Signing out through «вийти» showed the UK login page («увійти до JENKIN», notice in UK). Tab A, signed out by
  broadcast, kept its own RU.
- Cold loads of the login and setup pages were in the stored locale.
- Stored `<img src=x>` and `UK` → RU.
- A sign-in through the UK login form worked.

### 4.4 Sync chip — measured, real API

Method: same-origin iframes at exact widths (Chrome will not size a window below ~625 px), one fresh load per
configuration. The probe checks every visible text node (`Range` rects) and every control in `.main` against the
chip/band rect at the top, middle and bottom scroll positions, plus horizontal overflow.

- **Saved state, Home: 112/112 clean** (320/390/600/768/900/1024/1440 × dark/light/paradise-day/paradise-night ×
  Current/DejaVu × RU/UK). Expected mode per width (static <1024, absolute ≥1024), 0 intersections, 0 overflow,
  correct `lang`/`data-theme`/`data-font`; hints 12 px, never truncated (≤1 line ≤600 px, ≤3 lines at 768).
- **Other routes:** Tasks, Settings, Documents, Calendar, Updates × 320/390 × RU/UK = **20/20** clean. Desktop Home
  1024/1440 × RU/UK clean.
- **Real problem states.** These are the real coordinator phases; only the network outcome of the state `PUT`
  was forced in the iframe.
  - `offline` (fetch rejects): **18/18** configurations — 320/768/1024/1440 × 4 themes, plus collapsed sidebar at
    1440 and 1024. In each: sticky band, 0 intersections at rest, top 0 when scrolled, full content-column width,
    per-theme `--nav-bg` + blur, `scroll-padding-top: 56px`. After the network was restored and `online` fired,
    the real retry returned to `saved` with the normal chip mode.
    - With the sidebar expanded, its footer showed the same phase; collapsed, the band was the only indicator.
  - An earlier 23-config pass at 700 px height confirmed the same, except stickiness at ≥1024, because Home barely
    scrolls there; hence the 360 px-tall re-run. That pass's background reading was invalid (read after recovery,
    a probe bug), and was re-measured.
  - `error` (HTTP 500) at 390: band, 0 hits.
  - `conflict` at 390: a **genuine 409** from the real API after the server revision was advanced by re-PUTting
    the server's own snapshot unchanged. The band showed it, the Settings row offered export/reload, and the app's
    unsaved-changes guard blocked navigation away.

### 4.5 Browser-triggered document downloads (byte equality)
- **Upload:** through the real Documents UI. The file input was filled via `DataTransfer` with exact bytes fetched
  from a localhost-only CORS file server (a first attempt pasting base64 corrupted the bytes and was correctly
  refused as invalid). Uploaded: PNG «UFQA loan scan», PDF «UFQA statement», then version 2 of the PNG through
  the details panel.
- **Download:** the real «завантажити» buttons were clicked. Chrome saved the files to `~/Downloads` and they
  were hashed with `shasum -a 256`.

| File | Bytes | SHA-256 equal to original |
|---|---|---|
| version 1 (`ufqa-loan-scan-v1.png`) | 592 | yes |
| version 2 (`ufqa-loan-scan-v2.png`) | 568 | yes |
| current version button (= v2, saved as `… (1).png`) | 568 | yes |
| PDF (`ufqa-statement.pdf`) | 597 | yes |

### 4.6 Real restore of a launcher backup + decryption
1. **Backup:** the launcher's own `scripts/preview/launcher.py::backup_before_migration` was called directly
   against the scratch state home.
   - Why directly: the launcher takes a backup only before an actual migration, and the QA DB was already at
     head `20261001_0012`.
   - Produced: `database.dump` (custom format, 226 kB), a byte-identical keyring copy (`cmp`) and
     `manifest.json`, all 0600 in a 0700 directory.
2. **Restore:** the manifest's `restore` command was run verbatim
   (`createdb lifeos_preview_ufqa_restored && pg_restore -d …`) → exit 0.
3. **Fidelity:** per-table row count + content digest: **40/40 tables identical** (users 1, documents 2,
   document_versions 3, document_blobs 3, sessions, snapshots, audit…).
4. **Decryption with the backup's keyring:** an API on 8731 (documents enabled, `LIFEOS_KEYRING_FILE` = the
   backup's keyring copy, a fresh token) and the same build on 4731.
   - Signed out and signed in again **through the UI**.
   - Titles decrypted; v1, v2 and the PDF were downloaded through the UI buttons, all three **SHA-256-equal** to
     the originals (API log: three `…/content` 200s).
5. **Negative control:** the same restored DB with an independently generated *different* keyring →
   `503 document_key_unavailable`, list `state: key_unavailable`, titles `null`.

### 4.7 Reduced motion on the release-notes page
Headless Chrome (separate scratch profile) with **real CDP emulation**
`Emulation.setEmulatedMedia(prefers-reduced-motion)`, signed in, `#/updates`, RU and UK.

| Emulation | `matchMedia` | Chevron transition | After toggling the entry |
|---|---|---|---|
| `reduce` | true | `0s none` | flips instantly, **0** running animations; re-expands; 0 overflow |
| `no-preference` (control) | — | 180 ms `transform` | the transform transition runs |

Screenshot 08.

## 5. Screenshots (`Outputs/Implementations/jenkin-usability-followup_20261001/`)
`01-setup-uk-390.jpg`, `02-home-390-dark-uk-saved.jpg`, `03-home-390-paradise-day-uk-offline-scrolled.jpg`,
`04-home-768-dark-uk-dejavu-saved.jpg`, `05-home-1024-light-uk-hints.jpg`,
`06-home-1440-dark-ru-collapsed-offline-scrolled.jpg`, `07-home-1440-paradise-night-ru-saved.jpg`,
`08-updates-1440-reduced-motion-uk.jpg` (headless Chrome, exact viewports, synthetic data).

## 6. Docs
- `releaseNotes.json`: Unreleased gained one improvement (persisted language) and two fixes (sync indicator, Home
  hints), RU + UK, plus ref `03c00b8`.
- `CHANGELOG.md`: regenerated with `npm run release-notes`.
- `docs/product/JENKIN_PRODUCT_OVERVIEW.md`: locale row updated.
- Module boundaries: locale hook and chip contract.
- Master context: header line and §94; the §78 harness note annotated as superseded.

## 7. Remaining limitations
- The launcher backup was produced by calling `backup_before_migration` directly, not by a real
  `upgrade`-triggered run; no newer migration exists to trigger one honestly. The restore and decryption were
  real.
- Uploads used a `DataTransfer` on the real file input; the OS file picker itself was not driven.
- Forced phases: `offline` and `error` were reached by failing the state `PUT` inside the test iframe (the API
  was not actually unreachable). `conflict` was a genuine 409. Real `error`/`conflict` were checked at 390 only;
  their band styling is shared with `offline`, which was checked across all widths and themes.
- Not run: Firefox/WebKit, real iOS/Android devices (narrow widths were measured in iframes and headless
  device-metrics emulation), screen readers, the OS-level reduced-motion setting (CDP emulation was used), the
  full backend suite (no backend change).
- `aa-eyebrow` "системні сигнали" renders 9.5 px; it is part of the approved eyebrow style and was not
  documented as a defect, so it was left unchanged — flagged for an owner decision.
- QA left synthetic quick notes in the (now dropped) QA database only; nothing else persists except the scratch
  directory and the browser's per-origin `localStorage` for `127.0.0.1:4730/4731` (theme, font and locale keys).
