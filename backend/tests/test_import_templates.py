import pytest

from app.core.config import settings
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401

pytestmark = pytest.mark.asyncio


async def test_missing_template_is_404(client, override_auth, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "import_template_dir", str(tmp_path))
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get("/api/v1/import-templates/projects", headers=headers)
    assert response.status_code == 404


async def test_existing_template_is_served(client, override_auth, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "import_template_dir", str(tmp_path))
    (tmp_path / "projects-template.xlsx").write_bytes(b"PK-fake-xlsx")
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/import-templates/projects", headers=headers)
    assert response.status_code == 200
    assert response.content == b"PK-fake-xlsx"
    assert "spreadsheetml" in response.headers["content-type"]


@pytest.mark.parametrize("slug", ["..%2Fsecret", "Projects", "a_b", "-x"])
async def test_bad_slug_is_404(client, override_auth, tmp_path, monkeypatch, slug):
    monkeypatch.setattr(settings, "import_template_dir", str(tmp_path))
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get(f"/api/v1/import-templates/{slug}", headers=headers)
    assert response.status_code == 404
