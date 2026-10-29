import io
from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile

from app.api.v1.endpoints import customer_communications as cc
from app.core.config import settings
from app.models.reference_data import Account
from app.schemas.enums import QbrStatus, RoleCode
from tests.test_authorization import make_user, override_auth  # noqa: F401  (pytest fixture)
from tests.test_dashboard import _now, session_factory  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_URL = f"/api/v1/accounts/{_ACCOUNT_ID}/customer-communications"


async def test_list_requires_auth(client):
    assert (await client.get(_URL)).status_code == 401


async def test_list_rejects_unrelated_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    assert (await client.get(_URL, headers=headers)).status_code == 403


@pytest.mark.parametrize("role", [RoleCode.ADMIN, RoleCode.CXO, RoleCode.DELIVERY_EXCELLENCE])
async def test_list_returns_empty_for_cross_portfolio_roles(client, override_auth, role):
    headers = override_auth(role)
    response = await client.get(_URL, headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_rejects_cxo(client, override_auth):
    headers = override_auth(RoleCode.CXO)
    response = await client.post(
        _URL,
        data={"planned_date": "2026-09-15", "status": "Scheduled", "title": "Q3 Account Review"},
        files={"file": ("deck.pptx", b"x")},
        headers=headers,
    )
    assert response.status_code == 403


async def test_create_requires_planned_date_and_status(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    for data in (
        {"status": "Scheduled"},
        {"planned_date": "2026-09-15"},
        {"planned_date": "2026-09-15", "status": "Done"},
    ):
        assert (await client.post(_URL, data=data, headers=headers)).status_code == 422


async def _post_conducted(client, headers, file_name="deck.pptx", **overrides):
    today = date.today()
    data = {
        "planned_date": today.isoformat(),
        "status": "Conducted",
        "title": "Q3 Account Review",
        "actual_date": today.isoformat(),
        "next_qbr_date": (today + timedelta(days=90)).isoformat(),
        **overrides,
    }
    data = {k: v for k, v in data.items() if v is not None}
    return await client.post(_URL, data=data, files={"file": (file_name, b"x")}, headers=headers)


async def test_create_rejects_disallowed_file_type(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    response = await _post_conducted(client, headers, file_name="notes.txt")
    assert response.status_code == 400
    assert "allowed" in response.json()["detail"]


async def test_create_rejects_future_actual_date(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    response = await _post_conducted(client, headers, actual_date=(date.today() + timedelta(days=1)).isoformat())
    assert response.status_code == 400
    assert "future" in response.json()["detail"]


@pytest.mark.parametrize(
    ("missing", "message"),
    [
        ("title", "Title is required"),
        ("actual_date", "Actual QBR Date is required"),
        ("next_qbr_date", "Next QBR Date is required"),
    ],
)
async def test_conducted_requires_title_and_dates(client, override_auth, missing, message):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    response = await _post_conducted(client, headers, **{missing: None})
    assert response.status_code == 400
    assert message in response.json()["detail"]


async def test_conducted_next_date_must_be_after_actual_date(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    actual = date.today() - timedelta(days=30)
    response = await _post_conducted(
        client, headers, actual_date=actual.isoformat(), next_qbr_date=actual.isoformat()
    )
    assert response.status_code == 400
    assert "after the Actual QBR Date" in response.json()["detail"]


async def test_conducted_next_date_may_be_in_the_past(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    actual = date.today() - timedelta(days=200)
    response = await _post_conducted(
        client, headers, actual_date=actual.isoformat(), next_qbr_date=(actual + timedelta(days=90)).isoformat()
    )
    assert response.status_code == 201


async def test_conducted_requires_presentation(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    today = date.today()
    response = await client.post(
        _URL,
        data={
            "planned_date": today.isoformat(),
            "status": "Conducted",
            "title": "QBR",
            "actual_date": today.isoformat(),
            "next_qbr_date": (today + timedelta(days=90)).isoformat(),
        },
        headers=headers,
    )
    assert response.status_code == 400
    assert "presentation" in response.json()["detail"]


# --- Against a real (sqlite) DB: the one-open-QBR rule and the follow-up QBR. ---


def _upload(name="deck.pptx"):
    return UploadFile(file=io.BytesIO(b"x"), filename=name)


async def _make_account(session):
    account = Account(id=uuid4(), name="Acme", is_active=True, created_at=_now(), updated_at=_now())
    session.add(account)
    await session.commit()
    return account


def _fields(**overrides):
    fields = {
        "planned_date": date.today(),
        "qbr_status": QbrStatus.SCHEDULED,
        "title": None,
        "actual_date": None,
        "next_qbr_date": None,
        "remarks": None,
        "file": None,
    }
    fields.update(overrides)
    return fields


async def test_conducted_qbr_opens_the_next_one_initiated(session_factory, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "document_storage_dir", str(tmp_path))
    user = make_user()
    today = date.today()
    async with session_factory() as session:
        account = await _make_account(session)
        scheduled = await cc.create_customer_communication(account.id, **_fields(), db=session, current_user=user)
        # Only one Initiated / Scheduled QBR per account.
        with pytest.raises(HTTPException) as exc:
            await cc.create_customer_communication(account.id, **_fields(), db=session, current_user=user)
        assert exc.value.status_code == 409

        next_date = today + timedelta(days=90)
        conducted = await cc.update_customer_communication(
            account.id,
            scheduled.id,
            **_fields(
                qbr_status=QbrStatus.CONDUCTED,
                title="Q3 Review",
                actual_date=today,
                next_qbr_date=next_date,
                file=_upload(),
            ),
            db=session,
            current_user=user,
        )
        await session.commit()
        assert (conducted.status, conducted.actual_date, conducted.file_name) == ("Conducted", today, "deck.pptx")

        rows = await cc.list_customer_communications(account.id, db=session)
        follow_up = [r for r in rows if r.status == "Initiated"]
        assert len(rows) == 2 and len(follow_up) == 1
        assert follow_up[0].planned_date == next_date
        assert (follow_up[0].title, follow_up[0].actual_date, follow_up[0].file_name) == (None, None, None)

        # A Conducted QBR is closed.
        with pytest.raises(HTTPException) as exc:
            await cc.update_customer_communication(account.id, conducted.id, **_fields(), db=session, current_user=user)
        assert exc.value.status_code == 409
