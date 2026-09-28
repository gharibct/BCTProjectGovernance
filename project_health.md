# Project Health Dashboard — KPI Logic (as-built reference)

Page: `/project-health` (`frontend/src/components/dashboard/project-health-dashboard.tsx`)
API: `GET /dashboard/project-health` (`backend/app/api/v1/endpoints/dashboard.py::get_project_health_dashboard`, line ~490)
Logic: `backend/app/services/dashboard.py` (Project Health section starts ~line 2818)
Roles: every signed-in role can open the page; results are role-scoped (Geo Head → owned geos, Delivery Manager → owned accounts, Project Manager → own projects, Team Member → nothing) via `_health_scope` (`dashboard.py` endpoint, line 418).

This is a description of what the code does today, not a proposal. Every open question from the previous draft has been resolved against the implementation; where the summary card and its own drill-down screen disagree in scope, that is called out explicitly in §9 rather than papered over.

---

## 0. Global rules

### 0.1 Filter bar
The filter bar (`project-health-filter-bar.tsx`) offers **Geo / Region / Account / Period**. Region cascades off Geo; Account cascades off Geo+Region. There is **no Project Type filter in the UI** (the backend endpoints all accept an optional `project_type_id` query param, but no control sets it). An **Ownership** filter (Fully Owned / Co-Owned / Customer Driven) exists only on the `/project-health/projects` (Project List) drill-down, not on the main dashboard bar.

A Geo Head with a single owned geo has it locked in (no "All"); with several, "All" is available and default. A Delivery Manager gets no Geo/Region combo, only Account (their own). A Project Manager gets none of the three — they only see their own projects.

### 0.2 Period combo
Source: `GET /project-health/periods` → `recent_weekly_periods()` (`dashboard.py:4335`).
- **Weekly periods only**, `is_active = true`, and **completed** (`end_date <= today` — reporting happens on the end date, matching [[project_reporting_period_definition]]).
- Ordered newest-first, capped at **10** (`WEEKLY_PERIOD_LIMIT = 10`).
- Row 0 is flagged `is_current = true` and is the combo's default (`filters.periodId ?? periods[0]?.id`, `project-health-filter-bar.tsx:181`). There is no "[Current]" blank option — a period is always selected once periods load.
- If the client omits `period_id`, the backend independently resolves the same "current" period via `current_weekly_period()` (`dashboard.py:4353`).

**Which widgets use the selected week**, corrected against `get_project_health_dashboard` (`dashboard.py` endpoint, lines 501–535):

| Widget | Uses selected week? | How |
|---|---|---|
| Portfolio (shown on Project List drill-down, not a card) | No | Snapshot as of today |
| Project Health (RAG) | **Yes** | `project_health_week_summary(active_project_ids, week)` |
| Account Health (RAG) | **Yes** | `account_health_week_summary(active_account_ids, week)` |
| RAIDO (Risks/Issues/Dependencies/Assumptions/Opportunities) | No | Snapshot "as of today", Active Projects only |
| Metrics | Indirectly | `project_metrics_bucket_summary(active_project_ids, month_period)` — month_period is the previous month of the selected week |
| Commitments | Indirectly | `commitments_bucket_summary(active_project_ids, month)` — same previous-month window |
| Payment Milestones | No | Snapshot as of today, **not** Active-only (see 3.3) |
| Findings / DE Alerts | No | Snapshot, **not** Active-only (see 4.1) |
| DE Assessments | Indirectly | Latest Submitted assessment dated in the previous month of the selected week |
| Actions | No | Snapshot (see 4.3 for scope) |
| Report Submissions — Delivery Status (Projects/Account/Geo) | **Yes** | Selected week only |
| Report Submissions — Project Performance | Indirectly | Previous month of the selected week |
| Customer Project Status Reporting | **Yes** | Selected week, Active Projects only |
| Customer Account Reporting | No | Previous **calendar quarter**, independent of the Period combo (see 5.3) |

### 0.3 "Previous month of the selected week"
`previous_month_window()` (`dashboard.py:4358`):
```python
anchor = week.start_date if week is not None else date.today()
last_of_previous = anchor.replace(day=1) - timedelta(days=1)
return MonthRange(last_of_previous.replace(day=1), last_of_previous)
```
Confirmed: it anchors on the **week's start date**, not its end date. A week that straddles two calendar months (e.g. 28 Sep – 4 Oct) resolves to the month before the *start* month (September → August), even though most of the week falls in October. `monthly_period_for()` (`dashboard.py:4365`) then looks up the actual Monthly `ReportingPeriod` covering that window, if one exists.

