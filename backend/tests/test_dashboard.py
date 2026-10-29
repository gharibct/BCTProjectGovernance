from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.projects import Project
from app.models.project_status import ProjectStatusReport
from app.models.reference_data import Account, Geo, ReportingPeriod
from app.models.regional_status import GeoStatusReport
from app.schemas.dashboard import ProjectHealthRow
from app.schemas.enums import HealthRating, ReportStatus, RoleCode
from app.services import dashboard as dashboard_service
from app.services.dashboard import DashboardFilters
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_health_split_folds_leftover_potential_red_into_amber():
    rows = [
        SimpleNamespace(overall_rating=HealthRating.GREEN),
        SimpleNamespace(overall_rating=HealthRating.AMBER),
        SimpleNamespace(overall_rating=HealthRating.POTENTIAL_RED),
        SimpleNamespace(overall_rating=HealthRating.RED),
        SimpleNamespace(overall_rating=None),
    ]
    green, amber, red = dashboard_service.health_split(rows)
    assert (green, amber, red) == (1, 2, 1)


async def test_account_portfolio_health_counts_red_and_amber():
    account_id = uuid4()
    project_matrix = [
        SimpleNamespace(account_id=account_id, overall_rating=HealthRating.AMBER),
        SimpleNamespace(account_id=account_id, overall_rating=HealthRating.RED),
    ]
    account_matrix = [
        SimpleNamespace(entity_id=account_id, entity_label="Acme", overall_rating=HealthRating.RED),
    ]
    [row] = dashboard_service.account_portfolio_health(project_matrix, account_matrix)
    assert row.health_amber == 1
    assert row.health_red == 1


async def test_de_work_queue_row_carries_project_type_and_ownership():
    # The DE Assessment queue filters client-side on these attribute fields.
    from app.schemas.dashboard import DEAssessmentWorkQueueRow

    row = DEAssessmentWorkQueueRow(
        project_id=uuid4(),
        project_code="PRJ-9",
        project_name="Helios",
        project_manager_name="S. Connor",
        account_name="Globex",
        geo_name="APAC",
        region_name="India",
        project_type_name="Development",
        project_owned="Customer Driven",
        pm_health=None,
        de_health=None,
        pci_score=None,
        status="Due",
        href="/de-assessment/x",
    )
    dumped = row.model_dump()
    assert dumped["project_type_name"] == "Development"
    assert dumped["project_owned"] == "Customer Driven"


async def test_dashboard_summary_requires_auth(client):
    response = await client.get("/api/v1/dashboard/summary")
    assert response.status_code == 401


async def test_dashboard_summary_returns_200_for_any_role(client, override_auth):
    # Read-only aggregation over every other module — no write endpoints, so
    # no role-gate test needed. FakeDB has no seeded rows, so every count/list
    # in the summary comes back empty/zero.
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["active_projects"] == 0
    assert body["open_risks"] == 0
    assert body["project_health"] == []
    assert body["account_health"] == []
    assert body["open_ncs_count"] == 0
    assert body["open_ncs"] == []


async def test_high_risks_requires_auth(client):
    response = await client.get("/api/v1/dashboard/high-risks")
    assert response.status_code == 401


async def test_high_risks_is_cxo_and_geo_head_only(client, override_auth):
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.TEAM_MEMBER):
        response = await client.get("/api/v1/dashboard/high-risks", headers=override_auth(role))
        assert response.status_code == 403, role


async def test_delivery_and_project_health_grids_are_not_open_to_pm_or_team_member(client, override_auth):
    for path in ("delivery-health", "project-health-grid"):
        for role in (RoleCode.PROJECT_MANAGER, RoleCode.TEAM_MEMBER):
            response = await client.get(f"/api/v1/dashboard/{path}", headers=override_auth(role))
            assert response.status_code == 403, (path, role)
        assert (await client.get(f"/api/v1/dashboard/{path}")).status_code == 401


