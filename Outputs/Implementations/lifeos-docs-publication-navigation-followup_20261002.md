# LifeOS publication navigation follow-up — 2026-10-02

## Verified start and scope

Clean, inactive publication worktree `/Users/yurasachenko/LifeOS/LifeOS_docs-publication` on `docs/jenkin-records-20261002`; local, fetched and live remote HEAD all `e2bf43a039a1ae91c0c54cc5203a3655a73fd263`. Active-session working-directory inspection found no other session in this worktree. Subsequent application/source work was preserved. Pinned integration baseline remains `69477c9365f06d6ac2831f124aa03b7a23fb5214`; main remains `5e858bb0322be0cc729d3d7e73ce359597aada84`.

This is a focused documentation navigation and exposure-accounting correction. It does not certify implementation claims or recollect source documents. Imported content, manifest, source/reference JSON, collection run metadata and original historical publication report are unchanged.

## Generator corrections

`baseline_document` selects an exact original path from the manifest baseline reading set and validates the published object hash and matching source occurrence. It does not choose a feature variant when baseline provenance is unavailable, and no object hashes are hardcoded into the collector.

The primary product reading order links directly to `docs/product/JENKIN_PRODUCT_OVERVIEW.md`. README is an introduction. `ARCHITECTURE.md` is labelled according to its own header: historical June 2026 browser-only prototype documentation, not the current architecture authority. Current baseline architecture navigation points to the overview and module-boundary map.

The primary S2 reading links to `Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md`. The S2 QA README remains explicitly supporting verification material. Both selected documents and the product overview are byte-identical to their original paths at the pinned Git revision and have tracked/committed provenance from `LifeOS_combined` at that exact full HEAD.

`--regenerate-navigation` uses the existing manifest, link map and published objects without reading source roots or replacing any snapshots. The normal collection command uses the same generator. The focused regression check also found and corrected a statistics/source-issue ordering difference between in-memory collection data and JSON-loaded manifests, so navigation is stable across refresh modes.

## Withholding and existing exposure

Withholding a duplicate from `docs/published-records` does not remove pre-existing files elsewhere on the publication branch, other branches or Git history. Generated README, entry point, index and collection report state this explicitly and identify the withheld baseline paths.

Read-only Git tree checks confirmed these paths remain outside the collection at the confirmed publication HEAD and pinned baseline:

- `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md`
- `Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md`

The repository remains PUBLIC; their pre-existing exposure remains. [Path-only exposure evidence](../../docs/published-records/existing-exposure.json) records commit, path, disposition and reason, without credential values. No credentials were tested, reports altered, secrets rotated, visibility changed or history rewritten. The task does not assert that withholding sanitizes the repository.

## Validation

Ten fixture-based collector tests passed, including three focused regressions: pinned selections across conflicting variants/corrupt provenance, withholding/exposure semantics, and dry-run/repeatable navigation regeneration without source Git access. All generated local file links resolve. The requested overview and S2 objects match the pinned Git bytes; the QA link remains supporting material.

All 205 imported document SHA-256 hashes match their pre-task values. Manifest and `link-map.json` hashes are unchanged. Repeating navigation regeneration reports no changed files, and no run metadata is created. All 13 source checkout HEADs, status fingerprints and index hashes match pre-task state. `git diff --check` and staged-scope validation passed. No application suites were run because no application files changed.

Task-owned navigation/tooling/exposure records and this report are committed and normally pushed to the existing publication branch. Final remote full SHA and immutable entrypoint URL are returned after fetch-back and byte verification. No PR, merge or deployment is part of this follow-up.
