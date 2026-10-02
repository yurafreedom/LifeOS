# Harness correction

Initial backend run: 1318 passed, 5 failed, 1 skipped (447.83 s). The guard had
globally set `LIFEOS_AA_WRITE_ENABLED=true`. Five tests intentionally construct
Settings with the default gate closed, so this environment override invalidated
their premise. All five failures concerned that gate; this was an audit harness
error, not evidence of an application defect.

The suite environment now explicitly sets this flag false. The integration
fixture still explicitly opts in where appropriate. Independent auth/document
fixtures retain their explicit test-only opt-in. Both database URL overrides and
all destination guards remain enabled. Full backend suite repeated; see
`api-checks.json` for the final run. No application source or production guard
was changed.

Raw logs stay private and are not publication-safe: assertion representations
can include a synthetic database URL. Only selected status/count summaries are
retained as audit evidence. All disposable cluster credentials are destroyed
with the scratch directory at cleanup.
