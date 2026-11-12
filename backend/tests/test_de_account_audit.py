from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.de_account_audit import DEAccountAudit, DEAccountFinding
from app.models.reference_data import Account
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_FINDING_ID = uuid4()
_AUDIT_ID = uuid4()
_URL = "/api/v1/de-account-audit"
_AM_URL = "/api/v1/account-findings"


def _account(**overrides):
    defaults = dict(id=_ACCOUNT_ID, name="Acme", is_active=True, delivery_excellence_id=uuid4(), geo_id=None)
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _finding(**overrides):
    now = datetime.now(UTC)
    defaults = dict(
        id=_FINDING_ID,
        account_id=_ACCOUNT_ID,
        sequence_no=1,
        category="Customer",
        classification="Observation",
        description="d",
        action_taken=None,
        action_taken_date=None,
        finding_date=date(2026, 1, 1),
        due_date=date(2026, 2, 1),
        status="Open",
        remarks=None,
        closure_date=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _audit(**overrides):
    now = datetime.now(UTC)
    defaults = dict(
        id=_AUDIT_ID,
        account_id=_ACCOUNT_ID,
        audit_date=date(2026, 1, 1),
        de_assessed_health="Green",
        remarks=None,
        status="Draft",
        next_audit_due_date=None,
        audited_by=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


_FINDING_BODY = {
    "account_id": str(_ACCOUNT_ID),
    "category": "Customer",
    "classification": "Observation",
    "description": "x",
    "finding_date": "2026-11-01",
    "due_date": "2026-12-01",
}


async def test_requires_auth(client):
    assert (await client.get(f"{_URL}/queue")).status_code == 401
    assert (await client.get(_AM_URL)).status_code == 401


async def test_reads_reject_unrelated_roles(client, override_auth):
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.TEAM_MEMBER):
        headers = override_auth(role)
        for path in ("/queue", "/findings", "/findings/kpis"):
            assert (await client.get(f"{_URL}{path}", headers=headers)).status_code == 403


async def test_reads_allow_de_admin_cxo(client, override_auth):
    for role in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN, RoleCode.CXO):
        headers = override_auth(role)
        assert (await client.get(f"{_URL}/queue", headers=headers)).status_code == 200
        assert (await client.get(f"{_URL}/findings", headers=headers)).status_code == 200


async def test_cxo_cannot_write(client, override_auth):
    headers = override_auth(RoleCode.CXO)
    assert (await client.post(f"{_URL}/findings", json=_FINDING_BODY, headers=headers)).status_code == 403
    body = {"de_assessed_health": "Green"}
    assert (await client.post(f"{_URL}/accounts/{_ACCOUNT_ID}/audits", json=body, headers=headers)).status_code == 403


async def test_create_audit_submitted_defaults_date(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): _account()})
    response = await client.post(
        f"{_URL}/accounts/{_ACCOUNT_ID}/audits", json={"de_assessed_health": "Amber"}, headers=headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Submitted"
    assert body["audit_date"] == date.today().isoformat()


async def test_create_audit_requires_allocated_account_unless_admin(client, override_auth):
    unallocated = _account(delivery_excellence_id=None)
    body = {"de_assessed_health": "Green", "status": "Draft"}
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): unallocated})
    assert (await client.post(f"{_URL}/accounts/{_ACCOUNT_ID}/audits", json=body, headers=headers)).status_code == 403
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): unallocated})
    assert (await client.post(f"{_URL}/accounts/{_ACCOUNT_ID}/audits", json=body, headers=headers)).status_code == 201


async def test_create_audit_unknown_or_inactive_account_404(client, override_auth):
    body = {"de_assessed_health": "Green"}
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    assert (await client.post(f"{_URL}/accounts/{_ACCOUNT_ID}/audits", json=body, headers=headers)).status_code == 404
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): _account(is_active=False)}
    )
    assert (await client.post(f"{_URL}/accounts/{_ACCOUNT_ID}/audits", json=body, headers=headers)).status_code == 404


async def test_update_draft_audit_submits(client, override_auth):
    audit = _audit()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAccountAudit, _AUDIT_ID): audit, (Account, _ACCOUNT_ID): _account()},
    )
    response = await client.patch(f"{_URL}/audits/{_AUDIT_ID}", json={"status": "Submitted"}, headers=headers)
    assert response.status_code == 200
    assert audit.status == "Submitted"
    assert audit.audited_by is not None


