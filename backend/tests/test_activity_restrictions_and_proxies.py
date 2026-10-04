"""Per-project activity restrictions (services/activity_restriction.py + the
/activity-restrictions endpoints) and proxy PM / DM assignment (the proxy routes
of /reassignment). No Postgres: the same fake AsyncSession the other dependency
tests use (tests/test_authorization.py).
"""

from datetime import date, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.projects import Project, ProjectProxyManager
from app.models.reference_data import Account, ReportingPeriod
from app.models.users import Role, User, UserAccount
from app.schemas.enums import ProjectActivity, RoleCode
from app.services.activity_restriction import (
    assert_activity_open,
    assert_period_open,
    is_restricted,
    restricted_from_by_project,
)
from tests.test_authorization import FakeDB, _ExecResult, override_auth  # noqa: F401  (pytest fixture)


_FROM = date(2026, 9, 1)


class _RestrictionDB:
    """Answers db.get(ReportingPeriod, ...) and the restriction select with canned rows."""

    def __init__(self, restrictions: dict[ProjectActivity, date], period=None):
        self._rows = [(activity.value, d) for activity, d in restrictions.items()]
        self._period = period

    async def get(self, model, pk):
        return self._period if model is ReportingPeriod else None

    async def execute(self, stmt):
        return _ExecResult(self._rows)


def _period(period_type: str, start: date) -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), period_type=period_type, start_date=start, end_date=start + timedelta(days=4))


# --- pure rules ---------------------------------------------------------------


def test_is_restricted_from_the_date_onwards():
    restrictions = {ProjectActivity.METRICS.value: _FROM}
    assert not is_restricted(restrictions, ProjectActivity.METRICS, _FROM - timedelta(days=1))
    assert is_restricted(restrictions, ProjectActivity.METRICS, _FROM)
    assert is_restricted(restrictions, ProjectActivity.METRICS, _FROM + timedelta(days=30))
    assert not is_restricted(restrictions, ProjectActivity.COMMITMENTS, _FROM + timedelta(days=30))


async def test_weekly_period_follows_delivery_status():
    pid = uuid4()
    db = _RestrictionDB({ProjectActivity.DELIVERY_STATUS: _FROM}, _period("Weekly", _FROM))
    with pytest.raises(HTTPException) as exc:
        await assert_period_open(db, pid, uuid4())
    assert exc.value.status_code == 409
    assert "Delivery Status" in exc.value.detail

    before = _RestrictionDB({ProjectActivity.DELIVERY_STATUS: _FROM}, _period("Weekly", _FROM - timedelta(days=7)))
    await assert_period_open(before, pid, uuid4())  # the earlier week is still owed


async def test_monthly_section_checks_its_own_activity():
    pid = uuid4()
    db = _RestrictionDB({ProjectActivity.METRICS: _FROM}, _period("Monthly", _FROM))
    with pytest.raises(HTTPException):
        await assert_period_open(db, pid, uuid4(), activity=ProjectActivity.METRICS)
    # Commitments is not restricted, so its section stays open for the same month.
    await assert_period_open(db, pid, uuid4(), activity=ProjectActivity.COMMITMENTS)


async def test_monthly_report_blocked_only_when_all_three_sections_restricted():
    pid = uuid4()
    period = _period("Monthly", _FROM)
    one = _RestrictionDB({ProjectActivity.METRICS: _FROM}, period)
    await assert_period_open(one, pid, uuid4())  # report as a whole still owed

    all_three = _RestrictionDB(
        {
            ProjectActivity.METRICS: _FROM,
            ProjectActivity.COMMITMENTS: _FROM,
            ProjectActivity.PAYMENT_MILESTONES: _FROM - timedelta(days=30),
        },
        period,
    )
    with pytest.raises(HTTPException) as exc:
        await assert_period_open(all_three, pid, uuid4())
    assert exc.value.status_code == 409


async def test_period_without_restrictions_or_unknown_period_is_open():
    pid = uuid4()
    await assert_period_open(_RestrictionDB({}, _period("Weekly", _FROM)), pid, uuid4())
    await assert_period_open(_RestrictionDB({ProjectActivity.DELIVERY_STATUS: _FROM}, None), pid, uuid4())
    await assert_period_open(_RestrictionDB({ProjectActivity.DELIVERY_STATUS: _FROM}), pid, None)


