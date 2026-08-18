from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.db import get_db
from app.crud import ai_suggestions as crud
from app.crud.projects import project_crud
from app.crud.reference_data import account_crud, geo_crud, organization_crud, project_type_crud
from app.crud.users import user_crud
from app.schemas.ai_suggestions import AiFieldSuggestionIn, AiSuggestionBatchIn, AiSuggestionRead
from app.schemas.enums import RoleCode

# AI-Implementation.md: the app never writes AI values directly into business
# tables — these endpoints only store/serve the extraction JSON for review on
# the screen it targets. Ingest (POST "") is the contract whatever delivers
# that JSON (a local-LLM pipeline fed by Kafka, per the doc) posts to; this
# app does no extraction itself.
router = APIRouter(prefix="/projects/{project_id}/ai-suggestions", tags=["AI Suggestions"])

_pm_write = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN))]


async def _get_project_or_404(project_id: UUID, db: AsyncSession):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get("", response_model=list[AiSuggestionRead])
async def list_pending_suggestions(
    project_id: UUID, screen: str, period_id: UUID, db: AsyncSession = Depends(get_db)
):
    return await crud.list_pending(db, project_id, screen, period_id)


@router.post("", response_model=list[AiSuggestionRead], status_code=status.HTTP_201_CREATED, dependencies=_pm_write)
async def ingest_suggestions(
    project_id: UUID, payload: AiSuggestionBatchIn, db: AsyncSession = Depends(get_db)
):
    await _get_project_or_404(project_id, db)
    return await crud.upsert_batch(db, project_id, payload.screen, payload.period_id, payload.fields)


async def _project_profile_test_fields(db: AsyncSession) -> list[AiFieldSuggestionIn]:
    async def first(crud_obj):
        items, _ = await crud_obj.list(db, limit=1)
        return items[0] if items else None

    project_type, organization, geo, account, user = [
        await first(c) for c in (project_type_crud, organization_crud, geo_crud, account_crud, user_crud)
    ]

    fields = [
        AiFieldSuggestionIn(
            field_key="project_name",
            value="Digital Field Optimization",
            confidence=0.96,
            source_document="Project_Charter.pdf",
            source_location="Page 3",
            evidence="The project shall be called Digital Field Optimization.",
        ),
        AiFieldSuggestionIn(
            field_key="engagement_type",
            value="Implementation",
            confidence=0.97,
            source_document="Project_Charter.pdf",
            source_location="Page 3",
            evidence="This is an implementation engagement covering full lifecycle delivery.",
        ),
        AiFieldSuggestionIn(
            field_key="contract_type",
            value="T&M",
            confidence=0.55,
            source_document="Statement_of_Work.docx",
            source_location="Section 2",
            evidence="Engagement will be billed on a time and materials basis.",
        ),
        AiFieldSuggestionIn(
            field_key="project_owned",
            value="Co-Owned",
            confidence=0.4,
            source_document="Proposal.pdf",
            source_location="Page 1",
            evidence="Delivery will be jointly managed with the customer's PMO.",
        ),
        AiFieldSuggestionIn(
            field_key="project_revenue",
            value="250000",
            confidence=0.75,
            source_document="Commercial_Terms.xlsx",
            source_location="Sheet1!B4",
            evidence="Total Contract Value: 250,000",
        ),
        AiFieldSuggestionIn(
            field_key="project_currency",
            value="USD",
            confidence=0.9,
            source_document="Commercial_Terms.xlsx",
            source_location="Sheet1!B5",
            evidence="Currency: USD",
        ),
        AiFieldSuggestionIn(
            field_key="billing_type",
            value="T&M",
            confidence=0.5,
            source_document="Commercial_Terms.xlsx",
            source_location="Sheet1!B6",
            evidence="Billing Type: Time & Materials",
        ),
    ]

    if project_type is not None:
        fields.append(
            AiFieldSuggestionIn(
                field_key="project_type_id",
                value=str(project_type.id),
                confidence=0.82,
                source_document="Project_Charter.pdf",
                source_location="Page 2",
                evidence=f"Project Type: {project_type.name}",
            )
        )
    if organization is not None:
        fields.append(
            AiFieldSuggestionIn(
                field_key="organization_id",
                value=str(organization.id),
                confidence=0.7,
                source_document="Project_Charter.pdf",
                source_location="Page 1",
                evidence=f"Delivering Organization: {organization.name}",
            )
        )
    if geo is not None:
        fields.append(
            AiFieldSuggestionIn(
                field_key="geo_id",
                value=str(geo.id),
                confidence=0.88,
                source_document="Project_Charter.pdf",
                source_location="Page 1",
                evidence=f"Region: {geo.name}",
            )
        )
    if account is not None:
        fields.append(
            AiFieldSuggestionIn(
                field_key="account_id",
                value=str(account.id),
                confidence=0.6,
                source_document="Project_Charter.pdf",
                source_location="Page 1",
                evidence=f"Account: {account.name}",
            )
        )
    if user is not None:
        fields.append(
            AiFieldSuggestionIn(
                field_key="project_manager_id",
                value=str(user.id),
                confidence=0.93,
                source_document="Project_Charter.pdf",
                source_location="Page 2",
                evidence=f"Project Manager: {user.full_name}",
            )
        )

    return fields


