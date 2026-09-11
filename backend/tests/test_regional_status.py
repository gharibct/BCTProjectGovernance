"""Account / Geo Status Reporting review lifecycle (app.api.v1.endpoints.
regional_status). No Postgres — override_auth swaps get_current_user/get_db
for a FakeDB, same style as test_project_status.py.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.regional_status import AccountStatusReport, GeoStatusReport
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401 — pytest fixture

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_GEO_ID = uuid4()


async def test_resubmitting_rejected_account_report_clears_prior_review(client, override_auth):
    report_id = uuid4()
    report = AccountStatusReport(
        id=report_id,
        account_id=_ACCOUNT_ID,
        period_id=uuid4(),
        status="Rejected",
        reviewed_by=uuid4(),
        reviewed_at=datetime.now(UTC),
        review_comment="Revenue looks off",
        open_alerts_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    headers = override_auth(RoleCode.ADMIN, get_map={(AccountStatusReport, report_id): report})

    response = await client.put(
        f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports/{report_id}",
        json={"status": "Submitted"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Submitted"
    assert body["reviewed_by"] is None
    assert body["reviewed_at"] is None
    assert body["review_comment"] is None


async def test_resubmitting_rejected_geo_report_clears_prior_review(client, override_auth):
    report_id = uuid4()
    report = GeoStatusReport(
        id=report_id,
        geo_id=_GEO_ID,
        period_id=uuid4(),
        status="Rejected",
        reviewed_by=uuid4(),
        reviewed_at=datetime.now(UTC),
        review_comment="Needs the EMEA rollup",
        open_alerts_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    headers = override_auth(RoleCode.ADMIN, get_map={(GeoStatusReport, report_id): report})

    response = await client.put(
        f"/api/v1/geos/{_GEO_ID}/status-reports/{report_id}",
        json={"status": "Submitted"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Submitted"
    assert body["reviewed_by"] is None
    assert body["reviewed_at"] is None
    assert body["review_comment"] is None


async def test_editing_non_rejected_report_leaves_review_fields_untouched(client, override_auth):
    """The clear only fires on Rejected -> Submitted. A plain Draft -> Submitted
    (first submission) has no prior review to wipe and must not touch it."""
    report_id = uuid4()
    report = AccountStatusReport(
        id=report_id,
        account_id=_ACCOUNT_ID,
        period_id=uuid4(),
        status="Draft",
        reviewed_by=None,
        reviewed_at=None,
        review_comment=None,
        open_alerts_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    headers = override_auth(RoleCode.ADMIN, get_map={(AccountStatusReport, report_id): report})

    response = await client.put(
        f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports/{report_id}",
        json={"status": "Submitted"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Submitted"
