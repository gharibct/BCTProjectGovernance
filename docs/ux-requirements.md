# Project Governance Tool — UX Requirements

Status: **DRAFT — pending manual review**
Approved by: _______________  Date: _______________

Source: `Project Governance Tool Requirement_240726.xlsx` (18 sheets), parsed in full.

> This document describes **what** each screen needs to show, capture, and let people do —
> not how it should look. Layout, spacing, color palette, and component choices are left to
> Google Stitch. The one exception is the Red / Amber / Green (health) status convention,
> which is explicit in the source requirements and should carry through as a semantic color
> convention wherever a health/status field appears.
>
> **Update cadence:** the source Excel is a data-field list; it does not state how often
> each screen's data is refreshed. Cadences below (weekly Project Status, monthly RAID
> review, etc.) are stated where the user confirmed them, and are **proposed/assumed**
> everywhere else — marked ⚠ and listed again in §7 for you to confirm or correct.
> Anywhere the cadence implies a screen needs to hold *multiple records over time* rather
> than one current record, that's called out as a control gap against the original v1 of
> this document, also marked ⚠.

---

## 1. App overview

An internal PMO / delivery-governance web application for tracking project health across
the company's project portfolio. Project Managers maintain project data (charter, status,
risks, issues, dependencies, assumptions, opportunities, delivery metrics); Delivery
Excellence and PMO roles audit and govern that data; executives get a rolled-up,
read-mostly view of project and account health. Health is expressed throughout as a
**Red / Potential Red / Amber / Green** rating, rolled up from category-level ratings to
an overall project rating, and further rolled up to account/portfolio views on the
Dashboard.

## 2. Roles

| Role | What they need to see / do |
|---|---|
| **Admin** | Manage users, roles, LDAP connection, MFA, integrations, and reference data (project types, org codes). No project-content editing. |
| **CEO / CDO / GEO Head / Delivery Manager** | Read-mostly, cross-project/cross-account: Dashboard, project & account health, contractual commitments. (Source lists these as one combined access group — confirm during review whether they need distinct permissions, e.g. Delivery Manager approving escalations vs. CEO purely viewing.) |
| **Project Manager** | Full read/write on their own project(s): Charter, Status, all 5 RAID logs, Measurement entry. Submits project for DE Assessment. |
| **Project Team Member** | Update RAID items assigned to them; view their project's Status and Charter (read-only). |
| **Delivery Excellence (DE)** | Fills out the DE Assessment Form (PCI score, findings, alerts) for any project; cross-project read access for audit purposes. |
| **PMO** | Owns Contractual Compliance and Milestone Payment tracking; runs the Data Integrity checklist across all projects; cross-project read access. |

## 3. Screen inventory

| # | Screen | Primary role(s) | Purpose | Update cadence |
|---|---|---|---|---|
| 1 | Login | All | Authenticate via LDAP | N/A |
| 2 | Dashboard | All (content varies by role) | Portfolio/account/project health KPIs | Real-time / on-demand, reflects latest data from every module |
| 3 | Project Charter | PM (edit), all (view) | Project master data + health rollup | **Setup fields:** once at project start, edited only on change events. **Health Declaration:** ⚠ proposed weekly, aligned with Project Status |
| 4 | Project Status | PM (edit), all (view) | Narrative status reporting | **Weekly** — one new dated report per project each week; history retained |
| 5 | Risk Log | PM/Team (edit), all (view) | Risk register | Created/edited ad hoc as risks arise; register **reviewed monthly** |
| 6 | Issue Log | PM/Team (edit), all (view) | Issue register | Created/edited ad hoc as issues arise; register **reviewed monthly** |
| 7 | Dependency Log | PM/Team (edit), all (view) | Dependency register | Created/edited ad hoc; register **reviewed monthly** |
| 8 | Assumption Log | PM/Team (edit), all (view) | Assumption register | Created/edited ad hoc; register **reviewed monthly** |
| 9 | Opportunity Log | PM/Team (edit), all (view) | Opportunity register | Created/edited ad hoc; register **reviewed monthly** |
| 10 | Measurement Entry | PM (edit), all (view) | Delivery metrics, tabbed by project type | ⚠ Proposed **monthly** snapshot per reporting period (varies by tab — see §4.10) |
| 11 | Contractual Compliance | PMO (edit), all (view) | SLA commitments + milestone payments | Per-commitment **Frequency** field (One Time/Weekly/Fortnight/Monthly/Quarterly/Half Yearly/Phase Wise); milestones are event-based, tied to milestone dates |
| 12 | DE Assessment Form | DE (edit), all (view) | Delivery Excellence audit + PCI score | ⚠ Proposed **monthly** per project; one dated assessment record each cycle, history retained |
| 13 | Data Integrity Checklist | PMO (edit), all (view) | Flags stale/un-updated data across modules | ⚠ Proposed **weekly**, run at the same cadence as Project Status/Measurement reporting |
| 14 | Admin — Users & Roles | Admin | User/role/LDAP/MFA management | Ad hoc, as needed |
| 15 | Admin — Integrations & Reference Data | Admin | M365/Oracle/ticketing config; project-type reference data | Ad hoc, as needed |

