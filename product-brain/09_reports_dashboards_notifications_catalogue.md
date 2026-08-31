# 09 — Reports, Dashboards & Notifications Catalogue

**Document type:** Product-Brain Reference
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/00, product-brain/01, product-brain/04, product-brain/05, product-brain/06, product-brain/07
**Feeds:** product-brain/17, product-brain/21, product-brain/26

> **Purpose of this document.** Two registers. **Part A — Reports & Dashboards:** the
> per-role "My Summary" dashboards and the portfolio-wide Project Health view, each with its
> tiles / columns, audience, data source, and drill-ins. **Part B — Notifications:** every
> `N-*` event, with its trigger, recipients, channel, template intent, and whether it is
> implemented or planned. IDs (`RPT-*`, `DASH-*`, `N-*`) are defined here and referenced by
> `product-brain/02`, `04`, `06`, and `26`.

---

# PART A — REPORTS & DASHBOARDS

## A1. Conventions

- **Dashboard ID:** `DASH-<ROLE|SCOPE>-<NN>`. Each `DASH-*` renders on the matching
  `SCR-DASH-*` screen from `product-brain/08`.
- **Report/grid ID:** `RPT-<AREA>-<NN>` for the 14 Project Health grids.
- **Standard behaviour (all dashboards):**
  - Output is **computed live** from current module data on each request — never a
    separately stored aggregate (BR-DASH-030).
  - Output is filtered to the caller's Account/Geo scope (BR-DASH-010); an empty scope
    yields an empty dashboard, not an error.
  - `ADMIN` sees all scopes; `CXO` is unscoped at enterprise level.
  - `GET /dashboard/summary` returns the shared KPI shape; role-specific sections come from
    dedicated endpoints (`/dashboard/*`) and hooks (`lib/api/{pm,account-head,geo-head,pmo,de}-dashboard.ts`).
- **`ASSUMPTION` — "data as of" indicator.** A per-tile "last refreshed / data as of"
  timestamp is proposed (BRS Open Item 6, `docs/ux-requirements.md` §7) because modules
  update on different cadences. **Not built** — `GAD` for `product-brain/23`.

## A2. Per-role "My Summary" Dashboards

| DASH ID | Screen | Audience | Data source | Status |
| --- | --- | --- | --- | --- |
| DASH-PM-10 | SCR-DASH-20 `/dashboard/project-manager` | `PROJECT_MANAGER` | `lib/api/pm-dashboard.ts` | **On mock data** — not wired to `/dashboard/summary` (`roles-actions.md`; verify). |
| DASH-AM-10 | SCR-DASH-30 `/dashboard/account-manager` | `ACCOUNT_MANAGER` | `/dashboard/summary` + account-head section (`require_role(ACCOUNT_MANAGER, GEO_HEAD, ADMIN)`) | Live. |
| DASH-GH-10 | SCR-DASH-40 `/dashboard/geo-head` | `GEO_HEAD` | `/dashboard/*` geo section (`require_role(GEO_HEAD, ADMIN)`) | Live. |
| DASH-CXO-10 | SCR-DASH-50 `/dashboard/cxo` | `CXO` | `/dashboard/summary` + PMO/CXO section (`require_role(PMO, ADMIN, CXO)`) | Live. |
| DASH-ADMIN-10 | SCR-DASH-60 `/dashboard/admin` | `ADMIN` | superset of all sections | Live. |
| DASH-DE-10 | SCR-DASH-70 `/dashboard/delivery-excellence` | `DELIVERY_EXCELLENCE` | `de-summary` (`require_role(DELIVERY_EXCELLENCE, ADMIN)`), `lib/api/de-dashboard.ts` | **Live** — stat cards, work queue, findings summary. |
| DASH-PMO-10 | SCR-DASH-80 `/dashboard/pmo` | `PMO` | PMO section (`require_role(PMO, ADMIN)`) | Live (read-only). |
| DASH-TM-10 | SCR-DASH-10 `/dashboard` | `TEAM_MEMBER` (generic) | `components/dashboard/dashboard.tsx` | Generic. |

### DASH shared KPI tiles (`GET /dashboard/summary` — BRS FR-DASH-1)

