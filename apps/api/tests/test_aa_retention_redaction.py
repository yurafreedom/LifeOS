"""Slice 8 · bulk redaction semantics.

* R8-52: the set-based provenance matcher is at least as conservative as the
  per-fact ``aa_deletion._references`` on every encoding the latter accepts.
* NO ACTION proof: a cascaded membership-override revision chain disappears with
  its measurement in one statement.
* R8-43/R8-76: the retention reason is visible on Review reopen and in the export.
"""

import io
import json
import zipfile
from uuid import uuid4

from sqlalchemy import select

from app.models import AAMeasurement, AAMetricMembershipOverride
from app.services.aa_deletion import _references
from app.services.retention.provenance import provenance_hits
from tests import aa_retention_seed as seed
from tests.aa_helpers import authenticate
from tests.aa_retention_seed import counts, utc
from tests.test_aa_retention_apply import _apply, _policy, _preview, _review


def _encodings(identity):
    canonical = str(identity)
    return [
        {"id": canonical},
        {"id": canonical.upper()},
        {"id": identity.hex},
        {"id": identity.hex.upper()},
        {"id": "{" + canonical + "}"},
        {"id": f"urn:uuid:{canonical}"},
        {canonical: "as a key"},
        {"nested": [{"deep": [f"https://x.example/facts/{canonical}?v=1"]}]},
        {"path": f"aa_measurements/{canonical}"},
        [canonical],
    ]


def test_r8_52_bulk_provenance_is_at_least_as_conservative_as_per_fact(
    session_factory, account_factory
):
    owner = account_factory("ret-prov@example.com")
    pruned = [uuid4() for _ in range(3)]
    unrelated = uuid4()
    refs = [ref for identity in pruned for ref in _encodings(identity)]
    negatives = [{"id": str(unrelated)}, {"note": "no id here"}, {"id": "1234"},
                 {"sha": "a" * 64}, {"short": str(pruned[0])[:30]}]
    with session_factory() as db:
        rows = [seed.tx(db, owner.user_id, "1.00", utc(2025, 1, 1),
                        source_ref=ref if isinstance(ref, dict) else {"list": ref})
                for ref in refs + negatives]
        db.commit()
        ids = {row.id: row.source_ref for row in rows}
        hits = set(provenance_hits(db, user_id=owner.user_id, pruned=pruned).get(
            "aa_measurements", []))
    expected = {
        row_id for row_id, ref in ids.items()
        if any(_references(ref, identity) for identity in pruned)
    }
    assert expected, "the per-fact matcher must recognise the encodings"
    assert expected <= hits  # never less conservative
    assert len(expected) == len(refs)  # every encoding is a real reference
    negative_ids = {row.id for row in rows[len(refs):]}
    # Only the 64-hex payload may be over-matched (it contains no pruned id), so
    # nothing unrelated is touched here.
    assert not (hits & negative_ids)


def test_bulk_provenance_is_account_scoped(session_factory, account_factory):
    owner = account_factory("ret-prov-a@example.com")
    other = account_factory("ret-prov-b@example.com")
    target = uuid4()
    with session_factory() as db:
        seed.tx(db, other.user_id, "1.00", utc(2025, 1, 1), source_ref={"id": str(target)})
        db.commit()
        assert provenance_hits(db, user_id=owner.user_id, pruned=[target]) == {}


def test_a_cascaded_override_revision_chain_goes_in_one_statement(
    engine, session_factory, account_factory
):
    owner = account_factory("ret-override-chain@example.com")
    with session_factory() as db:
        old = seed.tx(db, owner.user_id, "5.00", utc(2024, 1, 5))
        first = seed.override(db, owner.user_id, old)
        seed.override(db, owner.user_id, old, supersedes=first, recorded=utc(2024, 1, 6))
        keep = seed.tx(db, owner.user_id, "6.00", utc(2025, 1, 5))
        seed.override(db, owner.user_id, keep)
        db.commit()
    _policy(session_factory, owner.user_id, 24)
    preview = _preview(session_factory, owner.user_id)
    assert preview["table_counts"]["aa_metric_membership_overrides"] == 2
    run, _ = _apply(session_factory, owner.user_id, preview["preview_token"])
    assert run.table_counts["aa_metric_membership_overrides"] == 2
    with session_factory() as db:
        survivors = db.scalars(select(AAMetricMembershipOverride.source_fact_id).where(
            AAMetricMembershipOverride.user_id == owner.user_id)).all()
        assert survivors == [keep.id]
        assert db.get(AAMeasurement, keep.id) is not None
    assert counts(engine, owner.user_id)["aa_measurements"] == 1


def test_r8_43_76_retention_reason_on_review_reopen_and_in_export(
    client, settings, session_factory, account_factory
):
    owner = account_factory("ret-review-reason@example.com")
    with session_factory() as db:
        source = seed.tx(db, owner.user_id, "77.00", utc(2024, 3, 3))
        ids = _review(db, owner.user_id, source, "77.00")
        db.commit()
    _policy(session_factory, owner.user_id, 24)
    _apply(session_factory, owner.user_id, _preview(session_factory, owner.user_id)[
        "preview_token"])
    authenticate(client, settings, owner)
    reopened = client.get(f"/api/v1/aa/reviews/{ids['review']}")
    assert reopened.status_code == 200, reopened.text
    item = reopened.json()["items"][0]
    assert item["redacted"] is True and item["value"] is None
    assert item["redaction_reason"] == "source_retention_pruned"
    exported = client.get("/api/v1/export")
    with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
        rows = [json.loads(line) for line in archive.read(
            "aa_review_context_items.ndjson").decode().splitlines()]
    assert [row["redaction_reason"] for row in rows] == ["source_retention_pruned"]
    assert all(row["value_num"] is None for row in rows)
