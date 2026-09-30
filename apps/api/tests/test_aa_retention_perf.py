"""Opt-in Slice 8 performance evidence on ``lifeos_test`` (Plan §12).

Skipped unless ``LIFEOS_RETENTION_PERF=1``. Seeds a representative account
(≈150k measurements over five years with dense equal local midnights, ~2.5 %
correction chains, ~1 % tombstones, coverage / semantic versions / policies,
Reviews, Experiments and Saved System Reviews) plus a 30k-row noise account,
runs ``ANALYZE`` and records ``EXPLAIN (ANALYZE, BUFFERS)`` for the hot reads and
every retention statement, then times preview and a real Apply. Output goes to
``LIFEOS_RETENTION_PERF_OUT`` (default: stdout only). Nothing is committed to the
repository; the autouse fixture truncates the data afterwards.
"""

import os
import time
from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlalchemy import text

from tests.aa_retention_seed import NOW

pytestmark = pytest.mark.skipif(
    os.getenv("LIFEOS_RETENTION_PERF") != "1", reason="opt-in performance evidence"
)

A_ROWS, B_ROWS = 150_000, 30_000
DAYS = 1826  # five years of local days
CHAIN_SHARE, TOMBSTONE_SHARE = 40, 100  # 1/40 ≈ 2.5 %, 1/100 = 1 %


def _seed_measurements(connection, user_id: UUID, rows: int, prefix: str) -> None:
    connection.execute(text(
        """
        INSERT INTO aa_measurements (id, user_id, metric_key, subject_domain, subject_type,
            subject_id, value_type, unit_code, value_num, dimensions, occurred_at, occurred_tz,
            recorded_at, source_kind, method, source_ref, original_recorded_at_known, status,
            idempotency_key)
        SELECT gen_random_uuid(), :u, 'finance.transaction_amount', 'finance', 'transaction',
               :p || g, 'money', 'UAH', (g % 997) + 0.25,
               '{"category_id": "food", "included_by_default": true}'::jsonb,
               ((date '2021-10-01' + (g % :days)) :: timestamp) AT TIME ZONE 'Europe/Kyiv',
               'Europe/Kyiv',
               CASE WHEN g % 7 = 0 THEN now()
                    ELSE ((date '2021-10-01' + (g % :days)) :: timestamp)
                         AT TIME ZONE 'Europe/Kyiv' + interval '2 hours' END,
               CASE WHEN g % 7 = 0 THEN 'IMPORTED' ELSE 'USER_REPORTED' END,
               CASE WHEN g % 7 = 0 THEN 'LEGACY_IMPORT' END,
               CASE WHEN g % 7 = 0 THEN jsonb_build_object('snapshot_transaction_id', :p || g) END,
               g % 7 <> 0, 'active', :p || 'key-' || g
          FROM generate_series(1, :n) AS g
        """
    ), {"u": user_id, "p": prefix, "n": rows, "days": DAYS})
    # Correction chains: a successor per picked row, then retire the original.
    connection.execute(text(
        "CREATE TEMP TABLE perf_chain ON COMMIT DROP AS"
        " SELECT id AS old_id, gen_random_uuid() AS new_id FROM aa_measurements"
        " WHERE user_id = :u AND status = 'active'"
        " AND abs(hashtext(id::text)) % :share = 0"
    ), {"u": user_id, "share": CHAIN_SHARE})
    connection.execute(text(
        """
        INSERT INTO aa_measurements (id, user_id, metric_key, subject_domain, subject_type,
            subject_id, value_type, unit_code, value_num, dimensions, occurred_at, occurred_tz,
            recorded_at, source_kind, status, supersedes_id, idempotency_key)
        SELECT c.new_id, m.user_id, m.metric_key, m.subject_domain, m.subject_type, m.subject_id,
               m.value_type, m.unit_code, m.value_num + 1, m.dimensions, m.occurred_at,
               m.occurred_tz, m.recorded_at + interval '1 day', 'USER_REPORTED', 'active', m.id,
               m.idempotency_key || '-fix'
          FROM perf_chain c JOIN aa_measurements m ON m.id = c.old_id
        """
    ))
    connection.execute(text(
        "UPDATE aa_measurements m SET status = 'superseded', superseded_at = m.recorded_at"
        " + interval '1 day', superseded_by_id = c.new_id, supersede_kind = 'CORRECTION'"
        " FROM perf_chain c WHERE m.id = c.old_id"
    ))
    connection.execute(text("DROP TABLE perf_chain"))
    connection.execute(text(
        "UPDATE aa_measurements SET status = 'tombstoned', tombstoned_at = now(),"
        " unit_code = NULL, value_num = NULL, basis = NULL, method = NULL, source_ref = NULL"
        " WHERE user_id = :u AND status = 'active' AND supersedes_id IS NULL"
        " AND abs(hashtext(id::text || 't')) % :share = 0"
    ), {"u": user_id, "share": TOMBSTONE_SHARE})


