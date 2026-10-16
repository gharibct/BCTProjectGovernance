"""Submit-time RAG rules between the Account Delivery Status Report and its projects.

1. Account submit: at each RAG parameter the account's rating must be the same
   as, or worse than, the worst rating any of its projects filed for the same
   period (a project at Amber means the account is Amber, Potential Red or Red
   there - never Green). Only projects' Submitted / Approved reports count; a
   Draft or Rejected project report has not been filed yet.
2. Project submit after the account: if the account's report for the period is
   already Submitted / Approved, the project's ratings may not be worse than the
   account's at any parameter.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_health_declarations import AccountHealthDeclaration
from app.models.health_declarations import HealthDeclaration
from app.models.project_status import ProjectStatusReport
from app.models.projects import Project
from app.models.regional_status import AccountStatusReport
from app.schemas.enums import HEALTH_RATING_SEVERITY, HealthRating, ReportStatus

# (label shown to the user, rating column on both declaration tables)
RAG_PARAMETERS = [
    ("Core Delivery", "core_delivery_rating"),
    ("People", "people_rating"),
    ("Operational", "operational_rating"),
    ("Customer", "customer_rating"),
    ("Financial", "financial_rating"),
    ("Compliance", "compliance_rating"),
]


def _severity(rating: str) -> int:
    """0 = worst (Red) .. 3 = best (Green)."""
    return HEALTH_RATING_SEVERITY.index(HealthRating(rating))


def _rag_findings(
    account_ratings: dict[str, str] | None,
    project_ratings: list[tuple[str, dict[str, str]]],
) -> list[tuple[str, str | None, str, str]]:
    """(parameter label, account rating or None, required rating, project label)
    for every parameter where the account is better than its worst project."""
    findings: list[tuple[str, str | None, str, str]] = []
    for label, column in RAG_PARAMETERS:
        worst: tuple[int, str] | None = None
        for project_label, ratings in project_ratings:
            rating = ratings.get(column)
            if rating is None:
                continue
            level = _severity(rating)
            if worst is None or level < worst[0]:
                worst = (level, project_label)
        if worst is None or worst[0] == _severity(HealthRating.GREEN.value):
            continue  # no project is worse than Green here - nothing to enforce
        project_rating = HEALTH_RATING_SEVERITY[worst[0]].value
        account_rating = (account_ratings or {}).get(column)
        if account_rating is None or _severity(account_rating) > worst[0]:
            findings.append((label, account_rating, project_rating, worst[1]))
    return findings


def rag_violations(
    account_ratings: dict[str, str] | None,
    project_ratings: list[tuple[str, dict[str, str]]],
) -> list[str]:
    """Pure rule check. `account_ratings` maps column -> rating (None = the
    account has not set RAG yet); `project_ratings` is [(project label, column ->
    rating)]. Returns one message per parameter that breaks the rule."""
    return [
        f"{label}: account is {account_rating or 'not set'}, must be {project_rating} or worse "
        f"(project {project_label} is {project_rating})."
        for label, account_rating, project_rating, project_label in _rag_findings(account_ratings, project_ratings)
    ]


def _friendly_message(findings: list[tuple[str, str | None, str, str]]) -> str:
    """One block per project, listing the parameters it affects, e.g.
    'Project X is rated Potential Red on People, Customer. Set the account to
    Potential Red or worse on these.'"""
    by_project: dict[tuple[str, str], list[str]] = {}
    for label, _account_rating, project_rating, project_label in findings:
        by_project.setdefault((project_label, project_rating), []).append(label)
    lines = [
        f"Project {project_label} is rated {project_rating} on {', '.join(labels)} "
        f"- set the account to {project_rating} or worse on {'this' if len(labels) == 1 else 'these'}."
        for (project_label, project_rating), labels in by_project.items()
    ]
    return "The account RAG cannot be better than its projects' RAG. " + " ".join(lines)