### 0.4 Project scope
Two nested scopes, both built by `_project_conditions()` (`dashboard.py:187`) off `DashboardFilters` flags set in `_health_filters()` (endpoint, line 459):

- **0.4 base set** (`approved_only=True`, set on every Project Health request): `Project.project_status.in_(("Approved", "Under Amendment"))`. Draft and Pending Approval are excluded; **Under Amendment stays in scope** (it's a live, already-approved project undergoing amendment).
- **Active Projects** (`active_only=True`, added on top by the endpoint via `replace(filters, active_only=True)`): the base set further restricted to `lifecycle_status IS NULL OR lifecycle_status NOT IN (Closed, Hold)`. **Hold is excluded from Active**, same as Closed.
- **Active Accounts**: `active_account_ids()` (`dashboard.py:4444`) — accounts matching the Geo/Account filter with `Account.is_active = true`. This is the **Account** row's own `is_active` flag, independent of whether the account has any Active (or any) Project — an account with `is_active = true` and zero projects still counts.

Not every card actually uses "Active Projects" — several use the wider 0.4 base set instead. See the per-card tables below and §9 for the full list of which is which.

---

## 1. Project & Account

### 1.1 Project Portfolio
Not a card on the main `/project-health` dashboard. It is returned in the API payload (`portfolio` field) and rendered as the four stat tiles at the top of the **`/project-health/projects`** (Project List) drill-down (`project-health-project-list.tsx:88-95`).

`project_portfolio_summary()` (`dashboard.py:2830`), scope = 0.4 base set, snapshot (ignores Period):

| Number | Logic |
|---|---|
| **Total** | Count of the 0.4 base set. |
| **Active** | `lifecycle_status` not Closed and not Hold. |
| **Completed** | `lifecycle_status = Closed`. |
| **On Hold** | `lifecycle_status = Hold`. |

Active + On Hold + Completed = Total.

### 1.2 Project Health — for the selected week
Card: `data.health` → `RagCounts` on the main dashboard. Population = **Active Projects**. `_weekly_health_buckets()` (`dashboard.py:4379`), called via `project_health_week_summary()`:

| Bucket | Logic |
|---|---|
| **Green / Amber / Pot. Red / Red** | The project has a `ProjectStatusReport` for the selected week with `status` in (Submitted, Approved) **and** a `HealthDeclaration` row for that same `period_id`; bucketed by the declaration's `overall_rating`. |
| **Not Submitted** | Either condition above is missing — no filed weekly report, or a filed report with no matching declaration row. |

- **Both a filed status report and a period-keyed declaration row are required** to be rated — this resolves the old open question definitively: it isn't "report OR declaration", it's both, looked up by `period_id` (not "latest ever").
- Overdue is gone — `WeeklyHealthBuckets` (schema) has no such field.
- A Draft or Rejected weekly report → Not Submitted (`_SUBMITTED_REPORT_STATUSES = (Submitted, Approved)`).

### 1.3 Account Health — for the selected week
Card: `data.account_health`. Population = **Active Accounts** (0.4, `Account.is_active = true`). Same `_weekly_health_buckets()` helper, sourced from `AccountStatusReport` + `AccountHealthDeclaration` keyed by `account_id`/`period_id`. Same Green/Amber/Pot. Red/Red/Not Submitted rule as 1.2, same "both report and declaration" requirement, same Draft/Rejected → Not Submitted.

---

## 2. RAIDO (as of today)

Heading on the page: **"RAIDO, Alerts & Actions (as of today)"** — it's one combined section with the DE Alerts and Actions cards (§4.1b, §4.3), not a standalone RAIDO section.

**Scope split (see §9 for the full list):** the five **summary cards** below (Risks/Issues/Dependencies/Assumptions/Opportunities) are scoped to **Active Projects** (`active_filters`, endpoint line 517-521). Their own **drill-down list screens** (`/project-health/risks`, `/issues`, `/dependencies`, `/assumptions`, `/opportunities`) use the wider **0.4 base set** with no `active_only` — i.e. they also include Hold projects that the summary card excludes.

### 2.1 Risks — `risk_card_summary` (`dashboard.py:2859`)
| Number | Logic |
|---|---|
| **Open** | `current_status` in (Open, Monitoring) |
| **High/Crit** | Open AND `severity` in (High, Critical) |
| **Overdue** | Open AND `target_resolution_date` is set and `< today` |
| **No Mitigation** | Open AND `mitigation_plan` is null/empty |

### 2.2 Issues — `issue_card_summary` (`dashboard.py:2894`)
| Number | Logic |
|---|---|
| **Open** | `status` not in (Resolved, Closed) |
| **Critical** | Open AND `severity = Critical` |
| **Overdue** | Open AND `due_date` is set and `< today` |

The service also computes an `aging_over_threshold_count` (open, `raised_date` set and more than 14 days ago — `_ISSUE_AGING_THRESHOLD_DAYS`), returned in `IssueCardSummary` but **not rendered** on the dashboard card (only Open/Critical/Overdue show).

### 2.3 Dependencies — `dependency_card_summary` (`dashboard.py:3186`)
| Number | Logic |
|---|---|
| **Open** | `dependency_status != Completed` |
| **Overdue** | Open AND `required_by_date` is set and `< today` |
| **Critical** | Open AND `criticality = Critical` |

### 2.4 Assumptions — `assumption_card_summary` (`dashboard.py:3262`)
AssumptionLog has no due-date field, so this is a proxy off validation fields:

| Number | Logic |
|---|---|
| **Open** | `current_status = Open` |
| **Review Due** | Open AND `validation_status = Pending` |
| **Overdue** | Review Due AND `validation_date` is set and `< today` |

### 2.5 Opportunities — `opportunity_card_summary` (`dashboard.py:3328`)
| Number | Logic |
|---|---|
| **Open** | `status` in (Identified, Approved) |
| **High Priority** | Open AND `impact = High` |
| **Pending Approval** | `approval_required = true` AND `status = Identified` |

Records with no due/target/review date are never counted as Overdue anywhere in RAIDO.

---

## 3. Performance & Commercial

### 3.1 Metrics — `project_metrics_bucket_summary` (`dashboard.py:4479`)
Population = **Active Projects** (both the card and its `/project-health/metrics` drill-down use `active_only=True` — this one is consistent). Source = `_project_field_statuses()` (`dashboard.py:4041`) across every measurement discipline (Development, Support, Staffing, Testing, Cloud Maintenance, Cloud Migration) for the **previous month's Project Performance data**.

| Bucket | Logic |
|---|---|
| **Compliant** | Project reported at least one comparable metric field for the month and **every** field it reported met its target. |
| **Critical Variance** | Project reported and **any** field missed its target (any miss counts — there is no 20% grace band at the project-bucket level). |
| **Not Reported** | No comparable metric field at all for the month (no report, or a report with nothing measurable against a target). |

Compliant + Critical Variance + Not Reported = Active Projects.

Note: the shared per-field helper `_metric_field_status()` (`dashboard.py:4022`) still internally distinguishes "Below Target" from "Critical Variance" using a 20%-of-target threshold (`_CRITICAL_VARIANCE_THRESHOLD_PCT = 20`). That distinction is only used by the older `metrics_compliance_summary()` (used by a different page, `project_performance.py`) and by the metric-level drill-down rows (`list_metrics_for_health`, which still shows a field-level "Below Target" vs "Critical Variance" status). At the **Project Health dashboard's project-bucket level**, both are folded into "Critical Variance" — any miss, no threshold, per project.

- Direction rule per field: `higher_better` → miss if `actual < target`; `lower_better` → miss if `actual > target`.
- Worst-wins across all disciplines a project reports in (fixed from a prior last-discipline-wins bug — `_project_field_statuses` accumulates every discipline's field statuses before reducing).

### 3.2 Commitments — `commitments_bucket_summary` (`dashboard.py:4503`)
Population = **Active Projects**, from `ContractualCommitmentActual` rows dated within the previous month (`period_date` between `month.start` and `month.end`).

| Bucket | Logic |
|---|---|
| **Met** | Project has at least one commitment actual in the month, and **every** commitment's latest actual that month is `met_status = Met`. |
| **Not Met** | At least one commitment's latest actual that month is not Met. |
| **Not Reported** | No commitment actual recorded for the project in that month — this includes projects with no commitments defined at all. |

Met + Not Met + Not Reported = Active Projects.

**Scope inconsistency:** the `/project-health/commitments` drill-down (`list_commitments_for_health`) uses the 0.4 base set (no `active_only`) and shows each commitment's *overall* latest actual (not scoped to the previous month) rather than the bucketed month-scoped view the summary card uses — see §9.

### 3.3 Payment Milestones — `payment_milestones_card_summary` (`dashboard.py:3393`)
Scope = **0.4 base set, not Active-only** (uses plain `filters`, unlike Metrics/Commitments/DE Assessments). Snapshot as of today.

| Number | Logic |
|---|---|
| **Value Due** | Sum of `expected_payment_value` for milestones with no actual payment date. Still sums across currencies unconditionally — no per-currency grouping exists. |
| **Due** | Unpaid, `expected_date` null or `>= today`. |
| **Overdue** | Unpaid, `expected_date < today`. |

---

## 4. Delivery Excellence & Governance

### 4.1 Findings (all classifications) — computed but not displayed
`findings_card_summary()` (`dashboard.py:3742`) is still called by the endpoint (`data.findings` in the response) and covers **every** `DEAssessmentFinding` regardless of classification (Observation, Recommendation, Alert), scoped to the 0.4 base set (not Active-only), snapshot as of today:

| Number | Logic |
|---|---|
| **Open Findings** | `status = Open` |
| **Overdue** | Open AND `finding_date` set and more than 30 days ago (`_FINDING_OVERDUE_DAYS = 30`) |
| **Awaiting Closure** | `status` in (**On Hold, Deferred**) |

The frontend dashboard **does not render this card** — `data.findings` is unused in `project-health-dashboard.tsx`. Only the Alert-scoped variant below is shown.

Note on "Awaiting Closure": `FindingStatus` (`schemas/enums.py:329`) now has an explicit `AWAITING_CLOSURE = "Awaiting Closure"` value, but this bucket still checks the older `On Hold`/`Deferred` values, not `status = Awaiting Closure`. That is the current behavior, not a doc gap — worth a product/eng decision on whether it should switch, but as-built it's the legacy pair.

### 4.1b DE Alerts (the card actually shown)
`alerts_card_summary()` (`dashboard.py:3761`) — identical logic to 4.1, restricted to `classification = Alert` (the renamed "Open NC" — see [[project_nc_renamed_alert]]):

| Number | Logic |
|---|---|
| **Open Alerts** | Alert-classified findings with `status = Open` |
| **Overdue** | Open AND `finding_date` more than 30 days ago |
| **Awaiting Closure** | `status` in (On Hold, Deferred) |

Card title on the page: **"DE Alerts"**, links to `/project-health/findings` (same grid as 4.1, filterable by `classification`). Scope = 0.4 base set, not Active-only. Snapshot, not period-dependent.

### 4.2 DE Assessments — `de_assessments_card_summary` (`dashboard.py:3865`)
Population = **Active Projects**. Source = the project's **latest `Submitted`** `DEAssessment` with `assessment_date` inside the previous month of the selected week:

```python
DEAssessment.status == "Submitted",
DEAssessment.assessment_date >= month.start,
DEAssessment.assessment_date <= month.end,
```

| Bucket | Logic |
|---|---|
| **Green** | Latest qualifying assessment's `de_assessed_project_health = Green`. |
| **Need Attention** | = latest assessments count − Green count (i.e. Amber, Potential Red or Red). |
| **Not Assessed** | No qualifying (Submitted, in-window) assessment. |

The schema (`DEAssessmentsCardSummary`) also carries the individual `amber_count` / `potential_red_count` / `red_count` (used to color the RAG strip's Amber/Pot.Red/Red cells on the dashboard's DE card, alongside `green_count`/`not_assessed_count`), but "Need Attention" as a single number is not a separate schema field — the frontend still displays the four RAG colors plus "Not Assessed", not a single "Need Attention" tile.

**Draft assessments are ignored** — confirmed by the `status == "Submitted"` filter. **Avg PCI is dropped** from this card — no PCI field on `DEAssessmentsCardSummary` (a `pci_score` still exists per-row on the `/project-health/assessments` drill-down grid only).

**Scope inconsistency:** `/project-health/assessments` (`list_assessments_for_health`) uses the 0.4 base set (no `active_only`) and lists every assessment ever recorded, not scoped to Active Projects or to the previous month — see §9.

### 4.3 Actions — `actions_card_summary` (`dashboard.py:3636`)
Scope = 0.4 base set (not Active-only), snapshot, not period-dependent. "Due This Week" is gone (`ActionsCardSummary` has no such field).

| Number | Logic |
|---|---|
| **Open** | `status` not in (Completed, Closed, Cancelled) |
| **In Progress** | Open AND `status = In Progress` |
| **Overdue** | Open AND `due_date < today` |

Scope rule (unchanged from before): with **no** Geo/Region/Account/Project Type filter active, every Action at every level (Project/Account/Geo) counts. With **any** filter active, only **Project-level** Actions on the in-scope project set count — Geo/Account-level actions have no FK to intersect against a project filter, so they're dropped and the UI shows a note ("Geo/Account-level actions are excluded while a filter is active").

### 4.4 Data Integrity — card removed, drill-down kept
The Data Integrity **card is gone** from `ProjectHealthDashboardSummary` and from the dashboard grid (`project-health-dashboard.tsx` has no Data Integrity `<Card>`). But:
- The drill-down route `GET /project-health/data-integrity` (`dashboard.py` endpoint, line 887) and its service function `list_data_integrity_for_health` (`dashboard.py:4254`) still exist and work — its own docstring notes it backs "the (removed) card summary".
- The **nav entry survives**: `project-health-nav.tsx:75` still links "Data Integrity" → `/project-health/data-integrity`.

So the resolution is: card removed only; drill-down screen and nav entry both stay.

---

## 5. Report Submissions & Customer Reporting

Section headings on the page: **"Delivery Status"** and **"Project Performance & Customer Reporting"**.
Draft/Rejected reports never count as Submitted anywhere in this section (`_SUBMITTED_REPORT_STATUSES = (Submitted, Approved)`).

### 5.1 Delivery Status — Weekly (`report_submissions_week_summary`, `dashboard.py:4564`)
Population = Active Projects / Active Accounts / geos in filter (or all geos when unfiltered). For the **selected week only** — no longer "every started period since onboarding" for this particular card:

| Card | Population | Submitted when |
|---|---|---|
| **Delivery Status — Projects** | Active Projects | `ProjectStatusReport` for the selected week is Submitted/Approved |
| **Delivery Status — Account** | Active Accounts | `AccountStatusReport` for the selected week is Submitted/Approved |
| **Delivery Status — Geo** | Geos in filter (all geos if unfiltered); hidden entirely for Project Manager / Delivery Manager roles | `GeoStatusReport` for the selected week is Submitted/Approved |

An entity onboarded after the week's start date is not "owed" a report for that week (`_owed_pairs`, using `tool_effective_date` / `actual_start_date` / `planned_start_date` as the onboarding anchor) and doesn't count against Expected.

### 5.2 Project Performance (renamed from "Metrics — Projects")
Population = Active Projects. **Submitted** = `compute_monthly_completion(db, project_id, month_period)` returns items that are **all** `complete` (every section — Measurement, Commitments, Payment Milestones, and the 5 RAIDO logs — saved or attested "Reviewed – No Changes") for the previous month's Monthly `ReportingPeriod`. There is no separate Draft/Submitted status on the Performance report itself; "Submitted" is entirely derived from monthly-completion state. If no Monthly period exists for that month, the card shows 0/`len(active_project_ids)`.

### 5.3 Customer Project Status Reporting — `customer_project_report_summary` (`dashboard.py:4687`)
Population = Active Projects that owed the **selected week's** status report (same owed-set logic as 5.1).

| Bucket | Logic |
|---|---|
| **Shared** | Report filed (Submitted/Approved) and `customer_report_shared = true` |
| **Not Shared** | Report filed but `customer_report_shared` is false/unset |
| **Not Submitted** | No filed report for the week (Draft, Rejected, or missing) |

### 5.4 Customer Account Reporting — `customer_account_report_summary` (`dashboard.py:4841`)
Population = Active Accounts. **Not tied to the Period combo** — it looks at the **previous calendar quarter** of `AccountCustomerCommunication` rows internally (quarterly cadence, current quarter deliberately ignored since it isn't due yet).

| Bucket | Logic |
|---|---|
| **Shared** | At least one communication logged and shared last quarter |
| **Not Shared** | Account has no qualifying communication last quarter (and isn't New) |
| **New** | Account onboarded so recently there's no completed quarter to judge yet — shown for information, excluded from the Adherence % |

---

## 6. Bucket integrity rules (implementation asserts these by construction)
| Widget | Buckets | Must equal |
|---|---|---|
| Project Health | Green + Amber + Pot. Red + Red + Not Submitted | Active Projects |
| Account Health | Green + Amber + Pot. Red + Red + Not Submitted | Active Accounts |
| Metrics | Compliant + Critical Variance + Not Reported | Active Projects |
| Commitments | Met + Not Met + Not Reported | Active Projects |
| DE Assessments | Green + Amber + Pot. Red + Red + Not Assessed | Active Projects |
| Delivery Status (Projects/Account/Geo) | Submitted + Not Submitted | Expected (owed pairs for the week) |
| Project Performance | Submitted + Not Submitted | Active Projects |
| Customer Project Status Reporting | Shared + Not Shared + Not Submitted | Active Projects owed the week |
| Customer Account Reporting | Shared + Not Shared + New | Active Accounts |
| Portfolio | Active + On Hold + Completed | Total (0.4 base set) |

RAIDO, Payment Milestones, Findings/DE Alerts, and Actions are **not** bucket-complete sets summing to a population — they're independent open/overdue-style counts, some against Active Projects (RAIDO cards) and some against the wider 0.4 base set (Payment Milestones, Findings/Alerts, Actions) — see §9.

---

## 7. Drill-down screens
All under `/project-health/*`; each has a corresponding backend list endpoint in `dashboard.py`:
`projects` (Portfolio + Project List), `rag`, `account-rag`, `risks`, `issues`, `dependencies`, `assumptions`, `opportunities`, `metrics`, `commitments`, `payment-milestones`, `assessments`, `findings` (backs both Findings and DE Alerts), `actions`, `data-integrity`, `report-submissions`, `customer-project-reports`, `customer-account-reports`, plus `oracle-projects` / `oracle-projects/summary` (a separate section, not one of the KPI cards — projects present in Oracle with no governance-tool project yet).

Not every drill-down honours the same population/period as its summary card — see §9.

---

## 8. Card inventory (what actually renders on `/project-health` today)
In page order (`project-health-dashboard.tsx`):
1. **Project & Account** — Project Health, Account Health (hidden for PM), Project Health Assessed by DE.
2. **RAIDO, Alerts & Actions (as of today)** — Risks, Issues, Opportunities, DE Alerts, Actions.
3. **Performance & Commercial** — Metrics, Commitments, Payment Milestones.
4. **Delivery Status** — Delivery Status Projects, Delivery Status Account (hidden for PM), Delivery Status Geo (hidden for PM/Delivery Manager).
5. **Project Performance & Customer Reporting** — Project Performance, Customer Project Status Reporting, Customer Account Reporting (hidden for PM).
6. **Oracle Projects** — role-gated (`useCanSeeOracleProjects`), not shown to PM/Team Member.

Not on the page as cards: **Dependencies** and **Assumptions** (summarized in the backend payload but not rendered — same "computed but unused" situation as plain Findings), **Project Portfolio** (rendered on the Project List drill-down instead), **Data Integrity** (removed per §4.4).

---

## 9. Known scope inconsistencies between a summary card and its own drill-down
These are current, real behaviors — not proposals to fix — flagged because a reader will otherwise assume a card's "View X" link shows the same population the card counted.

1. **RAIDO** (Risks/Issues/Dependencies/Assumptions/Opportunities): summary cards = Active Projects only; drill-downs (`/project-health/risks` etc.) = full 0.4 base set (Hold projects included).
2. **Commitments**: summary card = Active Projects, bucketed by the previous month's actuals only; `/project-health/commitments` = full 0.4 base set, shows each commitment's overall latest actual (any month).
3. **DE Assessments**: summary card = Active Projects, latest Submitted assessment in the previous month only; `/project-health/assessments` = full 0.4 base set, every assessment ever recorded (no month/status filter).
4. **Report Submissions drill-down** (`/project-health/report-submissions`, backing `list_report_submissions_for_health`) enumerates every owed (entity, period) pair across **every active Weekly+Monthly period since onboarding** — not just the selected week / previous month the main cards use.
5. **Findings vs DE Alerts**: both are computed server-side against the same 0.4 base set; only DE Alerts (Alert classification) is rendered as a card, but the plain Findings numbers are still shipped in the API payload unused.

Everything else (Project/Account Health, Metrics, Payment Milestones, Actions, Findings/Alerts, Delivery Status, Project Performance, Customer Reporting) uses the same population and period logic in its card and its drill-down.
