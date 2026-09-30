"""Slice 8 · preview / apply engine — destructive, ``lifeos_test`` only.

Clock pinned at 2026-09-30 12:00 UTC; a 24-month policy ⇒ horizon 2024-09-01
(Europe/Kyiv). Covers R8-05…R8-30, R8-43…R8-53, R8-58…R8-60, R8-66, R8-71/72,
R8-77/78/80 and the concurrency contract.
"""

import json
import logging
import threading
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text

from app.analytics.enums import RetentionMode
from app.models import (
    AABaseline,
    AACrossReference,
    AADeletionReceipt,
    AAExpectationVersion,
    AAImportanceRating,
    AAMeasurement,
    AARetentionRun,
    AAReview,
    AAReviewContextItem,
    AAReviewContextSource,
    AAReviewFactor,
    AAReviewRevision,
    AASystemReviewRevision,
    AATarget,
    UserSnapshot,
)
from app.services import aa_retention
from app.services.aa_deletion import delete_fact
from app.services.aa_facts import CorrectionConflictError, correct_measurement
from app.services.aa_retention import (
    CONSEQUENCES_VERSION,
    PolicyRequest,
    RetentionPreviewStaleError,
    apply_retention,
    effective_horizon,
    preview,
    set_policy,
)
from app.services.retention import eligibility
from app.services.retention import engine as retention_engine
from app.services.retention.horizon import target_horizon_date
from app.services.system_review.refs import fact_ref, section_ref
from tests import aa_retention_seed as seed
from tests.aa_retention_seed import HORIZON_24, NOW, counts, exists, utc


def _policy(session_factory, user_id: UUID, months: int | None, **kw):
    with session_factory() as db:
        return set_policy(db, user_id=user_id, request=PolicyRequest(
            mode=RetentionMode.FINITE if months else RetentionMode.UNLIMITED,
            retain_months=months,
            consequences_version=kw.get("version", CONSEQUENCES_VERSION),
            confirm_consequences=kw.get("confirm", True),
            idempotency_key=kw.get("key", f"policy-{uuid4()}"),
        ), now=kw.get("now", NOW))


def _preview(session_factory, user_id: UUID, now: datetime = NOW, tz: str = "Europe/Kyiv"):
    with session_factory() as db:
        try:
            return preview(db, user_id=user_id, timezone=tz, now=now)
        finally:
            db.rollback()


def _apply(session_factory, user_id: UUID, token: str, *, key: str | None = None,
           now: datetime = NOW, tz: str = "Europe/Kyiv"):
    with session_factory() as db:
        return apply_retention(db, user_id=user_id, preview_token=token, timezone=tz,
                               idempotency_key=key or f"apply-{uuid4()}", now=now)


@dataclass
class World:
    ids: dict[str, UUID]


def _review(db, user_id: UUID, source: AAMeasurement, value: str) -> dict[str, UUID]:
    review = AAReview(
        user_id=user_id, subject_domain="finance", subject_type="period", subject_id="2024-03",
        window_start=date(2024, 3, 1), window_end=date(2024, 3, 31), timezone="Europe/Kyiv",
        context_as_of=utc(2024, 4, 2), render_manifest={"sections": ["compare"]},
    )
    db.add(review)
    db.flush()
    item = AAReviewContextItem(
        user_id=user_id, review_id=review.id, ordinal=1, section="compare", role="actual",
        label_key="actual", metric_key="finance.monthly_spend", availability="present",
        value_type="money", unit_code="UAH", value_num=Decimal(value),
        source_kind="USER_REPORTED", basis="b", method="m", provenance_recorded_at=utc(2024, 3, 10),
        original_recorded_at_known=True,
    )
    db.add(item)
    db.flush()
    db.add(AAReviewContextSource(user_id=user_id, item_id=item.id, source_table="aa_measurements",
                                 source_fact_id=source.id))
    db.add(AAReviewRevision(user_id=user_id, review_id=review.id, revision=1,
                            note_text="Моя заметка о марте", idempotency_key=f"rv-{uuid4()}"))
    db.add(AAReviewFactor(user_id=user_id, review_id=review.id, ordinal=1, text="Переезд",
                          epistemic_kind="mine", added_in_revision=1))
    db.flush()
    return {"review": review.id, "item": item.id}


