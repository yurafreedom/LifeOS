# LifeOS — UI sound effects

Date: 2026-09-30 · Branch `fix/lifeos-completion-audit` · HEAD `1b396eb` (origin/main `5e858bb`)
Status: **implemented in the working tree, UNCOMMITTED, not pushed, no PR, not deployed.**
The working tree also carries the earlier, unrelated completion-audit follow-up (D1–D3) changes; they were
preserved untouched except where noted under "Shared files".

## Honesty note — what was and was not heard

No listening was possible in this environment. Everything below about the clips is **signal analysis**
(ffmpeg decode + numpy: duration, peak, RMS, envelope, spectral centroid, silence, cross-correlation) or
**filename-based hypothesis**. Browser verification proves that the right clip started, with the right
window and gain, exactly once — not how it sounds. The Settings → «Звуковые эффекты» panel exists for the
owner's listening review and reassignment.

## 1. Asset inspection (measured)

All files: MP3, 44.1 kHz, stereo. "Active" = span above −50 dB relative to the clip peak.

| File | Duration | Peak dBFS | Active RMS dBFS | Shape (50 ms envelope) | Centroid |
|---|---|---|---|---|---|
| click.mp3 | 1.018 s | −25.6 | −43.5 | two ticks ~60 ms apart, 185 ms active, **0.80 s digital silence tail** | 11.9 kHz |
| close_window.mp3 | 0.313 s | −8.5 | −26.4 | rising 0.3 s texture, peak at the end | 14.3 kHz |
| decoding.mp3 | 0.601 s | −20.8 | −40.1 | immediate attack, 0.6 s bright flutter | 11.9 kHz |
| expand.mp3 | 4.362 s | +2.6 (inter-sample) | −14.6 | **4.35 s swell, peak at 2.72 s** | 53 Hz |
| hover_cta_in / _out.mp3 | 0.888 s | −11.2 | −29.1 | 0.4 s swell and decay (mirror pair) | 150 Hz |
| hover_ui_in / _out.mp3 | 0.078 / 0.052 s | −34.5 / −34.1 | −45 / −48 | single ~30 ms tick | 13.2 / 11.6 kHz |
| menu_in.mp3 | 1.802 s | −1.2 | −19.7 | swell, peak at 0.85 s | 73 Hz |
| menu_out.mp3 | 2.247 s | −1.2 | −20.4 | swell, peak at 0.91 s | 75 Hz |
| quick_buildup.mp3 | 0.522 s | −18.8 | −38.0 | 0.5 s crescendo that stops abruptly | 4.7 kHz |
| release.mp3 | 2.508 s | −9.0 | −29.3 | immediate attack, ~1.8 s decay | 5.0 kHz |

The clips span ~30 dB of loudness, so each gets a measured gain trim (§4).

## 2. sfx.mp3 analysis

Source: `sfx/sfx.mp3`, 34.000 s, 429 189 B, sha1 `a85e939f…c953` (unchanged).

Segmentation: at thresholds −70/−60/−55 dBFS the file splits into the **same 12 segments**, separated by
~2 s of *digital* silence (−180 dB), so the split is unambiguous. No segment contains an internal pause long
enough to be mistaken for a boundary (gaps < 150 ms were merged). Cross-correlation against every standalone
file (normalized, full-resolution):

| # | Sprite range (s) | Best match | NCC | Level vs file | Finding |
|---|---|---|---|---|---|
| 01 | 0.00–0.25 | click | 0.69 | +4.7 dB | **variant** — same shape/spectrum, different render |
| 02 | 3.00–3.31 | close_window | 0.998 | 0.0 | duplicate |
| 03 | 5.00–5.63 | decoding | 0.65 | +5.3 dB | **variant** |
| 04 | 7.00–11.27 | expand | 1.000 | 0.0 | duplicate |
| 05 | 13.00–13.85 | hover_cta_in | 0.999 | 0.0 | duplicate |
| 06 | 15.05–15.90 | hover_cta_out | 1.000 | 0.0 | duplicate |
| 07 | 16.99–17.10 | hover_ui_in | 0.79 | +2.4 dB | **variant** — a ~65 ms *double* tick (file: single ~30 ms tick) |
| 08 | 18.99–19.10 | hover_ui_in/out | 0.68 | +4.5 dB | **variant** — double tick |
| 09 | 21.01–22.73 | menu_in | 1.000 | 0.0 | duplicate |
| 10 | 24.06–26.24 | menu_out | 1.000 | 0.0 | duplicate |
| 11 | 28.14–28.51 | quick_buildup | 1.000 | 0.0 | duplicate |
| 12 | 29.99–32.02 | release | 0.78 | +1.7 dB | **variant** |