async def test_assert_activity_open_compares_the_given_date():
    pid = uuid4()
    db = _RestrictionDB({ProjectActivity.DE_ASSESSMENT: _FROM})
    await assert_activity_open(db, pid, ProjectActivity.DE_ASSESSMENT, _FROM - timedelta(days=1))
    with pytest.raises(HTTPException) as exc:
        await assert_activity_open(db, pid, ProjectActivity.DE_ASSESSMENT, _FROM)
    assert exc.value.status_code == 409


async def test_restricted_from_by_project_needs_every_requested_activity():
    a, b = uuid4(), uuid4()

    class _DB:
        async def execute(self, stmt):
            return _ExecResult(
                [
                    (a, ProjectActivity.METRICS.value, date(2026, 9, 1)),
                    (a, ProjectActivity.COMMITMENTS.value, date(2026, 10, 1)),
                    (b, ProjectActivity.METRICS.value, date(2026, 9, 1)),
                ]
            )

    both = await restricted_from_by_project(_DB(), [a, b], ProjectActivity.METRICS, ProjectActivity.COMMITMENTS)
    assert both == {a: date(2026, 10, 1)}  # latest date; b misses Commitments
    assert await restricted_from_by_project(_DB(), [], ProjectActivity.METRICS) == {}


# --- endpoints ----------------------------------------------------------------


def _project():
    return SimpleNamespace(id=uuid4())


async def test_only_admin_and_de_may_set_a_restriction(client, override_auth):
    project = _project()
    body = {"not_required_from": "2026-09-01", "reason": "Closing"}
    path = f"/api/v1/projects/{project.id}/activity-restrictions/METRICS"
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.CDO):
        headers = override_auth(role, get_map={(Project, project.id): project})
        assert (await client.put(path, json=body, headers=headers)).status_code == 403
        assert (await client.delete(path, headers=headers)).status_code == 403
    for role in (RoleCode.ADMIN, RoleCode.DELIVERY_EXCELLENCE):
        headers = override_auth(role, get_map={(Project, project.id): project})
        response = await client.put(path, json=body, headers=headers)
        assert response.status_code == 200
        assert response.json()["activity"] == "METRICS"
        assert response.json()["not_required_from"] == "2026-09-01"


async def test_unknown_activity_is_rejected(client, override_auth):
    project = _project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, project.id): project})
    response = await client.put(
        f"/api/v1/projects/{project.id}/activity-restrictions/NOT_AN_ACTIVITY",
        json={"not_required_from": "2026-09-01"},
        headers=headers,
    )
    assert response.status_code == 422


# --- proxies -------------------------------------------------------------------


class _ProxyDB(FakeDB):
    """FakeDB that remembers writes and answers Role lookups per role id, so the
    proxy's own role (not the caller's) can be checked."""

    def __init__(self, caller_role, roles_by_id, **kwargs):
        super().__init__(caller_role, **kwargs)
        self._roles_by_id = roles_by_id
        self.added: list = []

    async def get(self, model, pk):
        if model is Role and pk in self._roles_by_id:
            return self._roles_by_id[pk]
        return await super().get(model, pk)

    def add(self, obj):
        self.added.append(obj)

    async def execute(self, stmt):
        compiled = str(stmt)
        # "Is this user already linked to the account?" — no, in these fixtures.
        if "user_accounts.account_id = " in compiled and "user_accounts.user_id = " in compiled:
            return _ExecResult([])
        return await super().execute(stmt)


def _use_db(db):
    from app.api.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db


def _proxy_user(role: Role):
    return SimpleNamespace(id=uuid4(), role_id=role.id, is_active=True, full_name="Proxy Person")


