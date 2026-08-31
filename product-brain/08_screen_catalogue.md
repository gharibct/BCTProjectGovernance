# 08 — Screen Catalogue

**Document type:** Product-Brain Reference
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/00, product-brain/01, product-brain/04, product-brain/05, product-brain/06, product-brain/07
**Feeds:** product-brain/17, product-brain/21, product-brain/26

> **Purpose of this document.** The inventory of user-facing screens with enough structure
> to drive UI build and test: what each screen is for, who uses it, its sections and
> actions, the validations and rules it applies, how it behaves per entity status, where it
> navigates, and which API each action calls. Every Next.js App Router `page.tsx` route has
> a `SCR-<MOD>-<NN>` ID. Priority screens are specified in full; five carry a field-level
> table. API IDs (`API-*`) are forward references to `product-brain/17` (`<!-- pending -->`).

---

## 1. Conventions

- **Screen ID:** `SCR-<MOD>-<NN>` — module short code from `product-brain/01` §1, number in tens.
- **Screen types:** `Hub` (card launcher for a reporting tree) · `Form` (create/edit) ·
  `List` (grid + filters) · `Detail` (read + contextual actions) · `Workbench` (multi-pane
  working screen) · `Dashboard` (KPI tiles + drill-in) · `Wizard` (stepped setup).
- **Field-spec columns** (§3): `Field · Type · Mandatory · Source · Editable · Default ·
  Validation · Business Rule`.
  - **Type:** `text`, `textarea`, `number`, `date`, `select` (enum), `lookup` (entity
    search), `multi-select`, `checkbox`, `radio`, `file`, `richtext`, `derived` (read-only
    computed), `grid`.
  - **Source:** `user`, `ref:<entity>` (reference data), `entity:<field>`, `derived`,
    `system`, `integration:oracle`.
  - **Editable:** `Yes`, `No`, or `status:<STATUS list>` (editable only in those statuses).
- **Nav rails.** The authenticated shell (`(app)/layout.tsx`: `AuthGuard` + `AppHeader` +
  `AppSidebar` + `AppFooter`) hosts nested layouts that add a right-hand rail per tree:
  `new-project-nav`, `project-nav` (Weekly/Monthly checklist), `account-nav`, `geo-nav`,
  `project-health-nav`, plus dashboard / de-* layouts.
- **Assets.** Screenshots and HTML prototypes referenced below live in
  `design-reference/` and should be copied to `product-brain/assets/` when this pack is
  finalised (list in §6). Do not move the originals until `product-brain/document-generation-plan.md`
  §5 runs.

---

## 2. Screen Index

### 2.1 Authentication

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-AUTH-10 | `/login` | Form | MOD-AUTH | unauthenticated | Sign in — renders the no-password identifier form or a "Sign in with OneLogin" button per `GET /auth/config`. |
| SCR-AUTH-20 | `/login/callback` | *(transient)* | MOD-AUTH | unauthenticated | OneLogin redirect landing; calls `GET /auth/me`, hydrates the session, routes to `ROLE_LANDING_ROUTE`. |
| SCR-AUTH-30 | `/` | *(redirect)* | MOD-AUTH | any | Redirects to `/login`. |