async def test_my_summary_requires_auth(client):
    response = await client.get("/api/v1/dashboard/my-summary")
    assert response.status_code == 401


async def test_my_summary_returns_zeroed_shape_for_pm(client, override_auth):
    # FakeDB seeds nothing, so every count is 0 — this locks in that the new
    # open_findings_count field is wired into the response.
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/dashboard/my-summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["open_findings_count"] == 0
    assert body["open_ncs_count"] == 0
    assert body["open_ncs"] == []
    assert body["my_projects_count"] == 0
    assert body["open_actions_count"] == 0


async def test_pmo_summary_requires_auth(client):
    response = await client.get("/api/v1/dashboard/pmo-summary")
    assert response.status_code == 401


async def test_pmo_summary_rejects_non_pmo_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/dashboard/pmo-summary", headers=headers)
    assert response.status_code == 403


async def test_pmo_summary_returns_200_for_pmo_role(client, override_auth):
    # No PMO login exists yet, but the endpoint itself is real (org-wide,
    # no owned-scope filter) — an empty DB should come back with every
    # count/list at zero rather than erroring.
    headers = override_auth(RoleCode.PMO)
    response = await client.get("/api/v1/dashboard/pmo-summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["active_projects_count"] == 0
    assert body["governance_compliance_pct"] == 0
    assert body["governance_exceptions"] == []
    assert body["governance_compliance"] == []
    assert body["reporting_compliance"] == {
        "on_time_count": 0,
        "late_count": 0,
        "missing_count": 0,
        "rework_count": 0,
    }


# --- tool_effective_date wiring (DB-backed) --------------------------------
# An isolated, throwaway sqlite DB per test — never the app's configured
# settings.database_url, which may point at a real shared Postgres server
# (same pattern as tests/test_master_data_import.py's session_factory).


@pytest.fixture
async def session_factory(tmp_path):
    db_path = tmp_path / "dashboard_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


def _now():
    return datetime.now(timezone.utc)


async def _make_project(session, **overrides):
    overrides.setdefault("project_status", "Draft")
    project = Project(
        id=uuid4(),
        project_code=f"P-{uuid4().hex[:8]}",
        project_name="Test Project",
        created_at=_now(),
        updated_at=_now(),
        **overrides,
    )
    session.add(project)
    await session.commit()
    return project


async def _make_period(session, start, end, period_type="Weekly"):
    period = ReportingPeriod(
        id=uuid4(),
        period_type=period_type,
        code=f"{period_type}-{uuid4().hex[:8]}",
        label=f"{period_type} {start}",
        start_date=start,
        end_date=end,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(period)
    await session.commit()
    return period


def _health_row(project: Project) -> ProjectHealthRow:
    return ProjectHealthRow(
        project_id=project.id,
        project_code=project.project_code,
        project_name=project.project_name,
        overall_project_health=None,
    )


async def test_reports_due_rows_excludes_periods_before_tool_effective_date(session_factory):
    async with session_factory() as session:
        project = await _make_project(
            session, actual_start_date=date(2026, 1, 1), tool_effective_date=date(2026, 8, 1)
        )
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))  # before effective date — not owed
        await _make_period(session, date(2026, 8, 3), date(2026, 8, 9))  # on/after — owed

        rows = await dashboard_service._reports_due_rows(session, DashboardFilters(), [_health_row(project)])

        assert [r["period"].start_date for r in rows] == [date(2026, 8, 3)]


async def test_reports_due_rows_falls_back_to_actual_start_when_unset(session_factory):
    async with session_factory() as session:
        project = await _make_project(session, actual_start_date=date(2026, 8, 1), tool_effective_date=None)
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))  # before actual start — not owed
        await _make_period(session, date(2026, 8, 3), date(2026, 8, 9))  # on/after — owed

        rows = await dashboard_service._reports_due_rows(session, DashboardFilters(), [_health_row(project)])

        assert [r["period"].start_date for r in rows] == [date(2026, 8, 3)]


