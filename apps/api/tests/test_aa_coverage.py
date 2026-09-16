"""Permanent regression tests T-19 and T-05 — coverage rests on evidence.

T-19: coverage is never inferred from fact presence. A day carrying a
transaction but no coverage claim is `unknown_coverage`, not `observed`; a day
with a `complete` claim and zero transactions **is** `observed`; a window with no
claim at all never reports a bare fraction.

T-05 (coverage half): asking about a window that holds no observations returns a
derived answer and writes nothing.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.analytics.coverage import CoverageClaim, CoverageReport, build_coverage_report
from app.analytics.enums import CoverageState, DayCoverage, FactStatus, SourceKind
from app.analytics.subjects import SubjectRef
from app.models import AAMeasurement, AASourceCoverage
from app.services.aa_coverage_claims import (
    CoverageClaimRequest,
    coverage_report_for_window,
    record_coverage_claim,
    supersede_coverage_claim,
)
from tests.aa_helpers import METRIC_TRANSACTION

KYIV = "Europe/Kyiv"
PERIOD = SubjectRef("finance", "period", "2026-08")
AUGUST_START = date(2026, 8, 1)
AUGUST_END = date(2026, 8, 31)
# Fixed "now" so the future bucket is deterministic: 29–31 August have not
# elapsed in Kyiv when the report is taken on 28 August.
NOW = datetime(2026, 8, 28, 20, 0, tzinfo=UTC)


def claim_request(**overrides: object) -> CoverageClaimRequest:
    defaults: dict[str, object] = {
        "source_id": "monobank",
        "subject": PERIOD,
        "window_start_date": AUGUST_START,
        "window_end_date": date(2026, 8, 28),
        "timezone": KYIV,
        "coverage_state": CoverageState.COMPLETE,
        "completeness_known": True,
        "source_kind": SourceKind.IMPORTED,
        "basis": "184 операции · monobank",
        "method": "Импорт выписки",
        "idempotency_key": "idem-coverage-0001",
    }
    defaults.update(overrides)
    return CoverageClaimRequest(**defaults)  # type: ignore[arg-type]


def add_measurement(
    session_factory: sessionmaker[Session],
    user_id: object,
    *,
    day: date,
    idempotency_key: str,
) -> None:
    with session_factory.begin() as db:
        db.add(
            AAMeasurement(
                user_id=user_id,
                metric_key=METRIC_TRANSACTION,
                subject_domain="finance",
                subject_type="period",
                subject_id="2026-08",
                value_type="money",
                unit_code="UAH",
                value_num=Decimal("100"),
                occurred_at=datetime(day.year, day.month, day.day, 9, 0, tzinfo=UTC),
                occurred_tz=KYIV,
                source_kind=SourceKind.USER_REPORTED,
                status=FactStatus.ACTIVE,
                idempotency_key=idempotency_key,
            )
        )


def report_for(session_factory: sessionmaker[Session], user_id: object) -> CoverageReport:
    with session_factory() as db:
        return coverage_report_for_window(
            db,
            user_id=user_id,
            subject_key=PERIOD.subject_key,
            window_start=AUGUST_START,
            window_end=AUGUST_END,
            timezone=KYIV,
            now=NOW,
        )


def test_a_complete_claim_over_a_day_with_no_transactions_is_observed(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    # T-19: a genuinely zero-spend day is fully observed. Counting rows would
    # have called it missing.
    account = account_factory("coverage-zero@example.com")
    with session_factory() as db:
        record_coverage_claim(db, user_id=account.user_id, request=claim_request())

    report = report_for(session_factory, account.user_id)
    assert report.expected_denominator == 31
    assert report.observed_count == 28
    assert report.missing_count == 0
    assert report.unknown_coverage_count == 0
    assert report.future_count == 3


def test_a_day_with_a_transaction_but_no_claim_is_unknown_coverage(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    # T-19: facts never promote a day to observed.
    account = account_factory("coverage-facts@example.com")
    add_measurement(
        session_factory, account.user_id, day=date(2026, 8, 12), idempotency_key="idem-cov-fact"
    )

    report = report_for(session_factory, account.user_id)
    assert report.observed_count == 0
    assert report.unknown_coverage_count == 28
    assert report.missing_count == 0
    assert report.future_count == 3
    # Not «0 / 31», which would read as "spent nothing".
    assert report.reason == "не установлена"


def test_absent_evidence_is_never_silently_complete(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    account = account_factory("coverage-absent@example.com")
    report = report_for(session_factory, account.user_id)
    assert report.observed_count == 0
    assert report.missing_count == 0
    assert report.unknown_coverage_count == 28


def test_a_source_may_affirm_that_nothing_happened(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    # `missing` is a claim, not an inference: the source says it looked and
    # found nothing, which is different from nobody having looked.
    account = account_factory("coverage-none@example.com")
    with session_factory() as db:
        record_coverage_claim(
            db,
            user_id=account.user_id,
            request=claim_request(
                coverage_state=CoverageState.NONE,
                window_end_date=date(2026, 8, 28),
            ),
        )
    report = report_for(session_factory, account.user_id)
    assert report.missing_count == 28
    assert report.observed_count == 0


def test_partial_coverage_quantifies_both_sides_of_the_fraction(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    account = account_factory("coverage-partial@example.com")
    with session_factory() as db:
        record_coverage_claim(
            db,
            user_id=account.user_id,
            request=claim_request(
                coverage_state=CoverageState.PARTIAL,
                observed_units=3,
                expected_units=10,
            ),
        )
    report = report_for(session_factory, account.user_id)
    assert report.partial_count == 28
    assert report.observed_count == 0


def test_a_wider_reimport_supersedes_rather_than_overwrites(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    account = account_factory("coverage-reimport@example.com")
    with session_factory() as db:
        first, _ = record_coverage_claim(
            db,
            user_id=account.user_id,
            request=claim_request(window_end_date=date(2026, 8, 14)),
        )
        first_id = first.id
        supersede_coverage_claim(
            db,
            user_id=account.user_id,
            claim_id=first_id,
            request=claim_request(
                window_end_date=date(2026, 8, 28), idempotency_key="idem-coverage-0002"
            ),
            reason="Повторный импорт охватил больше дней",
        )

    with session_factory() as db:
        rows = list(db.scalars(select(AASourceCoverage).order_by(AASourceCoverage.recorded_at)))
    assert len(rows) == 2
    original = next(row for row in rows if row.id == first_id)
    assert original.status == FactStatus.SUPERSEDED
    assert original.superseded_by_id is not None
    assert original.window_end_date == date(2026, 8, 14)

    report = report_for(session_factory, account.user_id)
    assert report.observed_count == 28


def test_coverage_claims_are_isolated_between_accounts(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    owner = account_factory("coverage-owner@example.com")
    other = account_factory("coverage-other@example.com")
    with session_factory() as db:
        record_coverage_claim(db, user_id=owner.user_id, request=claim_request())

    assert report_for(session_factory, owner.user_id).observed_count == 28
    assert report_for(session_factory, other.user_id).observed_count == 0
    assert report_for(session_factory, other.user_id).unknown_coverage_count == 28


def test_reading_coverage_writes_nothing(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    # T-05: a derived no-data answer never leaves a row behind.
    account = account_factory("coverage-readonly@example.com")
    for _ in range(3):
        report_for(session_factory, account.user_id)
    with session_factory() as db:
        assert db.scalar(select(func.count(AASourceCoverage.id))) == 0
        assert db.scalar(select(func.count(AAMeasurement.id))) == 0


def test_the_buckets_always_exhaust_the_denominator() -> None:
    report = build_coverage_report(
        window_start=AUGUST_START,
        window_end=AUGUST_END,
        timezone=KYIV,
        now=NOW,
        claims=[
            CoverageClaim(
                window_start_date=AUGUST_START,
                window_end_date=date(2026, 8, 10),
                coverage_state=CoverageState.COMPLETE,
                completeness_known=True,
            )
        ],
    )
    assert (
        report.observed_count
        + report.partial_count
        + report.missing_count
        + report.unknown_coverage_count
        + report.future_count
        == report.expected_denominator
        == 31
    )


def test_a_report_whose_buckets_do_not_add_up_is_impossible() -> None:
    with pytest.raises(ValueError):
        CoverageReport(
            window_start=AUGUST_START,
            window_end=AUGUST_END,
            timezone=KYIV,
            denominator_basis="calendar_days",  # type: ignore[arg-type]
            expected_denominator=31,
            observed_count=1,
            partial_count=0,
            missing_count=0,
            unknown_coverage_count=0,
            future_count=0,
            estimated_count=0,
            corrected_count=0,
            freshest_recorded_at=None,
            has_legacy_imports=False,
            reason=None,
        )


def test_a_claim_that_cannot_vouch_for_completeness_never_reads_as_observed() -> None:
    unverified = CoverageClaim(
        window_start_date=AUGUST_START,
        window_end_date=AUGUST_END,
        coverage_state=CoverageState.COMPLETE,
        completeness_known=False,
    )
    report = build_coverage_report(
        window_start=AUGUST_START,
        window_end=AUGUST_END,
        timezone=KYIV,
        now=NOW,
        claims=[unverified],
    )
    assert report.observed_count == 0
    assert report.unknown_coverage_count == 28


def test_a_day_that_has_not_elapsed_is_future_not_missing() -> None:
    classification = build_coverage_report(
        window_start=AUGUST_START,
        window_end=AUGUST_END,
        timezone=KYIV,
        now=NOW,
        claims=[],
    )
    assert classification.future_count == 3
    assert DayCoverage.FUTURE.value == "future"
