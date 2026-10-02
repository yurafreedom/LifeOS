# LifeOS Adaptive Analytics — Slice 7 · Owner Decision Memo

**Generated:** 2026-09-29 · Claude Code (Opus 5.5) · parallel read-only session
**Baseline:** `414df142700653d616016ff644bff3d9c0007540` (Slice 5 merged, Slice 6 absent)
**Status of every decision below: OPEN.** Nothing here is approved. The recommendations are defaults for the provisional plan, not owner answers.

Searched for existing owner authority: `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` (§8, §36, §40, §41), Phase B Plan §24.10/§21, Slice 4 and Slice 5 reports and plans, the frozen J README. None settles OD-7.1, OD-7.2 or OD-7.3. The only owner text on Slice 7 is master context §41: *"Trade-offs retain incompatible dimensions. No global composite score. Contradictions can coexist. Importance should remain user-owned."*

---

## OD-7.1 — Cross-reference relation vocabulary and creation UX

**Question.** Which relations may a user record between two changes/subjects, and where can the user create one?

**Evidence.**
- Phase B Plan fixes the table (`aa_cross_references`, "explicit user-created relations only"), the endpoint and the error `422 causal_relation_forbidden`. It names no allowed relation.
- Frozen J (`system.jsx`, `data.js`) has **no creation UI** and no relation list. Its only "связь" is a system-derived overlap card («Часы и сон · связь не установлена · совпадение по дням; причинность не проверялась») — which is not a user relation and must not become a row.
- Master context forbids causal claims; the Slice 4 factors are "never causal".

**Options.**
| | Vocabulary | Creation UX | Consequence |
|---|---|---|---|
| **1 (recommended)** | `related` only, copy «связаны — по моему мнению»; optional user note ≤500; causal family → `422 causal_relation_forbidden` | one minimal «связать» action on a change card (J1) opening a picker of other cards in the same window; linked cards show the relation + note; retraction via «убрать связь» | small UX delta beyond frozen J (a button + picker); adds `cross_reference.create` and `cross_reference.retract` queue ops |
| 2 | `related` only | **API + storage + rendering only**, no creation UI | zero UX delta to frozen J; the feature is invisible until a later slice adds UI; tests still cover API |
| 3 | richer vocabulary (e.g. `same_period`, `tradeoff_of`) | as 1 | each extra word is new product semantics; `tradeoff_of` risks implying an exchange rate; not recommended |

**Recommendation.** Option 1 — or Option 2 if you want zero UX delta to the frozen package.
**Consequence of no answer.** The final Plan cannot fix the M7 `relation` CHECK or the frontend scope; implementation must not start.

**Owner answer:** `____________` (1 / 2 / 3 / other) · retraction allowed? `yes / no`

---

## OD-7.2 — System Review persistence (meaning, «Вывода нет», adjustments, «сохранить обзор»)

**Question.** Where, if anywhere, does the J1/J2 reflection persist, and where do adjustment candidates come from?

**Evidence (current code).**
- Frozen J1 shows «Что это значит для меня» (free text) + «Вывода нет — оставить как наблюдение» but **no save button**. Frozen J2 shows «Что я решаю поменять» (checklist with seed items) + «сохранить обзор».
- The seed adjustments («Записывать сон каждый день…», «Ставить срок проекта с запасом 3 дня (типично для меня)») would be **system recommendations** if generated. Recommendations are non-scope.
- Expected M7 = two tables (importance, cross-references).
- Slice 4 Review reuse (path A) checked in code:
  - `resolve_review_subject` accepts only `finance:period` and `project:project`; `system:window` → `422 unsupported_review_subject`.
  - Context items are limited by **hard-coded M5 CHECKs** to `section ∈ {compare, quality, alongside}` and `role ∈ {expected, forecast, actual, delta, target, coverage, observation}`; System Review groups and signal recurrence have no role.
  - Saving re-derives the whole context and compares a fingerprint; a whole-month, all-domain context would `409 review_context_changed` on nearly any concurrent write.
  - No no-conclusion field. Mapping it to `decision.choice = 'inconclusive'` would conflate «Вывода нет — оставить как наблюдение» with «Непонятно — данных недостаточно».
  - No adjustment concept. `aa_review_factors` are *contributing factors* with epistemic kind; `decision = 'adjust'` is one choice, not a list.

**Options.**
| | What ships | Schema | Consequence |
|---|---|---|---|
| A | Reuse `aa_reviews` with `system:window` | M7 must also swap M5 CHECKs + new system context builder | semantic abuse of factors/decision, fragile fingerprint; **not recommended** |
| **B (recommended)** | System Review v1 is **derived and read-only**. Reflection/adjustment/save blocks are **not rendered**. J2 keeps «открыть ревью» as navigation to the existing per-subject Review, where note, decision and «Непонятно» already persist | M7 = 2 tables | honest; smallest; deviation from frozen J2 (no save) is visible and must be accepted |
| C | Third M7 table (e.g. `aa_system_review_notes`: user text, `no_conclusion` bool, **user-authored** adjustment lines, appended revisions) + one POST + one queue op | M7 = 3 tables | full J fidelity; product/schema expansion; still **no generated candidates** — the checklist starts empty and the user types lines (optionally copying their own earlier Review notes) |

Any option: generated recommendation checklists are forbidden; «Ничего не выбрано — это нормальный итог» and «Вывода нет» are valid end states wherever saving exists.

**Recommendation.** B.
**Consequence of no answer.** The Plan stays at B-as-default but cannot be final; if the owner later picks C, M7 gains a table and export/TRUNCATE parity grows by one.

**Owner answer:** `____________` (A / B / C / other)

---

## OD-7.3 — Source of «Ждёт вас · Ревью доступно» (new; raised by reconciliation)

**Question.** What counts as a Review that is "available" / waiting?

**Evidence.** Frozen J2 shows «Ревью доступно · 2». The Phase B Plan mentioned a "review-available signal". Slice 4 **deliberately did not build it** (report §2, D-5): it would be a fifth signal rule, and the catalogue is pinned at four by test. No other definition exists in code.

**Options.**
| | Behaviour | Consequence |
|---|---|---|
| **1 (recommended)** | Omit the count. «Ждёт вас» shows only Slice 6 experiments (allow-list) plus a plain «открыть ревью» link | no invented semantics; deviation from frozen J2 visible |
| 2 | Derived, non-signal count: closed finance months (and completed projects) with facts but no saved Review | new product semantics ("you owe a review"); risk of nagging; must not appear on Home |
| 3 | Defer the whole «Ждёт вас» block until Slice 6 is merged and re-verified | block empty before S6 |

**Recommendation.** 1.

**Owner answer:** `____________`

---

## Resolved conservatively by planning (no owner semantics added; owner may lift)

- Importance vocabulary = frozen `none | matters | ok | ignore`; default undecided = no row; no numeric mapping.
- «Что повторилось» = recurrence of existing derivations only; no fifth rule.
- Review Decision is never grounding (no direction field exists).
- Project date deltas are ungrounded in v1 (P7-Q1), matching the Slice 5 page.
- Window = one calendar month (P7-Q3).

```
OD_7_1_STATUS=OPEN   recommendation: related-only + optional note + causal 422 + minimal «связать» action (or API-only)
OD_7_2_STATUS=OPEN   recommendation: B — derived/read-only System Review; persist only importance + cross-references
OD_7_3_STATUS=OPEN   recommendation: omit «Ревью доступно» count
OWNER_APPROVAL_RECORDED=NO
```