async def test_project_report_status_returns_not_due_before_tool_effective_date(session_factory):
    async with session_factory() as session:
        project = await _make_project(session, tool_effective_date=date(2026, 8, 1))
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))  # nearest (soonest-ending) period

        statuses = await dashboard_service.project_report_status(session, DashboardFilters(), [_health_row(project)])

        assert statuses[project.id] == "Not Due"


async def test_project_report_status_not_submitted_when_no_effective_date_set(session_factory):
    async with session_factory() as session:
        project = await _make_project(session)
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))

        statuses = await dashboard_service.project_report_status(session, DashboardFilters(), [_health_row(project)])

        assert statuses[project.id] == "Not Submitted"


async def test_account_rag_card_summary_excludes_overdue_before_tool_effective_date(session_factory):
    async with session_factory() as session:
        account = Account(
            id=uuid4(), name="Acme", is_active=True, tool_effective_date=date(2026, 8, 1),
            created_at=_now(), updated_at=_now(),
        )
        session.add(account)
        await session.commit()
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))  # before effective date — not owed

        summary = await dashboard_service.account_rag_card_summary(session, DashboardFilters())

        assert summary.reporting_overdue_count == 0


async def test_account_rag_card_summary_counts_overdue_when_no_effective_date_set(session_factory):
    async with session_factory() as session:
        account = Account(
            id=uuid4(), name="Acme", is_active=True, tool_effective_date=None,
            created_at=_now(), updated_at=_now(),
        )
        session.add(account)
        await session.commit()
        await _make_period(session, date(2020, 1, 6), date(2020, 1, 12))  # long past, unsubmitted — overdue

        summary = await dashboard_service.account_rag_card_summary(session, DashboardFilters())

        assert summary.reporting_overdue_count == 1


async def test_geo_report_due_false_when_geo_predates_tool_effective_date(session_factory):
    async with session_factory() as session:
        geo = Geo(
            id=uuid4(), code="APAC", name="Asia Pacific", is_active=True, tool_effective_date=date(2026, 12, 1),
            created_at=_now(), updated_at=_now(),
        )
        session.add(geo)
        await session.commit()
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))  # before geo's effective date

        assert await dashboard_service.geo_report_due(session, [geo.id]) is False


async def test_geo_report_due_true_for_mixed_in_scope_and_not_yet_onboarded_geos(session_factory):
    async with session_factory() as session:
        onboarded = Geo(
            id=uuid4(), code="APAC", name="Asia Pacific", is_active=True, tool_effective_date=date(2020, 1, 1),
            created_at=_now(), updated_at=_now(),
        )
        not_yet = Geo(
            id=uuid4(), code="MEA", name="Middle East & Africa", is_active=True,
            tool_effective_date=date(2026, 12, 1), created_at=_now(), updated_at=_now(),
        )
        session.add_all([onboarded, not_yet])
        await session.commit()
        period = await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))
        # not_yet's period predates its effective date; onboarded has no report -> due.
        assert await dashboard_service.geo_report_due(session, [onboarded.id, not_yet.id]) is True

        session.add(
            GeoStatusReport(
                id=uuid4(), geo_id=onboarded.id, period_id=period.id, status=ReportStatus.SUBMITTED,
                created_at=_now(), updated_at=_now(),
            )
        )
        await session.commit()
        # Once the only in-scope geo has submitted, nothing is due (not_yet stays excluded).
        assert await dashboard_service.geo_report_due(session, [onboarded.id, not_yet.id]) is False