Conclusion: sfx.mp3 is a demo reel of the 12 standalone cues **in alphabetical filename order**; 7 are exact
duplicates and 5 are alternate renders.

Decision: **separate clips, no sprite.** Only the 5 non-duplicate segments were exported, losslessly with
`ffmpeg -ss/-to -c copy` (frame-boundary cuts placed inside the 2 s silent gaps; no re-encode). Each cut
decodes **bit-exactly** to its sprite region (NCC 1.00000, max sample difference 0). Leading/trailing gap
silence is excluded at playback by the catalog's `start`/`end` window on the decoded buffer. A sprite would
have forced a 429 KB download for five cues totalling ~150 KB, with no playback benefit.
Neutral names (meaning uncertain): `sfx_seg01/03/07/08/12.mp3`. They are unassigned by default, not
prefetched, and shown in the panel with their source range and nearest standalone file. sfx.mp3 itself is not
bundled.

## 3. Semantic events and assignments

| Event | Default clip | Basis | Where it fires |
|---|---|---|---|
| `control.activate` | click | filename | any eligible control (button, link, tab, menu item, switch, option, summary, checkbox, radio) |
| `menu.open` / `menu.close` | menu_in / menu_out | filename | trigger with `aria-haspopup` + `aria-expanded` (AA factor/importance menus, Quick Add category, Tasks sort); Escape that closes an open popup |
| `panel.expand` / `panel.collapse` | expand / **None** | filename / no clip fits | `aria-expanded` without popup, `<details><summary>`, Quick Add schedule/notes expanders (`data-sfx`) |
| `modal.close` | close_window | filename | a `[role=dialog]` open before the gesture is gone after it: X / Cancel, Escape, backdrop press. **Not** for primary confirmations (Save, Complete) |
| `hover.enter` / `hover.leave` | hover_ui_in / _out | filename | control-sized eligible controls, fine hover-capable pointer only |
| `hover.cta.enter` / `.leave` | hover_cta_in / _out | filename | primary CTAs (paradise capsule set + submit buttons) |
| `task.complete` | release | measured shape (immediate attack, decay) — hypothesis | open → done in `LifeDataContext.toggleTask` / `completeTask` (Tasks list, Task detail, Calendar Day Manager) |
| `save.success` | decoding | measured shape — hypothesis | after the server acknowledged the retention policy PUT |

Unassigned: `quick_buildup` (a crescendo that ends abruptly — no LifeOS event is an "about to" moment) and
the five sfx.mp3 variants.

Success-boundary decisions:
- `task.complete` fires on the **local** state transition (the moment the UI shows the task done); the sync
  coordinator then queues it for the server. The panel says so («в момент отметки в приложении;
  синхронизация с сервером идёт отдельно»). Reopening is silent.
- `save.success` is labelled «Сохранено на сервере» and is emitted **only** where a save awaits a server
  acknowledgement: the retention policy PUT. Local-first saves (Quick Add, task edits, finance entries that are
  queued in the AA write queue) get the ordinary activation cue — no "saved" cue that would overstate
  persistence. Background sync («сохранено на сервере» status) never sounds.

Measured concern for the owner's review: `expand.mp3` peaks 2.7 s after the click and `menu_*` ~0.9 s after;
these may feel late for UI. They are kept as instructed (filename defaults) and are one click to reassign.

## 4. Playback architecture

```
sound/catalog.ts      assets (bundled URL, start/end window, gain trim, sprite source) + events
sound/preferences.ts  defaults + field-by-field validation, localStorage `lifeOsSfx`
sound/engine.ts       Web Audio engine (decoded buffers, channels, voice cap, late drop, never throws)
sound/gestures.ts     one cue per trusted gesture; hover; delegated listeners
sound/index.ts        facade: sfx.emit / sfx.preview / installUiSound / preference store
app/useUiSound.js     useUiSound() in AppShell; useSoundPreferences() for Settings
```

- **Gesture arbitration.** A trusted `click` (pointer, touch and keyboard activation all produce exactly one),
  a trusted Escape, or a trusted press opens a gesture; it resolves on the next task, after React committed.
  Candidates compete by priority: app event (90) > dialog actually closed (70) > explicit/menu/panel (60) >
  activation (10). So a menu trigger plays only the menu cue, Complete in a dialog plays only
  `task.complete`, an X plays only `modal.close`, and nested markup resolves to its single control. Only
  eligible, enabled controls sound; text, cards and inputs are silent; `data-sfx="none"` silences a subtree.
  Programmatic `.click()`, focus, render, hydration and background refresh are never trusted gestures.
- **Why a delegated listener is not "every document click".** It plays only for an eligible control or an app
  event; it follows the repository's precedent (`paradisePress.js`) because LifeOS has no shared Button
  component.