def _scope_schedule_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="customer_overview",
            value="Global manufacturing client consolidating regional ERP instances into a single cloud platform.",
            confidence=0.72,
            source_document="Statement_of_Work.docx",
            source_location="Section 1",
            evidence="The customer operates manufacturing sites across three regions and is consolidating "
            "regional ERP instances into a single cloud platform.",
        ),
        AiFieldSuggestionIn(
            field_key="project_scope_description",
            value="Implement and roll out the core ERP modules (Finance, Procurement, Inventory) across all "
            "regional sites, including data migration and integration with existing logistics systems.",
            confidence=0.85,
            source_document="Statement_of_Work.docx",
            source_location="Section 2",
            evidence="Scope covers implementation of Finance, Procurement, and Inventory modules, data "
            "migration from legacy systems, and integration with existing logistics systems.",
        ),
        AiFieldSuggestionIn(
            field_key="planned_start_date",
            value="2026-09-01",
            confidence=0.6,
            source_document="Project_Charter.pdf",
            source_location="Page 4",
            evidence="Project is planned to kick off on September 1, 2026.",
        ),
        AiFieldSuggestionIn(
            field_key="planned_end_date",
            value="2027-03-31",
            confidence=0.58,
            source_document="Project_Charter.pdf",
            source_location="Page 4",
            evidence="Go-live is targeted for end of March 2027.",
        ),
    ]