async def _make_status_report(session, project, period, status=ReportStatus.SUBMITTED):
    report = ProjectStatusReport(
        id=uuid4(),
        project_id=project.id,
        period_id=period.id,
        status=status,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(report)
    await session.commit()
    return report


async def test_report_submissions_summary_counts_owed_vs_submitted(session_factory):
    async with session_factory() as session:
        p1 = await _make_project(session, actual_start_date=date(2026, 1, 1))
        p2 = await _make_project(session, actual_start_date=date(2026, 1, 1))
        wk = await _make_period(session, date(2026, 8, 3), date(2026, 8, 9), "Weekly")
        mo = await _make_period(session, date(2026, 8, 1), date(2026, 8, 31), "Monthly")
        # p1 filed only its Weekly report; p2 filed nothing.
        await _make_status_report(session, p1, wk)

        summary = await dashboard_service.report_submissions_summary(
            session, DashboardFilters(), [_health_row(p1), _health_row(p2)]
        )

        dsp = summary.delivery_status_projects
        assert dsp.expected_count == 4  # 2 projects x (Weekly + Monthly)
        assert dsp.submitted_count == 1
        assert dsp.adherence_pct == 25
        # No measurement rows at all.
        assert summary.metrics_projects.submitted_count == 0
        assert summary.metrics_projects.expected_count == 4


async def test_geo_delivery_status_hidden_for_account_scoped_delivery_manager(session_factory):
    async with session_factory() as session:
        geo = Geo(
            id=uuid4(), code="APAC", name="Asia Pacific", is_active=True, tool_effective_date=date(2020, 1, 1),
            created_at=_now(), updated_at=_now(),
        )
        session.add(geo)
        await session.commit()
        await _make_period(session, date(2026, 8, 3), date(2026, 8, 9), "Weekly")

        # Org-wide and Geo Head scopes owe the geo's weekly report.
        for filters in (DashboardFilters(), DashboardFilters(geo_ids=[geo.id])):
            summary = await dashboard_service.report_submissions_summary(session, filters, [])
            assert summary.delivery_status_geos.expected_count == 1
            items, total = await dashboard_service.list_report_submissions_for_health(
                session, filters, [], skip=0, limit=100
            )
            assert {r.report_type for r in items} == {"Delivery Status - Geo"}

        # A Delivery Manager (account-scoped, no geo scope) owes and sees no geo report.
        scoped = DashboardFilters(account_ids=[uuid4()])
        summary = await dashboard_service.report_submissions_summary(session, scoped, [])
        assert summary.delivery_status_geos.expected_count == 0
        items, total = await dashboard_service.list_report_submissions_for_health(
            session, scoped, [], skip=0, limit=100, report_type="Delivery Status - Geo"
        )
        assert total == 0


async def test_report_submissions_detail_grid_marks_each_owed_pair(session_factory):
    async with session_factory() as session:
        project = await _make_project(session, actual_start_date=date(2026, 1, 1))
        wk = await _make_period(session, date(2026, 8, 3), date(2026, 8, 9), "Weekly")
        await _make_period(session, date(2026, 8, 1), date(2026, 8, 31), "Monthly")
        await _make_status_report(session, project, wk)  # weekly delivery-status filed

        items, total = await dashboard_service.list_report_submissions_for_health(
            session, DashboardFilters(), [_health_row(project)], skip=0, limit=100
        )

        # 2 owed periods x 2 project report types (Delivery Status + Metrics).
        assert total == 4
        by_type_status = sorted((r.report_type, r.status) for r in items)
        assert by_type_status == [
            ("Delivery Status - Project", "Not Submitted"),
            ("Delivery Status - Project", "Submitted"),
            ("Metrics - Project", "Not Submitted"),
            ("Metrics - Project", "Not Submitted"),
        ]
        submitted = next(r for r in items if r.status == "Submitted")
        assert submitted.period_label == wk.label
        assert submitted.submission_date is not None
        assert submitted.project_label.startswith(project.project_code)


async def test_report_submissions_detail_grid_filters_by_type_and_pending(session_factory):
    """The KPI-scoped sub screens pass report_type + pending; both narrow the
    result set before paging, so `total` reflects the filtered rows."""
    async with session_factory() as session:
        project = await _make_project(session, actual_start_date=date(2026, 1, 1))
        wk = await _make_period(session, date(2026, 8, 3), date(2026, 8, 9), "Weekly")
        await _make_period(session, date(2026, 8, 1), date(2026, 8, 31), "Monthly")
        await _make_status_report(session, project, wk)  # one weekly delivery-status filed

        rows = [_health_row(project)]

        # Delivery Status stream, pending only -> just the unfiled Monthly pair.
        items, total = await dashboard_service.list_report_submissions_for_health(
            session, DashboardFilters(), rows, skip=0, limit=100,
            report_type="Delivery Status - Project", pending=True,
        )
        assert total == 1
        assert {(r.report_type, r.status) for r in items} == {
            ("Delivery Status - Project", "Not Submitted")
        }

        # Delivery Status stream, filed only -> just the submitted Weekly pair.
        items, total = await dashboard_service.list_report_submissions_for_health(
            session, DashboardFilters(), rows, skip=0, limit=100,
            report_type="Delivery Status - Project", pending=False,
        )
        assert total == 1
        assert items[0].status == "Submitted"
        assert items[0].period_label == wk.label

        # Metrics stream -> only mp- rows, never a Delivery Status row.
        items, total = await dashboard_service.list_report_submissions_for_health(
            session, DashboardFilters(), rows, skip=0, limit=100,
            report_type="Metrics - Project",
        )
        assert total == 2
        assert {r.report_type for r in items} == {"Metrics - Project"}


async def test_report_submissions_summary_excludes_periods_before_onboarding(session_factory):
    async with session_factory() as session:
        project = await _make_project(
            session, actual_start_date=date(2026, 1, 1), tool_effective_date=date(2026, 8, 1)
        )
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12), "Weekly")  # pre-onboarding
        owed = await _make_period(session, date(2026, 8, 3), date(2026, 8, 9), "Weekly")
        await _make_status_report(session, project, owed)

        summary = await dashboard_service.report_submissions_summary(
            session, DashboardFilters(), [_health_row(project)]
        )

        assert summary.delivery_status_projects.expected_count == 1
        assert summary.delivery_status_projects.adherence_pct == 100


