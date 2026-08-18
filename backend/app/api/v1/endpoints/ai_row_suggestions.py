from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.db import get_db
from app.crud import ai_row_suggestions as crud
from app.crud.projects import project_crud
from app.schemas.ai_row_suggestions import AiRowSuggestionBatchIn, AiRowSuggestionIn, AiRowSuggestionRead
from app.schemas.enums import AiRowSuggestionStatus, RoleCode

# AI-Implementation.md §10: for grids (Risks/Issues/Dependencies/Assumptions/
# Opportunities), AI confidence applies to a whole candidate row, not a
# field. `screen` here is the entity's RAID prefix (risks/issues/
# dependencies/assumptions/opportunities). The app still never writes
# directly to business tables — "Apply" (below) is the frontend calling that
# entity's own create endpoint with the suggested values, same as manual
# entry; /apply here only marks the suggestion consumed afterward.
router = APIRouter(prefix="/projects/{project_id}/ai-row-suggestions", tags=["AI Row Suggestions"])

_pm_write = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN))]


async def _get_project_or_404(project_id: UUID, db: AsyncSession):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get("", response_model=list[AiRowSuggestionRead])
async def list_pending_suggestions(
    project_id: UUID, screen: str, period_id: UUID, db: AsyncSession = Depends(get_db)
):
    return await crud.list_pending(db, project_id, screen, period_id)


@router.post(
    "", response_model=list[AiRowSuggestionRead], status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def ingest_suggestions(
    project_id: UUID, payload: AiRowSuggestionBatchIn, db: AsyncSession = Depends(get_db)
):
    await _get_project_or_404(project_id, db)
    return await crud.upsert_batch(db, project_id, payload.screen, payload.period_id, payload.rows)


def _risk_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "risk_title": "Procurement Delay",
                "risk_category": "Operational",
                "risk_type": "External",
                "probability": "High",
                "impact": "High",
                "response_strategy": "Mitigate",
                "risk_description": "Vendor hardware procurement has been delayed past the planned lead time.",
            },
            confidence=0.87,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 2",
            evidence="Hardware procurement from the vendor is running three weeks behind the original lead time.",
        ),
        AiRowSuggestionIn(
            values={
                "risk_title": "Vendor Availability",
                "risk_category": "Operational",
                "risk_type": "External",
                "probability": "Medium",
                "impact": "High",
                "response_strategy": "Transfer",
                "risk_description": "Key vendor resource may be unavailable during UAT due to a scheduling conflict.",
            },
            confidence=0.6,
            source_document="Resource_Plan.xlsx",
            source_location="Sheet1!D8",
            evidence="Vendor confirmed the assigned SME has a scheduling conflict during the planned UAT window.",
        ),
        AiRowSuggestionIn(
            values={
                "risk_title": "Cybersecurity Approval",
                "risk_category": "Compliance",
                "risk_type": "Internal",
                "probability": "Medium",
                "impact": "Critical",
                "response_strategy": "Avoid",
                "risk_description": "Security review board has not yet approved the new integration endpoint.",
            },
            confidence=0.4,
            source_document="Steering_Committee_Minutes.pdf",
            source_location="Page 2",
            evidence="Security review board flagged the new integration endpoint as pending approval.",
        ),
    ]


def _issue_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "issue_title": "Integration Approval Blocked",
                "issue_category": "Compliance",
                "priority": "High",
                "severity": "Major",
                "root_cause": "Security review board has not yet approved the new integration endpoint.",
                "business_impact": "Go-live for the integration module is blocked until approval is granted.",
            },
            confidence=0.66,
            source_document="Steering_Committee_Minutes.pdf",
            source_location="Page 2",
            evidence="Security review board flagged the new integration endpoint as pending approval.",
        ),
    ]