async def assert_account_rag_not_better_than_projects(
    db: AsyncSession,
    account_id: UUID,
    period_id: UUID,
    account_ratings_override: dict[str, str] | None = None,
) -> None:
    """`account_ratings_override` lets a RAG save validate the ratings being
    written (column -> rating) instead of the stored declaration."""
    projects = (await db.execute(select(Project).where(Project.account_id == account_id))).scalars().all()
    if not projects:
        return
    project_by_id = {p.id: p for p in projects}

    filed_ids = set(
        (
            await db.execute(
                select(ProjectStatusReport.project_id).where(
                    ProjectStatusReport.project_id.in_(project_by_id.keys()),
                    ProjectStatusReport.period_id == period_id,
                    ProjectStatusReport.status.in_((ReportStatus.SUBMITTED, ReportStatus.APPROVED)),
                )
            )
        ).scalars()
    )
    if not filed_ids:
        return

    # Latest declaration per project for the period.
    declarations = (
        (
            await db.execute(
                select(HealthDeclaration).where(
                    HealthDeclaration.project_id.in_(filed_ids), HealthDeclaration.period_id == period_id
                )
            )
        )
        .scalars()
        .all()
    )
    latest: dict[UUID, HealthDeclaration] = {}
    for decl in declarations:
        current = latest.get(decl.project_id)
        if current is None or decl.created_at > current.created_at:
            latest[decl.project_id] = decl
    project_ratings = [
        (
            f"{project_by_id[pid].project_code} · {project_by_id[pid].project_name}",
            {column: getattr(decl, column) for _, column in RAG_PARAMETERS},
        )
        for pid, decl in latest.items()
    ]

    account_decls = (
        (
            await db.execute(
                select(AccountHealthDeclaration).where(
                    AccountHealthDeclaration.account_id == account_id,
                    AccountHealthDeclaration.period_id == period_id,
                )
            )
        )
        .scalars()
        .all()
    )
    account_decl = max(account_decls, key=lambda d: d.created_at, default=None)
    account_ratings = {column: getattr(account_decl, column) for _, column in RAG_PARAMETERS} if account_decl else None

    if account_ratings_override is not None:
        account_ratings = account_ratings_override
    findings = _rag_findings(account_ratings, project_ratings)
    if findings:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, _friendly_message(findings))


def project_rag_violations(
    account_ratings: dict[str, str],
    project_ratings: dict[str, str],
) -> list[str]:
    """Reverse rule, checked when a project report is submitted after the
    account's report: at no parameter may the project be worse than the
    account's submitted rating."""
    problems: list[str] = []
    for label, column in RAG_PARAMETERS:
        account_rating = account_ratings.get(column)
        project_rating = project_ratings.get(column)
        if account_rating is None or project_rating is None:
            continue
        if _severity(project_rating) < _severity(account_rating):
            problems.append(f"{label}: project RAG is {project_rating} but the submitted account RAG is {account_rating}.")
    return problems


async def assert_project_rag_within_submitted_account(
    db: AsyncSession,
    project_id: UUID,
    period_id: UUID,
    project_ratings_override: dict[str, str] | None = None,
) -> None:
    """When a project report is submitted and the account's report for the same
    period is already Submitted / Approved, the project's ratings must be the
    same as or better than the account's (the account stays at least as bad as
    every project). Nothing to check while the account report is still open.
    `project_ratings_override` lets a RAG save validate the ratings being
    written (column -> rating) instead of the stored declaration."""
    project = await db.get(Project, project_id)
    if project is None or project.account_id is None:
        return
    account_status = (
        await db.execute(
            select(AccountStatusReport.status).where(
                AccountStatusReport.account_id == project.account_id, AccountStatusReport.period_id == period_id
            )
        )
    ).scalars().first()
    if account_status not in (ReportStatus.SUBMITTED, ReportStatus.APPROVED):
        return

    project_decls = (
        (
            await db.execute(
                select(HealthDeclaration).where(
                    HealthDeclaration.project_id == project_id, HealthDeclaration.period_id == period_id
                )
            )
        )
        .scalars()
        .all()
    )
    account_decls = (
        (
            await db.execute(
                select(AccountHealthDeclaration).where(
                    AccountHealthDeclaration.account_id == project.account_id,
                    AccountHealthDeclaration.period_id == period_id,
                )
            )
        )
        .scalars()
        .all()
    )
    project_decl = max(project_decls, key=lambda d: d.created_at, default=None)
    account_decl = max(account_decls, key=lambda d: d.created_at, default=None)
    if account_decl is None or (project_decl is None and project_ratings_override is None):
        return

    problems = project_rag_violations(
        {column: getattr(account_decl, column) for _, column in RAG_PARAMETERS},
        project_ratings_override
        if project_ratings_override is not None
        else {column: getattr(project_decl, column) for _, column in RAG_PARAMETERS},
    )
    if problems:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Project RAG cannot be worse than the account RAG already submitted for this period. "
            + " ".join(problems)
            + " Improve the project RAG, or ask the Delivery Manager to recall and update the account report.",
        )