def _self_assessment_test_fields() -> list[AiFieldSuggestionIn]:
    # field_keys match HealthDeclarationCreate's rating/description pairs;
    # rating values are the ApiHealthRating enum strings the frontend also
    # uses ("Green"/"Amber"/"Potential Red"/"Red").
    return [
        AiFieldSuggestionIn(
            field_key="core_delivery_rating",
            value="Amber",
            confidence=0.74,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 1",
            evidence="Two milestones slipped by two weeks due to a procurement delay on the client side.",
        ),
        AiFieldSuggestionIn(
            field_key="core_delivery_description",
            value="Two milestones slipped by two weeks due to procurement delays on the client side.",
            confidence=0.7,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 1",
            evidence="Two milestones slipped by two weeks due to a procurement delay on the client side.",
        ),
        AiFieldSuggestionIn(
            field_key="people_rating",
            value="Green",
            confidence=0.88,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 2",
            evidence="Team is fully staffed with no attrition this quarter.",
        ),
        AiFieldSuggestionIn(
            field_key="people_description",
            value="Team fully staffed with no attrition this quarter.",
            confidence=0.8,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 2",
            evidence="Team is fully staffed with no attrition this quarter.",
        ),
        AiFieldSuggestionIn(
            field_key="operational_rating",
            value="Green",
            confidence=0.65,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 2",
            evidence="PO, invoicing, and timesheet compliance are all current.",
        ),
        AiFieldSuggestionIn(
            field_key="operational_description",
            value="PO, invoicing, and timesheet compliance are all current.",
            confidence=0.6,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 2",
            evidence="PO, invoicing, and timesheet compliance are all current.",
        ),
        AiFieldSuggestionIn(
            field_key="customer_rating",
            value="Amber",
            confidence=0.55,
            source_document="Steering_Committee_Minutes.pdf",
            source_location="Page 1",
            evidence="Customer raised concerns about response time in the last steering committee.",
        ),
        AiFieldSuggestionIn(
            field_key="customer_description",
            value="Customer raised concerns about response time in the last steering committee.",
            confidence=0.55,
            source_document="Steering_Committee_Minutes.pdf",
            source_location="Page 1",
            evidence="Customer raised concerns about response time in the last steering committee.",
        ),
        AiFieldSuggestionIn(
            field_key="financial_rating",
            value="Green",
            confidence=0.7,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 3",
            evidence="Margin is tracking to forecast this period.",
        ),
        AiFieldSuggestionIn(
            field_key="financial_description",
            value="Margin tracking to forecast.",
            confidence=0.65,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 3",
            evidence="Margin is tracking to forecast this period.",
        ),
        AiFieldSuggestionIn(
            field_key="compliance_rating",
            value="Red",
            confidence=0.9,
            source_document="Risk_Register.xlsx",
            source_location="Sheet1!C12",
            evidence="Security audit flagged an open vendor access review item, unresolved past due date.",
        ),
        AiFieldSuggestionIn(
            field_key="compliance_description",
            value="Security audit flagged an open vendor access review item.",
            confidence=0.85,
            source_document="Risk_Register.xlsx",
            source_location="Sheet1!C12",
            evidence="Security audit flagged an open vendor access review item, unresolved past due date.",
        ),
    ]


def _measurement_development_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="overall_planned_size",
            value="450",
            confidence=0.7,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 3",
            evidence="Overall planned size is estimated at 450 function points.",
        ),
        AiFieldSuggestionIn(
            field_key="actual_pct_completion",
            value="62",
            confidence=0.65,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 3",
            evidence="Development is 62% complete as of this reporting period.",
        ),
        AiFieldSuggestionIn(
            field_key="uat_defects_external",
            value="4",
            confidence=0.6,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 3",
            evidence="4 external defects were logged during UAT this period.",
        ),
    ]


def _measurement_support_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="incidents_p1_count",
            value="2",
            confidence=0.7,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 4",
            evidence="2 P1 incidents were raised this period.",
        ),
        AiFieldSuggestionIn(
            field_key="tickets_reopened_count",
            value="1",
            confidence=0.55,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 4",
            evidence="1 ticket was reopened after initial resolution.",
        ),
    ]


def _measurement_staffing_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="requests_count",
            value="3",
            confidence=0.6,
            source_document="Resource_Plan.xlsx",
            source_location="Sheet1!B2",
            evidence="3 new staffing requests were raised this period.",
        ),
        AiFieldSuggestionIn(
            field_key="associates_joined_count",
            value="1",
            confidence=0.65,
            source_document="Resource_Plan.xlsx",
            source_location="Sheet1!B5",
            evidence="1 associate joined the project this period.",
        ),
    ]


def _measurement_testing_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="total_test_cases_designed",
            value="220",
            confidence=0.68,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 5",
            evidence="220 test cases have been designed to date.",
        ),
        AiFieldSuggestionIn(
            field_key="passed_test_cases",
            value="180",
            confidence=0.6,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 5",
            evidence="180 of the executed test cases passed.",
        ),
    ]