def _seed_context(connection, user_id: UUID) -> None:
    months = "generate_series(date '2021-10-01', date '2026-09-01', interval '1 month') AS m"
    connection.execute(text(
        f"""
        INSERT INTO aa_source_coverage (id, user_id, source_id, metric_key, subject_domain,
            subject_type, subject_id, window_start_date, window_end_date, timezone,
            coverage_state, completeness_known, recorded_at, source_kind,
            original_recorded_at_known, status, idempotency_key)
        SELECT gen_random_uuid(), :u, 'bank', 'finance.monthly_spend', 'finance', 'period',
               to_char(m, 'YYYY-MM'), m::date, (m + interval '1 month - 1 day')::date,
               'Europe/Kyiv', 'complete', true, m, 'IMPORTED', false, 'active',
               'perf-cov-' || to_char(m, 'YYYY-MM')
          FROM {months}
        """
    ), {"u": user_id})
    for table, extra_cols, extra_vals in (
        ("aa_expectation_versions", ", effective_from", ", m"),
        ("aa_targets", ", desired_direction", ", 'lower'"),
        ("aa_baselines", "", ""),
    ):
        connection.execute(text(
            f"""
            INSERT INTO {table} (id, user_id, metric_key, subject_domain, subject_type,
                subject_id, value_type, unit_code, value_num, window_start, window_end,
                timezone, recorded_at, source_kind, status, idempotency_key{extra_cols})
            SELECT gen_random_uuid(), :u, 'finance.monthly_spend', 'finance', 'period',
                   to_char(m, 'YYYY-MM'), 'money', 'UAH', 40000, m::date,
                   (m + interval '1 month - 1 day')::date, 'Europe/Kyiv', m, 'USER_REPORTED',
                   'active', 'perf-{table}-' || to_char(m, 'YYYY-MM'){extra_vals}
              FROM {months}
            """
        ), {"u": user_id})
    connection.execute(text(
        "INSERT INTO aa_metric_policy_versions (id, user_id, metric_key, policy, effective_from,"
        " recorded_at, source_kind, status, idempotency_key) VALUES (gen_random_uuid(), :u,"
        " 'finance.monthly_spend', '{\"exclude_categories\": [], \"default\": \"include\"}',"
        " timestamptz '2021-10-01', timestamptz '2021-10-01', 'IMPORTED', 'active', 'perf-pol')"
    ), {"u": user_id})
    # Reviews: 60 monthly reviews × 3 items, each linked to a sample transaction.
    connection.execute(text(
        f"""
        INSERT INTO aa_reviews (id, user_id, subject_domain, subject_type, subject_id,
            window_start, window_end, timezone, context_as_of, render_manifest)
        SELECT gen_random_uuid(), :u, 'finance', 'period', to_char(m, 'YYYY-MM'), m::date,
               (m + interval '1 month - 1 day')::date, 'Europe/Kyiv', m + interval '1 month',
               '{{}}'::jsonb
          FROM {months}
        """
    ), {"u": user_id})
    connection.execute(text(
        """
        INSERT INTO aa_review_context_items (id, user_id, review_id, ordinal, section, role,
            label_key, availability, value_type, unit_code, value_num)
        SELECT gen_random_uuid(), r.user_id, r.id, o, 'compare', 'actual', 'actual', 'present',
               'money', 'UAH', 100 + o
          FROM aa_reviews r CROSS JOIN generate_series(1, 3) AS o WHERE r.user_id = :u
        """
    ), {"u": user_id})
    connection.execute(text(
        """
        INSERT INTO aa_review_context_sources (id, user_id, item_id, source_table,
            source_fact_id)
        SELECT gen_random_uuid(), i.user_id, i.id, 'aa_measurements',
               (SELECT m.id FROM aa_measurements m
                 WHERE m.user_id = i.user_id AND m.subject_id = 'A' || (i.ordinal * 997 + 1)
                 LIMIT 1)
          FROM aa_review_context_items i WHERE i.user_id = :u
        """
    ), {"u": user_id})
    connection.execute(text(
        f"""
        INSERT INTO aa_system_review_revisions (id, user_id, period_kind, period_key, timezone,
            revision, status, context_as_of, frozen_context, source_ids, idempotency_key)
        SELECT gen_random_uuid(), :u, 'month', to_char(m, 'YYYY-MM'), 'Europe/Kyiv', 1,
               'draft', m + interval '1 month',
               jsonb_build_object('sections', jsonb_build_object('changed', jsonb_build_object(
                 'items', jsonb_build_array(jsonb_build_object('ordinal', 1, 'sources',
                   jsonb_build_array(jsonb_build_array('aa_measurements', s.id::text))))))),
               ARRAY[s.id], 'perf-sr-' || to_char(m, 'YYYY-MM')
          FROM {months}
          CROSS JOIN LATERAL (SELECT id FROM aa_measurements x WHERE x.user_id = :u
                               AND x.subject_id = 'A' || (extract(month FROM m)::int * 13)
                               LIMIT 1) AS s
        """
    ), {"u": user_id})