async def test_project_reporting_bucket_treats_not_yet_onboarded_as_on_time(session_factory):
    async with session_factory() as session:
        project = await _make_project(session, tool_effective_date=date(2026, 8, 1))
        await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))  # ended, before effective date

        buckets = await dashboard_service._project_reporting_bucket(session, [_health_row(project)])

        assert buckets[project.id][0] == "On Time"


async def test_project_reporting_bucket_missing_when_no_effective_date_set(session_factory):
    async with session_factory() as session:
        project = await _make_project(session)
        await _make_period(session, date(2020, 1, 6), date(2020, 1, 12))  # long past, unsubmitted

        buckets = await dashboard_service._project_reporting_bucket(session, [_health_row(project)])

        assert buckets[project.id][0] == "Missing"


async def test_reporting_readiness_excludes_not_yet_onboarded_project(session_factory):
    async with session_factory() as session:
        onboarded = await _make_project(session)
        not_yet = await _make_project(session, tool_effective_date=date(2026, 8, 1))
        period = await _make_period(session, date(2026, 7, 6), date(2026, 7, 12))
        session.add(
            ProjectStatusReport(
                id=uuid4(), project_id=onboarded.id, period_id=period.id, status=ReportStatus.APPROVED,
                created_at=_now(), updated_at=_now(),
            )
        )
        await session.commit()

        readiness = await dashboard_service.reporting_readiness(
            session, DashboardFilters(), [_health_row(onboarded), _health_row(not_yet)]
        )

        # not_yet is excluded entirely — total_count reflects only the in-scope project.
        assert readiness.total_count == 1
        assert readiness.approved_count == 1
        assert readiness.not_submitted_count == 0


# --- Project Health dashboard: scoping + bucket rules ----------------------------