def _measurement_cloud_maintenance_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="total_uptime_hours",
            value="710",
            confidence=0.62,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 6",
            evidence="Total uptime recorded was 710 hours this period.",
        ),
        AiFieldSuggestionIn(
            field_key="application_downtime_hours",
            value="2",
            confidence=0.58,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 6",
            evidence="Application downtime of 2 hours was recorded during a planned maintenance window.",
        ),
    ]


def _measurement_cloud_migration_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="planned_application_migration_count",
            value="12",
            confidence=0.6,
            source_document="Schedule.xlsx",
            source_location="Sheet1!C3",
            evidence="12 applications are planned for migration in this wave.",
        ),
        AiFieldSuggestionIn(
            field_key="applications_migrated_count",
            value="9",
            confidence=0.62,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 7",
            evidence="9 applications have been migrated so far in this wave.",
        ),
    ]


def _de_assessment_profile_test_fields() -> list[AiFieldSuggestionIn]:
    return [
        AiFieldSuggestionIn(
            field_key="de_assessed_project_health",
            value="Amber",
            confidence=0.65,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 1",
            evidence="Overall project health is trending Amber due to the procurement delay.",
        ),
        AiFieldSuggestionIn(
            field_key="pci_score",
            value="7.5",
            confidence=0.55,
            source_document="Weekly_Status_Report.pdf",
            source_location="Page 1",
            evidence="Project Compliance Index is calculated at 7.5 this period.",
        ),
    ]


@router.post(
    "/seed-test-data", response_model=list[AiSuggestionRead], status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def seed_test_suggestions(
    project_id: UUID,
    period_id: UUID,
    screen: str = "project_profile",
    db: AsyncSession = Depends(get_db),
):
    """Testing-only helper: fabricates a canned batch of suggestions for the
    given screen, as if a real extraction pipeline (AI-Implementation.md
    §1-§3, not built yet) had run, so the AI review UI can be exercised
    without one. project_profile's FK-backed fields point at whatever
    reference-data row happens to be first, so Apply resolves to a real,
    selectable option."""
    await _get_project_or_404(project_id, db)

    if screen == "project_profile":
        fields = await _project_profile_test_fields(db)
    elif screen == "scope_schedule":
        fields = _scope_schedule_test_fields()
    elif screen == "self_assessment":
        fields = _self_assessment_test_fields()
    elif screen == "measurement_development":
        fields = _measurement_development_test_fields()
    elif screen == "measurement_support":
        fields = _measurement_support_test_fields()
    elif screen == "measurement_staffing":
        fields = _measurement_staffing_test_fields()
    elif screen == "measurement_testing":
        fields = _measurement_testing_test_fields()
    elif screen == "measurement_cloud_maintenance":
        fields = _measurement_cloud_maintenance_test_fields()
    elif screen == "measurement_cloud_migration":
        fields = _measurement_cloud_migration_test_fields()
    elif screen == "de_assessment_profile":
        fields = _de_assessment_profile_test_fields()
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"No test data available for screen '{screen}'")

    return await crud.upsert_batch(db, project_id, screen, period_id, fields)


@router.post("/{suggestion_id}/ignore", response_model=AiSuggestionRead, dependencies=_pm_write)
async def ignore_suggestion(project_id: UUID, suggestion_id: UUID, db: AsyncSession = Depends(get_db)):
    suggestion = await crud.get_one_by_id(db, suggestion_id)
    if suggestion is None or suggestion.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suggestion not found")
    return await crud.ignore(db, suggestion)


@router.post("/resolve", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def resolve_suggestions(
    project_id: UUID, screen: str, period_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Called by the screen these suggestions belong to right after its own
    Save/Edit/Create action succeeds (AI-Implementation.md §9)."""
    await crud.resolve_all(db, project_id, screen, period_id)