- **Hover.** Mouse pointer type, `(hover: hover) and (pointer: fine)`, no pressed buttons, control-sized
  targets only (≤ 72 × 420 px), 70 ms minimum gap, quiet for 250 ms after any press/cue, and only on genuine
  motion (the boundary event is at a new pointer position, or a move landed within 16 ms). Moving straight
  from one control to another voices only the enter cue. Hover bus −6 dB. Off by default.
- **Engine.** AudioContext created inside the first trusted gesture; the first gesture then prefetches only
  assigned, currently playable clips (hover clips only if hover is on). A cue whose clip is not decoded
  within 120 ms is dropped, never played late. One voice per channel (new cue fades the previous in 12 ms),
  6 voices max, identical event within 40 ms dropped. Master gain = volume (linear), applied live. Mute stops
  voices immediately. Fetch/decode failures are cached for 10 s (no request per click); every audio error is
  swallowed. Nodes disconnect on end.
- **Loudness trims.** Measured toward ≈ −30 dBFS active RMS, clamped ±12 dB, peak ≤ −3 dBFS
  (e.g. click +12 dB, expand −12 dB, menu −10 dB). Previews use the same trims.
- **Remounts.** `installUiSound()` is reference counted; StrictMode remount leaves exactly one listener set;
  the engine and AudioContext are module singletons.

## 5. Preferences

Browser-local `localStorage.lifeOsSfx` (`{v:1, enabled, volume, hover, assignments}`), the same mechanism as
`lifeOsTheme` / `lifeOsScene`: volume and whether a device makes sound are device settings. No server field,
no migration. Invalid fields fall back to defaults one by one; unknown assets fall back to the event default;
`null` = None. Another tab picks up changes via the `storage` event.
Defaults (owner-authorized): enabled, volume 25 %, hover off.

## 6. Settings panel

Settings → «Звуковые эффекты» / «Звукові ефекти»: master switch, volume slider, hover switch;
assignment workflow — pick an event (list shows its current clip) → preview candidates (play/stop; one preview
at a time; works while UI sounds are off; uses the volume) → «назначить» (or «без звука») → try it on the
«Проверка в действии» bench (button, CTA, menu, dialog, details panel, simulated task completion / save),
which runs through the real pipeline. Configuration controls are `data-sfx="none"`, so previews never get a
click on top. Candidates show file, playback duration and, for sprite clips, `из sfx.mp3, 5,00–5,63 с ·
похож на decoding.mp3`. «восстановить по умолчанию» restores all defaults. Technical data appears only here.
RU/UK: 48 keys each.

## 7. Asset sizes and loading

17 runtime clips, 528 KB on disk (standalone 12 = byte-identical copies of `sfx/`; 5 lossless cuts).
Production build: 15 fingerprinted `.mp3` files in `dist/assets/`; `hover_ui_in/out` (2.3 / 2.1 KB) fall
under Vite's 4 KB inline limit and ship as `data:` URIs inside the JS bundle.
Main JS after the change: 340.59 kB (105.72 kB gzip).
Loading verified in the production preview: **0 audio requests and no AudioContext at page load**; after the
first click, only the 7 assigned non-hover clips (~284 KB) were fetched, all HTTP 200; hover clips only after
enabling hover; the 5 variants and quick_buildup only when previewed/assigned.

## 8. Tests

New: `src/test/ui-sound.test.ts` (34) and `src/test/ui-sound-settings.test.jsx` (6), mocked Web Audio / DOM.
They cover defaults and validation, catalog integrity, "None", reassignment, mute and live volume, voice
bounds under rapid repeats, duplicate guard, hover gating (off, touch, non-hover device, rate limit, still
cursor, press re-render, adjacent controls), failure isolation (context, fetch, decode, graph), no late
playback, preview while muted, one cue per gesture, app event outranking the click, modal close vs primary
confirmation, Escape menu close, silenced areas, untrusted clicks, listener disposal, task-completion and
save-success timing, the panel in RU/UK. They do not prove anything is audible.

Frontend gate (apps/web): `npm test` **601 passed / 47 files**; `npm run typecheck` PASS; `npm run lint`
PASS; `npm run build` PASS; repo `git diff --check` PASS. Backend: no backend change; pytest/ruff/alembic
not rerun for this task (`alembic current` on lifeos_test = `20260930_0009 (head)`).

## 9. Browser verification (production build, `vite preview` + API on lifeos_test)

Account: new disposable `qa-sfx-20260930@example.com` in `lifeos_test` only. Playback observed by
instrumenting `AudioBufferSourceNode.start` (offset/duration identify the clip).

