# JENKIN branding asset handoff

Prepared: 2026-10-01 (Europe/Kyiv)

This is a source-reference handoff for Claude Code Cloud. It publishes the
owner-approved logo concepts and DejaVu Sans package without implementing them
in the application. It does not authorize a merge, deployment, force-push,
repository rename, server-schema change, or push to `main`.

## 1. Repository and publication context

- Repository: `yurafreedom/LifeOS`
- Target development branch: `handoff/jenkin-cloud-20260930`.
- Initial inspection found local and remote target at
  `d396fa941b58b588f80e3be8958667f8bdc6a604` with divergence `0 0`.
- A required pre-publication fetch then found that Claude Code Cloud had advanced
  the remote target to `0730f84cc5a54000c68795c906ac2107433431f3`
  (`feat(jenkin): shell material tokens, real account block, visible JENKIN output`)
  while these assets were being prepared.
- To preserve that concurrent commit without merge, rebase, reset, stash, or
  force-push, the branding asset commit is published on
  `feat/jenkin-branding-assets-20261001`, based directly on remote target
  `0730f84cc5a54000c68795c906ac2107433431f3`.
- The remote target branch itself is not changed by this preparation. Claude
  Code Cloud must incorporate the asset branch before using the packages on its
  current development branch.
- The existing untracked owner files remain outside this commit.
- The asset commit contains only this document and
  `design-references/jenkin-branding/`.

Cloud work should discover its checkout with `git rev-parse --show-toplevel`
and use the repository-relative paths below. Do not use a local `/Users/...`
path.

## 2. Original packages and SHA256

The exact source archives were found in the owner's Downloads directory. The
original ZIP bytes are committed at:

| Package | Repository-relative path | SHA256 |
|---|---|---|
| JENKIN logo concepts | `design-references/jenkin-branding/packages/JENKIN-logo-concepts.zip` | `1966f4c78c2372460d343969f4fd3682aad1cd7ce0e5886b2906af56a63cbd0e` |
| DejaVu Sans for JENKIN | `design-references/jenkin-branding/packages/DejaVu-Sans-JENKIN.zip` | `8e645eb3063d7f96ed7560762da5b23f9eaad691b0a81d93ac938610b981f424` |

Both archives passed an entry-path safety check: no absolute paths, drive-root
paths, parent-directory traversal, or symlink entries. `unzip -t` reported no
compressed-data errors. Extraction removed only the redundant single wrapper
folders (`JENKIN-logo-concepts/` and `DejaVu-Sans-JENKIN/`). No asset content was
rewritten, and no macOS metadata was included.

The upstream DejaVu `LICENSE` contains one historical trailing space. The
scoped `design-references/jenkin-branding/.gitattributes` marks only that file
`-diff` so its bytes and legal notice remain exact while repository whitespace
checks continue to cover every other staged text file.

## 3. Approved production decisions

These are the owner's approved decisions and take precedence over exploratory
wording in the package README files:

1. **The chosen production logo direction is 01 Editorial.**
2. Satin (`02-satin-*`), Modular (`03-modular-*`), and the logo-directions
   comparison sheet are reference studies, not production logos.
3. Use the Editorial variants according to context:
   - `01-editorial-light.svg` on dark surfaces;
   - `01-editorial-dark.svg` on light surfaces;
   - `01-editorial-currentcolor.svg` when an inline SVG should inherit a
     controlled current text color.
4. Editorial SVG lettering is outlined and does not require the Editorial
   source font at runtime.
5. The supplied serif J icon is approved as the starting favicon/app-icon
   design. Adapt and export it for small sizes when implementing; do not assume
   the 512 px source is already optimized for every favicon slot.
6. **DejaVu Sans is an optional interface font, not the new default.**
7. Preserve the existing default interface font and add a Settings choice
   between **Current** and **DejaVu Sans**.
8. Persist the font selection as a validated device-local preference, following
   the existing theme/sound/sidebar preference pattern. Do not add a backend
   field, migration, snapshot field, or server-schema change.
9. The Editorial logo does not change when the interface font changes.
10. The font package contains Regular 400, Bold 700, Oblique, and Bold Oblique
    in both original TTF and full WOFF form, plus `fonts.css` and `LICENSE`.
11. Preserve and distribute all license/credit notices with the relevant
    sources. Do not remove `LICENSE` or `FONT-NOTICES.txt`.
12. Both original packages and their complete extracted reference copies must
    remain available to the cloud continuation.

This preparation task intentionally makes no application changes. Claude Code
Cloud should integrate the chosen assets through the production component,
settings, preference, accessibility, theme, build, and test architecture—not by
loading the ZIPs at runtime.

## 4. Logo reference paths

Extracted root:

`design-references/jenkin-branding/logo/`

### Chosen Editorial production direction