def _seed_world(session_factory, user_id: UUID, *, full: bool = True) -> World:
    ids: dict[str, UUID] = {}
    with session_factory() as db:
        # R8-18 / R8-23: an old correction chain, the correction recorded recently.
        old = seed.tx(db, user_id, "98765.43", utc(2024, 3, 10))
        old_fix = seed.correct(db, old, "98765.00", recorded=utc(2026, 1, 5))
        ids |= {"old": old.id, "old_fix": old_fix.id}
        ids["old_override"] = seed.override(db, user_id, old_fix).id
        # A legacy-import-like fact: old semantic date, ingested yesterday.
        ids["legacy"] = seed.tx(db, user_id, "11.11", utc(2024, 2, 1),
                                recorded=utc(2026, 9, 29)).id
        # R8-19: a malformed chain straddling the horizon is kept whole.
        straddle = seed.tx(db, user_id, "50.00", utc(2024, 8, 20))
        ids |= {"straddle": straddle.id,
                "straddle_next": seed.correct(db, straddle, "51.00", recorded=utc(2024, 9, 20),
                                              occurred=utc(2024, 9, 5)).id}
        new = seed.tx(db, user_id, "700.00", utc(2024, 10, 10))
        ids["new"] = new.id
        # R8-51: surviving provenance naming a pruned id (upper-case, nested).
        ids["prov_hit"] = seed.tx(db, user_id, "1.00", utc(2025, 1, 5),
                                  source_ref={"derived": {"from": [str(old.id).upper()]}}).id
        ids["prov_clean"] = seed.tx(db, user_id, "2.00", utc(2025, 1, 6),
                                    source_ref={"note": "unrelated"}).id
        # R8-24: whole coverage windows only.
        ids["cov_old"] = seed.coverage(db, user_id, date(2024, 2, 1), date(2024, 2, 29),
                                       "2024-02").id
        ids["cov_straddle"] = seed.coverage(db, user_id, date(2024, 8, 15), date(2024, 9, 15),
                                            "2024-08").id
        # Windowed versions: an old expectation, an old target revision chain, a
        # post-horizon target.
        ids["exp_old"] = seed.windowed(db, AAExpectationVersion, user_id,
                                       date(2024, 3, 1), date(2024, 3, 31)).id
        t1 = seed.windowed(db, AATarget, user_id, date(2024, 3, 1), date(2024, 3, 31))
        ids["target_old"] = t1.id
        ids["target_old_rev"] = seed.windowed(db, AATarget, user_id, date(2024, 3, 1),
                                              date(2024, 3, 31), supersedes=t1,
                                              recorded=utc(2024, 3, 5)).id
        ids["target_new"] = seed.windowed(db, AATarget, user_id, date(2024, 10, 1),
                                          date(2024, 10, 31)).id
        # R8-25 / R8-26: in-force policy and preference chains stay; a dead old
        # preference goes.
        ids["policy_in_force"] = seed.policy_version(db, user_id, utc(2023, 1, 1)).id
        ids["pref_in_force"] = seed.preference(db, user_id, utc(2023, 1, 1)).id
        ids["pref_dead"] = seed.preference(db, user_id, utc(2023, 2, 1),
                                           tombstoned=utc(2023, 3, 1)).id
        ids["obs_old"] = seed.observation(db, user_id, utc(2024, 3, 12)).id
        if full:
            # R8-29 / R8-30: completed old unit goes; open and late-Actual units stay.
            f1 = seed.forecast(db, user_id, "p-done", date(2023, 5, 1), utc(2023, 1, 5))
            f2 = seed.forecast(db, user_id, "p-done", date(2023, 6, 1), utc(2023, 3, 5),
                               supersedes=f1)
            ids |= {"done_f1": f1.id, "done_f2": f2.id,
                    "done_actual": seed.completion(db, user_id, "p-done", date(2023, 6, 3)).id,
                    "done_obs": seed.observation(db, user_id, utc(2023, 4, 1),
                                                 subject=("project", "project", "p-done")).id}
            ids["open_f"] = seed.forecast(db, user_id, "p-open", date(2023, 5, 1),
                                          utc(2023, 1, 5)).id
            ids["late_f"] = seed.forecast(db, user_id, "p-late", date(2024, 1, 1),
                                          utc(2023, 1, 5)).id
            ids["late_actual"] = seed.completion(db, user_id, "p-late", date(2024, 10, 3)).id
            # R8-39: episodes of erased windows / units go; later ones stay.
            ids["ep_old"] = seed.episode(db, user_id, ("finance", "period", "2024-03"),
                                         "finance.monthly_spend.threshold").id
            ids["ep_new"] = seed.episode(db, user_id, ("finance", "period", "2024-10"),
                                         "finance.monthly_spend.threshold").id
            ids["ep_done"] = seed.episode(db, user_id, ("project", "project", "p-done"),
                                          "project.forecast.revision").id
            # R8-28 / R8-77: experiment evidence is preserved.
            ids["experiment"] = seed.experiment(db, user_id).id
            # R8-43 / R8-44: Review evidence redacted, user content kept.
            ids |= _review(db, user_id, old_fix, "98765.00")
            # R8-45 / R8-46: Saved System Review item redacted, reflection kept.
            revision = AASystemReviewRevision(
                user_id=user_id, period_kind="month", period_key="2024-03",
                timezone="Europe/Kyiv", revision=1, status="draft",
                context_as_of=utc(2024, 4, 2), reflection="Мой вывод за март",
                decisions=["меньше кафе"], adjustments=["бюджет"],
                # The real freeze shape: each frozen section is a list of items.
                frozen_context={"manifest_version": 1, "sections": {"changed": [
                    {"ordinal": 1, "section": "changed", "kind": "finance",
                     "value": "98765.00", "sources": [["aa_measurements", str(old_fix.id)]]},
                    {"ordinal": 2, "section": "changed", "kind": "finance",
                     "value": "700.00", "sources": [["aa_measurements", str(new.id)]]},
                ], "consequences": {"expenses": [], "position": [], "priorities": []}}},
                source_ids=[old_fix.id, new.id], idempotency_key=f"sr-{uuid4()}",
            )
            db.add(revision)
            # R8-47 / R8-48: relation endpoint redacted; fact importance erased.
            relation = AACrossReference(
                user_id=user_id, source="user", from_key=fact_ref("aa_measurements", old_fix.id),
                to_key="subject|finance:period:2024-10", from_domain="finance",
                to_domain="finance", relation_type="related", epistemic_kind="association",
                status="approved", note="Моя связь", idempotency_key=f"rel-{uuid4()}",
            )
            db.add(relation)
            db.flush()
            ids |= {"sr_revision": revision.id, "relation": relation.id}
            for target, name in ((fact_ref("aa_measurements", old_fix.id), "imp_fact"),
                                 (section_ref("2024-03", "changed"), "imp_section")):
                rating = AAImportanceRating(
                    user_id=user_id, target_key=target, importance="matters",
                    recorded_at=utc(2024, 4, 1), status="active", idempotency_key=f"i-{uuid4()}",
                )
                db.add(rating)
                db.flush()
                ids[name] = rating.id
            db.add(UserSnapshot(user_id=user_id, schema_version=2, revision=1, payload={
                "transactions": [], "activityLog": [{"action": "keep-me",
                                                     "timestamp": "2020-01-01T00:00:00Z"}]}))
        db.commit()
    return World(ids)