async def test_portfolio_excludes_draft_and_splits_active_hold_completed(session_factory):
    async with session_factory() as session:
        await _make_project(session, project_status="Approved", lifecycle_status="Ongoing")
        await _make_project(session, project_status="Approved", lifecycle_status=None)
        await _make_project(session, project_status="Approved", lifecycle_status="Hold")
        await _make_project(session, project_status="Approved", lifecycle_status="Closed")
        await _make_project(session, project_status="Draft")
        await _make_project(session, project_status="Pending Approval")

        summary = await dashboard_service.project_portfolio_summary(session, DashboardFilters(approved_only=True))

        assert (summary.total_count, summary.active_count, summary.on_hold_count, summary.completed_count) == (4, 2, 1, 1)
        assert summary.active_count + summary.on_hold_count + summary.completed_count == summary.total_count


async def test_project_health_week_summary_buckets_sum_to_active(session_factory):
    from app.models.health_declarations import HealthDeclaration

    async with session_factory() as session:
        week = await _make_period(session, date(2026, 9, 14), date(2026, 9, 20))
        green = await _make_project(session, project_status="Approved")
        draft_report = await _make_project(session, project_status="Approved")
        no_report = await _make_project(session, project_status="Approved")
        await _make_status_report(session, green, week)
        await _make_status_report(session, draft_report, week, status=ReportStatus.DRAFT)
        session.add(
            HealthDeclaration(
                id=uuid4(), project_id=green.id, period_id=week.id, overall_rating="Green",
                core_delivery_rating="Green", people_rating="Green", operational_rating="Green",
                customer_rating="Green", financial_rating="Green", compliance_rating="Green",
                created_at=_now(),
            )
        )
        await session.commit()

        ids = [green.id, draft_report.id, no_report.id]
        buckets = await dashboard_service.project_health_week_summary(session, ids, week)

        assert buckets.green_count == 1
        assert buckets.not_submitted_count == 2  # Draft report and missing report both count as Not Submitted
        assert (
            buckets.green_count + buckets.amber_count + buckets.red_count
            + buckets.not_submitted_count
        ) == len(ids)


async def test_commitments_bucket_summary_any_not_met_makes_project_not_met(session_factory):
    from app.models.contractual import ContractualCommitment, ContractualCommitmentActual

    async with session_factory() as session:
        met = await _make_project(session, project_status="Approved")
        not_met = await _make_project(session, project_status="Approved")
        silent = await _make_project(session, project_status="Approved")
        for project, statuses in ((met, ["Met", "Met"]), (not_met, ["Met", "Not Met"])):
            for i, status in enumerate(statuses):
                commitment = ContractualCommitment(
                    id=uuid4(), project_id=project.id, commitment_name=f"c{i}", frequency="Monthly", penalty_applicable=False,
                    created_at=_now(), updated_at=_now(),
                )
                session.add(commitment)
                await session.flush()
                session.add(
                    ContractualCommitmentActual(
                        id=uuid4(), commitment_id=commitment.id, period_date=date(2026, 8, 15),
                        met_status=status, created_at=_now(),
                    )
                )
        await session.commit()

        month = dashboard_service.MonthRange(date(2026, 8, 1), date(2026, 8, 31))
        summary = await dashboard_service.commitments_bucket_summary(session, [met.id, not_met.id, silent.id], month)

        assert (summary.met_count, summary.not_met_count, summary.not_reported_count) == (1, 1, 1)


async def test_previous_month_window_and_recent_weekly_periods(session_factory):
    week = SimpleNamespace(start_date=date(2026, 1, 5))
    assert tuple(dashboard_service.previous_month_window(week)) == (date(2025, 12, 1), date(2025, 12, 31))

    async with session_factory() as session:
        for i in range(12):
            start = date(2026, 6, 1) + timedelta(days=7 * i)
            await _make_period(session, start, start + timedelta(days=6))
        await _make_period(session, date(2026, 6, 1), date(2026, 6, 30), period_type="Monthly")

        periods = await dashboard_service.recent_weekly_periods(session, today=date(2026, 8, 20))

        assert len(periods) == 10
        assert all(p.period_type == "Weekly" for p in periods)
        assert periods[0].end_date == max(p.end_date for p in periods)
        assert periods[0].end_date <= date(2026, 8, 20)  # only completed periods