- `design-references/jenkin-branding/logo/01-editorial-currentcolor.svg`
- `design-references/jenkin-branding/logo/01-editorial-dark.svg`
- `design-references/jenkin-branding/logo/01-editorial-dark.png`
- `design-references/jenkin-branding/logo/01-editorial-light.svg`
- `design-references/jenkin-branding/logo/01-editorial-light.png`

### Approved starting app icon

- `design-references/jenkin-branding/logo/jenkin-icon.svg`
- `design-references/jenkin-branding/logo/jenkin-icon.png`

### Reference-only alternative directions

- `design-references/jenkin-branding/logo/02-satin-currentcolor.svg`
- `design-references/jenkin-branding/logo/02-satin-dark.svg`
- `design-references/jenkin-branding/logo/02-satin-dark.png`
- `design-references/jenkin-branding/logo/02-satin-light.svg`
- `design-references/jenkin-branding/logo/02-satin-light.png`
- `design-references/jenkin-branding/logo/03-modular-currentcolor.svg`
- `design-references/jenkin-branding/logo/03-modular-dark.svg`
- `design-references/jenkin-branding/logo/03-modular-dark.png`
- `design-references/jenkin-branding/logo/03-modular-light.svg`
- `design-references/jenkin-branding/logo/03-modular-light.png`

### Reference-only comparison and supporting material

- `design-references/jenkin-branding/logo/JENKIN-logo-directions.svg`
- `design-references/jenkin-branding/logo/JENKIN-logo-directions.png`
- `design-references/jenkin-branding/logo/logo-effects.css`
- `design-references/jenkin-branding/logo/README.md`
- `design-references/jenkin-branding/logo/FONT-NOTICES.txt`

The comparison sheet is not a logo asset. `logo-effects.css` is optional design
reference, not a production dependency or instruction to add permanent glow or
continuous animation.

## 5. Font reference paths

Extracted root:

`design-references/jenkin-branding/fonts/`

### Regular 400

- `design-references/jenkin-branding/fonts/DejaVuSans.ttf`
- `design-references/jenkin-branding/fonts/DejaVuSans.woff`

### Bold 700

- `design-references/jenkin-branding/fonts/DejaVuSans-Bold.ttf`
- `design-references/jenkin-branding/fonts/DejaVuSans-Bold.woff`

### Oblique 400

- `design-references/jenkin-branding/fonts/DejaVuSans-Oblique.ttf`
- `design-references/jenkin-branding/fonts/DejaVuSans-Oblique.woff`

### Bold Oblique 700

- `design-references/jenkin-branding/fonts/DejaVuSans-BoldOblique.ttf`
- `design-references/jenkin-branding/fonts/DejaVuSans-BoldOblique.woff`

### Integration reference and license

- `design-references/jenkin-branding/fonts/fonts.css`
- `design-references/jenkin-branding/fonts/README.md`
- `design-references/jenkin-branding/fonts/LICENSE`

`fonts.css` declares all four WOFF faces with `font-display: swap`. It is an
integration reference; production may place/copy the approved runtime font
files into the existing web asset structure as needed, but must keep the
source-reference package and license intact here.

## 6. Verification performed for this handoff

- Logo archive: 22 entries; all 22 extracted files match their archive entry
  SHA256 byte-for-byte.
- Font archive: 11 entries; all 11 extracted files match their archive entry
  SHA256 byte-for-byte.
- Original committed ZIP hashes match the source ZIP hashes shown in section 2.
- Required Editorial light/dark/currentColor SVGs are present and recognized as
  SVG images.
- The serif J source is present as SVG and a 512 × 512 RGBA PNG.
- All four TTF variants are recognized as TrueType fonts.
- All four WOFF variants are recognized as Web Open Font Format files.
- `fonts.css`, the DejaVu `LICENSE`, logo `FONT-NOTICES.txt`, and both package
  README files are present.
- No `.DS_Store` or AppleDouble file was copied.
- The scoped `.gitattributes` preservation rule is repository metadata, not an
  archive asset; the 22-file logo tree and 11-file font tree remain exact
  archive copies.

No application test suite is required for this source-reference-only commit
because no runtime file changes. The publication gate is archive/extraction
verification, explicit staged review, `git diff --check`, normal push, and
post-push remote SHA/path verification.

## 7. Cloud continuation rule

Claude Code Cloud cannot use these new paths from the current
`handoff/jenkin-cloud-20260930` tip until it incorporates
`feat/jenkin-branding-assets-20261001` through the repository's normal
non-rewriting workflow. The asset branch is based directly on the current
remote target commit, so it contains the concurrent cloud work plus this
reference-only asset addition. Do not substitute the design-system ZIP, the
comparison SVG, Satin, or Modular for the selected Editorial production logo.