---

## 4. Per-screen requirements

### 4.1 Login

- **Purpose:** authenticate a user against the company LDAP directory.
- **Roles:** all (unauthenticated).
- **Update cadence:** N/A.
- **Fields/elements:** Username, Password, Sign-in action, error state for invalid
  credentials, "contact admin" note for account issues.
- **Actions:** Sign in. (No self-service password reset — password is managed by LDAP.)
- **States:** default, submitting, invalid-credentials error, account-locked/disabled error.
- **Notes:** Auth backend is LDAP, not a local username/password store. MFA may apply post-login (see Security notes, §5).
- **Links to:** Dashboard (on success, role-appropriate landing view).

### 4.2 Dashboard

- **Purpose:** at-a-glance portfolio health and pending-attention items; the landing
  screen after login.
- **Roles:** all — content scope varies (PM sees their own projects; Executive/PMO/DE see
  cross-project/account rollups).
- **Update cadence:** real-time/on-demand — it's a live aggregation of every other
  screen's latest data, not a separately maintained record. ⚠ Proposed addition: a
  "last refreshed" or "data as of" timestamp per tile, since underlying modules update on
  different cadences (weekly status vs. monthly RAID review vs. ad hoc RAID items) and
  users should be able to tell how fresh each number is.
- **Fields/elements (KPI tiles/panels):**
  - Active Projects (count)
  - Projects by Type (breakdown across Development/Support/Professional Staffing/Testing/
    Cloud Maintenance/Cloud Migration)
  - Delayed Projects (count)
  - Open Risks (count)
  - Open Issues (count)
  - Pending Approvals (count — e.g. opportunities awaiting approval, DE alerts open)
  - Project Health — a 360° view per project for delivery review (Red/Potential Red/
    Amber/Green, drill-in to Project Charter)
  - Account Health — rolled up across all projects for an account
  - Contractual Commitment status (met / not met summary)
  - Milestones Linked to Payment (upcoming/overdue summary)
- **Actions:** filter by GEO/Account/Project Type/Health status; drill into a project's
  Charter, or into a specific RAID log filtered to "open" items.
- **States:** empty (no projects assigned/visible to this user), loaded, filtered.
- **Links to:** Project Charter, Risk/Issue logs (filtered), Contractual Compliance.

### 4.3 Project Charter

- **Purpose:** the system-of-record for a project's identity, resourcing, and rolled-up
  health.
- **Roles:** Project Manager (create/edit their own project), all others (read).
- **Update cadence:**
  - **Setup fields** (Project Description, Progress dates, Resource Allocation): entered
    once when the project is created; edited only on change events (e.g. extension,
    resourcing change, PM handover) — not a periodic re-entry.
  - **Health Declaration** (Delivery Declared Project Health and its 6 category ratings,
    Overall Project Health, Project Status): ⚠ this looks like it should be updated on a
    recurring cadence, not just at project start — proposing **weekly**, aligned with
    Project Status reporting, since "Delivery Declared" reads as something the PM
    re-declares each reporting cycle. Confirm cadence, and confirm whether this belongs
    on the Charter screen at all, or should be its own periodic record (see control gap
    below).
- **⚠ Control gap vs. v1 of this document:** if Health Declaration is updated weekly, the
  Charter screen needs to hold a **history of health declarations over time** (one per
  week, each with its own date), not just a single "current" set of ratings — otherwise
  there's no way to see how a project's health trended over the last N weeks, and no
  audit trail of when a rating changed. Proposed addition: a "Health Declaration History"
  list (date, all 6 category ratings, overall rating, declared by) nested under the
  Charter, with the Charter screen always showing the latest entry plus a link to history.
  **Please confirm whether to add this.**