# --- Project Health dashboard: customer reporting cards ---------------------------


async def test_customer_project_report_summary_splits_shared_not_shared_not_submitted(session_factory):
    async with session_factory() as session:
        week = await _make_period(session, date(2026, 8, 3), date(2026, 8, 9))
        shared = await _make_project(session, actual_start_date=date(2026, 1, 1))
        not_shared = await _make_project(session, actual_start_date=date(2026, 1, 1))
        unanswered = await _make_project(session, actual_start_date=date(2026, 1, 1))
        draft = await _make_project(session, actual_start_date=date(2026, 1, 1))
        missing = await _make_project(session, actual_start_date=date(2026, 1, 1))
        not_yet_started = await _make_project(session, actual_start_date=date(2026, 9, 1))
        for project, flag in ((shared, True), (not_shared, False), (unanswered, None)):
            report = await _make_status_report(session, project, week)
            report.customer_report_shared = flag
        draft_report = await _make_status_report(session, draft, week, status=ReportStatus.DRAFT)
        draft_report.customer_report_shared = True  # Draft never counts as shared
        await session.commit()

        ids = [p.id for p in (shared, not_shared, unanswered, draft, missing, not_yet_started)]
        summary = await dashboard_service.customer_project_report_summary(session, ids, week)

        assert summary.shared_count == 1
        assert summary.not_shared_count == 2  # explicit No + never answered
        assert summary.not_submitted_count == 2  # Draft + missing; the not-yet-started project owes nothing


async def test_account_qbr_summary_for_selected_quarter(session_factory):
    from app.models.customer_communications import AccountCustomerCommunication

    async def make_account(session, name, critical="Yes"):
        account = Account(
            id=uuid4(), name=name, is_active=True, tool_effective_date=date(2024, 1, 1), critical_flag=critical,
            created_at=_now(), updated_at=_now(),
        )
        session.add(account)
        await session.commit()
        return account

    async def qbr(session, account, status, planned, actual=None):
        session.add(
            AccountCustomerCommunication(
                id=uuid4(), account_id=account.id, planned_date=planned, actual_date=actual,
                status=status, title="QBR", file_name="q.pdf", file_path="x/q.pdf", created_at=_now(), updated_at=_now(),
            )
        )
        await session.commit()

    async with session_factory() as session:
        today = date(2026, 8, 6)  # Jul-Sep 2026
        conducted = await make_account(session, "Conducted")
        scheduled = await make_account(session, "Scheduled")
        initiated = await make_account(session, "Initiated")
        not_planned = await make_account(session, "NotPlanned")
        last_quarter = await make_account(session, "LastQuarter")
        optional = await make_account(session, "Optional", critical="No")  # owes no QBR: left out
        # Conducted in the quarter, and its follow-up Initiated in the next: Conducted wins.
        await qbr(session, conducted, "Conducted", date(2026, 6, 25), date(2026, 7, 2))
        await qbr(session, conducted, "Initiated", date(2026, 10, 5))
        await qbr(session, scheduled, "Scheduled", date(2026, 9, 30))  # last day of the quarter counts
        await qbr(session, initiated, "Initiated", date(2026, 8, 20))
        await qbr(session, not_planned, "Initiated", date(2026, 10, 1))  # next quarter
        await qbr(session, last_quarter, "Conducted", date(2026, 6, 1), date(2026, 6, 30))
        await qbr(session, optional, "Conducted", date(2026, 7, 1), date(2026, 7, 1))

        ids = [a.id for a in (conducted, scheduled, initiated, not_planned, last_quarter, optional)]
        summary = await dashboard_service.customer_account_report_summary(session, ids, today)
        assert (
            summary.conducted_count,
            summary.scheduled_count,
            summary.initiated_count,
            summary.not_planned_count,
        ) == (1, 1, 1, 2)
        assert summary.quarter_label == "Jul-Sep 2026"

        items, total = await dashboard_service.list_customer_account_reports_for_health(session, ids, 0, 10, today=today)
        assert total == 5
        assert [r.status for r in items] == ["Not Planned", "Not Planned", "Initiated", "Scheduled", "Conducted"]
        assert summary.previous_quarter_labels == ["Oct-Dec 2025", "Jan-Mar 2026", "Apr-Jun 2026"]
        assert summary.next_quarter_label == "Oct-Dec 2026"
        by_name = {r.account_name: r for r in items}
        row = by_name["Conducted"]
        assert (row.current_quarter_conducted, row.current_quarter_planned, row.next_quarter_open_count) == (1, 0, 1)
        assert (row.last_qbr_date, row.last_qbr_title) == (date(2026, 7, 2), "QBR")
        assert by_name["LastQuarter"].previous_quarters_conducted == [0, 0, 1]
        assert by_name["LastQuarter"].last_qbr_date == date(2026, 6, 30)
        assert by_name["NotPlanned"].next_quarter_open_count == 1
        items, total = await dashboard_service.list_customer_account_reports_for_health(
            session, ids, 0, 10, status="Scheduled", today=today
        )
        assert (total, items[0].current_quarter_planned, items[0].last_qbr_date) == (1, 1, None)


