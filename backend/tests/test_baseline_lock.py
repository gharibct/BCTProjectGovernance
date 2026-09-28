"""Baseline lock: a project's baseline (profile, scope & schedule, Oracle mapping,
resources, measurement targets, commitments, milestones, "create"-context
documents) is only writable while the project is Draft or Under Amendment. In
Pending Approval / Approved the same writes are rejected with 422 PROJECT_LOCKED —
the only way in is Initiate Amendment. Reporting data (actuals, RAIDO, per-period
measurements, reporting documents) is never gated. See deps.py "Baseline lock".

No Postgres needed — like test_authorization.py these run the real routes against
FakeDB, which answers db.get(Project, id) from canned data.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.api.deps import PROJECT_LOCKED, ensure_baseline_editable, require_baseline_editable
from app.main import app
from app.models.projects import Project
from app.schemas.enums import ProjectStatus, RoleCode
from tests.test_authorization import FakeDB, override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

PID = uuid4()
ROW = uuid4()
BASE = f"/api/v1/projects/{PID}"

EDITABLE = ["Draft", "Under Amendment"]
LOCKED = ["Pending Approval", "Approved"]

# (method, path, json) — every baseline write endpoint. Bodies are irrelevant to the
# lock (the guard runs before body validation), so most are empty.
BASELINE_WRITES = [
    ("PUT", BASE, {"project_name": "x"}),
    ("POST", f"{BASE}/oracle-ids", {"oracle_project_id": "ORA-1"}),
    ("DELETE", f"{BASE}/oracle-ids/{ROW}", None),
    ("POST", f"{BASE}/resources", {}),
    ("PUT", f"{BASE}/resources/{ROW}", {}),
    ("DELETE", f"{BASE}/resources/{ROW}", None),
    ("PUT", f"{BASE}/metric-targets/development", {}),
    ("DELETE", f"{BASE}/metric-targets/development", None),
    ("PUT", f"{BASE}/metric-targets/support", {}),
    ("PUT", f"{BASE}/metric-targets/testing", {}),
    ("PUT", f"{BASE}/metric-targets/consulting", {}),
    ("PUT", f"{BASE}/metric-targets/cloud-maintenance", {}),
    ("PUT", f"{BASE}/metric-targets/cloud-migration", {}),
    ("PUT", f"{BASE}/metric-targets/staffing", {}),
    ("PUT", f"{BASE}/metric-targets/staffing/priorities/P1", {}),
    ("DELETE", f"{BASE}/metric-targets/staffing", None),
    ("POST", f"{BASE}/contractual-commitments", {}),
    ("PUT", f"{BASE}/contractual-commitments/{ROW}", {}),
    ("DELETE", f"{BASE}/contractual-commitments/{ROW}", None),
    ("POST", f"{BASE}/milestone-payments", {}),
    ("PUT", f"{BASE}/milestone-payments/{ROW}", {}),
    ("DELETE", f"{BASE}/milestone-payments/{ROW}", None),
]

# Reporting-side writes that must stay open whatever the project's status.
REPORTING_WRITES = [
    ("POST", f"{BASE}/contractual-commitments/{ROW}/actuals", {"period_date": "2026-01-31"}),
    ("PUT", f"{BASE}/contractual-commitments/{ROW}/actuals/{ROW}", {}),
    ("DELETE", f"{BASE}/contractual-commitments/{ROW}/actuals/{ROW}", None),
    ("PUT", f"{BASE}/milestone-payments/{ROW}/actual", {}),
    ("POST", f"{BASE}/risks", {}),
    ("PUT", f"{BASE}/risks/{ROW}", {}),
    ("DELETE", f"{BASE}/risks/{ROW}", None),
    ("POST", f"{BASE}/issues", {}),
    ("POST", f"{BASE}/measurements/support", {}),
]


def _project_map(status: str, **extra):
    project = SimpleNamespace(account_id=None, geo_id=None, project_status=status, **extra)
    return {(Project, PID): project}


@pytest.fixture
async def lenient_client():
    # A route that gets past the lock may still trip over FakeDB having no real
    # storage; those surface as 500s here instead of raising into the test.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _is_locked(response) -> bool:
    if response.status_code != 422:
        return False
    detail = response.json().get("detail")
    return isinstance(detail, dict) and detail.get("code") == PROJECT_LOCKED


def _call(client, method, path, body, headers):
    return client.request(method, path, json=body, headers=headers)


# --- status x endpoint matrix -------------------------------------------------


@pytest.mark.parametrize("status", LOCKED)
@pytest.mark.parametrize("method,path,body", BASELINE_WRITES)
async def test_baseline_write_is_locked_when_pending_or_approved(
    lenient_client, override_auth, status, method, path, body
):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map(status))
    response = await _call(lenient_client, method, path, body, headers)
    assert _is_locked(response), (status, method, path, response.status_code, response.text)
    assert response.json()["detail"]["project_status"] == status


@pytest.mark.parametrize("status", EDITABLE)
@pytest.mark.parametrize("method,path,body", BASELINE_WRITES)
async def test_baseline_write_is_not_locked_when_draft_or_under_amendment(
    lenient_client, override_auth, status, method, path, body
):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map(status))
    response = await _call(lenient_client, method, path, body, headers)
    assert not _is_locked(response), (status, method, path, response.status_code, response.text)


@pytest.mark.parametrize("status", LOCKED + EDITABLE)
@pytest.mark.parametrize("method,path,body", REPORTING_WRITES)
async def test_reporting_write_is_never_locked(lenient_client, override_auth, status, method, path, body):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map(status))
    response = await _call(lenient_client, method, path, body, headers)
    assert not _is_locked(response), (status, method, path, response.status_code, response.text)


@pytest.mark.parametrize("method,path,body", BASELINE_WRITES)
async def test_lock_does_not_leak_status_to_unauthorised_callers(
    lenient_client, override_auth, method, path, body
):
    # Role check runs first: a caller with no access gets 403, not PROJECT_LOCKED.
    headers = override_auth(RoleCode.TEAM_MEMBER, get_map=_project_map("Approved"))
    response = await _call(lenient_client, method, path, body, headers)
    assert response.status_code == 403


@pytest.mark.parametrize("method,path,body", BASELINE_WRITES)
async def test_baseline_write_on_missing_project_is_404(lenient_client, override_auth, method, path, body):
    headers = override_auth(RoleCode.PROJECT_MANAGER)  # empty get_map -> no such project
    response = await _call(lenient_client, method, path, body, headers)
    assert response.status_code == 404


# --- error contract -------------------------------------------------------------


async def test_approved_message_points_to_initiate_amendment(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map("Approved"))
    response = await lenient_client.put(BASE, json={"project_name": "x"}, headers=headers)
    assert response.status_code == 422
    assert response.json()["detail"] == {
        "code": PROJECT_LOCKED,
        "message": "Initiate an amendment to change this project",
        "project_status": "Approved",
    }


async def test_pending_approval_message_points_to_recall(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map("Pending Approval"))
    response = await lenient_client.put(BASE, json={"project_name": "x"}, headers=headers)
    assert response.status_code == 422
    assert "Recall" in response.json()["detail"]["message"]


@pytest.mark.parametrize("status", [s.value for s in ProjectStatus])
async def test_ensure_baseline_editable_unit(status):
    project = SimpleNamespace(project_status=status)
    if status in EDITABLE:
        ensure_baseline_editable(project)
    else:
        with pytest.raises(HTTPException) as exc:
            ensure_baseline_editable(project)
        assert exc.value.status_code == 422
        assert exc.value.detail["code"] == PROJECT_LOCKED


async def test_require_baseline_editable_dependency_unit():
    dep = require_baseline_editable()
    await dep(project_id=PID, db=FakeDB(RoleCode.ADMIN, get_map=_project_map("Draft")))
    with pytest.raises(HTTPException) as locked:
        await dep(project_id=PID, db=FakeDB(RoleCode.ADMIN, get_map=_project_map("Approved")))
    assert locked.value.status_code == 422
    with pytest.raises(HTTPException) as missing:
        await dep(project_id=PID, db=FakeDB(RoleCode.ADMIN))
    assert missing.value.status_code == 404


# --- "create"-context documents ---------------------------------------------------


def _doc(context: str, ai_status: str = "Not Processed"):
    return SimpleNamespace(
        id=ROW, project_id=PID, context=context, ai_status=ai_status, storage_path="p/x.pdf", file_name="x.pdf"
    )


async def test_create_context_document_upload_is_locked_when_approved(lenient_client, override_auth):
    headers = override_auth(
        RoleCode.PROJECT_MANAGER, get_map={**_project_map("Approved", project_code="PRJ-1")}
    )
    response = await lenient_client.post(
        f"{BASE}/documents",
        data={"context": "create"},
        files={"file": ("charter.pdf", b"%PDF", "application/pdf")},
        headers=headers,
    )
    assert _is_locked(response), response.text


async def test_reporting_context_document_upload_is_not_locked_when_approved(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={**_project_map("Approved", project_code="PRJ-1")})
    response = await lenient_client.post(
        f"{BASE}/documents",
        data={"context": "reporting", "period_id": str(uuid4())},
        files={"file": ("status.pdf", b"%PDF", "application/pdf")},
        headers=headers,
    )
    assert not _is_locked(response), response.text


async def test_create_context_document_delete_and_process_are_locked_when_approved(
    lenient_client, override_auth, monkeypatch
):
    async def _fake_get(self, db, pk):
        # The project lookup also goes through CRUDBase.get on this router.
        return _doc("create") if pk == ROW else _project_map("Approved", project_code="PRJ-1")[(Project, PID)]

    monkeypatch.setattr("app.crud.base.CRUDBase.get", _fake_get)
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map("Approved", project_code="PRJ-1"))

    deleted = await lenient_client.delete(f"{BASE}/documents/{ROW}", headers=headers)
    assert _is_locked(deleted), deleted.text
    processed = await lenient_client.post(f"{BASE}/documents/process", json={"document_ids": [str(ROW)]}, headers=headers)
    assert _is_locked(processed), processed.text


async def test_reporting_context_document_delete_and_process_are_not_locked_when_approved(
    lenient_client, override_auth, monkeypatch
):
    async def _fake_get(self, db, pk):
        # The project lookup also goes through CRUDBase.get on this router.
        return _doc("reporting") if pk == ROW else _project_map("Approved", project_code="PRJ-1")[(Project, PID)]

    monkeypatch.setattr("app.crud.base.CRUDBase.get", _fake_get)
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_project_map("Approved", project_code="PRJ-1"))

    deleted = await lenient_client.delete(f"{BASE}/documents/{ROW}", headers=headers)
    assert not _is_locked(deleted), deleted.text
    processed = await lenient_client.post(f"{BASE}/documents/process", json={"document_ids": [str(ROW)]}, headers=headers)
    assert not _is_locked(processed), processed.text


# --- PUT /projects/{id} field rules --------------------------------------------------


def _put_map(status: str, **fields):
    return _project_map(
        status,
        lifecycle_status=fields.get("lifecycle_status"),
        project_type_id=fields.get("project_type_id"),
    )


async def test_lifecycle_status_change_rejected_while_draft(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_put_map("Draft"))
    response = await lenient_client.put(BASE, json={"lifecycle_status": "Hold"}, headers=headers)
    assert _is_locked(response), response.text
    assert "Under Amendment" in response.json()["detail"]["message"]


async def test_lifecycle_status_change_allowed_while_under_amendment(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_put_map("Under Amendment", lifecycle_status="Ongoing"))
    response = await lenient_client.put(BASE, json={"lifecycle_status": "Hold"}, headers=headers)
    assert not _is_locked(response), response.text


async def test_unchanged_lifecycle_status_is_not_rejected_while_draft(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_put_map("Draft", lifecycle_status="Ongoing"))
    response = await lenient_client.put(BASE, json={"lifecycle_status": "Ongoing"}, headers=headers)
    assert not _is_locked(response), response.text


async def test_project_type_change_rejected_once_approved(lenient_client, override_auth):
    current = uuid4()
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_put_map("Under Amendment", project_type_id=current))
    response = await lenient_client.put(BASE, json={"project_type_id": str(uuid4())}, headers=headers)
    assert _is_locked(response), response.text
    assert "Project Type" in response.json()["detail"]["message"]


async def test_same_project_type_is_allowed_under_amendment(lenient_client, override_auth):
    current = uuid4()
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_put_map("Under Amendment", project_type_id=current))
    response = await lenient_client.put(BASE, json={"project_type_id": str(current)}, headers=headers)
    assert not _is_locked(response), response.text


async def test_project_type_change_allowed_while_draft(lenient_client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map=_put_map("Draft", project_type_id=uuid4()))
    response = await lenient_client.put(BASE, json={"project_type_id": str(uuid4())}, headers=headers)
    assert not _is_locked(response), response.text


async def test_delivery_excellence_id_is_not_settable_via_project_put():
    from app.schemas.projects import ProjectUpdate

    assert "delivery_excellence_id" not in ProjectUpdate.model_fields
    assert "delivery_excellence_id" not in ProjectUpdate(delivery_excellence_id=str(uuid4())).model_dump(
        exclude_unset=True
    )
