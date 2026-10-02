# LifeOS documentation collection tool

This Python standard-library tool reads explicit sources without changing their branches, indexes, files, processes or databases. It imports Markdown only. `sources.json` records the 13 discovered checkouts, four approved non-Git folders and the specific historical ZIP, plus the pinned completed integration revision and verified repository visibility. Its source paths are this owner's local inventory; refresh them explicitly if that inventory changes. The publication checkout is deliberately absent.

From `/Users/yurasachenko/LifeOS/LifeOS_docs-publication`, refresh with:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/docs/collect-records.py --config scripts/docs/sources.json --policy scripts/docs/review-policy.json --destination docs/published-records
```

The exact absolute command is:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /Users/yurasachenko/LifeOS/LifeOS_docs-publication/scripts/docs/collect-records.py --config /Users/yurasachenko/LifeOS/LifeOS_docs-publication/scripts/docs/sources.json --policy /Users/yurasachenko/LifeOS/LifeOS_docs-publication/scripts/docs/review-policy.json --destination /Users/yurasachenko/LifeOS/LifeOS_docs-publication/docs/published-records
```

Append `--dry-run` to read, review and validate without writing the destination. `--source-root /explicit/path` adds an explicit folder, detecting a checkout by its `.git` marker; choose its source type in the JSON config for design/archive provenance. `--verify --destination docs/published-records` validates an existing collection without source collection. Use a task-owned destination and preserve a prior manifest on refresh: earlier distinct published objects and occurrences are retained. Objects and mappings are deterministic for unchanged inputs; timestamped `runs/*.json` holds separate run metadata.

Run meaningful fixture checks with:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/docs/test_collect_records.py
```

They cover cross-source deduplication and conflicting versions, repeatability, retained earlier versions, Git index preservation, staged/modified/untracked labels, self-exclusion, dry run, hygiene withholding, unstable reads with three retries, symlink exclusion, original document link resolution, object tamper detection, archive metadata/resource forks, and archive path/symlink/nested-archive/size/count rejection before decompression.

Each candidate gets one disposition. Staged plus working-tree modified reports describe the bytes on disk and record both index/worktree flags; the tool does not commit source indexes or install imported instructions. Before/after identity, size, mtime, ctime and SHA-256 checks surround a physical copy into anonymous scratch and a second source read, with up to three attempts. Final content-addressed object bytes are verified against that stable snapshot. A checkout whose HEAD/index/status changes during its collection is marked pending. Run the collector again after inspecting pending paths; no waiting for unrelated sessions is required.

Archive central-directory inspection rejects absolute/traversal/control/backslash/drive paths, symlinks, encryption, duplicate member names and nested archives before reading any member. Bounds: 2000 entries, 64 MiB compressed and decompressed total, 16 MiB per member, 100:1 expansion. Eligible member bytes are read directly; nothing is extracted or executed. Case/NFC-Unicode collisions are recorded and safe distinct candidates are retained. Symlink directories are not entered. Generated local index links are validated; imported relative links remain unchanged and are mapped in `link-map.json`. Application/runtime/media/font/database files are excluded.

`review-policy.json` contains path-based withholding and hash-bound manual decisions for ordinary technical examples, explicitly synthetic QA accounts and other reviewed matches. It contains no credential values or withheld document contents. A changed/new flagged file is withheld until reviewed; do not auto-approve its hash. Public audit text with potential actionable exploit descriptions requires disclosure review. Recognition is deliberately bounded and is not a comprehensive secret-detection guarantee. Historical static test-token examples were distinguished from unresolved literal database user/password values; the latter remain withheld.

Collection is local and does not push. After review, stage only `docs/published-records`, `scripts/docs` and the task-owned publication report, inspect the staged diff, commit and push normally to the dedicated branch. Never merge or deploy as part of refresh. `PUBLICATION.md` records immutable links to the verified snapshot commit after publication. A commit cannot contain its own SHA; final remote verification and the owner's delivered links identify the final branch tip separately.

The collection-local `.gitattributes` exempts `blank-at-eol` for the exact SHA-addressed historical technical-discovery object that contains an inherited trailing space. Imported bytes remain original; generated docs and every other object remain subject to normal whitespace checks. Do not normalize historical bytes to silence Git warnings.

## Navigation-only refresh

For a focused navigation correction, preserve the published snapshots and refresh from their manifest:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/docs/collect-records.py --regenerate-navigation --destination docs/published-records
```

Append `--dry-run` to inspect which navigation files would change. This mode reads the existing manifest, source/reference map and published objects; it does not recollect source roots or modify their metadata, document objects, manifest, link map or collection runs. Repeating it after regeneration should report no changed navigation files. The full collection command above uses the same generator.

Primary overview and S2 report selections use exact original paths and byte hashes from `manifest.json`'s pinned-baseline reading set, never hardcoded object hashes or newer-looking feature variants. README is an introduction; baseline ARCHITECTURE.md is a June 2026 prototype-era reference; the S2 QA README supports the primary S2 implementation report.

Withholding removes no pre-existing exposure outside the collection, on other branches or in Git history. [existing-exposure.json](../../docs/published-records/existing-exposure.json) records read-only path-existence checks at the confirmed publication and baseline commits without credential values. Documentation collection does not test credentials, edit source reports, rotate secrets, change visibility or rewrite history.