- **Fields/elements — Project Description:**
  Project Name, Project ID (auto-generated), Contract Type (FPP / T&M / Capped T&M /
  Internal), Project Type (Development / Maintenance / Professional Staffing / Support
  (Application/Infrastructure) / Testing / Cloud Maintenance / Cloud Migration),
  Organization (BCTPL / BCTC / FT), Project Owned (Fully Owned / Co-Owned / Customer
  Driven), GEO (APAC / MEA / US), Account Name, Project Manager, Delivery Manager,
  Delivery Excellence (assigned person), Customer Overview (free text), Project Scope
  Description (free text), Project Revenue, Project Currency, Oracle Project ID(s),
  Billing Type (FPP / FB / T&M / Product / Unit Based Billing / Others), Engagement Type
  (Implementation / Support).
- **Fields/elements — Progress:**
  Planned Start Date, Actual Start Date, Planned End Date, Actual End Date, Planned
  Duration, Actual Duration.
- **Fields/elements — Resource Allocation** (sourced from BCT Oracle App, likely
  read-only/synced rather than manually typed): a list of Resources, each with an FTE
  allocation; auto-calculated Head Count and total FTE.
- **Fields/elements — Treatment / Health:**
  - Applicable Phase (Requirement / Design / CUT / Build & Deployment / Testing / UAT /
    Warranty / Support)
  - Delivery Declared Project Health — six category ratings, each Red / Potential Red /
    Amber / Green, each with a short description: **Core Delivery** (Scope/Cost/Schedule/
    Quality/Contractual SLA/KPI), **People** (Resourcing/Fulfilment/Skilling/Performance/
    Attrition), **Operational** (PID Creation/Extension/Contract Extension/PO/Projects
    without contract/Payment/Invoices/Timesheet), **Customer** (Relation/Pulse/Feedback/
    Opportunities/Business), **Financial** (Forecast/Margin/MIP), **Compliance**
    (Security/Infrastructure/Vendor Management)
  - Delivery Declared Overall Project Health — auto-calculated: if any one category is
    Red, the overall is Red
  - DE Assessed Project Health — read-only, pulled from the DE Assessment Form
  - Project Status — Start Up / Execution / Hold / Closed / Open Only for Billing
  - Overall Project Health — inferred from the highest-severity status across Delivery
    Declared and DE Assessed ratings
- **Actions:** create project, edit (PM only, while unlocked), view resource list,
  navigate to related RAID logs / Status / Measurement for this project.
- **States:** create (empty form), view, edit; visually distinguish auto-calculated
  fields (Project ID, Overall Health, Head Count/FTE) from user-entered fields.
- **Links to:** Project Status, all 5 RAID logs, Measurement Entry, DE Assessment Form —
  all scoped to this project.

### 4.4 Project Status

- **Purpose:** free-text narrative status reporting for a project, refreshed weekly.
- **Roles:** Project Manager (edit), all (view, scoped to projects they can see).
- **Update cadence:** **weekly.** A project accumulates **multiple Project Status
  records over its lifetime** — one per week — not a single record that gets
  overwritten.
- **⚠ Control gap vs. v1 of this document:** the original draft described this as one
  form with three text sections and no date. That's wrong for a weekly-cadence record —
  it needs: (a) a **Report Date / Reporting Week** field on every entry, (b) a **list
  view of past status reports** for a project (date-sorted, most recent first) alongside
  the (c) detail/edit view for a single week's report. Adding these three controls;
  **please confirm.**
- **Fields/elements (per report):** Report Date/Reporting Week (⚠ proposed addition, see
  above), and the three bulleted free-text sections — **Key Accomplishments** (since
  last report, including client appreciation), **Upcoming Key Releases / Milestones /
  Actions**, **Leadership Support / Attention Required**.
- **Actions:** create this week's report, edit a report (while still current/unlocked),
  browse report history.
- **States:** list of past reports (empty on a brand-new project), current report empty,
  current report populated, editing.
- **Links to:** Project Charter (parent project).

### 4.5 – 4.9 RAID Logs (Risk, Issue, Dependency, Assumption, Opportunity)