### 2.2 Dashboards ("My Summary") & Project Health portfolio

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-DASH-10 | `/dashboard` | Dashboard | MOD-DASH | `TEAM_MEMBER` (generic) | Generic landing dashboard. |
| SCR-DASH-20 | `/dashboard/project-manager` | Dashboard | MOD-DASH | `PROJECT_MANAGER` | PM "My Summary" (**still on mock data**). |
| SCR-DASH-30 | `/dashboard/account-manager` | Dashboard | MOD-DASH | `ACCOUNT_MANAGER` | Account Head "My Summary": Project Governance Matrix (rows = Projects), Top 5 Highlights, KPI row. |
| SCR-DASH-40 | `/dashboard/geo-head` | Dashboard | MOD-DASH | `GEO_HEAD` | Geo Head "My Summary": Account Governance Matrix, highlights, KPIs. |
| SCR-DASH-50 | `/dashboard/cxo` | Dashboard | MOD-DASH | `CXO` | Enterprise portfolio: KPI tiles, Governance Matrix, Contractual/Milestone summaries, Executive Updates view. |
| SCR-DASH-60 | `/dashboard/admin` | Dashboard | MOD-DASH | `ADMIN` | Admin dashboard (superset). |
| SCR-DASH-70 | `/dashboard/delivery-excellence` | Dashboard | MOD-DASH | `DELIVERY_EXCELLENCE` | DE "My Summary" — stat cards, work queue, findings summary (wired to `useDeDashboardSummary`). |
| SCR-DASH-80 | `/dashboard/pmo` | Dashboard | MOD-DASH | `PMO` | PMO "My Summary". |
| SCR-DASH-100 | `/project-health` | Hub | MOD-DASH | `PMO`/`CXO`/`ADMIN` | Project Health overview; rail to the 14 grids. |
| SCR-DASH-101 | `/project-health/project-list` | List | MOD-DASH | as above | Total / Active / Completed / On Hold; columns Project, Type, Geo, Account, PM, dates, Overall Health, Status. |
| SCR-DASH-102 | `/project-health/rag` | List | MOD-DASH | as above | Green/Amber/Red/Reporting Overdue; per-dimension RAG + Period + Last Updated. |
| SCR-DASH-103 | `/project-health/risks` | List | MOD-DASH | as above | Open Risks, High/Critical, Overdue, No Mitigation. |
| SCR-DASH-104 | `/project-health/issues` | List | MOD-DASH | as above | Open Issues, Critical, Overdue, Aging > Threshold. |
| SCR-DASH-105 | `/project-health/dependencies` | List | MOD-DASH | as above | Open Dependencies, Critical, Overdue. |
| SCR-DASH-106 | `/project-health/assumptions` | List | MOD-DASH | as above | Open Assumptions, Review Due, Overdue. |
| SCR-DASH-107 | `/project-health/opportunities` | List | MOD-DASH | as above | Open Opportunities, High Priority, Under Review. |
| SCR-DASH-108 | `/project-health/metrics` | List | MOD-DASH | as above | Meeting Target %, Below Target, Not Reported, Critical Variance. |
| SCR-DASH-109 | `/project-health/commitments` | List | MOD-DASH | as above | Open Commitments, Due Soon, Overdue. |
| SCR-DASH-110 | `/project-health/payment-milestones` | List | MOD-DASH | as above | Due This Period, Overdue, Value Due/Overdue. |
| SCR-DASH-111 | `/project-health/assessments` | List | MOD-DASH | as above | Completed, Due, Red/Amber, Average PCI; PM Health vs DE Health. |
| SCR-DASH-112 | `/project-health/findings` | List | MOD-DASH | as above | Open Findings, New This Period, Overdue, Awaiting Closure. |
| SCR-DASH-113 | `/project-health/actions` | List | MOD-DASH | as above | Open, In Progress, Overdue, Due This Week; Level + Geo/Account/Project. |
| SCR-DASH-114 | `/project-health/data-integrity` | List | MOD-DASH | as above | Checks Passed %, Projects With Gaps, Critical Gaps. |

### 2.3 Create / Maintain Project (`/new-project/[projectId]/*`) — rail: `new-project-nav`

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-PROJ-10 | `/new-project` | Hub | MOD-PROJ | `PROJECT_MANAGER`/`ADMIN` | Project list / create entry. |
| SCR-PROJ-20 | `/new-project/[id]/create` | Form | MOD-PROJ | `PROJECT_MANAGER` (+ act-as) | Mandatory Create Project step. |
| SCR-PROJ-30 | `/new-project/[id]/project-charter` | Form ★§3.1 | MOD-PROJ | `PROJECT_MANAGER` | Project Profile — the master attribute form; **Send To Approval**. |
| SCR-PROJ-40 | `/new-project/[id]/project-charter/schedule` | Form | MOD-PROJ | `PROJECT_MANAGER` | Scope & Schedule — planned/actual dates, durations. |
| SCR-PROJ-50 | `/new-project/[id]/project-charter/self-assessment` | Form ★§3.2 | MOD-HEALTH | `PROJECT_MANAGER` | Self Assessment (RAG) — 6-category health declaration. |
| SCR-PROJ-60 | `/new-project/[id]/map-oracle-projects` | Form | MOD-PROJ | `PROJECT_MANAGER` | Add / remove Oracle Project ID(s). |
| SCR-PROJ-70 | `/new-project/[id]/raido` | List/Form ★§3.3 | MOD-RAID | `PROJECT_MANAGER` | Project RAIDO Register (5 tabs). |
| SCR-PROJ-80 | `/new-project/[id]/measurement` | Form | MOD-MEAS | `PROJECT_MANAGER` | Baseline measurement entry (type-switcher). |
| SCR-PROJ-90 | `/new-project/[id]/contractual-compliance` | Form | MOD-CONTRACT | `PROJECT_MANAGER` | Commitments / Milestones definition tabs. |
| SCR-PROJ-100 | `/new-project/[id]/de-assessment` | Form ★§3.4 | MOD-DEA | `DELIVERY_EXCELLENCE`/`PROJECT_MANAGER` | DE Assessment (baseline). |
| SCR-AI-10 | `/new-project/[id]/ai-hub/document-processing` | Workbench | MOD-AI | `PROJECT_MANAGER` | Upload documents, run extraction, review suggestions. |