def test_qbr_quarter_label():
    assert dashboard_service.qbr_quarter(date(2026, 12, 31))[2] == "Oct-Dec 2026"
    assert dashboard_service.qbr_quarter(date(2026, 1, 4))[:2] == (
        date(2026, 1, 1),
        date(2026, 3, 31),
    )


async def test_calendar_quarter_bounds():
    bounds = dashboard_service._calendar_quarter_bounds
    assert bounds(date(2026, 9, 25)) == (date(2026, 4, 1), date(2026, 6, 30), date(2026, 7, 1))
    assert bounds(date(2026, 1, 1)) == (date(2025, 10, 1), date(2025, 12, 31), date(2026, 1, 1))
    assert bounds(date(2026, 3, 31)) == (date(2025, 10, 1), date(2025, 12, 31), date(2026, 1, 1))
    assert bounds(date(2026, 4, 1)) == (date(2026, 1, 1), date(2026, 3, 31), date(2026, 4, 1))


async def test_customer_report_list_functions_filter_by_status_and_page(session_factory):
    from app.models.customer_communications import AccountCustomerCommunication

    async with session_factory() as session:
        week = await _make_period(session, date(2026, 8, 3), date(2026, 8, 9))
        shared = await _make_project(session, actual_start_date=date(2026, 1, 1))
        missing = await _make_project(session, actual_start_date=date(2026, 1, 1))
        report = await _make_status_report(session, shared, week)
        report.customer_report_shared = True
        report.customer_report_date = date(2026, 8, 6)
        await session.commit()
        ids = [shared.id, missing.id]

        items, total = await dashboard_service.list_customer_project_reports_for_health(session, ids, week, 0, 10)
        assert total == 2
        assert items[0].status == "Not Submitted"  # pending first
        assert items[1].status == "Shared with Customer"
        assert items[1].customer_report_date == date(2026, 8, 6)

        items, total = await dashboard_service.list_customer_project_reports_for_health(
            session, ids, week, 0, 10, status="Shared with Customer"
        )
        assert (total, len(items)) == (1, 1)
        items, total = await dashboard_service.list_customer_project_reports_for_health(session, ids, week, 1, 1)
        assert (total, len(items)) == (2, 1)
