"""Bulk copy of the previous DE assessment into a selected Weekly period.

An assessment stays valid for 35 days, so the latest Submitted assessment of a
project / account can be carried forward to later periods unchanged. Each copy
is a new Submitted row with the SAME assessment date and the selected period. It
is refused (listed in the "failed" grid) when the assessment date is more than
35 days before the period end date. Project Quality Audits carry no period and
are ignored; so are projects / accounts with nothing to copy.
"""

from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import require_role
from app.core.db import get_db
from app.models.de_account_audit import DEAccountAudit
from app.models.de_assessment import DEAssessment
from app.models.projects import Project
from app.models.reference_data import Account, ReportingPeriod
from app.models.users import User
from app.schemas.de_bulk_copy import BulkCopyRequest, BulkCopyResult, BulkCopyRow
from app.schemas.enums import DEAssessmentStatus, DEAssessmentType, ProjectActivity, RoleCode
from app.services.activity_restriction import assert_activity_open
from app.services.assessment_window import ASSESSMENT_WINDOW_DAYS
from app.services.dashboard import _APPROVED_PROJECT_STATUSES

router = APIRouter(prefix="/de-bulk-copy", tags=["DE Bulk Copy"])

_de = require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)

_SUBMITTED = DEAssessmentStatus.SUBMITTED.value


async def _weekly_period(db: AsyncSession, period_id: UUID) -> ReportingPeriod:
    period = await db.get(ReportingPeriod, period_id)
    if period is None or period.period_type != "Weekly":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "period_id must be a Weekly reporting period")
    return period


def _skip_reason(
    source_date: date | None,
    source_period_end: date | None,
    period: ReportingPeriod,
    earliest: date,
) -> str | None:
    if source_date is None:
        return "The previous assessment has no assessment date."
    if source_period_end is not None and source_period_end >= period.end_date:
        return "The latest assessment already covers this or a later period."
    if source_date < earliest:
        return (
            f"Assessment dated {source_date.isoformat()} is more than {ASSESSMENT_WINDOW_DAYS} days before the "
            f"period end date ({period.end_date.isoformat()}); the earliest valid date is {earliest.isoformat()}."
        )
    return None


@router.post("/projects", response_model=BulkCopyResult)
async def bulk_copy_projects(
    payload: BulkCopyRequest,
    current_user: User = Depends(_de),
    db: AsyncSession = Depends(get_db),
):
    period = await _weekly_period(db, payload.period_id)
    earliest = period.end_date - timedelta(days=ASSESSMENT_WINDOW_DAYS)

    de = aliased(User)
    stmt = (
        select(Project, Account.name, de.full_name)
        .outerjoin(Account, Account.id == Project.account_id)
        .outerjoin(de, de.id == Project.delivery_excellence_id)
        .where(
            Project.delivery_excellence_id.is_not(None),
            Project.project_status.in_(_APPROVED_PROJECT_STATUSES),
            Project.lifecycle_status.is_(None) | Project.lifecycle_status.not_in(["Closed", "Hold"]),
        )
        .order_by(Project.project_name)
    )
    if payload.de_user_id is not None:
        stmt = stmt.where(Project.delivery_excellence_id == payload.de_user_id)
    projects = (await db.execute(stmt)).all()
    ids = [p.id for p, *_ in projects]

    by_project: dict[UUID, list[DEAssessment]] = {}
    if ids:
        for a in (
            await db.execute(
                select(DEAssessment).where(
                    DEAssessment.project_id.in_(ids),
                    DEAssessment.assessment_type == DEAssessmentType.DELIVERY_RISK_REVIEW.value,
                )
            )
        ).scalars():
            by_project.setdefault(a.project_id, []).append(a)

    period_ends: dict[UUID, date] = {}
    period_ids = {a.period_id for rows in by_project.values() for a in rows if a.period_id}
    if period_ids:
        period_ends = dict(
            (
                await db.execute(
                    select(ReportingPeriod.id, ReportingPeriod.end_date).where(ReportingPeriod.id.in_(period_ids))
                )
            ).all()
        )

    copied: list[BulkCopyRow] = []
    failed: list[BulkCopyRow] = []
    skipped: list[BulkCopyRow] = []
    now = datetime.now(UTC)
    for project, account_name, de_name in projects:
        history = by_project.get(project.id, [])
        submitted = sorted(
            (a for a in history if a.status == _SUBMITTED),
            key=lambda a: (a.assessment_date or date.min, a.created_at),
            reverse=True,
        )
        if not submitted:
            continue  # nothing to copy (or Quality Audit only) — ignored
        src = submitted[0]
        existing = next((a for a in history if a.period_id == period.id), None)
        if existing is not None:
            # Already assessed for this period — never copied again; shown as an exception.
            skipped.append(
                BulkCopyRow(
                    entity_id=project.id,
                    entity_name=f"{project.project_code} — {project.project_name}",
                    account_name=account_name,
                    delivery_excellence_name=de_name,
                    assessment_date=existing.assessment_date,
                    de_health=existing.de_assessed_project_health,
                    pci_score=existing.pci_score,
                    reason=f"Already has an assessment ({existing.status}) for {period.label}.",
                )
            )
            continue
        reason = _skip_reason(
            src.assessment_date, period_ends.get(src.period_id) if src.period_id else None, period, earliest
        )
        if reason is None:
            try:
                await assert_activity_open(db, project.id, ProjectActivity.DE_ASSESSMENT, src.assessment_date)
            except HTTPException as exc:
                reason = exc.detail if isinstance(exc.detail, str) else "DE Assessment is not required for this project."
        row = BulkCopyRow(
            entity_id=project.id,
            entity_name=f"{project.project_code} — {project.project_name}",
            account_name=account_name,
            delivery_excellence_name=de_name,
            assessment_date=src.assessment_date,
            de_health=src.de_assessed_project_health,
            pci_score=src.pci_score,
            reason=reason,
        )
        if reason is not None:
            failed.append(row)
            continue
        db.add(
            DEAssessment(
                id=uuid4(),
                project_id=project.id,
                assessment_date=src.assessment_date,
                assessment_type=DEAssessmentType.DELIVERY_RISK_REVIEW.value,
                period_id=period.id,
                de_assessed_project_health=src.de_assessed_project_health,
                pci_score=src.pci_score,
                remarks=src.remarks,
                status=_SUBMITTED,
                next_assessment_due_date=src.next_assessment_due_date,
                assessed_by=current_user.id,
                created_at=now,
                updated_at=now,
            )
        )
        copied.append(row)
    await db.flush()
    return BulkCopyResult(
        period_label=period.label,
        period_end_date=period.end_date,
        earliest_assessment_date=earliest,
        copied=copied,
        failed=failed,
        skipped=skipped,
    )