def _dependency_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "dependency_title": "Customer Data Export",
                "dependency_type": "Customer",
                "category": "Data Migration",
                "depends_on": "Customer IT team to provide a clean data export",
                "criticality": "High",
                "probability_of_delay": "Medium",
                "impact_if_delayed": "Data migration testing cannot start without the export.",
            },
            confidence=0.58,
            source_document="Statement_of_Work.docx",
            source_location="Section 3",
            evidence="Migration testing depends on the customer's IT team providing a clean data export.",
        ),
    ]


def _assumption_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "title": "Existing Infrastructure Reuse",
                "category": "Operational",
                "detailed_description": "Assumes existing customer infrastructure can be reused without upgrades.",
                "probability_of_failure": "Low",
                "impact_rating": "Medium",
                "impact_if_invalid": "Additional infrastructure procurement would extend the schedule.",
            },
            confidence=0.5,
            source_document="Project_Charter.pdf",
            source_location="Page 5",
            evidence="Charter assumes the customer's existing infrastructure can be reused without upgrades.",
        ),
    ]


def _opportunity_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "opportunity_title": "Phase 2 Expansion",
                "category": "Financial",
                "opportunity_description": "Customer expressed interest in extending the engagement to two more regions.",
                "impact": "High",
                "expected_benefit": "Revenue",
                "benefit_type": "Revenue Increase",
                "exploitation_strategy": "Exploit",
                "action_plan": "Prepare a Phase 2 proposal for the additional regions.",
            },
            confidence=0.62,
            source_document="Steering_Committee_Minutes.pdf",
            source_location="Page 3",
            evidence="Customer sponsor expressed interest in extending the engagement to two more regions.",
        ),
    ]


def _commitment_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "commitment_name": "SLA - Incident Resolution Time",
                "frequency": "Monthly",
                "formula": "Incidents Resolved Within SLA / Total Incidents",
                "target": "95%",
                "penalty_applicable": "Y",
                "penalty_value": "5000",
            },
            confidence=0.78,
            source_document="Statement_of_Work.docx",
            source_location="Section 4",
            evidence="Vendor shall resolve 95% of logged incidents within the agreed SLA window, measured "
            "monthly; failure to meet this target attracts a penalty of $5,000 per occurrence.",
        ),
        AiRowSuggestionIn(
            values={
                "commitment_name": "System Uptime",
                "frequency": "Monthly",
                "formula": "Uptime Hours / Total Hours",
                "target": "99.5%",
                "penalty_applicable": "Y",
                "penalty_value": "10000",
            },
            confidence=0.7,
            source_document="Purchase_Order.pdf",
            source_location="Page 2",
            evidence="The platform shall maintain 99.5% uptime measured monthly; non-compliance is subject "
            "to a $10,000 service credit.",
        ),
        AiRowSuggestionIn(
            values={
                "commitment_name": "Monthly Status Reporting",
                "frequency": "Monthly",
                "target": "By 5th of following month",
                "penalty_applicable": "N",
            },
            confidence=0.5,
            source_document="Proposal.pdf",
            source_location="Page 6",
            evidence="A monthly status report will be submitted to the customer by the 5th of the "
            "following month.",
        ),
    ]


def _milestone_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "milestone_name": "Go-Live - Phase 1",
                "expected_date_of_payment": "2026-11-30",
                "expected_payment_value": "150000",
                "milestone_description": "Payment due on successful go-live of Phase 1 (Finance and "
                "Procurement modules).",
            },
            confidence=0.8,
            source_document="Purchase_Order.pdf",
            source_location="Page 3",
            evidence="30% of contract value ($150,000) is payable upon successful go-live of Phase 1, "
            "covering Finance and Procurement modules.",
        ),
        AiRowSuggestionIn(
            values={
                "milestone_name": "UAT Sign-off",
                "expected_date_of_payment": "2026-10-15",
                "expected_payment_value": "75000",
                "milestone_description": "Payment due on customer sign-off of User Acceptance Testing.",
            },
            confidence=0.65,
            source_document="Proposal.pdf",
            source_location="Page 4",
            evidence="15% of contract value ($75,000) is due upon customer sign-off of User Acceptance "
            "Testing, expected mid-October 2026.",
        ),
        AiRowSuggestionIn(
            values={
                "milestone_name": "Contract Signing Advance",
                "expected_date_of_payment": "2026-09-05",
                "expected_payment_value": "50000",
            },
            confidence=0.55,
            source_document="Purchase_Order.pdf",
            source_location="Page 1",
            evidence="An advance of $50,000 is payable within 5 business days of contract signing.",
        ),
    ]


