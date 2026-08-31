"""touch_project_on_write (app.api.deps) records project activity after any
successful write to a project-scoped route. It rides get_db, which the test
suite overrides with a no-op FakeDB, so here we only assert it stays inert:
the dependency must not change a request's status code or body.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.deps import _PROJECT_WRITE_PATH
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_PID = uuid4()


async def test_project_write_path_regex_matches_project_scoped_writes():
    assert _PROJECT_WRITE_PATH.match(f"/api/v1/projects/{_PID}/status-reports")
    assert _PROJECT_WRITE_PATH.match(f"/api/v1/projects/{_PID}/raido/risks")
    assert _PROJECT_WRITE_PATH.match(f"/api/v1/de-approval/{_PID}/decision")
    # non-project paths and the bare project route are not matched
    assert _PROJECT_WRITE_PATH.match("/api/v1/projects") is None
    assert _PROJECT_WRITE_PATH.match(f"/api/v1/projects/{_PID}") is None
    assert _PROJECT_WRITE_PATH.match("/api/v1/accounts") is None


async def test_dependency_does_not_alter_a_write_response(client, override_auth):
    # A DELETE that 404s inside the endpoint still returns 404 (not 500) with the
    # activity dependency layered on — i.e. the bump is inert / swallowed.
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.delete(
        f"/api/v1/projects/{_PID}/oracle-ids/{uuid4()}", headers=headers
    )
    assert response.status_code == 404


async def test_dependency_does_not_alter_a_read_response(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/projects", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()