@router.post("/accounts", response_model=BulkCopyResult)
async def bulk_copy_accounts(
    payload: BulkCopyRequest,
    current_user: User = Depends(_de),
    db: AsyncSession = Depends(get_db),
):
    period = await _weekly_period(db, payload.period_id)
    earliest = period.end_date - timedelta(days=ASSESSMENT_WINDOW_DAYS)

    de = aliased(User)
    stmt = (
        select(Account, de.full_name)
        .outerjoin(de, de.id == Account.delivery_excellence_id)
        .where(Account.is_active.is_(True), Account.delivery_excellence_id.is_not(None))
        .order_by(Account.name)
    )
    if payload.de_user_id is not None:
        stmt = stmt.where(Account.delivery_excellence_id == payload.de_user_id)
    accounts = (await db.execute(stmt)).all()
    ids = [a.id for a, _ in accounts]

    by_account: dict[UUID, list[DEAccountAudit]] = {}
    if ids:
        for a in (
            await db.execute(select(DEAccountAudit).where(DEAccountAudit.account_id.in_(ids)))
        ).scalars():
            by_account.setdefault(a.account_id, []).append(a)

    period_ends: dict[UUID, date] = {}
    period_ids = {a.period_id for rows in by_account.values() for a in rows if a.period_id}
    if period_ids:
        period_ends = dict(
            (
                await db.execute(
                    select(ReportingPeriod.id, ReportingPeriod.end_date).where(ReportingPeriod.id.in_(period_ids))
                )
            ).all()
        )

    copied: list[BulkCopyRow] = []
    failed: list[BulkCopyRow] = []
    skipped: list[BulkCopyRow] = []
    now = datetime.now(UTC)
    for account, de_name in accounts:
        history = by_account.get(account.id, [])
        submitted = sorted(
            (a for a in history if a.status == _SUBMITTED),
            key=lambda a: (a.audit_date or date.min, a.created_at),
            reverse=True,
        )
        if not submitted:
            continue
        src = submitted[0]
        existing = next((a for a in history if a.period_id == period.id), None)
        if existing is not None:
            skipped.append(
                BulkCopyRow(
                    entity_id=account.id,
                    entity_name=account.name,
                    delivery_excellence_name=de_name,
                    assessment_date=existing.audit_date,
                    de_health=existing.de_assessed_health,
                    reason=f"Already has an assessment ({existing.status}) for {period.label}.",
                )
            )
            continue
        reason = _skip_reason(
            src.audit_date, period_ends.get(src.period_id) if src.period_id else None, period, earliest
        )
        row = BulkCopyRow(
            entity_id=account.id,
            entity_name=account.name,
            delivery_excellence_name=de_name,
            assessment_date=src.audit_date,
            de_health=src.de_assessed_health,
            reason=reason,
        )
        if reason is not None:
            failed.append(row)
            continue
        db.add(
            DEAccountAudit(
                id=uuid4(),
                account_id=account.id,
                audit_date=src.audit_date,
                de_assessed_health=src.de_assessed_health,
                remarks=src.remarks,
                status=_SUBMITTED,
                next_audit_due_date=src.next_audit_due_date,
                period_id=period.id,
                covered_project_ids=list(src.covered_project_ids or []),
                audited_by=current_user.id,
                created_at=now,
                updated_at=now,
            )
        )
        copied.append(row)
    await db.flush()
    return BulkCopyResult(
        period_label=period.label,
        period_end_date=period.end_date,
        earliest_assessment_date=earliest,
        copied=copied,
        failed=failed,
        skipped=skipped,
    )