| Tile | Content | Drill-in |
| --- | --- | --- |
| Active Projects | count within scope | Project List (SCR-DASH-101) |
| Projects by Type | breakdown across the 7 engagement types | Project List filtered |
| Delayed Projects | count where Actual End > Planned End (or overdue reporting) | Project List filtered |
| Open Risks / Open Issues | counts from the RAID registers | Risks / Issues grids |
| Pending Approvals | `Submitted` reports awaiting this user's review + Opportunities awaiting approval + open DE alerts | Review screens |
| Contractual Commitment status | Met / Not Met / Not Recorded summary | Commitments grid |
| Milestones Linked to Payment | upcoming / overdue summary | Payment Milestones grid |
| Project Health | 360° per-project RAG (Red / Potential Red / Amber / Green) | Project Charter |
| Account Health | rolled up across an account's projects | Account rollup |

### DASH-DE-10 — Delivery Excellence "My Summary" (built)

| Element | Content |
| --- | --- |
| Stat cards | Awaiting Review, In Review, Returned, Approved (from the DE approval queue KPIs) |
| Work queue | projects allocated to this DE — code, name, account, PM, completeness %, gaps, `project_status`, `de_review_status`, link to `/de-approval/{id}` |
| Findings summary | open findings across allocated projects, by status |
| Assessments due | projects past `next_assessment_due_date` |

## A3. Project Health Portfolio — 14 grids (`RPT-*`)

Screen group `/project-health/*` (SCR-DASH-100..114); role gate `require_role(PMO, ADMIN, CXO)`
(BR-DASH-020); filters: Geo / Account / Project; paged. Columns per
`design-reference/project-health-screens.md`.

| RPT ID | Grid | Screen | KPIs | Grid columns |
| --- | --- | --- | --- | --- |
| RPT-PROJ-10 | Project List | SCR-DASH-101 | Total, Active, Completed, On Hold | Project, Project Type, Geo, Account, Project Manager, Start Date, End Date, Overall Health, Status |
| RPT-RAG-10 | RAG | SCR-DASH-102 | Green, Amber, Red, Reporting Overdue | Project, Geo, Account, Overall RAG, Schedule, Financial, Delivery, Period, Last Updated |
| RPT-RISK-10 | Risks | SCR-DASH-103 | Open Risks, High/Critical, Overdue, No Mitigation | Project, Risk, Category, Probability, Impact, Rating, Mitigation, Owner, Due Date, Status |
| RPT-ISS-10 | Issues | SCR-DASH-104 | Open Issues, Critical, Overdue, Aging > Threshold | Project, Issue, Category, Severity, Owner, Due Date, Age, Status |
| RPT-DEP-10 | Dependencies | SCR-DASH-105 | Open Dependencies, Critical, Overdue | Project, Dependency, Dependency On, Owner, Due Date, Status |
| RPT-ASM-10 | Assumptions | SCR-DASH-106 | Open Assumptions, Review Due, Overdue | Project, Assumption, Owner, Review Date, Status |
| RPT-OPP-10 | Opportunities | SCR-DASH-107 | Open Opportunities, High Priority, Under Review | Project, Opportunity, Category, Priority, Owner, Target Date, Status |
| RPT-MET-10 | Metrics | SCR-DASH-108 | Meeting Target %, Below Target, Not Reported, Critical Variance | Project, Metric, Target, Actual, Variance, Status, Period |
| RPT-COM-10 | Commitments | SCR-DASH-109 | Open Commitments, Due Soon, Overdue | Project, Commitment, Type, Owner, Due Date, Actual Date, Status |
| RPT-PAY-10 | Payment Milestones | SCR-DASH-110 | Due This Period, Overdue, Value Due/Overdue | Project, Milestone, Amount, Currency, Planned Date, Actual Date, Status |
| RPT-ASS-10 | Assessments | SCR-DASH-111 | Completed, Due, Red/Amber, Average PCI | Project, Project Manager Health, DE Health, PCI Score, Assessment Period, Assessed By, Status |
| RPT-FND-10 | Findings | SCR-DASH-112 | Open Findings, New This Period, Overdue, Awaiting Closure | Project, Finding, Classification, Action Taken, Owner, Due Date, Age, Status |
| RPT-ACT-10 | Actions | SCR-DASH-113 | Open, In Progress, Overdue, Due This Week | Level, Geo/Account/Project, Action, Assigned To, Due Date, Age, Status |
| RPT-DI-10 | Data Integrity | SCR-DASH-114 | Checks Passed %, Projects With Gaps, Critical Gaps | Project, Check, Category, Status, Issue, Last Checked |

Each grid row drills into the source screen (Project Charter, a RAID register, Measurement,
Contractual, DE Assessment, Action panel, or Data Integrity).

## A4. Governance / Account Matrix & Top Highlights