### 2.4 Project Reporting (`/project-reporting/[projectId]/*`) — rail: `project-nav` (Weekly/Monthly)

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-STATUS-10 | `/project-reporting/[id]` | Hub | MOD-STATUS | `PROJECT_MANAGER` | Reporting Hub cards. |
| SCR-DASH-90 | `/project-reporting/[id]/dashboard` | Dashboard | MOD-DASH | all (scoped) | Per-project dashboard. |
| SCR-PROJ-110 | `/project-reporting/[id]/project-charter` | Detail | MOD-PROJ | all (read); PM edit `status:Draft` | Charter (read / amend). |
| SCR-PROJ-120 | `/project-reporting/[id]/project-charter/schedule` | Detail | MOD-PROJ | as above | Scope & Schedule. |
| SCR-HEALTH-10 | `/project-reporting/[id]/project-charter/self-assessment` | Form ★§3.2 | MOD-HEALTH | `PROJECT_MANAGER` | RAG Status — periodic health declaration. |
| SCR-STATUS-20 | `/project-reporting/[id]/project-status` | Form | MOD-STATUS | `PROJECT_MANAGER` | Weekly status report — Key Metrics + 4 category grids; **Submit Report**. |
| SCR-PROJ-130 | `/project-reporting/[id]/resource-allocation` | Form | MOD-PROJ | `PROJECT_MANAGER` | Resource Allocation (Monthly). |
| SCR-MEAS-10 | `/project-reporting/[id]/measurement` | Form | MOD-MEAS | `PROJECT_MANAGER` | Measurement entry (Monthly), one tab per Project Type. |
| SCR-CONTRACT-10 | `/project-reporting/[id]/contractual-compliance` | Form | MOD-CONTRACT | `PROJECT_MANAGER`/`PMO` | Commitments/Milestones + actuals (Monthly). |
| SCR-RAID-10 | `/project-reporting/[id]/raido` | List/Form ★§3.3 | MOD-RAID | `PROJECT_MANAGER`/`TEAM_MEMBER` | Project RAIDO Register (Monthly review). |
| SCR-DEA-10 | `/project-reporting/[id]/de-assessment` | Workbench ★§3.4 | MOD-DEA | `DELIVERY_EXCELLENCE` | DE Assessment + Findings + Alert register tabs. |
| SCR-AI-20 | `/project-reporting/[id]/ai-hub/document-processing` | Workbench | MOD-AI | `PROJECT_MANAGER` | AI Hub (reporting context). |

### 2.5 Account Reporting (`/account-reporting/[accountId]/*`) — rail: `account-nav`

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-ACCT-10 | `/account-reporting/[id]` | Hub | MOD-ACCT | `ACCOUNT_MANAGER` | Account reporting hub. |
| SCR-ACCT-20 | `/account-reporting/[id]/status` | Form ★§3.5 | MOD-ACCT | `ACCOUNT_MANAGER` | Account Status Report — Key Metrics + category items + rollup source panel; **Submit**. |
| SCR-ACCT-30 | `/account-reporting/[id]/rag-status` | Form | MOD-ACCT | `ACCOUNT_MANAGER` | Account RAG/Health declaration + health rollup. |
| SCR-DASH-120 | `/account-reporting/[id]/dashboard` | Dashboard | MOD-DASH | `ACCOUNT_MANAGER` | Read-only Account Dashboard (PPT-style). |
| SCR-AI-30 | `/account-reporting/[id]/ai-hub/document-processing` | Workbench | MOD-AI | `ACCOUNT_MANAGER` | AI Hub (account context). |