def _de_assessment_alert_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "alert_category": "Compliance",
                "brief_description": "Vendor access review overdue",
                "raised_on": "2026-08-05",
                "detailed_description": "Security audit flagged an open vendor access review item, unresolved past due date.",
            },
            confidence=0.72,
            source_document="Risk_Register.xlsx",
            source_location="Sheet1!C12",
            evidence="Security audit flagged an open vendor access review item, unresolved past due date.",
        ),
    ]


def _de_assessment_finding_test_rows() -> list[AiRowSuggestionIn]:
    return [
        AiRowSuggestionIn(
            values={
                "classification": "Observation",
                "action_taken": "Escalated to delivery manager",
                "finding_date": "2026-08-05",
                "status": "Open",
                "remarks": "Procurement delay pending vendor response.",
            },
            confidence=0.6,
            source_document="Steering_Committee_Minutes.pdf",
            source_location="Page 2",
            evidence="Procurement delay was raised in steering committee and escalated to the delivery manager.",
        ),
    ]


_TEST_ROW_BUILDERS = {
    "risks": _risk_test_rows,
    "issues": _issue_test_rows,
    "dependencies": _dependency_test_rows,
    "assumptions": _assumption_test_rows,
    "opportunities": _opportunity_test_rows,
    "commitments": _commitment_test_rows,
    "milestones": _milestone_test_rows,
    "de_assessment_alerts": _de_assessment_alert_test_rows,
    "de_assessment_findings": _de_assessment_finding_test_rows,
}


@router.post(
    "/seed-test-data",
    response_model=list[AiRowSuggestionRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=_pm_write,
)
async def seed_test_suggestions(
    project_id: UUID, screen: str, period_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Testing-only helper: fabricates a canned batch of candidate rows for
    the given RAID entity, as if a real extraction pipeline had run. Values
    match that entity's Create schema so Apply (frontend) can post them
    straight through the same create endpoint manual entry uses."""
    await _get_project_or_404(project_id, db)

    builder = _TEST_ROW_BUILDERS.get(screen)
    if builder is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"No test data available for screen '{screen}'")

    return await crud.replace_pending(db, project_id, screen, period_id, builder())


@router.post("/{suggestion_id}/ignore", response_model=AiRowSuggestionRead, dependencies=_pm_write)
async def ignore_suggestion(project_id: UUID, suggestion_id: UUID, db: AsyncSession = Depends(get_db)):
    suggestion = await crud.get_one_by_id(db, suggestion_id)
    if suggestion is None or suggestion.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suggestion not found")
    return await crud.mark_status(db, suggestion, AiRowSuggestionStatus.IGNORED)


@router.post("/{suggestion_id}/apply", response_model=AiRowSuggestionRead, dependencies=_pm_write)
async def apply_suggestion(project_id: UUID, suggestion_id: UUID, db: AsyncSession = Depends(get_db)):
    """Called by the frontend right after it creates the real Risk/Issue/etc
    row from this suggestion's values via that entity's own create endpoint
    — this only marks the suggestion consumed, it doesn't create anything
    itself (the app never writes directly to business tables)."""
    suggestion = await crud.get_one_by_id(db, suggestion_id)
    if suggestion is None or suggestion.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suggestion not found")
    return await crud.mark_status(db, suggestion, AiRowSuggestionStatus.APPLIED)