async def test_de_adds_a_proxy_project_manager(client, override_auth):
    pm_role = Role(id=uuid4(), code=RoleCode.PROJECT_MANAGER, name="PM")
    project = SimpleNamespace(
        id=uuid4(), project_manager_id=uuid4(), account_id=None, geo_id=None, project_code="PRJ-1",
        project_name="One", region_id=None,
    )
    proxy = _proxy_user(pm_role)
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    db = _ProxyDB(
        RoleCode.DELIVERY_EXCELLENCE,
        {pm_role.id: pm_role},
        get_map={(Project, project.id): project, (User, proxy.id): proxy},
    )
    _use_db(db)
    response = await client.post(
        f"/api/v1/reassignment/projects/{project.id}/proxies", json={"user_id": str(proxy.id)}, headers=headers
    )
    assert response.status_code == 200
    assert [type(o) for o in db.added] == [ProjectProxyManager]
    assert db.added[0].project_id == project.id and db.added[0].user_id == proxy.id


async def test_proxy_project_manager_must_have_the_pm_role(client, override_auth):
    dm_role = Role(id=uuid4(), code=RoleCode.ACCOUNT_MANAGER, name="DM")
    project = SimpleNamespace(id=uuid4(), project_manager_id=uuid4(), account_id=None, geo_id=None)
    not_a_pm = _proxy_user(dm_role)
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    db = _ProxyDB(
        RoleCode.DELIVERY_EXCELLENCE,
        {dm_role.id: dm_role},
        get_map={(Project, project.id): project, (User, not_a_pm.id): not_a_pm},
    )
    _use_db(db)
    response = await client.post(
        f"/api/v1/reassignment/projects/{project.id}/proxies", json={"user_id": str(not_a_pm.id)}, headers=headers
    )
    assert response.status_code == 422
    assert db.added == []


async def test_primary_pm_cannot_also_be_a_proxy(client, override_auth):
    pm_role = Role(id=uuid4(), code=RoleCode.PROJECT_MANAGER, name="PM")
    primary = _proxy_user(pm_role)
    project = SimpleNamespace(id=uuid4(), project_manager_id=primary.id, account_id=None, geo_id=None)
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    db = _ProxyDB(
        RoleCode.DELIVERY_EXCELLENCE,
        {pm_role.id: pm_role},
        get_map={(Project, project.id): project, (User, primary.id): primary},
    )
    _use_db(db)
    response = await client.post(
        f"/api/v1/reassignment/projects/{project.id}/proxies", json={"user_id": str(primary.id)}, headers=headers
    )
    assert response.status_code == 409


async def test_account_head_adds_proxy_dm_only_inside_own_account(client, override_auth):
    dm_role = Role(id=uuid4(), code=RoleCode.ACCOUNT_MANAGER, name="DM")
    own = SimpleNamespace(id=uuid4(), name="Acme", geo_id=None)
    other = SimpleNamespace(id=uuid4(), name="Globex", geo_id=None)
    proxy = _proxy_user(dm_role)
    headers = override_auth(RoleCode.ACCOUNT_MANAGER, owned_account_ids=[own.id])
    db = _ProxyDB(
        RoleCode.ACCOUNT_MANAGER,
        {dm_role.id: dm_role},
        owned_account_ids=[own.id],
        get_map={(Account, own.id): own, (Account, other.id): other, (User, proxy.id): proxy},
    )
    _use_db(db)
    ok = await client.post(
        f"/api/v1/reassignment/accounts/{own.id}/proxies", json={"user_id": str(proxy.id)}, headers=headers
    )
    assert ok.status_code == 200
    assert any(isinstance(o, UserAccount) and o.is_proxy and o.account_id == own.id for o in db.added)
    denied = await client.post(
        f"/api/v1/reassignment/accounts/{other.id}/proxies", json={"user_id": str(proxy.id)}, headers=headers
    )
    assert denied.status_code == 403


async def test_proxy_routes_reject_roles_outside_the_assign_role_screen(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    pid, aid, uid = uuid4(), uuid4(), uuid4()
    for path in (f"projects/{pid}/proxies", f"accounts/{aid}/proxies"):
        assert (await client.post(f"/api/v1/reassignment/{path}", json={"user_id": str(uid)}, headers=headers)).status_code == 403
        assert (await client.delete(f"/api/v1/reassignment/{path}/{uid}", headers=headers)).status_code == 403


async def test_all_restrictions_list_is_open_to_signed_in_users(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/activity-restrictions", headers=headers)
    assert response.status_code == 200
    assert response.json() == []