async def test_submitted_audit_is_locked(client, override_auth):
    audit = _audit(status="Submitted")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAccountAudit, _AUDIT_ID): audit, (Account, _ACCOUNT_ID): _account()},
    )
    response = await client.patch(f"{_URL}/audits/{_AUDIT_ID}", json={"remarks": "x"}, headers=headers)
    assert response.status_code == 409


async def test_create_finding_starts_open_with_sequence(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): _account()})
    response = await client.post(f"{_URL}/findings", json=_FINDING_BODY, headers=headers)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Open"
    assert body["sequence_no"] == 1


async def test_create_finding_requires_dates(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): _account()})
    bad = {k: v for k, v in _FINDING_BODY.items() if k != "due_date"}
    assert (await client.post(f"{_URL}/findings", json=bad, headers=headers)).status_code == 422


async def test_create_finding_unallocated_account_forbidden_for_de(client, override_auth):
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): _account(delivery_excellence_id=None)}
    )
    assert (await client.post(f"{_URL}/findings", json=_FINDING_BODY, headers=headers)).status_code == 403


async def test_update_finding_close_sets_closure_date(client, override_auth):
    finding = _finding(status="Awaiting Closure")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAccountFinding, _FINDING_ID): finding, (Account, _ACCOUNT_ID): _account()},
    )
    response = await client.put(
        f"{_URL}/findings/{_FINDING_ID}", json={"status": "Closed", "remarks": "verified"}, headers=headers
    )
    assert response.status_code == 200
    assert finding.status == "Closed"
    assert finding.closure_date == date.today()


async def test_closed_finding_cannot_be_reopened(client, override_auth):
    finding = _finding(status="Closed")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAccountFinding, _FINDING_ID): finding, (Account, _ACCOUNT_ID): _account()},
    )
    response = await client.put(f"{_URL}/findings/{_FINDING_ID}", json={"status": "Open"}, headers=headers)
    assert response.status_code == 409


async def test_account_findings_rejects_non_account_roles(client, override_auth):
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.DELIVERY_EXCELLENCE, RoleCode.GEO_HEAD):
        assert (await client.get(_AM_URL, headers=override_auth(role))).status_code == 403


async def test_account_findings_allows_account_manager_and_admin(client, override_auth):
    for role in (RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN):
        headers = override_auth(role)
        assert (await client.get(_AM_URL, headers=headers)).status_code == 200
        assert (await client.get(f"{_AM_URL}/kpis", headers=headers)).status_code == 200


async def test_action_taken_by_owner_moves_to_awaiting_closure(client, override_auth):
    finding = _finding(status="Open")
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[_ACCOUNT_ID],
        get_map={(DEAccountFinding, _FINDING_ID): finding, (Account, _ACCOUNT_ID): _account()},
    )
    response = await client.put(
        f"{_AM_URL}/{_FINDING_ID}/action-taken", json={"action_taken": "Fixed it"}, headers=headers
    )
    assert response.status_code == 200
    assert finding.status == "Awaiting Closure"
    assert finding.action_taken == "Fixed it"
    assert finding.action_taken_date == date.today()


async def test_action_taken_by_non_owner_forbidden(client, override_auth):
    finding = _finding(status="Open")
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[uuid4()],
        get_map={(DEAccountFinding, _FINDING_ID): finding},
    )
    response = await client.put(
        f"{_AM_URL}/{_FINDING_ID}/action-taken", json={"action_taken": "x"}, headers=headers
    )
    assert response.status_code == 403
    assert finding.status == "Open"


async def test_action_taken_requires_open_finding_and_text(client, override_auth):
    finding = _finding(status="Closed")
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[_ACCOUNT_ID],
        get_map={(DEAccountFinding, _FINDING_ID): finding, (Account, _ACCOUNT_ID): _account()},
    )
    r = await client.put(f"{_AM_URL}/{_FINDING_ID}/action-taken", json={"action_taken": "x"}, headers=headers)
    assert r.status_code == 409
    r = await client.put(f"{_AM_URL}/{_FINDING_ID}/action-taken", json={"action_taken": ""}, headers=headers)
    assert r.status_code == 422