### 2.6 Geo Reporting (`/geo-reporting/[geoId]/*`) — rail: `geo-nav`

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-GEO-10 | `/geo-reporting/[id]` | Hub | MOD-GEO | `GEO_HEAD` | Geo reporting hub. |
| SCR-GEO-20 | `/geo-reporting/[id]/status` | Form ★§3.5 | MOD-GEO | `GEO_HEAD` | Geo Status Reporting — Key Metrics + items + rollup; **Submit**. |
| SCR-EXEC-10 | `/geo-reporting/[id]/executive-update` | Workbench | MOD-EXEC | `GEO_HEAD` | Executive Update builder (sections + rich-text/image/table blocks). |
| SCR-DASH-130 | `/geo-reporting/[id]/dashboard` | Dashboard | MOD-DASH | `GEO_HEAD` | Read-only Geo Dashboard (Account Rollup). |
| SCR-AI-40 | `/geo-reporting/[id]/ai-hub/document-processing` | Workbench | MOD-AI | `GEO_HEAD` | AI Hub (geo context). |
| — | *Geo RAG-status* | — | MOD-GEO | — | **Not built** — `GET/POST /geos/{id}/health-declarations` exist, no page (known gap). |

### 2.7 Review screens

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-REVIEW-10 | `/project-review/[projectId]` | Detail | MOD-REVIEW | `ACCOUNT_MANAGER`/`GEO_HEAD`/`ADMIN` (not the PM) | Read-only project data (Overview quadrants, RAG Status) + Approve/Reject bar on a `Submitted` report. |
| SCR-REVIEW-20 | `/account-review/[accountId]` | Detail | MOD-REVIEW | `GEO_HEAD`/`ADMIN` (owned geo) | Read-only account rollup + Approve/Reject. |
| SCR-REVIEW-30 | `/geo-review/[geoId]` | Detail | MOD-REVIEW | `CXO`/`ADMIN` | Read-only geo rollup + Approve/Reject (unscoped). |

### 2.8 Delivery Excellence workflow

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-DEAL-10 | `/de-allocation` | List | MOD-DEAL | `DELIVERY_EXCELLENCE`/`ADMIN` | DE Project Allocation grid — assign assessors (bulk). |
| SCR-DEAP-10 | `/de-approval` | List | MOD-DEAP | `DELIVERY_EXCELLENCE`/`ADMIN` | DE Project Approval queue — KPIs + rows scoped to the DE's allocations. |
| SCR-DEAP-20 | `/de-approval/[projectId]` | Workbench | MOD-DEAP | allocated `DELIVERY_EXCELLENCE` | Governance review workspace — per-module verdicts, completeness %, Approve/Return. |
| SCR-DEA-20 | `/de-assessment` | List | MOD-DEA | `DELIVERY_EXCELLENCE`/`ADMIN` | DE Assessment work queue. |
| SCR-DEA-30 | `/de-assessment/[projectId]` | Workbench ★§3.4 | MOD-DEA | `DELIVERY_EXCELLENCE` | Per-project assessment (Assessed Health + PCI, findings). |

### 2.9 Administration

| SCR | Route | Type | Module | Roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| SCR-USER-10 | `/admin/users` | List/Form | MOD-USER | `ADMIN` | Users & Roles — create/edit/deactivate, assign Role + multi-select Accounts/Geos. |
| SCR-REF-10 | `/admin/accounts` | List/Form | MOD-REF | `ADMIN` | Accounts / reference data — Account Name + Geo, Add Account. |
| SCR-INTG-10 | *(sidebar `system-health`)* | — | MOD-INTG | `ADMIN` | **Dead link** (`href="#"`); Integrations/backup screen is planned. |

---

## 3. Field-Level Specifications

### 3.1 ★ SCR-PROJ-30 — Project Profile (Charter)