| Check | Result |
|---|---|
| page load | no `.mp3` request, no AudioContext |
| first interaction (filter chip) | context created + `click` plays on that first click |
| menu (Tasks sort, Quick Add category) | open → `menu_in`, close → `menu_out`, once each |
| keyboard | Enter / Space on the sort trigger → one menu cue each; Escape closes dialog → one `close_window` |
| programmatic `.click()` ×2 | silent |
| task complete (checkbox) | `release` only (no click on top) |
| Quick Add | expander → `expand`; option → `click`; X → `close_window`; backdrop press → `close_window`; Save → `click` only |
| save.success | Save policy: `click` at press; PUT 201 → `decoding` 2 ms later |
| mute | toggles and navigation silent; preview still works |
| preview | plays at volume while muted; second preview replaces the first |
| reassignment | activation → close_window: nav clicks play it; persisted; survives reload |
| hover on | button → `hover_ui_in`; adjacent CTA → `hover_cta_in` (no leave); off CTA → `hover_cta_out`; dialog opening under the cursor → no hover cue (after fixes, 3/3 rounds) |
| hover off | no hover cues |
| restore defaults | click / 25 % / hover off |
| missing assets (all `.mp3` fetches rejected) | menu still opens; no uncaught error/rejection |
| console | no page errors (only warnings from an unrelated browser extension) |
| Settings layout | 0 horizontal overflow in all 24 combinations: 320/390/768/1440 × RU/UK × dark/light/paradise (iframe harness; theme and locale asserted per frame); screenshots at 320 paradise UK, 320 light RU, 768 paradise UK, 1440 light RU |

Defects found and fixed during verification: adjacent-control hover lost its enter cue to the rate limit; a
dialog opening under the cursor produced a stray hover-leave (boundary events at an unchanged position, and
before the gesture resolved); at 768 px the candidate list was squeezed (now a container query on the
section's own width); at 320 px the assign button now sits below the metadata.

## 10. Limitations

- Not listened to. Default mappings for `task.complete`, `save.success` and the long `expand`/`menu` swells
  need the owner's ear.
- Touch: verified by unit tests and the `(hover: hover) and (pointer: fine)` gate; no real touch device or
  touch emulation was available in the browser tooling. Tap → click → one cue follows the same code path as
  mouse clicks.
- Windows narrower than 625 px could not be produced in this Chrome; 320/390 were checked in same-origin
  iframes at exact widths.
- `save.success` currently has one real boundary (retention policy); other server-acknowledged saves can
  adopt it with one `sfx.emit` after their awaited success.
- Hover before the first click is silent (browsers require a gesture to start audio).
- MP3 encoder-delay handling can differ slightly by browser; trim windows include ~10 ms pre-roll / 30 ms
  post-roll margins.

## 11. Changed files (this task)

New:
- `apps/web/src/sound/{catalog.ts,engine.ts,gestures.ts,preferences.ts,index.ts,assets.d.ts}`
- `apps/web/src/app/useUiSound.js`
- `apps/web/src/components/settings/SoundSection.jsx`
- `apps/web/src/assets/sfx/` — 12 copies + `sfx_seg01/03/07/08/12.mp3`
- `apps/web/src/test/ui-sound.test.ts`, `apps/web/src/test/ui-sound-settings.test.jsx`
- this report

Modified:
- `apps/web/src/App.jsx` (install hook)
- `apps/web/src/context/LifeDataContext.jsx` (`completesTask`, emit on completion)
- `apps/web/src/components/settings/RetentionSection.jsx` (`savePolicy` → `save.success`)
- `apps/web/src/components/SettingsPage.jsx` (section)
- `apps/web/src/components/QuickAddModal.jsx`, `apps/web/src/pages/TasksPage.jsx` (`aria-haspopup`/`aria-expanded`, `data-sfx` on expanders)
- `apps/web/src/styles/home.css`, `apps/web/src/styles/theme-light.css` (`.set-sfx*`)
- `Outputs/architecture/module-boundaries.md` (UI sound section), `LIFEOS_MASTER_CONTEXT.md` (status)

Shared files that already had uncommitted D1–D3 changes (only appended to): `context/locale/ru.js`,
`context/locale/uk.js` (+48 keys each), `test/locale-shape.test.ts` (key counts 1721/1720 → 1769/1768),
`LIFEOS_MASTER_CONTEXT.md`.

Untouched: `sfx/` (owner staging, untracked), stash entries, backend, database schema, dependencies.
Test-data side effects: one QA user and one 5-year retention policy for it in `lifeos_test`.

## 12. Publication status

Uncommitted working tree on `fix/lifeos-completion-audit` at `1b396eb`. Not committed, not pushed, no PR,
not merged, not deployed. Note for committing: new files under `Outputs/` need the canonical-case
`git update-index` staging (the on-disk directory is lowercase).