# ───────────────────────────── policy ─────────────────────────────


def test_r8_01_05_06_no_row_is_unlimited_and_policy_changes_delete_nothing(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-policy@example.com")
    _seed_world(session_factory, owner.user_id)
    with session_factory() as db:
        state = aa_retention.policy_state(db, user_id=owner.user_id, timezone="Europe/Kyiv",
                                          now=NOW)
    assert state["mode"] == "unlimited" and state["source"] == "default"
    assert state["retain_months"] is None and state["allowed_months"] == [60, 36, 24]
    assert state["effective_horizon"] is None and state["latest_run"] is None
    before = counts(engine, owner.user_id)
    with pytest.raises(aa_retention.RetentionConsequencesUnconfirmedError):
        _policy(session_factory, owner.user_id, 24, confirm=False)
    with pytest.raises(aa_retention.RetentionConsequencesStaleError):
        _policy(session_factory, owner.user_id, 24, version="retention-consequences-v0")
    for months in (24, 60, None, 36):
        _policy(session_factory, owner.user_id, months)
    after = counts(engine, owner.user_id)
    assert after.pop("aa_retention_policies") == 4
    before.pop("aa_retention_policies")
    assert after == before
    with session_factory() as db:
        state = aa_retention.policy_state(db, user_id=owner.user_id, timezone="Europe/Kyiv",
                                          now=NOW)
    assert state["mode"] == "finite" and state["retain_months"] == 36
    assert state["policy_version"] == 4 and state["source"] == "explicit"
    # The same intent again appends nothing.
    _, changed, _ = _policy(session_factory, owner.user_id, 36)
    assert changed is False


# ───────────────────────────── preview ─────────────────────────────


def test_r8_07_08_preview_is_read_only_and_its_token_binds_the_exact_set(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-preview@example.com")
    world = _seed_world(session_factory, owner.user_id)
    with pytest.raises(aa_retention.RetentionPolicyNotFiniteError):
        _preview(session_factory, owner.user_id)
    _policy(session_factory, owner.user_id, 24)
    before = counts(engine, owner.user_id)
    first = _preview(session_factory, owner.user_id)
    assert counts(engine, owner.user_id) == before
    assert first["target_horizon_date"] == "2024-09-01"
    assert first["table_counts"] == {
        "aa_expectation_versions": 1,
        "aa_forecast_versions": 2,
        "aa_measurements": 4,  # old + fix + legacy + p-done Actual
        "aa_metric_membership_overrides": 1,
        "aa_observations": 2,  # free old observation + p-done observation
        "aa_preferences": 1,
        "aa_signal_episodes": 2,
        "aa_source_coverage": 1,
        "aa_targets": 2,
    }
    assert first["project_unit_count"] == 1
    assert first["chain_count"] == 2  # the measurement correction + the target revision
    assert first["review_redaction_count"] == 1
    assert first["system_review_redaction_count"] == 1
    assert first["relation_redaction_count"] == 1
    assert first["importance_redaction_count"] == 1
    assert first["provenance_redaction_count"] == 1
    assert first["skipped"] == {
        "aa_measurements.retained_chains": 1,
        "aa_preferences.retained_chains": 1,
        "aa_metric_policy_versions.retained_chains": 1,
        "aa_source_coverage.retained_chains": 1,
        "project_units.not_wholly_before_horizon": 1,
        "project_units.open": 1,
    }
    assert "reviews" in first["preserved"]
    assert _preview(session_factory, owner.user_id)["preview_token"] == first["preview_token"]
    with session_factory() as db:
        seed.tx(db, owner.user_id, "3.00", utc(2024, 4, 1))
        db.commit()
    assert _preview(session_factory, owner.user_id)["preview_token"] != first["preview_token"]
    assert world.ids


def test_r8_09_stale_preview_is_409_and_deletes_nothing(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-stale@example.com")
    _seed_world(session_factory, owner.user_id, full=False)
    _policy(session_factory, owner.user_id, 24)
    token = _preview(session_factory, owner.user_id)["preview_token"]
    with session_factory() as db:
        seed.tx(db, owner.user_id, "4.00", utc(2024, 5, 1))
        db.commit()
    before = counts(engine, owner.user_id)
    with pytest.raises(RetentionPreviewStaleError):
        _apply(session_factory, owner.user_id, token)
    assert counts(engine, owner.user_id) == before
    assert before["aa_retention_runs"] == 0


# ───────────────────────────── apply ─────────────────────────────


def test_apply_erases_whole_units_redacts_first_and_writes_one_run(
    engine, session_factory, account_factory, caplog
):
    owner = account_factory("ret-apply@example.com")
    noise = account_factory("ret-noise@example.com")
    world = _seed_world(session_factory, owner.user_id)
    _seed_world(session_factory, noise.user_id, full=False)
    noise_before = counts(engine, noise.user_id)
    _policy(session_factory, owner.user_id, 24)
    token = _preview(session_factory, owner.user_id)["preview_token"]
    with caplog.at_level(logging.INFO):
        run, replayed = _apply(session_factory, owner.user_id, token, key="apply-once")
    ids = world.ids
    assert replayed is False and run.status == "completed"

    # R8-18 / R8-20 / R8-23: whole chain gone together; nothing rewired.
    for name in ("old", "old_fix", "legacy", "old_override"):
        table = "aa_metric_membership_overrides" if name == "old_override" else "aa_measurements"
        assert not exists(engine, table, ids[name]), name
    # R8-19: the straddling chain survives whole, links intact.
    with session_factory() as db:
        straddle = db.get(AAMeasurement, ids["straddle"])
        assert straddle is not None and straddle.superseded_by_id == ids["straddle_next"]
    for name in ("new", "prov_hit", "prov_clean", "straddle_next"):
        assert exists(engine, "aa_measurements", ids[name]), name
    # R8-24: coverage whole windows.
    assert not exists(engine, "aa_source_coverage", ids["cov_old"])
    assert exists(engine, "aa_source_coverage", ids["cov_straddle"])
    # Windowed versions; in-force policy / preference (R8-25/26).
    assert not exists(engine, "aa_expectation_versions", ids["exp_old"])
    assert not exists(engine, "aa_targets", ids["target_old"])
    assert not exists(engine, "aa_targets", ids["target_old_rev"])
    assert exists(engine, "aa_targets", ids["target_new"])
    assert exists(engine, "aa_metric_policy_versions", ids["policy_in_force"])
    assert exists(engine, "aa_preferences", ids["pref_in_force"])
    assert not exists(engine, "aa_preferences", ids["pref_dead"])
    assert not exists(engine, "aa_observations", ids["obs_old"])
    # R8-29 / R8-30: Project units.
    for name in ("done_f1", "done_f2"):
        assert not exists(engine, "aa_forecast_versions", ids[name])
    assert not exists(engine, "aa_measurements", ids["done_actual"])
    assert not exists(engine, "aa_observations", ids["done_obs"])
    assert exists(engine, "aa_forecast_versions", ids["open_f"])
    assert exists(engine, "aa_forecast_versions", ids["late_f"])
    assert exists(engine, "aa_measurements", ids["late_actual"])
    # Signal episodes.
    assert not exists(engine, "aa_signal_episodes", ids["ep_old"])
    assert not exists(engine, "aa_signal_episodes", ids["ep_done"])
    assert exists(engine, "aa_signal_episodes", ids["ep_new"])
    # R8-28 / R8-77: experiment and its evidence untouched.
    after = counts(engine, owner.user_id)
    for table in ("aa_experiments", "aa_experiment_adherence", "aa_experiment_observations"):
        assert after[table] == 1, table
    with session_factory() as db:
        assert db.scalar(select(AABaseline).where(
            AABaseline.user_id == owner.user_id, AABaseline.subject_domain == "experiment"))

        # R8-43 / R8-44: Review evidence redacted with the retention reason; the
        # user's note and factor survive; no link to the erased id remains.
        item = db.get(AAReviewContextItem, ids["item"])
        assert item.redaction_reason == "source_retention_pruned" and item.value_num is None
        assert db.scalar(select(AAReviewRevision.note_text).where(
            AAReviewRevision.review_id == ids["review"])) == "Моя заметка о марте"
        assert db.scalar(select(AAReviewFactor.text).where(
            AAReviewFactor.review_id == ids["review"])) == "Переезд"
        assert db.scalars(select(AAReviewContextSource).where(
            AAReviewContextSource.user_id == owner.user_id)).all() == []
        # R8-45 / R8-46: saved System Review.
        revision = db.get(AASystemReviewRevision, ids["sr_revision"])
        changed_items = revision.frozen_context["sections"]["changed"]
        assert changed_items[0] == {"ordinal": 1, "section": "changed", "kind": "finance",
                                    "redacted": True,
                                    "redaction_reason": "source_retention_pruned"}
        assert changed_items[1]["value"] == "700.00"
        assert revision.source_ids == [ids["new"]] and revision.redacted_at is not None
        assert revision.reflection == "Мой вывод за март"
        assert revision.decisions == ["меньше кафе"]
        # R8-47 / R8-48.
        relation = db.get(AACrossReference, ids["relation"])
        assert relation.from_key == "redacted" and relation.note == "Моя связь"
        assert relation.endpoint_redacted_at is not None and relation.status == "approved"
        assert db.get(AAImportanceRating, ids["imp_fact"]) is None
        assert db.get(AAImportanceRating, ids["imp_section"]) is not None
        # R8-51: provenance residue.
        hit = db.get(AAMeasurement, ids["prov_hit"])
        assert hit.source_ref is None and hit.basis is None and hit.method is None
        assert db.get(AAMeasurement, ids["prov_clean"]).source_ref == {"note": "unrelated"}
        # R8-66: the snapshot's activityLog is untouched by AA retention.
        snapshot = db.scalar(select(UserSnapshot).where(UserSnapshot.user_id == owner.user_id))
        assert snapshot.payload["activityLog"] == [{"action": "keep-me",
                                                    "timestamp": "2020-01-01T00:00:00Z"}]
        # R8-12 / R8-13: exactly one run, no per-fact receipts.
        assert len(db.scalars(select(AARetentionRun).where(
            AARetentionRun.user_id == owner.user_id)).all()) == 1
        assert db.scalars(select(AADeletionReceipt).where(
            AADeletionReceipt.user_id == owner.user_id)).all() == []

    # R8-15 / R8-16: run totals.
    assert run.table_counts == {
        "aa_expectation_versions": 1, "aa_forecast_versions": 2, "aa_measurements": 4,
        "aa_metric_membership_overrides": 1, "aa_observations": 2, "aa_preferences": 1,
        "aa_signal_episodes": 2, "aa_source_coverage": 1, "aa_targets": 2,
    }
    assert run.total_deleted == 16
    assert run.chain_count == 2 and run.project_unit_count == 1
    assert run.review_redaction_count == 1 and run.system_review_redaction_count == 1
    assert run.relation_redaction_count == 1 and run.importance_redaction_count == 1
    assert run.provenance_redaction_count == 1 and run.signal_episode_count == 2
    assert run.pruned_units == {"project_subject_ids": ["p-done"]}
    assert run.target_horizon_date == HORIZON_24 and run.retain_months == 24
    # R8-17 / R8-80: no deleted value in the audit row or the log.
    with engine.begin() as connection:
        stored = json.dumps([str(v) for v in connection.execute(text(
            "SELECT * FROM aa_retention_runs WHERE id = :id"), {"id": run.id}).one()])
    for value in ("98765", "11.11", "Моя", "меньше"):
        assert value not in stored
    logged = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert "98765" not in logged and "Моя" not in logged
    # R8-53: the other account is untouched.
    assert counts(engine, noise.user_id) == noise_before
    # R8-78: no retained row references an erased one.
    with engine.begin() as connection:
        for table in ("aa_measurements", "aa_targets", "aa_forecast_versions"):
            assert connection.scalar(text(
                f"SELECT count(*) FROM {table} t WHERE t.user_id = :u AND ("
                f" (t.supersedes_id IS NOT NULL AND NOT EXISTS"
                f"  (SELECT 1 FROM {table} p WHERE p.id = t.supersedes_id))"
                f" OR (t.superseded_by_id IS NOT NULL AND NOT EXISTS"
                f"  (SELECT 1 FROM {table} s WHERE s.id = t.superseded_by_id)))"),
                {"u": owner.user_id}) == 0
    # The effective horizon is now durable.
    with session_factory() as db:
        horizon = effective_horizon(db, user_id=owner.user_id)
    assert horizon.date == HORIZON_24 and horizon.run_id == run.id


def test_r8_11_apply_is_idempotent_and_a_reused_key_is_refused(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-replay@example.com")
    _seed_world(session_factory, owner.user_id, full=False)
    _policy(session_factory, owner.user_id, 24)
    token = _preview(session_factory, owner.user_id)["preview_token"]
    run, _ = _apply(session_factory, owner.user_id, token, key="apply-key-1")
    again, replayed = _apply(session_factory, owner.user_id, token, key="apply-key-1")
    assert replayed is True and again.id == run.id
    with pytest.raises(aa_retention.RetentionIdempotencyReusedError):
        _apply(session_factory, owner.user_id, "e" * 64, key="apply-key-1")
    assert counts(engine, owner.user_id)["aa_retention_runs"] == 1
    # A second Apply with a fresh preview has nothing left to erase.
    second = _preview(session_factory, owner.user_id)
    assert second["total_deleted"] == 0
    assert second["effective_horizon"]["date"] == "2024-09-01"


def test_r8_14_ordinary_hard_delete_still_writes_a_per_fact_receipt(
    session_factory, account_factory
):
    owner = account_factory("ret-receipt@example.com")
    with session_factory() as db:
        lone = seed.tx(db, owner.user_id, "9.00", utc(2025, 5, 5))
        db.commit()
        delete_fact(db, user_id=owner.user_id, table_name="aa_measurements", fact_id=lone.id,
                    mode="hard")
        assert len(db.scalars(select(AADeletionReceipt).where(
            AADeletionReceipt.user_id == owner.user_id)).all()) == 1


def test_r8_58_59_60_horizon_is_durable_and_only_advances(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-horizon@example.com")
    _seed_world(session_factory, owner.user_id, full=False)
    _policy(session_factory, owner.user_id, 24)
    _apply(session_factory, owner.user_id, _preview(session_factory, owner.user_id)["preview_token"])

    def horizon():
        with session_factory() as db:
            return effective_horizon(db, user_id=owner.user_id).date

    _policy(session_factory, owner.user_id, None)  # back to Unlimited
    assert horizon() == HORIZON_24
    with session_factory() as db:
        state = aa_retention.policy_state(db, user_id=owner.user_id, timezone="Europe/Kyiv",
                                          now=NOW)
    assert state["mode"] == "unlimited" and state["effective_horizon"]["date"] == "2024-09-01"
    _policy(session_factory, owner.user_id, 60)  # a longer duration restores nothing
    looser = _preview(session_factory, owner.user_id)
    assert looser["target_horizon_date"] == "2021-09-01" and looser["total_deleted"] == 0
    _apply(session_factory, owner.user_id, looser["preview_token"])
    assert horizon() == HORIZON_24
    # A later, stricter Apply advances it.
    later = datetime(2027, 1, 15, 12, tzinfo=UTC)
    _policy(session_factory, owner.user_id, 24, now=later)
    stricter = _preview(session_factory, owner.user_id, now=later)
    assert stricter["target_horizon_date"] == "2025-01-01"
    _apply(session_factory, owner.user_id, stricter["preview_token"], now=later)
    assert horizon() == date(2025, 1, 1)
    assert counts(engine, owner.user_id)["aa_retention_runs"] == 3


def test_r8_22_horizon_is_computed_in_the_iana_zone():
    # 21:30 UTC on 30 Sep is already 1 Oct in Kyiv (+03): the local month moved.
    assert target_horizon_date(24, "Europe/Kyiv", datetime(2026, 9, 30, 21, 30, tzinfo=UTC)) \
        == date(2024, 10, 1)
    assert target_horizon_date(24, "America/New_York",
                               datetime(2026, 10, 1, 2, 0, tzinfo=UTC)) == date(2024, 9, 1)
    assert target_horizon_date(60, "Europe/Kyiv", NOW) == date(2021, 9, 1)
    assert target_horizon_date(36, "Europe/Kyiv", NOW) == date(2023, 9, 1)
    from app.services.retention.horizon import RetentionHorizon
    summer = RetentionHorizon(date(2024, 10, 1), "Europe/Kyiv", uuid4(), NOW)
    winter = RetentionHorizon(date(2024, 11, 1), "Europe/Kyiv", uuid4(), NOW)
    assert summer.instant.astimezone(UTC) == datetime(2024, 9, 30, 21, tzinfo=UTC)
    assert winter.instant.astimezone(UTC) == datetime(2024, 10, 31, 22, tzinfo=UTC)


def test_r8_71_72_a_failed_apply_rolls_back_and_is_audited(
    engine, session_factory, account_factory, monkeypatch
):
    owner = account_factory("ret-fail@example.com")
    _seed_world(session_factory, owner.user_id)
    _policy(session_factory, owner.user_id, 24)
    token = _preview(session_factory, owner.user_id)["preview_token"]
    before = counts(engine, owner.user_id)
    original = retention_engine._delete

    def explode(db, user_id, table, ids):
        if table == "aa_targets":
            raise RuntimeError("disk on fire")
        return original(db, user_id, table, ids)

    monkeypatch.setattr(retention_engine, "_delete", explode)
    with pytest.raises(RuntimeError):
        _apply(session_factory, owner.user_id, token, key="apply-fails")
    after = counts(engine, owner.user_id)
    assert after.pop("aa_retention_runs") == 1
    before.pop("aa_retention_runs")
    assert after == before  # nothing deleted, nothing redacted
    with session_factory() as db:
        run = db.scalar(select(AARetentionRun).where(AARetentionRun.user_id == owner.user_id))
        assert run.status == "failed" and run.failure_code == "RuntimeError"
        assert run.total_deleted == 0 and run.completed_at is None
        assert effective_horizon(db, user_id=owner.user_id) is None
        item = db.scalar(select(AAReviewContextItem).where(
            AAReviewContextItem.user_id == owner.user_id))
        assert item.redacted_at is None


def test_concurrent_applies_serialize_and_the_loser_is_stale(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-race@example.com")
    _seed_world(session_factory, owner.user_id, full=False)
    _policy(session_factory, owner.user_id, 24)
    token = _preview(session_factory, owner.user_id)["preview_token"]
    outcomes: list[object] = []

    def attempt(key):
        try:
            outcomes.append(_apply(session_factory, owner.user_id, token, key=key)[0].status)
        except RetentionPreviewStaleError as error:
            outcomes.append(error.code)

    threads = [threading.Thread(target=attempt, args=(f"race-{n}",)) for n in range(3)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(30)
    assert sorted(outcomes) == ["completed", "retention_preview_stale", "retention_preview_stale"]
    assert counts(engine, owner.user_id)["aa_retention_runs"] == 1


def test_a_concurrent_correction_waits_and_cannot_fork_an_erased_chain(
    engine, session_factory, account_factory, monkeypatch
):
    owner = account_factory("ret-correct@example.com")
    with session_factory() as db:
        old = seed.tx(db, owner.user_id, "10.00", utc(2024, 3, 3))
        db.commit()
        old_id = old.id
    _policy(session_factory, owner.user_id, 24)
    token = _preview(session_factory, owner.user_id)["preview_token"]
    locked, release = threading.Event(), threading.Event()
    original = eligibility.lock_candidates

    def pause(db, *, user_id, candidates):
        original(db, user_id=user_id, candidates=candidates)
        locked.set()
        release.wait(10)

    monkeypatch.setattr(retention_engine, "lock_candidates", pause)
    applied: list[object] = []
    worker = threading.Thread(target=lambda: applied.append(
        _apply(session_factory, owner.user_id, token)[0].status))
    worker.start()
    assert locked.wait(10)
    corrected: list[object] = []

    def correct():
        from app.schemas.aa_measurement import MeasurementCorrect
        with session_factory() as db:
            try:
                correct_measurement(db, user_id=owner.user_id, measurement_id=old_id,
                                    request=MeasurementCorrect(
                                        value={"type": "money", "unit_code": "UAH", "num": "11"},
                                        reason="опечатка",
                                        provenance={"source_kind": "USER_REPORTED"},
                                        idempotency_key=f"race-fix-{uuid4()}"))
                corrected.append("committed")
            except CorrectionConflictError:
                corrected.append("conflict")

    fixer = threading.Thread(target=correct)
    fixer.start()
    fixer.join(1.0)
    assert fixer.is_alive()  # blocked on the candidate row lock
    release.set()
    worker.join(30)
    fixer.join(30)
    assert applied == ["completed"] and corrected == ["conflict"]
    assert not exists(engine, "aa_measurements", old_id)
    assert counts(engine, owner.user_id)["aa_measurements"] == 0