**Sections:** Project Description · Progress (Scope & Schedule) · Resource Allocation ·
Treatment / Health (read-only summary). **Actions:** Save (`PUT /projects/{id}` —
`API-PROJ-*` `<!-- pending -->`), **Send To Approval** (`PUT` with `project_status: "Pending Approval"`),
Edit Project (revert to `Draft`).

| Field | Type | Mandatory | Source | Editable | Default | Validation | Business Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project Name | text | Yes | user | status:Draft | — | non-empty | BR-PROJ-050 |
| Project ID / Code | derived | — | system | No | `PRJ-YYYY-NNNN` | — | BR-PROJ-010/020 |
| Contract Type | select | Yes | `ContractType` | status:Draft | — | ∈ {FPP, T&M, Capped T&M, Internal} | BR-PROJ-050 |
| Project Type | select | Yes | `ref:project_types` | status:Draft; **editable after Approved** | — | ∈ project types (incl. Consulting) | BR-PROJ-080 |
| Organization | select | Yes | `ContractType`/ref (BCTPL/BCTC/FT) | status:Draft | — | ∈ codes | BR-PROJ-050 |
| Project Owned | select | Yes | `ProjectOwned` | status:Draft | — | ∈ {Fully Owned, Co-Owned, Customer Driven} | BR-PROJ-050 |
| Geo | lookup | Yes | `ref:geos` | status:Draft | — | active geo | BR-PROJ-050 |
| Account | lookup | Yes | `ref:accounts` | status:Draft | — | active account in the geo | BR-PROJ-050 |
| Project Manager | lookup | Yes | `ref:users` | status:Draft | — | active user | BR-PROJ-050 |
| Delivery Manager | lookup | No | `ref:users` | status:Draft | — | — | — |
| Geo Head | lookup | No | `ref:users` | status:Draft | defaulted from Geo | — | `PendingPoints` #8 |
| Delivery Excellence owner | lookup | No | `ref:users` | status:Draft | — | — | (removed from Charter per `PendingPoints` #17 — set via DE Allocation) |
| Customer Overview | textarea | No | user | status:Draft | — | — | — |
| Project Scope Description | textarea | Yes | user | status:Draft | — | non-empty | BR-PROJ-050 |
| Revenue | number | Yes | user | status:Draft | — | ≥ 0 | BR-PROJ-050 |
| Currency | select | Yes | ref | status:Draft | — | ISO currency | BR-PROJ-050 |
| Critical Flag | radio (Yes/No) | Yes | `YesNo` | status:Draft | No | — | `PendingPoints` #7 |
| Product Flag | radio (Yes/No) | Yes | `YesNo` | status:Draft | No | if Yes → Product required | `PendingPoints` #7 |
| Product | lookup | if Product Flag = Yes | `ref:products` | status:Draft | — | active product | `PendingPoints` #7 |
| Oracle Project ID(s) | grid | Yes (≥ 1) | user / `integration:oracle` | Yes (own sub-form) | — | non-empty | BR-PROJ-090 |
| Applicable Phase | multi-select | No | `ApplicablePhase` | status:Draft | — | subset of the 8 phases | `PendingPoints` #30 |
| Planned/Actual Start & End Date | date | Planned: Yes | user | status:Draft (Actuals editable later) | — | start ≤ end | BR-PROJ (schedule) |
| Planned/Actual Duration | derived | — | derived | No | — | — | — |
| Resource list (Resource, FTE) | grid | No | `integration:oracle` (intended) / user | Yes | — | FTE ≥ 0 | BR-PROJ-100 |
| Head Count / Total FTE | derived | — | derived | No | — | — | BR-PROJ-100 |
| Delivery-Declared Overall Health | derived | — | `services/health_rollup` | No | — | — | BR-HEALTH-010 |
| DE-Assessed Project Health | derived | — | `entity:de_assessments.latest` | No | — | — | BR-DEA-040 |
| Overall Project Health | derived | — | `compute_overall_project_health` | No | — | — | BR-HEALTH-020 |
| Project Status | select | — | `ProjectStatus` | Amend screen only, post-Approved: {Approved/Ongoing, Hold, Closed, Open Only for Billing} | `Draft` | ∈ enum | BR-PROJ-060/070 |

**Status-dependent behaviour:** whole form editable only while `project_status = Draft`
(BR-PROJ-040); `Send To Approval` requires every mandatory field (BR-PROJ-050) and ≥ 1
Oracle ID (BR-PROJ-090); after `Approved` only Project Type is editable (BR-PROJ-080).
**Navigation:** rail → Schedule, Self-Assessment, RAIDO, Measurement, Contractual, DE
Assessment, AI Hub.

### 3.2 ★ SCR-PROJ-50 / SCR-HEALTH-10 — Self Assessment (RAG) / RAG Status

**Sections:** one per health category. **Actions:** Save each category (`POST/PUT
/projects/{id}/health-items` or `.../health-declarations`), Submit declaration.

| Field | Type | Mandatory | Source | Editable | Default | Validation | Business Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reporting Period | select | Yes | `ref:reporting_periods` | Yes | current period | ∈ periods | `product-brain/14` |
| Category | derived | — | `Category` (6 fixed) | No | — | — | — |
| Rating (per category) | select | Yes | `HealthRating` | Yes | — | ∈ {Red, Potential Red, Amber, Green} | BR-HEALTH-030 |
| Description (per category) | textarea | No | user | Yes | — | — | — |
| Delivery-Declared Overall | derived | — | `compute_overall_rating` | No | — | worst of the 6 | BR-HEALTH-010 |
| Declared By / Date | derived | — | system | No | current user / now | — | BR-HEALTH-040 |

**Status-dependent behaviour:** each declaration is a new dated row; prior declarations are
read-only history. **Navigation:** feeds the Charter's Treatment/Health summary and the
account rollup.

### 3.3 ★ SCR-PROJ-70 / SCR-RAID-10 — Risk Register (representative of the 5 RAIDO tabs)

**Actions:** Create / Edit / Delete (`POST/PUT/DELETE /projects/{id}/risks`), Mark Reviewed,
Import (Excel/clipboard), apply AI row suggestion.

| Field | Type | Mandatory | Source | Editable | Default | Validation | Business Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Risk ID | derived | — | system | No | `RSK-YYYY-NNNN` | — | BR-RAID-010 |
| Project Name / Type | derived | — | `entity:project` | No | from context | — | — |
| Risk Title | text | Yes | user | Yes | — | non-empty | BR-RAID-040 |
| Risk Description | textarea | Yes | user | Yes | — | non-empty | — |
| Risk Category | select | Yes | `Category` (6) | Yes | — | ∈ enum | BR-RAID-040 |
| Risk Type | select | Yes | `RiskType` | Yes | — | Internal \| External | BR-RAID-040 |
| Identified By / Date | text / date | Yes | user | Yes | current user / today | date ≤ today | — |
| Risk Owner | lookup | Yes | `ref:users` | Yes | — | active user | — |
| Probability | select | Yes | `Probability` | Yes | — | Very Low…Very High | BR-RAID-030 |
| Impact | select | Yes | `Impact` | Yes | — | Very Low…Critical | BR-RAID-030 |
| Risk Score | derived | — | Probability × Impact | No | — | — | BR-RAID-030 |
| Severity | select/derived | Yes | `RiskSeverity` | derived | — | Low…Critical | BR-RAID-030 |
| Response Strategy | select | No | `ResponseStrategy` | Yes | — | Avoid/Mitigate/Transfer/Accept | — |
| Mitigation / Contingency / Residual | textarea | No | user | Yes | — | — | — |
| Target Resolution Date | date | No | user | Yes | — | — | — |
| Current Status | select | Yes | `RiskStatus` | Yes | `Open` | Open/Monitoring/Closed | §6.11 |
| Escalation Required / Escalated To | checkbox / lookup | No | user | Yes | No | — | — |
| Last Review Date / Next Review Date | date | No | user | Yes | — | next ≥ last | BR-RAID-060 |
| Closure Date | date | if `Closed` | user | Yes | — | — | §6.11 |
| Remarks | textarea | No | user | Yes | — | — | — |

*(Issue, Dependency, Assumption, Opportunity registers share this list/detail shape with
their own field sets — see `docs/ux-requirements.md` §4.6–4.9 for the full lists; lifecycles
in `product-brain/06` §12–15.)*

### 3.4 ★ SCR-DEA-10 / SCR-DEA-30 — DE Assessment

**Tabs:** Assessment · Findings · Alerts. **Actions:** Create (`POST
/projects/{id}/de-assessments`), Save (`PATCH`), Add Finding, Raise Alert, Submit.

| Field | Type | Mandatory | Source | Editable | Default | Validation | Business Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Assessment Date | date | Yes | user | status:Draft | today | — | BR-DEA-050 |
| Next Assessment Due Date | date | No | user | status:Draft | +cadence | — | `product-brain/14` |
| DE-Assessed Project Health | select | Yes | `HealthRating` | status:Draft | — | ∈ {Red, Potential Red, Amber, Green} | BR-DEA-040 |
| PCI Score | number | Yes | user | status:Draft | — | numeric | BR-DEA-060 |
| Remarks | textarea | No | user | status:Draft | — | — | — |
| **Finding:** Sequence # | number | Yes | system | No | auto | — | — |
| Finding Classification | select | Yes | `FindingClassification` | Yes | — | Observation/Recommendation or Governance/Performance/Security/Financial | — |
| Finding Description | textarea | Yes | user | Yes | — | non-empty | — |
| Finding Severity | select | No | `RiskSeverity` | Yes | — | Low…Critical | — |
| Assigned To | lookup | No | `ref:users` | Yes | — | — | — |
| Action Taken / Finding Date / Due Date | textarea / date | No | user | Yes | — | — | — |
| Finding Status | select | Yes | `FindingStatus` | Yes | `Open` | Open/In Progress/Awaiting Closure/Closed/Cancelled | §6.16 |
| **Alert:** Alert ID | derived | — | system | No | `ALT-YYYY-NNNN` | — | BR-DEA-030 |
| Alert Category | select | Yes (if raised) | `Category` (6) | Yes | — | ∈ enum | BR-DEA-020 |
| Brief / Detailed Description | text / textarea | Yes / No | user | Yes | — | brief non-empty | — |
| Raised By / On | derived | — | system | No | current user / today | — | — |

**Status-dependent behaviour:** editable only while `Draft`; on Submit the rating pushes to
the Charter (BR-DEA-040); an Alert is required when the rating ≠ Green (BR-DEA-020,
Advisory). **Navigation:** from the DE work queue (SCR-DEA-20) or the reporting rail.

### 3.5 ★ SCR-ACCT-20 / SCR-GEO-20 — Account / Geo Status Report

**Sections:** Key Metrics · 4 category grids (Key Accomplishments, Upcoming, Leadership
Support, Key Risks/Issues) · Rollup Source panel. **Actions:** Save (`PUT
/accounts/{id}/status-reports/{rid}` or geo equiv.), add/edit/delete items, Pull/Ignore/Undo
from the rollup panel, **Submit Report**.

| Field | Type | Mandatory | Source | Editable | Default | Validation | Business Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reporting Period | select | Yes | `ref:reporting_periods` | Yes | current | ∈ periods | `product-brain/14` |
| Revenue / Onsite FTE / Offshore FTE / Projects Count | number | Yes | user (pre-filled from rollup sum) | status:Draft | rollup sum | ≥ 0 | BR-ROLLUP-050 |
| Category (per grid) | derived | — | `ProjectStatusCategory` | No | — | — | — |
| Item text | textarea | Yes per row | user | status:Draft | — | non-empty | — |
| Item rollup status | derived | — | `RollupStatus` | via Pull/Ignore/Undo | `Pending` | — | BR-ROLLUP-010/030 |
| Report Status | derived | — | `ReportStatus` | via Submit / Review | `Draft` | — | §6.5 / §6.6 |
| Reviewed By / At / Comment | derived | — | system | No (set on review) | — | — | BR-REVIEW-050 |

**Status-dependent behaviour:** editable only while `Draft`; **Submit** → `Submitted`; the
Review surface one tier up shows Approve/Reject only when `Submitted` (BR-STATUS-030,
BR-REVIEW-010). **Navigation:** rail → RAG Status (account only), Dashboard, AI Hub; feeds
the parent tier's rollup and the governance matrix.

---

## 4. Cross-cutting screen behaviour

- **Reporting-period selector.** Every periodic screen carries a period selector / badge
  (`reporting-period-badge`); "current period" resolution is defined in `product-brain/14`.
- **Register tables.** The 5 RAIDO tabs, Contractual, and Measurement grids use a shared
  `register-table` with filter/sort, an import toolbar (Excel via SheetJS + clipboard
  paste), and a `pagination-bar`.
- **Computed vs entered.** Derived fields (Project ID, Overall Health, Head Count/FTE, all
  Measurement "metrics" columns, Risk Score) render visually distinct and non-editable
  (BR-MEAS-010).
- **AI indicators.** On AI-populated controls a confidence box precedes the control; the
  info popup shows confidence, source, evidence, Apply/Ignore. The indicator is removed on
  edit/save/create (BR-AI-040).
- **Review action bar.** On `/project-review`, `/account-review`, `/geo-review` the
  Approve/Reject bar appears only when the underlying report is `Submitted`.
- **Empty / loading / error.** `empty-state` component; `sonner` toasts on mutation;
  `global-mutation-overlay` during writes.
- **Responsive.** Desktop-first, data-entry-heavy; mobile "should work".

---

## 5. Navigation map

```mermaid
flowchart LR
    L[/login/] --> D{ROLE_LANDING_ROUTE}
    D --> PM[/dashboard/project-manager/]
    D --> AM[/dashboard/account-manager/]
    D --> GH[/dashboard/geo-head/]
    D --> CX[/dashboard/cxo/]
    D --> DE[/dashboard/delivery-excellence/]
    PM --> NP[/new-project/[id]/*  create->charter->schedule->self-assessment->raido->measurement->contractual->de-assessment/]
    PM --> PR[/project-reporting/[id]/*  status->measurement->contractual->raido->de-assessment/]
    PR --> RV1[/project-review/[id]/]
    AM --> AR[/account-reporting/[id]/*  status->rag-status/]
    AR --> RV2[/account-review/[id]/]
    GH --> GR[/geo-reporting/[id]/*  status->executive-update/]
    GR --> RV3[/geo-review/[id]/]
    DE --> DAL[/de-allocation/]
    DE --> DAP[/de-approval->[id]/]
    DE --> DAS[/de-assessment->[id]/]
    CX --> PH[/project-health/* 14 grids/]
```

---

## 6. Assets to copy into `product-brain/assets/`

From `design-reference/` (referenced above; move on finalisation per generation-plan §5):
`login_page.jpg`, `project_charter1.jpg`–`3.jpg`, `dashboard.jpg`, `dashboard1.jpg`,
`dashboard2.jpg`, `pm-mysummary.jpg`, `acchead-mysummary.jpg`, `geohead-mysummary.jpg`,
`de-mysummary.jpg`, `pmo-mysummary.jpg`, `Metric-Measurment-design.jpg`,
`project_reporting.jpg`, `ProjectGov-Account-Dashboard.jpg`, `proj-hel-project-list.png`,
`proj-hel-rag.png`, `proj-hel-raido.png`, `proj-issue-rep.png`, `EditableTextList.jpg`,
`card.jpg`, `framework.jpg`; HTML prototypes `RAG Status.html`, `Review-Overview.html`,
`Action-Tracker.html`, `Project-Health.html`, `geo-dashbaord.html`; folders
`de-approval/` (3 screens) and `de-assessments/` (4 screens).

---

## 7. Assumptions

| ID | Assumption |
| --- | --- |
| A-SCR-001 | `ASSUMPTION:` `SCR-*` IDs are assigned here for the first time; `product-brain/17` and `26` must use these. Numbering leaves gaps for insertion. |
| A-SCR-002 | `ASSUMPTION:` Field-level tables merge code-visible fields with `docs/ux-requirements.md` §4 and `docs/PendingPoints.txt` changes (remove Billing Type / Engagement Type; add Critical/Product flags, Applicable Phase, Region); some changes may not yet be in the running UI. |
| A-SCR-003 | `ASSUMPTION:` The Geo RAG-status screen and the Integrations/`system-health` screen do not exist; their routes are listed as gaps. |
| A-SCR-004 | `ASSUMPTION:` "Maintain Project" vs "Create Project" vs "View / Amend Project" are menu framings over the same `/new-project/[id]/*` and `/project-reporting/[id]/*` trees (`PendingPoints` #19). |
| A-SCR-005 | `ASSUMPTION:` `API-*` mappings are deferred to `product-brain/17`; action→endpoint notes here use route paths. |
