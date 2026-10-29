"""Covers regional_status.py (Account/Geo Reporting status reports + items),
account_rollup.py, account_health_rollup.py and geo_rollup.py.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import ProjectStatusCategory, RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_GEO_ID = uuid4()


class TestAccountStatusReports:
    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports")
        assert response.status_code == 401

    async def test_list_returns_200_for_admin_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", headers=headers)
        assert response.status_code == 403

    async def test_create_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", json={}, headers=headers)
        assert response.status_code == 403

    async def test_create_passes_account_manager_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", json={}, headers=headers)
        assert response.status_code != 403

    async def test_review_rejects_wrong_role(self, client, override_auth):
        # Gated by require_account_geo_scope(GEO_HEAD, ADMIN).
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.patch(
            f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
        )
        assert response.status_code == 403

    async def test_review_passes_geo_head_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.patch(
            f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
        )
        assert response.status_code != 403

    async def test_list_status_items_returns_200(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/status-items",
            params={"period_id": str(uuid4()), "category": ProjectStatusCategory.KEY_ACCOMPLISHMENTS.value},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []


class TestGeoStatusReports:
    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/geos/{_GEO_ID}/status-reports")
        assert response.status_code == 401

    async def test_list_returns_200_for_cxo_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.CXO)
        response = await client.get(f"/api/v1/geos/{_GEO_ID}/status-reports", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/geos/{_GEO_ID}/status-reports", headers=headers)
        assert response.status_code == 403

    async def test_create_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/geos/{_GEO_ID}/status-reports", json={}, headers=headers)
        assert response.status_code == 403

    async def test_create_passes_geo_head_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/geos/{_GEO_ID}/status-reports", json={}, headers=headers)
        assert response.status_code != 403

    async def test_recall_rejects_wrong_role(self, client, override_auth):
        # Geo reports are baselined/recalled by the Geo Head (no CXO review).
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.patch(f"/api/v1/geos/{_GEO_ID}/status-reports/{uuid4()}/recall", headers=headers)
        assert response.status_code == 403

    async def test_recall_passes_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.patch(f"/api/v1/geos/{_GEO_ID}/status-reports/{uuid4()}/recall", headers=headers)
        assert response.status_code != 403


class TestAccountRollup:
    async def test_get_requires_auth(self, client):
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/rollup", params={"period_id": str(uuid4())})
        assert response.status_code == 401

    async def test_get_returns_200_for_admin_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == {
            "metrics": {
                "revenue": None,
                "onsite_fte": None,
                "offshore_fte": None,
                "projects_count": None,
                "contributing_project_count": 0,
            },
            "items": [],
        }

    async def test_get_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403

    async def test_pull_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup/pull", json={"project_item_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403

    async def test_pull_passes_account_manager_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup/pull", json={"project_item_id": str(uuid4())}, headers=headers
        )
        assert response.status_code != 403


class TestAccountHealthRollup:
    async def test_get_returns_200_for_admin_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/health-rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == {"items": []}

    async def test_get_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/health-rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403

    async def test_pull_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/accounts/{_ACCOUNT_ID}/health-rollup/pull",
            json={"project_item_id": str(uuid4())},
            headers=headers,
        )
        assert response.status_code == 403


class TestGeoRollup:
    async def test_get_returns_200_for_cxo_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.CXO)
        response = await client.get(
            f"/api/v1/geos/{_GEO_ID}/rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == {
            "metrics": {
                "revenue": None,
                "onsite_fte": None,
                "offshore_fte": None,
                "projects_count": None,
                "contributing_account_count": 0,
            },
            "items": [],
        }

    async def test_get_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/geos/{_GEO_ID}/rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403

    async def test_pull_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/geos/{_GEO_ID}/rollup/pull", json={"account_item_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403


def test_pulled_item_whose_account_copy_was_deleted_is_pending_again():
    from types import SimpleNamespace
    from uuid import uuid4

    from app.services.account_rollup import effective_rollup_status

    linked = SimpleNamespace(account_rollup_status="Pulled", rolled_up_account_item_id=uuid4())
    orphaned = SimpleNamespace(account_rollup_status="Pulled", rolled_up_account_item_id=None)
    ignored = SimpleNamespace(account_rollup_status="Ignored", rolled_up_account_item_id=None)
    assert effective_rollup_status(linked) == "Pulled"
    assert effective_rollup_status(orphaned) == "Pending"
    assert effective_rollup_status(ignored) == "Ignored"



def test_account_rag_must_be_same_or_worse_than_projects_per_parameter():
    from app.services.account_rag_validation import rag_violations

    columns = [
        "core_delivery_rating",
        "people_rating",
        "operational_rating",
        "customer_rating",
        "financial_rating",
        "compliance_rating",
    ]
    green = dict.fromkeys(columns, "Green")
    amber_people = {**green, "people_rating": "Amber"}
    red_people = {**green, "people_rating": "Red"}
    projects = [("P1", amber_people), ("P2", red_people), ("P3", green)]

    # Account Green on People while a project is Amber/Red -> blocked, citing the worst (Red).
    problems = rag_violations(green, projects)
    assert len(problems) == 1 and problems[0].startswith("People") and "Red" in problems[0]
    # Amber is still better than the worst project (Red) -> blocked; Red is fine.
    assert rag_violations({**green, "people_rating": "Amber"}, projects)
    assert rag_violations({**green, "people_rating": "Red"}, projects) == []
    # All-Green projects enforce nothing.
    assert rag_violations(green, [("P3", green)]) == []
    # Account RAG not set yet while a project is Amber -> blocked.
    assert rag_violations(None, [("P1", amber_people)])
    # Amber project, account Red -> allowed.
    assert rag_violations({**green, "people_rating": "Red"}, [("P1", amber_people)]) == []



def test_project_rag_may_not_be_worse_than_submitted_account_rag():
    from app.services.account_rag_validation import project_rag_violations

    columns = [
        "core_delivery_rating",
        "people_rating",
        "operational_rating",
        "customer_rating",
        "financial_rating",
        "compliance_rating",
    ]
    account = {**dict.fromkeys(columns, "Green"), "people_rating": "Amber"}
    # Project Red on People, account Amber -> blocked.
    bad = project_rag_violations(account, {**dict.fromkeys(columns, "Green"), "people_rating": "Red"})
    assert len(bad) == 1 and bad[0].startswith("People")
    # Same or better than the account everywhere -> fine (Green project under an Amber account too).
    assert project_rag_violations(account, {**dict.fromkeys(columns, "Green"), "people_rating": "Amber"}) == []
    assert project_rag_violations(account, dict.fromkeys(columns, "Green")) == []
