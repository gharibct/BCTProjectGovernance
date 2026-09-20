from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.db import get_db
from app.crud.project_status import project_status_item_crud, project_status_report_crud
from app.crud.regional_status import account_status_item_crud, account_status_report_crud
from app.models.project_status import ProjectStatusReport
from app.models.projects import Project
from app.models.reference_data import Account, ReportingPeriod
from app.models.regional_status import AccountStatusReport
from app.models.users import User
from app.schemas.bulk_delivery_status import (
    BulkAccountStatusReport,
    BulkProjectStatusReport,
    BulkStatusReportBase,
)
from app.schemas.enums import ProjectStatusCategory, ReportStatus, RoleCode
from app.schemas.project_status import ProjectStatusItemCreate, ProjectStatusReportCreate, ProjectStatusReportRead
from app.schemas.regional_status import AccountStatusItemCreate, AccountStatusReportCreate, AccountStatusReportRead
from app.services import dashboard as dashboard_service

# Admin bulk upload of Delivery Status reports (Projects / Accounts). Called
# once per upload row, so each row commits (or fails) on its own. Reports land
# as Draft — the PM / Account Head reviews and submits them as usual.
router = APIRouter(
    prefix="/bulk",
    tags=["Bulk Delivery Status"],
    dependencies=[Depends(require_role(RoleCode.ADMIN))],
)

_CATEGORY_FIELDS = (
    ("key_accomplishments", ProjectStatusCategory.KEY_ACCOMPLISHMENTS),
    ("upcoming_key_releases", ProjectStatusCategory.UPCOMING_KEY_RELEASES),
    ("leadership_support_required", ProjectStatusCategory.LEADERSHIP_SUPPORT_REQUIRED),
    ("key_risks_issues", ProjectStatusCategory.KEY_RISKS_ISSUES),
)


async def _resolve_period(db: AsyncSession, raw: str) -> ReportingPeriod:
    key = raw.strip().lower()
    period = (
        (
            await db.execute(
                select(ReportingPeriod).where(
                    or_(func.lower(ReportingPeriod.code) == key, func.lower(ReportingPeriod.label) == key)
                )
            )
        )
        .scalars()
        .first()
    )
    if period is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Reporting period {raw!r} not found.")
    return period


def _items(payload: BulkStatusReportBase) -> list[tuple[ProjectStatusCategory, str]]:
    return [
        (category, text.strip())
        for field, category in _CATEGORY_FIELDS
        for text in getattr(payload, field)
        if text.strip()
    ]


def _report_fields(payload: BulkStatusReportBase, period: ReportingPeriod, user: User) -> dict:
    return {
        "period_id": period.id,
        "status": ReportStatus.DRAFT,
        "revenue": payload.revenue,
        "onsite_fte": payload.onsite_fte,
        "offshore_fte": payload.offshore_fte,
        "projects_count": payload.projects_count,
        "created_by": user.id,
    }


@router.post("/project-status-reports", response_model=ProjectStatusReportRead, status_code=status.HTTP_201_CREATED)
async def bulk_create_project_status_report(
    payload: BulkProjectStatusReport,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = payload.project_code.strip().lower()
    project = (
        await db.execute(select(Project).where(func.lower(Project.project_code) == code))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Project {payload.project_code!r} not found.")
    period = await _resolve_period(db, payload.period)
    existing = (
        await db.execute(
            select(ProjectStatusReport.id).where(
                ProjectStatusReport.project_id == project.id, ProjectStatusReport.period_id == period.id
            )
        )
    ).first()
    if existing is not None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{project.project_code} already has a status report for {period.label}.",
        )

    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="project", scope_id=project.id
    )
    report = await project_status_report_crud.create(
        db,
        ProjectStatusReportCreate(**_report_fields(payload, period, current_user)),
        project_id=project.id,
        open_alerts_count=alerts_count,
        open_alerts_snapshot=alerts_snapshot,
    )
    for category, description in _items(payload):
        await project_status_item_crud.create(
            db,
            ProjectStatusItemCreate(period_id=period.id, category=category, description=description),
            project_id=project.id,
        )
    return report


@router.post("/account-status-reports", response_model=AccountStatusReportRead, status_code=status.HTTP_201_CREATED)
async def bulk_create_account_status_report(
    payload: BulkAccountStatusReport,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await db.get(Account, payload.account_id)
    if account is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Account not found.")
    period = await _resolve_period(db, payload.period)
    existing = (
        await db.execute(
            select(AccountStatusReport.id).where(
                AccountStatusReport.account_id == account.id, AccountStatusReport.period_id == period.id
            )
        )
    ).first()
    if existing is not None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{account.name} already has a status report for {period.label}.",
        )

    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="account", scope_id=account.id
    )
    report = await account_status_report_crud.create(
        db,
        AccountStatusReportCreate(**_report_fields(payload, period, current_user)),
        account_id=account.id,
        open_alerts_count=alerts_count,
        open_alerts_snapshot=alerts_snapshot,
    )
    for category, description in _items(payload):
        await account_status_item_crud.create(
            db,
            AccountStatusItemCreate(period_id=period.id, category=category, description=description),
            account_id=account.id,
        )
    return report