| Element | Where | Content |
| --- | --- | --- |
| **Project Governance Matrix** | DASH-AM-10 (rows = Projects) | one row per project in the account: RAG per dimension (Schedule / Financial / Delivery / Overall), reporting status, last updated. "Rename Entity to Projects; add Account column before Projects" (`PendingPoints`). |
| **Account Governance Matrix** | DASH-GH-10 / DASH-CXO-10 / DASH-ADMIN-10 (rows = Accounts) | one row per account: RAG from the latest Account RAG-status declaration; from step-5 data of the data-entry flow. |
| **Top 5 Highlights** | DASH-AM-10 / DASH-CXO-10 / DASH-GH-10 | the 5 most recent status items (any category) across the scope. |
| **Contractual Compliance widget** | DASH-CXO-10 / DASH-ADMIN-10 | Met / Not Met / **Not Recorded** summary — everything shows "Not Recorded" where no actuals-entry path exists (BR-CONTRACT-050). |
| **Milestone Payments widget** | DASH-CXO-10 / DASH-ADMIN-10 | Upcoming vs Overdue from each milestone's expected date; "Paid" requires an actual date (gap). |
| **Executive Updates view** | DASH-CXO-10 | read-only render of Geo Heads' Executive Updates. |

## A5. Account & Geo Dashboards (read-only, PPT-style)

| DASH ID | Screen | Audience | Content |
| --- | --- | --- | --- |
| DASH-ACCT-10 | SCR-DASH-120 `/account-reporting/[id]/dashboard` | `ACCOUNT_MANAGER` | Read-only account view mirroring the PPT deck — health, highlights, KPIs for the account. |
| DASH-GEO-10 | SCR-DASH-130 `/geo-reporting/[id]/dashboard` | `GEO_HEAD` | Read-only geo view; "Account Rollup" section (renamed from "Overview" per `PendingPoints`). |
| DASH-PROJ-10 | SCR-DASH-90 `/project-reporting/[id]/dashboard` | all (scoped) | Per-project dashboard. |

---

# PART B — NOTIFICATIONS

## B1. Conventions

- **Notification ID:** `N-<AREA>-<NAME>`.
- **Channels considered:** `In-App` (a badge / list on a dashboard), `Email`, `SMS`.
- **Delivery mechanism status.** ProjectGovernance has **no notification-delivery
  infrastructure today** — no email/SMS library in `backend/requirements.txt`, and the
  integrations module (Microsoft 365) is registry-only. Every event below is therefore
  **Planned** unless it is surfaced purely as an in-app derived list (marked *In-App
  (derived)* — these already work because they are computed on a dashboard, not "sent").
- Recipients are role-based and scope-bounded (`product-brain/07`).

## B2. Notification Register