These five logs share a near-identical shape: a filterable list view and a detail
view/form, scoped to a project. Differences are called out per log below.

**Update cadence (all 5 logs):** individual items are created/edited **ad hoc**, whenever
something is identified — there's no fixed cadence for raising a risk or issue. The
**register as a whole is reviewed monthly** (per your direction). Risk already has
`Last Review Date` / `Next Review Date` fields in the source to support this. The other
four logs do not — see control gap below.

**⚠ Control gap vs. v1 of this document:** for a consistent monthly-review workflow
across all 5 logs (e.g. a "due for review" filter on each list, or a Dashboard tile for
"items not reviewed this month"), Issue, Dependency, and Opportunity logs are missing a
`Last Review Date` / `Next Review Date` pair (Assumption has a close equivalent via
`Validation Date`, but it's framed as a one-time validation, not a recurring review).
Proposing to add `Last Review Date` / `Next Review Date` to Issue, Dependency, and
Opportunity logs for consistency with Risk. **Please confirm whether to add these.**

**Shared list-view behavior (all 5 logs):**
- Filter/sort by Status, Category, Owner, Project; search by title.
- ⚠ Proposed filter addition: "Due for monthly review" / "Overdue for review", once the
  review-date fields above are confirmed.
- Each row shows: ID, Title, Category, Owner, current Status, and (where applicable)
  Severity/Priority/Criticality/Impact — with color coding on severity/priority fields.
- "Open items" and "Escalated items" are meaningful filtered views (used by the Dashboard
  drill-ins).

#### 4.5 Risk Log
- **Fields:** Risk ID (auto), Project Name (default from context), Project Type
  (default), Risk Title, Risk Description, Risk Category (Core Delivery / People /
  Operational / Customer / Financial / Compliance), Risk Type (Internal / External),
  Identified By, Identified Date, Risk Owner, Trigger/Event, Probability (Very Low / Low /
  Medium / High / Very High), Impact (Very Low / Low / Medium / High / Critical), Risk
  Score (computed: Probability × Impact), Severity (Low / Medium / High / Critical),
  Affected Deliverables, Affected Milestone, Response Strategy (Avoid / Mitigate /
  Transfer / Accept), Mitigation Plan, Contingency Plan, Residual Risk, Target Resolution
  Date, Current Status (Open / Monitoring / Closed), Escalation Required (Y/N), Escalated
  To, **Last Review Date, Next Review Date** (already present — supports the monthly
  review cadence), Closure Date, Remarks.
- **Actions:** create, edit, escalate, close, mark reviewed (updates Last/Next Review
  Date).

#### 4.6 Issue Log
- **Fields:** Issue ID (auto), Project Name, Project Type, Issue Title, Issue Description,
  Issue Category, Priority (Low / Medium / High / Critical), Severity (Minor / Major /
  Critical), Raised By, Raised Date, Assigned To, Root Cause, Business Impact, Affected
  Deliverables, Affected Milestone, Resolution Plan, Due Date, Actual Resolution Date,
  Status (New / Assigned / In Progress / Pending / Resolved / Closed), Escalation Level
  (PM / Delivery Manager / Steering Committee), Escalation Date, Resolution Summary,
  Lessons Learned, Closure Date, Remarks, ⚠ **Last Review Date / Next Review Date**
  (proposed addition — not in source, see control gap above).
- **Actions:** create, assign, escalate, resolve, close, mark reviewed (if addition
  confirmed).

#### 4.7 Dependency Log
- **Fields:** Dependency ID (auto), Project Name, Project Type, Dependency Title,
  Description, Dependency Type (Internal / External / Vendor / Customer / Infrastructure /
  Regulatory / Third Party), Category, Depends On, Related Task/Milestone, Required By
  (date), Owner, Dependency Status (Not Started / In Progress / Completed / Blocked),
  Criticality (Low / Medium / High / Critical), Impact if Delayed, Probability of Delay
  (Low / Medium / High), Mitigation Plan, Escalation Required (Y/N), Escalation Level
  (Project Manager / Delivery Manager / Steering Committee), Actual Completion Date, Last
  Updated, Remarks, ⚠ **Last Review Date / Next Review Date** (proposed addition — not
  in source, see control gap above).
- **Actions:** create, edit, mark blocked/completed, escalate, mark reviewed (if addition
  confirmed).

#### 4.8 Assumption Log
- **Fields:** Assumption ID (auto), Project Name, Project Type, Title, Detailed
  Description, Category, Raised By, Raised Date, Owner, Dependency Reference (optional
  link to a Dependency record), Impact if Invalid, Probability of Failure (Low / Medium /
  High), Impact Rating (Low / Medium / High / Critical), Validation Date, Validation
  Status (Pending / Validated / Invalid), Mitigation Plan, Contingency Plan, Current
  Status (Open / Closed / Cancelled), Last Updated, Remarks. (Validation Date already
  functions as a review-style date, though framed as one-time validation rather than a
  recurring monthly review — confirm if that's sufficient or if a separate recurring
  Next Review Date is also wanted.)
- **Actions:** create, edit, validate/invalidate, close.

#### 4.9 Opportunity Log
- **Fields:** Opportunity ID (auto), Project Name, Project Type, Opportunity Title,
  Opportunity Description, Category, Identified By, Identified Date, Opportunity Owner,
  Impact (Very Low / Low / Medium / High), Expected Benefit (Time / Cost / Quality /
  Revenue), Estimated Benefit (quantified value), Benefit Type (Cost Saving / Revenue
  Increase / Quality Improvement / Customer Satisfaction), Exploitation Strategy (Exploit
  / Enhance / Share / Accept), Action Plan, Target Implementation Date, Status
  (Identified / Approved / Implemented / Closed), Approval Required (Y/N), Approved By,
  Actual Benefit, Closure Date, Remarks, ⚠ **Last Review Date / Next Review Date**
  (proposed addition — not in source, see control gap above).
- **Actions:** create, edit, request approval, approve/reject (approver role TBD —
  likely Delivery Manager), implement, close, mark reviewed (if addition confirmed).

### 4.10 Measurement Entry

- **Purpose:** capture delivery metrics; the specific measures/metrics shown depend on
  the project's Project Type. Present as tabs or a type-switcher, one tab per project
  type, showing only that type's fields.
- **Roles:** Project Manager (edit), all (view).
- **Update cadence:** ⚠ not stated in the source beyond "as on date" language on several
  fields, implying periodic snapshots. Proposing:
  - **Development:** weekly, aligned with Project Status (fields like "Planned Effort
    (As on Date)", "% Completion (As on Date)" read as a recurring snapshot).
  - **Support:** continuous/ticket-driven as incidents occur, rolled up weekly for
    reporting.
  - **Professional Staffing:** request-driven (ad hoc per resource request), rolled up
    weekly for reporting.
  - **Testing:** per test cycle/phase rather than calendar-weekly.
  - **Cloud Maintenance:** continuous (uptime tracked continuously), rolled up monthly
    (typical for SLA-style availability reporting).
  - **Cloud Migration:** event-based, per migration attempt — not periodic.

  **Please confirm/correct these cadences.**
- **⚠ Control gap vs. v1 of this document:** since data is periodic/snapshot in nature,
  each tab needs an explicit **Reporting Period / As-of Date** control (only the
  Development tab's source data mentions "Last Updated Date" explicitly) and the screen
  needs to support **viewing prior periods**, not just entering the current one — this
  is what would drive trend charts on the Dashboard. Proposing to add a Reporting
  Period selector + history to all 6 tabs, not just Development. **Please confirm.**
- **Tab: Development Projects** — inputs: Overall Planned Size, Actual Size (end of
  project), Overall Estimated Effort, Planned Effort (as on date), Actual Effort (as on
  date), Planned % Completion, Actual % Completion, plus paired Internal/External defect
  counts across the SDLC stages (URD, Proto, SRS, ADD, HLD, USP/LLD, Code, UTC, SITC, UT,
  SIT), UAT Defects (External), Production Defects (External), Total Test Cases Designed,
  # Executed Test Cases, # Passed Test Cases, Last Updated Date. Computed metrics shown
  read-only: Productivity, Effort Variation %, Schedule Performance Index (SPI), Cost
  Performance Index (CPI), Defect Leakage % (Internal vs External), Code Coverage %,
  Test Execution Coverage %, Test Pass Rate %.
- **Tab: Support (Application/Infrastructure)** — inputs: Incidents by priority (P1/P2/P3
  counts + person-days), Service Requests, User Clarifications, # Tickets Re-opened,
  # Aging Tickets, # First-Time Resolutions. Computed metrics: Incident SLA Compliance %
  (by priority), Incident MTTR, Service Request MTTR, User Clarification MTTR.
- **Tab: Professional Staffing** — inputs: # Requests, Response Time to resource request
  by priority (Critical/High/Medium/Low, person-hours), # Profiles Submitted, # Client
  Interviews, # Interview Selects, # Associates Joined, Lead Time (Resource Request to
  Onboarding) by priority. Computed metrics: Average Response Time by priority, % Profiles
  Qualifying for Client Submission, % Candidates Resulting in Joining, Lead Time by
  priority.
- **Tab: Testing** — inputs: Total Test Cases Designed, # Executed, # Passed, # Automated,
  Effort for Test Case Design, Effort for Test Execution. Computed metrics: Test
  Execution Coverage %, Test Pass Rate %, Automation Coverage %, Test Design
  Productivity, Test Execution Productivity.
- **Tab: Cloud Maintenance** — inputs: Total Uptime, Total Scheduled Time, Application
  Downtime. Computed metrics: Service Availability %, Application Availability %.
- **Tab: Cloud Migration** — inputs: Planned Application Migration count, Applications
  Migrated, Total Migration Attempts, Successful Migrations, Migration Start/End Time.
  Computed metrics: Applications Migrated (Planned vs Actual) %, Migration Success Rate
  %, Migration Downtime.
- **Actions:** enter/update period data, view computed metrics (read-only, clearly
  distinguished from entered values), view trend over time (see control gap above).
- **States:** empty (no data yet this period), populated, last-updated timestamp visible.

### 4.11 Contractual Compliance

- **Purpose:** track SLA/contractual commitments and payment milestones against actuals.
- **Roles:** PMO (edit), Project Manager (view/contribute), Executive (view).
- **Update cadence:** already modeled in the source — each commitment carries its own
  **Frequency** (One Time / Weekly / Fortnight / Monthly / Quarterly / Half Yearly /
  Phase Wise), so "Actuals" entry cadence is per-commitment, not fixed for the whole
  screen. Milestone payments are event-based, tied to each milestone's expected/actual
  payment date rather than a recurring cycle.
- **Section: Contractual Commitment — Definition:** Frequency (One Time / Weekly /
  Fortnight / Monthly / Quarterly / Half Yearly / Phase Wise), Name of the Commitment,
  Formula, Target, Penalty Applicable (Y/N), Penalty Value.
- **Section: Contractual Commitment — Actual:** same fields plus Actual (value achieved),
  Met / Not Met status.
- **Section: Milestones Linked to Payment — Definition:** Milestone Name, Milestone
  Description, Expected Date of Payment, Expected Payment Value.
- **Section: Milestones Linked to Payment — Actual:** same fields plus Actual Date of
  Payment, Actual Payment Value, Status (Paid On Time / Delayed Payment / Yet To Be
  Paid), Remarks.
- **Actions:** define commitments/milestones (setup, likely at project start), record
  actuals each period (per the commitment's own Frequency), flag Not Met / Delayed items.
- **States:** definition-only (not yet due), due, met, not-met/delayed.
- **Links to:** Dashboard's "Contractual Commitment" and "Milestones Linked to Payment"
  tiles.

### 4.12 DE Assessment Form

- **Purpose:** Delivery Excellence's periodic audit of a project.
- **Roles:** Delivery Excellence (edit), all (view).
- **Update cadence:** ⚠ not stated in the source. Proposing **monthly or quarterly** per
  project — please confirm which. A project accumulates **multiple assessment records
  over time** (like Project Status), each a dated snapshot.
- **⚠ Control gap vs. v1 of this document:** the original draft described a single
  assessment form with no date and no history. Proposing to add: (a) an **Assessment
  Date** field on every assessment, (b) a **list view of past assessments** for a
  project, and (c) a **Next Assessment Due Date** to drive reminders — mirroring the
  Project Status history pattern. **Please confirm whether to add these.**
- **Fields/elements:** Assessment Date (⚠ proposed addition), DE Assessed Project Health
  (Red / Potential Red / Amber / Green). If not Green, an Alert is raised: Alert ID
  (auto), Alert Category (Core Delivery / People / Operational / Customer / Financial /
  Compliance), Alert Brief Description, Detailed Description, Raised By, Raised On. Also:
  PCI Score (numeric). Key Findings table: sequence #, Classification (Observation /
  Recommendation), Action Taken, Date, Status (Open / Closed / On Hold / Deferred),
  Remarks.
- **Actions:** submit assessment (creates a new dated record), raise alert, add finding,
  update finding status, browse assessment history.
- **States:** assessment in progress, submitted; findings open vs. closed.
- **Links to:** Project Charter's "DE Assessed Project Health" (shows latest assessment's
  rating there, read-only).

### 4.13 Data Integrity Checklist

- **Purpose:** a governance view showing, per project, which data points across every
  other module have or haven't been updated for the current reporting period — each item
  is Updated / Not Updated. It is a rollup, not new source data.
- **Roles:** PMO (primary), all (view).
- **Update cadence:** ⚠ not stated in the source. Proposing **weekly**, run at the same
  cadence as Project Status/Measurement reporting, so a "Not Updated" flag means
  "not updated this week." Since the underlying modules have different cadences
  (RAID monthly, DE Assessment monthly/quarterly), the checklist should track each
  item against *its own* expected cadence rather than assuming everything is weekly —
  **please confirm this logic.**
- **Fields/elements:** grouped checklist mirroring the other modules' data points —
  Delivery metrics (Planned/Actual Size, Effort, % Completion), Defect counts, Support
  metrics (Incidents, Service Requests, User Clarifications), Professional Staffing
  metrics, Testing metrics, Cloud Maintenance/Migration metrics, RAID logs (Risk,
  Assumption, Opportunity, Dependencies, Issues — updated as a whole log, not per-item),
  Health/Status (Delivery Declared Project Health, DE Assessed Project Health, Project
  Status), Contractual (Commitment Definition/Actual, Milestone Definition/Actual) — each
  row: item name, expected cadence, Updated/Not Updated status, last-updated date.
- **Actions:** filter to "Not Updated" items across a project or the whole portfolio.
- **States:** all updated (green), some outstanding (flagged).
- **Links to:** Dashboard, drill into the specific module screen for a "Not Updated" item.

### 4.14 Admin — Users & Roles

- **Purpose:** manage who can access the system and with what role.
- **Roles:** Admin only.
- **Update cadence:** ad hoc, as people join/leave/change roles.
- **Fields/elements:** user list (name, LDAP identifier, assigned role, active/inactive),
  add/deactivate user, assign one of the 6 roles, MFA enrollment status, audit
  trail/activity log viewer (per Security sheet: RBAC, MFA, Audit Trail, Activity Logs
  are explicit requirements).
- **Actions:** invite/deactivate user, change role, view activity log, force MFA
  re-enrollment.
- **States:** active, inactive, pending-MFA-setup.

### 4.15 Admin — Integrations & Reference Data

- **Purpose:** configure external system connections and manage shared reference/lookup
  data.
- **Roles:** Admin only.
- **Update cadence:** ad hoc, as integrations or reference values change.
- **Fields/elements:**
  - Integration connections: Microsoft 365, BCT Oracle Application (source for Resource
    Allocation on the Project Charter), Ticketing Tools, existing Project Management
    tools — each with connection status (connected/error) and last-sync time.
  - Reference data: Project Type list with descriptions (Development/Implementation/
    Enhancement, Support (Application/Infrastructure), Professional Staffing, Testing,
    Cloud Maintenance, Cloud Migration — each with its definition, used as the Project
    Type dropdown throughout the app), Organization codes (BCTPL/BCTC/FT), GEO codes
    (APAC/MEA/US).
  - Backup/Restore trigger and status (per Security sheet requirement).
- **Actions:** configure/test integration connection, edit reference data, trigger
  backup.

---

## 5. Global / cross-cutting notes

- **Navigation shell:** role-aware — the same shell (top nav or sidebar) shows only the
  screens a given role can access; PM/Team Member see their assigned project(s) scoped
  everywhere, Executive/PMO/DE see a project or account picker.
- **Health/status color convention:** Red / Potential Red / Amber / Green is used
  consistently for project, category, and account health — Stitch should treat this as a
  semantic 4-state indicator (not a generic 2 or 3-state badge), reused across Dashboard,
  Project Charter, and DE Assessment.
- **RAID consistency:** the 5 RAID logs (Risk, Issue, Dependency, Assumption,
  Opportunity) should share one list/detail UI pattern given their nearly identical
  shape, rather than being designed as five unrelated screens.
- **Computed vs. entered fields:** several fields are auto-calculated or system-sourced
  (Project ID, Overall Project Health, Head Count/FTE, DE Assessed Project Health shown
  on the Charter, all Measurement "Metrics" columns) — these must be visually
  distinguishable from user-entered fields and not editable where marked read-only.
- **Periodic vs. one-time records:** the app has two different data shapes and the UI
  should treat them differently — **one-time/setup records** (Project Charter's setup
  fields) vs. **recurring dated records with history** (Project Status weekly, RAID
  monthly review, DE Assessment monthly/quarterly, Measurement periodic snapshots).
  Screens in the second group need a list/history view plus a "create new dated entry"
  action, not just a single editable form.
- **Data freshness:** several modules are explicitly tracked "as on date" (Measurement)
  or checked for staleness (Data Integrity) — last-updated timestamps should be visible
  on data-entry screens.
- **Responsive expectations:** internal tool, primarily desktop use (data entry-heavy
  forms and tables); mobile/tablet is a "should work," not a primary design target unless
  the user says otherwise.
- **Auth:** LDAP-based login; MFA is a listed Security requirement — confirm during
  review whether MFA is enforced at every login or configurable per role.

---

## 6. Open questions for the review gate

1. Should the combined "CEO / CDO / GEO Head / Delivery Manager" access group in the
   source be split into distinct roles with different permissions (e.g., can a Delivery
   Manager approve/escalate while CEO/CDO/GEO Head are pure viewers)?
2. Who approves an Opportunity (`Approval Required: Y/N`, `Approved By`)? Not stated in
   the source — assumed Delivery Manager pending confirmation.
3. Resource Allocation on the Project Charter is sourced from BCT Oracle App — confirm
   whether this is read-only/synced in the UI or manually re-entered until that
   integration exists.
4. The `Architecture` sheet in the source workbook is empty — no content to incorporate;
   flagging in case it was meant to hold something (e.g. a system diagram) not yet filled
   in.
5. The tool has no confirmed name yet (per the source workbook's own open action items) —
   using "Project Governance Tool" as a placeholder throughout.

## 7. Proposed additional controls (pending your decision)

Everything below is **not in the source Excel** — it's added because the stated update
cadences (weekly Status, monthly RAID review, etc.) don't work without these controls.
Each is called out inline in §4 as well; consolidated here for a quick yes/no pass.

| # | Screen | Proposed control | Why it's needed |
|---|---|---|---|
| 1 | Project Charter | Health Declaration History (dated list of the 6 category ratings + overall, per cycle) | If Delivery Declared Health is redeclared weekly, a single "current" field loses the trend/audit trail |
| 2 | Project Status | Report Date / Reporting Week field | A weekly report needs to know which week it's for |
| 3 | Project Status | List view of past status reports per project | Confirmed: a project has multiple Project Status entries over time, not one |
| 4 | Issue Log | Last Review Date / Next Review Date | Needed for the monthly-review cadence; Risk already has this, Issue doesn't |
| 5 | Dependency Log | Last Review Date / Next Review Date | Same as above |
| 6 | Opportunity Log | Last Review Date / Next Review Date | Same as above |
| 7 | RAID logs (all 5) | "Due for review" / "Overdue" filter on list views | Surfaces items the monthly review cadence requires attention on |
| 8 | Measurement Entry | Reporting Period / As-of Date selector on every tab (not just Development) | Needed to support periodic snapshots and trend views consistently |
| 9 | Measurement Entry | Ability to view prior reporting periods, not just enter the current one | Needed for trend charts and historical comparison |
| 10 | DE Assessment Form | Assessment Date field | A recurring assessment needs to know which cycle it's for |
| 11 | DE Assessment Form | List view of past assessments per project | Mirrors Project Status — DE Assessed Health changes over time |
| 12 | DE Assessment Form | Next Assessment Due Date | Drives reminders/overdue tracking |
| 13 | Dashboard | "Last refreshed" / "data as of" indicator per tile | Underlying modules update on different cadences; users need to know how fresh each number is |
| 14 | Data Integrity Checklist | Expected cadence + last-updated date per checklist row | Lets the checklist judge "not updated" against each item's own cadence instead of one blanket assumption |