def _explain(connection, label: str, sql: str, params: dict, out: list[str]) -> float:
    started = time.perf_counter()
    plan = connection.execute(text("EXPLAIN (ANALYZE, BUFFERS) " + sql), params).scalars().all()
    elapsed = (time.perf_counter() - started) * 1000
    out.append(f"\n### {label}  ({elapsed:.1f} ms wall)\n```\n" + "\n".join(plan) + "\n```")
    return elapsed


def test_retention_performance_evidence(engine, session_factory, account_factory):
    from app.services.retention.engine import apply_retention, preview
    from app.services.retention.policy import PolicyRequest, set_policy

    owner = account_factory("perf-a@example.com")
    noise = account_factory("perf-b@example.com")
    started = time.perf_counter()
    with engine.begin() as connection:
        _seed_measurements(connection, owner.user_id, A_ROWS, "A")
        _seed_measurements(connection, noise.user_id, B_ROWS, "B")
        _seed_context(connection, owner.user_id)
    with engine.connect() as connection:
        connection.execution_options(isolation_level="AUTOCOMMIT").execute(text("ANALYZE"))
    out = [f"# Slice 8 retention performance evidence ({datetime.now(UTC).isoformat()})",
           f"seed: {time.perf_counter() - started:.1f}s"]
    with engine.connect() as connection:
        sizes = connection.execute(text(
            "SELECT user_id = :u AS a, status, count(*) FROM aa_measurements"
            " GROUP BY 1, 2 ORDER BY 1, 2"), {"u": owner.user_id}).all()
        out.append("measurements by (account A?, status): " + repr(sizes))
        u = {"u": owner.user_id}
        cursor_row = connection.execute(text(
            "SELECT occurred_at, id FROM aa_measurements WHERE user_id = :u"
            " AND metric_key = 'finance.transaction_amount' AND status = 'active'"
            " ORDER BY occurred_at, id OFFSET 90000 LIMIT 1"), u).one()
        base = ("SELECT * FROM aa_measurements WHERE user_id = :u"
                " AND metric_key = 'finance.transaction_amount'"
                " AND occurred_at >= :f AND occurred_at <= :t AND status = 'active'")
        rng = {**u, "f": datetime(2021, 1, 1, tzinfo=UTC), "t": datetime(2026, 12, 31, tzinfo=UTC)}
        _explain(connection, "F3 history — first page (fixed tuple_ keyset)",
                 base + " ORDER BY occurred_at, id LIMIT 50", rng, out)
        _explain(connection, "F3 history — deep cursor (row value continuation)",
                 base + " AND (occurred_at, id) > (:ct, :ci) ORDER BY occurred_at, id LIMIT 50",
                 {**rng, "ct": cursor_row[0], "ci": cursor_row[1]}, out)
        _explain(connection, "semantic layer — expectations page",
                 "SELECT * FROM aa_expectation_versions WHERE user_id = :u AND metric_key ="
                 " 'finance.monthly_spend' AND recorded_at >= :f AND recorded_at <= :t"
                 " AND status <> 'tombstoned' ORDER BY recorded_at DESC, id DESC LIMIT 51", rng, out)
        _explain(connection, "coverage report — fact statistics for one month",
                 "SELECT count(*) FILTER (WHERE supersede_kind = 'CORRECTION'),"
                 " max(recorded_at) FROM aa_measurements WHERE user_id = :u"
                 " AND subject_key = 'finance:period:2025-03' AND occurred_at >= :f"
                 " AND occurred_at < :t AND status <> 'tombstoned'",
                 {**u, "f": datetime(2025, 2, 28, 22, tzinfo=UTC),
                  "t": datetime(2025, 3, 31, 21, tzinfo=UTC)}, out)
        _explain(connection, "derive_month — monthly_spend_inputs rows",
                 "SELECT * FROM aa_measurements WHERE user_id = :u AND metric_key ="
                 " 'finance.transaction_amount' AND subject_domain = 'finance' AND subject_type"
                 " = 'transaction' AND occurred_at >= :f AND occurred_at < :t"
                 " AND status = 'active'",
                 {**u, "f": datetime(2025, 2, 28, 22, tzinfo=UTC),
                  "t": datetime(2025, 3, 31, 21, tzinfo=UTC)}, out)
        _explain(connection, "signals input — finance period discovery",
                 "SELECT DISTINCT to_char(timezone('Europe/Kyiv', occurred_at), 'YYYY-MM')"
                 " FROM aa_measurements WHERE user_id = :u AND metric_key ="
                 " 'finance.transaction_amount' AND subject_domain = 'finance'"
                 " AND subject_type = 'transaction' AND status <> 'tombstoned'"
                 " AND status = 'active'", u, out)
        h = {**u, "h_date": datetime(2024, 9, 1).date(),
             "h_at": datetime(2024, 8, 31, 21, tzinfo=UTC)}
        _explain(connection, "retention eligibility — measurement chains (recursive CTE)",
                 """WITH RECURSIVE chain(id, root) AS (
                      SELECT id, id FROM aa_measurements WHERE user_id = :u
                        AND supersedes_id IS NULL AND subject_domain NOT IN ('project','experiment')
                      UNION ALL
                      SELECT c.id, chain.root FROM aa_measurements c JOIN chain
                        ON c.supersedes_id = chain.id WHERE c.user_id = :u
                        AND c.subject_domain NOT IN ('project','experiment'))
                    SELECT array_agg(t.id), bool_and(t.occurred_at < :h_at)
                      FROM chain JOIN aa_measurements t ON t.id = chain.id
                     GROUP BY chain.root HAVING bool_or(t.occurred_at < :h_at)""", h, out)
        _explain(connection, "retention eligibility — Project units",
                 "SELECT subject_key FROM aa_forecast_versions WHERE user_id = :u AND"
                 " subject_domain = 'project'", u, out)
        doomed = connection.execute(text(
            "SELECT array_agg(id) FROM aa_measurements WHERE user_id = :u"
            " AND occurred_at < :h_at"), h).scalar()
        out.append(f"\ncandidate measurement ids at H=2024-09-01: {len(doomed)}")
        _explain(connection, "bulk Review redaction lookup",
                 "SELECT DISTINCT s.item_id FROM aa_review_context_sources s JOIN unnest("
                 "CAST(:tables AS text[]), CAST(:ids AS uuid[])) AS p(tbl, id) ON"
                 " s.source_fact_id = p.id AND s.source_table = p.tbl JOIN"
                 " aa_review_context_items i ON i.id = s.item_id WHERE s.user_id = :u"
                 " AND i.redacted_at IS NULL",
                 {**u, "tables": ["aa_measurements"] * len(doomed), "ids": doomed}, out)
        _explain(connection, "bulk System Review lookup (GIN overlap)",
                 "SELECT id FROM aa_system_review_revisions WHERE user_id = :u"
                 " AND source_ids && CAST(:ids AS uuid[])", {**u, "ids": doomed}, out)
        _explain(connection, "bulk provenance hits (UUID-token hash join)",
                 """WITH pruned AS (SELECT unnest(CAST(:hexes AS text[])) AS hex)
                    SELECT DISTINCT t.id FROM aa_measurements t
                     CROSS JOIN LATERAL regexp_matches(lower(t.source_ref::text),
                          '[0-9a-f-]{32,}', 'g') AS m(tok)
                     CROSS JOIN LATERAL (SELECT replace(m.tok[1], '-', '') AS h) AS s
                     CROSS JOIN LATERAL generate_series(1, length(s.h) - 31) AS g(i)
                      JOIN pruned ON pruned.hex = substr(s.h, g.i, 32)
                     WHERE t.user_id = :u AND t.source_ref IS NOT NULL""",
                 {**u, "hexes": [identity.hex for identity in doomed]}, out)
        connection.rollback()
        with connection.begin() as transaction:
            _explain(connection, "whole-chain delete (one statement, rolled back)",
                     "DELETE FROM aa_measurements WHERE user_id = :u"
                     " AND id = ANY(CAST(:ids AS uuid[]))", {**u, "ids": doomed}, out)
            transaction.rollback()

    with session_factory() as db:
        set_policy(db, user_id=owner.user_id, request=PolicyRequest(
            mode="finite", retain_months=24, consequences_version="retention-consequences-v1",
            confirm_consequences=True, idempotency_key="perf-policy-0001"), now=NOW)
    with session_factory() as db:
        started = time.perf_counter()
        result = preview(db, user_id=owner.user_id, timezone="Europe/Kyiv", now=NOW)
        preview_ms = (time.perf_counter() - started) * 1000
        db.rollback()
    out.append(f"\n## preview: {preview_ms:.0f} ms · total_deleted={result['total_deleted']}"
               f" · table_counts={result['table_counts']}"
               f" · review={result['review_redaction_count']}"
               f" · system_review={result['system_review_redaction_count']}"
               f" · provenance={result['provenance_redaction_count']}")
    with session_factory() as db:
        started = time.perf_counter()
        run, _ = apply_retention(db, user_id=owner.user_id, preview_token=result["preview_token"],
                                 timezone="Europe/Kyiv", idempotency_key="perf-apply-0001",
                                 now=NOW)
        apply_ms = (time.perf_counter() - started) * 1000
    out.append(f"## apply (atomic, committed): {apply_ms:.0f} ms · status={run.status}"
               f" · total_deleted={run.total_deleted} · chains={run.chain_count}")
    with engine.connect() as connection:
        survivors = connection.execute(text(
            "SELECT count(*) FROM aa_measurements WHERE user_id = :u"), {"u": noise.user_id})
        out.append(f"noise account measurements after apply: {survivors.scalar()}")
    report = "\n".join(out)
    target = os.getenv("LIFEOS_RETENTION_PERF_OUT")
    if target:
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(report)
    print(report)
    assert run.status == "completed"