| N ID | Event / Trigger | Recipients | Channel | Template intent | Status |
| --- | --- | --- | --- | --- | --- |
| N-DEAP-QUEUED | Project moved to `Pending Approval` (Send To Approval) | allocated `DELIVERY_EXCELLENCE` | In-App (derived) / Email | "Project {code} is ready for governance review." | In-App (derived) via DE queue; Email **Planned** |
| N-DEAP-DECISION | DE decision `Approve` / `Return` | project's `PROJECT_MANAGER` | In-App / Email | "Your project {code} was {approved / returned}: {remarks}." | **Planned** |
| N-STATUS-SUBMITTED | Weekly project status report submitted | owning `ACCOUNT_MANAGER` | In-App (derived) | "{project} submitted its week {period} status." | In-App (derived) via Review queue; Email **Planned** |
| N-STATUS-DEFAULTER | Weekly report **not** submitted by cadence cut-off | `PROJECT_MANAGER`, escalate to `ACCOUNT_MANAGER` | In-App (derived) / Email | "Week {period} status not submitted for {project}." | **Planned** — depends on `product-brain/14` cadence ratification |
| N-REVIEW-PENDING | A tier's report awaits the next tier's review | next-tier reviewer (`ACCOUNT_MANAGER` / `GEO_HEAD` / `CXO`) | In-App (derived) | "{n} reports awaiting your review." | In-App (derived) via "Pending Approvals" KPI |
| N-REVIEW-DECISION | Review `Approved` / `Rejected` | the report's author | In-App / Email | "Your {tier} status for {period} was {approved / rejected}: {comment}." | **Planned** |
| N-REVIEW-DEFAULTER | Monthly review datasets (Measurement / Contractual / RAIDO) not updated | `PROJECT_MANAGER`, escalate up | In-App (derived) / Email | "Monthly review incomplete for {project}: {missing modules}." | **Planned** |
| N-DEA-ALERT | DE Assessment saved/submitted with health ≠ `Green` and an Alert raised | `PROJECT_MANAGER`, `ACCOUNT_MANAGER` | In-App / Email | "DE assessed {project} as {rating}: {alert brief}." | **Planned** (Alert record exists; no send) |
| N-DEA-OVERDUE | Assessment past `next_assessment_due_date` | allocated `DELIVERY_EXCELLENCE` | In-App (derived) | "{n} assessments overdue." | In-App (derived) via DE dashboard |
| N-DEA-NUDGE | Health ≠ `Green` recorded with **zero** alerts logged | the DE / PM on screen | In-App (inline) | "This rating is not Green — log an Alert." | Implemented as an on-screen nudge (BR-DEA-020) |
| N-RAID-ESCALATED | A RAID(O) item's Escalation flag set | escalation target (PM / Delivery Manager / Steering Committee) | In-App / Email | "{register} {id} escalated to {level}." | **Planned** |
| N-RAID-REVIEW-DUE | RAID item past `Next Review Date` (Risk today) | `PROJECT_MANAGER` | In-App (derived) | "{n} risks due for monthly review." | In-App (derived) via "Review Due" KPI on the Assumptions/RAG grids |
| N-CONTRACT-BREACH | Commitment actual computes `Not Met` | `PMO`, `PROJECT_MANAGER` | In-App / Email | "Commitment {name} on {project} is Not Met (penalty {applicable?})." | **Planned** |
| N-MILESTONE-OVERDUE | Milestone Expected Payment Date passed with no Actual Date | `PMO`, `PROJECT_MANAGER` | In-App (derived) / Email | "Milestone {name} on {project} is overdue." | In-App (derived) via Payment Milestones widget |
| N-ACTION-ASSIGNED | Action created / reassigned | the assignee (`action_by_id`) | In-App / Email | "You were assigned action {code}: {title} (due {date})." | **Planned** |
| N-ACTION-DUE | Action past / near `due_date` and not `COMPLETED`/`CLOSED` | assignee, escalate to level owner | In-App (derived) / Email | "Action {code} is {overdue / due this week}." | In-App (derived) via Actions grid KPIs |
| N-DI-DEFAULTER | Data Integrity checklist has `Not Updated` rows for the period | `PMO`; per-tier defaulter lists | In-App (derived) | "{n} projects with data gaps this period." | In-App (derived) via Data Integrity grid |
| N-DEAL-ASSIGNED | DE assessor allocated to a project | the allocated `DELIVERY_EXCELLENCE` | In-App (derived) | "{n} new projects allocated to you." | In-App (derived) via DE allocation grid |
| N-USER-DEACTIVATED | A user is deactivated | the user (next login), `ADMIN` log | In-App | forced logout / `401` | Implemented (BR-USER-030) — behavioural, not a message |
| N-BACKUP-RESULT | Backup / Restore `Completed` / `Failed` | `ADMIN` | In-App (log) | "Backup {status} at {time}." | In-App (log) via `backup-restore-log`; alerting **Planned** |

## B3. Defaulter / submission tracking (cross-cutting)

BRS §7 and `PendingPoints` #25 call for tracking whether weekly and monthly reports are
submitted, with a "view defaulters at all levels" capability. Today this is realised only as
**derived KPIs** (Reporting Overdue on RPT-RAG-10; Pending Approvals; Data Integrity gaps).
A dedicated defaulter view and any push notification (`N-STATUS-DEFAULTER`,
`N-REVIEW-DEFAULTER`) are **Planned** and depend on the cadence model (`product-brain/14`).

---

## Assumptions

| ID | Assumption |
| --- | --- |
| A-RD-001 | `ASSUMPTION:` `RPT-*` / `DASH-*` / `N-*` IDs are defined here for the first time; `02`, `04`, `06`, `26` forward references must be reconciled to these. |
| A-RD-002 | `ASSUMPTION:` PM "My Summary" (DASH-PM-10) is on mock data; DASH-DE-10 is wired to a real API. Both need a code check. |
| A-RD-003 | `ASSUMPTION:` No notification-delivery mechanism (email/SMS/push) exists; "In-App (derived)" items work because they are dashboard computations, not sends. Every "Planned" row needs infrastructure. |
| A-RD-004 | `ASSUMPTION:` The exact tile set of `GET /dashboard/summary` is taken from BRS FR-DASH-1 and the dashboard screenshots; the running endpoint may differ. |
| A-RD-005 | `ASSUMPTION:` A "data as of" per-tile freshness indicator is proposed but not built (`GAD`). |
