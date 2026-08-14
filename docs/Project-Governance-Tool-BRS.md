# Business Requirements Specification — Project Governance Tool

## Document Control

| | |
|---|---|
| **Document title** | Business Requirements Specification — Project Governance Tool |
| **Prepared for** | Bahwan CyberTek (BCT) PMO |
| **Status** | **Draft — pending stakeholder review** |
| **Source material** | `Project Governance Tool Requirement_240726.xlsx` (18-sheet internal workbook) + current implementation state as of 2026-08-12 |
| **Reviewers (proposed)** | Hariharasudhan, GEO Heads, Vivek, Sowmya / Revathi |

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-08-12 | First draft, consolidated from source workbook and current build |

> **How to read this document.** Section 4 (Functional Requirements) is organized by module and numbered `FR-<module>-<n>` so each requirement can be individually approved, rejected, or amended. Anything marked **⚠ Open Item** is not settled — either the source workbook was silent on it, or it conflicts with a decision already made in the current build. Section 8 consolidates every open item into one list for a single review pass.

---

## 1. Introduction

### 1.1 Purpose

This document specifies the business requirements for the **Project Governance Tool**, an internal PMO / delivery-governance platform for BCT. It is the reference for what the system must do — not how screens should look (see `docs/ux-requirements.md` for UX-level detail, and the Google Stitch mockups it feeds) and not how it is built (see the codebase itself for implementation).

### 1.2 Background

Project delivery health, risk registers, contractual compliance, and delivery-excellence audits are currently tracked in separate spreadsheets per project, account, and geography. There is no single system of record, no consistent rule for rolling a project's health up to its account and geo, and no shared audit trail for the reviews and sign-offs that already happen informally. The Project Governance Tool replaces that patchwork with one application covering the full reporting chain from individual project to CXO.

### 1.3 Scope

**In scope:** project charter and master data; health declaration and Red/Amber/Green rollup from project → account → geo → enterprise; the report-and-review workflow at each tier; five RAID registers; weekly status reporting; delivery metrics by engagement type; contractual SLA and milestone-payment tracking; Delivery Excellence assessment; a data-integrity checklist; role-based dashboards; user/role administration.

**Out of scope (this phase):** payroll/financial systems of record (the tool tracks revenue/forecast fields but is not a finance system), full CRM functionality, timesheet capture (referenced as an input to Data Integrity but not itself built here), any customer-facing surface — this is an internal BCT tool only.

### 1.4 Definitions

| Term | Meaning |
|---|---|
| **RAG** | Red / Amber / Green health rating. This system uses a 4-state variant: **Red, Potential Red, Amber, Green**, ordered worst-to-best in that sequence. |
| **Worst-wins rollup** | The rule that a parent's health rating equals the worst rating among its children (e.g., one Red project makes its account Red). |
| **RAID** | Risk, Assumption, Issue, Dependency — plus Opportunity, tracked here as a fifth, related register. |
| **Reporting surface** | The screen where a tier (Project/Account/Geo) enters its own data. |
| **Review surface** | The read-only, one-level-up screen where the next tier reviews and approves/rejects what was reported below it. |
| **Geo** | Geography (region) — the organizational tier between Account and CXO (e.g., APAC, MEA, US). |
| **PCI Score** | Delivery Excellence's numeric project compliance/quality index, produced by the DE Assessment. |

---

## 2. Business Objectives

| # | Objective | Success looks like |
|---|---|---|
| 1 | Replace spreadsheet-based status reporting with one system of record | No project's health, RAID log, or contractual status lives only in a local file |
| 2 | Guarantee that risk visibility travels upward without dilution | A Red project cannot be hidden inside a Green account or geo view |
| 3 | Make review and sign-off a first-class, auditable action | Every account/geo/CXO approval or rejection is timestamped and attributable |
| 4 | Reduce the manual effort of assembling roll-up reports | Account and geo views are computed from project data, not re-typed |
| 5 | Give Delivery Excellence and PMO a consistent audit trail | DE assessments, findings, and data-integrity checks are queryable across the whole portfolio |

---

## 3. Stakeholders & Roles

### 3.1 Roles

The system implements **eight roles**, superseding the source workbook's combined "CEO/CDO/GEO Head/Delivery Manager" executive group — that group has since been split so each organizational tier has its own reporting and review responsibilities.

| Role | Org scope | Core responsibility |
|---|---|---|
| **Admin** | All | User/role administration, integration configuration, reference data, backups |
| **CXO** | Enterprise | Reviews and approves every Geo's rolled-up status; enterprise-wide dashboard |
| **Geo Head** | One or more Geos | Reviews and approves Accounts within their Geo(s); reports their Geo's own status upward |
| **Account Manager** ("Account Head") | One or more Accounts | Reviews and approves Projects within their Account(s); reports their Account's own status upward |
| **Project Manager** | Their own project(s) | Owns Project Charter, Status, RAID logs, Measurement entry; submits for DE Assessment |
| **Team Member** | Their assigned project(s) | Updates RAID items assigned to them; read-only on Charter/Status |
| **Delivery Excellence (DE)** | Cross-project (audit) | Performs the DE Assessment (PCI score, findings, alerts) for any project |
| **PMO** | Cross-project | Owns Contractual Compliance and Milestone Payments; runs the Data Integrity checklist |

A user's Account/Geo scope is assigned individually (a user can be scoped to more than one Account or Geo), driving what they see across every reporting and review screen.

### 3.2 Organizational Hierarchy

```
Project  →  Account  →  Geo  →  CXO (enterprise)
```

Each tier above Project has two surfaces:

- **Reporting** — the tier's own self-authored status (e.g., an Account Manager's narrative and health for their Account as a whole, independent of any single project).
- **Review** — a read-only rollup of the tier below, with an **Approve / Reject** action per item, one tier up (Account Manager reviews Projects; Geo Head reviews Accounts; CXO reviews Geos).

This Reporting/Review pattern is identical at every tier by design, so a fourth tier could be added later without a new UI pattern.

---

## 4. Functional Requirements

Each requirement is tagged **[Built]** (working in the current system), **[Partial]** (some part exists, incomplete), or **[Planned]** (specified, not yet built) as of 2026-08-12. This is a living status, not a promise — see §7 for the fuller status breakdown.

### 4.1 Authentication & Access

| ID | Requirement | Status |
|---|---|---|
| FR-AUTH-1 | Users authenticate against the company directory before accessing any screen | **[Planned]** — see ⚠ Open Item 1 |
| FR-AUTH-2 | Multi-factor authentication is available/enforceable per the Security sheet | **[Planned]** |
| FR-AUTH-3 | Every screen and action is restricted by the user's role and Account/Geo scope | **[Built]** |
| FR-AUTH-4 | All authentication and authorization-relevant actions are captured in an audit/activity log | **[Partial]** — an audit log table exists; coverage of what's logged needs confirmation |

### 4.2 Project Charter

| ID | Requirement | Status |
|---|---|---|
| FR-CHART-1 | Capture project master data once at project creation: Project Name, Project ID (auto), Contract Type (FPP / T&M / Capped T&M / Internal), Project Type, Organization (BCTPL / BCTC / FT), Project Owned (Fully Owned / Co-Owned / Customer Driven), Geo, Account, Project Manager, Delivery Manager, Delivery Excellence owner, Customer Overview, Scope Description, Revenue, Currency, Oracle Project ID(s), Billing Type, Engagement Type | **[Built]** |
| FR-CHART-2 | Capture Planned/Actual Start and End Dates and derived Duration | **[Built]** |
| FR-CHART-3 | Show Resource Allocation (resource list, FTE, computed Head Count) sourced from the BCT Oracle Application | **[Partial]** — Oracle **project/resource ID mapping** exists; live sync of allocation data is not yet wired |
| FR-CHART-4 | Capture a Delivery-Declared health rating (Red / Potential Red / Amber / Green) across six categories: Core Delivery, People, Operational, Customer, Financial, Compliance | **[Partial → migrating]** — a newer **itemized** register (`project_health_items`, one line item per category per period) is replacing the earlier single free-text-per-category rating; both models currently coexist during migration |
| FR-CHART-5 | Auto-compute Overall Project Health as worst-wins across the six categories | **[Built]** |
| FR-CHART-6 | Show DE-Assessed Project Health, sourced read-only from the latest DE Assessment | **[Built]** |
| FR-CHART-7 | Project lifecycle status is one of: **Draft, Pending Approval, Approved, Hold, Closed, Open Only for Billing** | **[Built]** — ⚠ note: the source workbook lists "Start Up"/"Execution" instead of "Draft"/"Approved"; this BRS uses the values actually implemented, per an explicit prior correction (see §8, Open Item 2) |
| FR-CHART-8 | Every health declaration is a dated, retained record — not a single value that gets overwritten — so health can be trended over time | **[Built]** (via the itemized rollup work in FR-CHART-4) |

### 4.3 Project Status Reporting

| ID | Requirement | Status |
|---|---|---|
| FR-STAT-1 | Project Manager submits a status report on a recurring cadence covering: Key Accomplishments, Upcoming Key Releases/Milestones/Actions, Leadership Support/Attention Required, and Key Risks/Issues | **[Built]** |
| FR-STAT-2 | Each report carries a Report Date; a project retains a full history of past reports | **[Built]** |
| FR-STAT-3 | Individual status items can be pulled into the Account's own status register, ignored, or left pending — tracked per item (Pending / Pulled / Ignored) | **[Built]** — this is the Reporting → Review rollup mechanism described in §3.2 |
| FR-STAT-4 | The same rollup pattern repeats one tier up: Account status items roll into the Geo register | **[Built]** |

### 4.4 RAID Logs (Risk, Issue, Dependency, Assumption, Opportunity)

| ID | Requirement | Status |
|---|---|---|
| FR-RAID-1 | Maintain five registers per project — Risk, Issue, Dependency, Assumption, Opportunity — sharing one consistent list/detail interaction pattern | **[Built]** |
| FR-RAID-2 | **Risk Log** fields: Risk ID, Title, Description, Category, Type (Internal/External), Identified By/Date, Owner, Trigger, Probability, Impact, computed Risk Score, Severity, Affected Deliverables/Milestone, Response Strategy, Mitigation Plan, Contingency Plan, Residual Risk, Target Resolution Date, Status, Escalation flag/target, Last/Next Review Date, Closure Date, Remarks | **[Built]** |
| FR-RAID-3 | **Issue Log** fields: Issue ID, Title, Description, Category, Priority, Severity, Raised By/Date, Assigned To, Root Cause, Business Impact, Affected Deliverables/Milestone, Resolution Plan, Due Date, Actual Resolution Date, Status, Escalation Level/Date, Resolution Summary, Lessons Learned, Closure Date, Remarks | **[Built]** |
| FR-RAID-4 | **Dependency Log** fields: Dependency ID, Title, Description, Type, Category, Depends On, Related Task/Milestone, Required By, Owner, Status, Criticality, Impact if Delayed, Probability of Delay, Mitigation Plan, Escalation flag/level, Actual Completion Date, Remarks | **[Built]** |
| FR-RAID-5 | **Assumption Log** fields: Assumption ID, Title, Description, Category, Raised By/Date, Owner, optional Dependency link, Impact if Invalid, Probability of Failure, Impact Rating, Validation Date/Status, Mitigation/Contingency Plan, Status, Remarks | **[Built]** |
| FR-RAID-6 | **Opportunity Log** fields: Opportunity ID, Title, Description, Category, Identified By/Date, Owner, Impact, Expected/Estimated Benefit, Benefit Type, Exploitation Strategy, Action Plan, Target Implementation Date, Status, Approval flag/Approved By, Actual Benefit, Closure Date, Remarks | **[Built]** |
| FR-RAID-7 | Every register is filterable/sortable by Status, Category, Owner; "Open" and "Escalated" items feed the Dashboard | **[Built]** |
| FR-RAID-8 | Every register supports a recurring **monthly review** cadence via Last Review Date / Next Review Date, consistently across all five logs | **⚠ Open Item** — Risk already has this pair; whether Issue, Dependency, and Opportunity get it too (Assumption has an equivalent Validation Date) is unconfirmed (see §8, Open Item 3) |

### 4.5 Measurement (Delivery Metrics)

| ID | Requirement | Status |
|---|---|---|
| FR-MEAS-1 | Capture engagement-specific delivery metrics, one tab per Project Type: Development, Support, Professional Staffing, Testing, Cloud Maintenance, Cloud Migration | **[Built]** |
| FR-MEAS-2 | **Development** tab: planned/actual size and effort, % completion, SDLC-stage defect counts (internal/external), UAT/Production defects, test-case counts; computed Productivity, Effort Variation %, SPI, CPI, Defect Leakage %, Code/Test Coverage %, Test Pass Rate % | **[Built]** |
| FR-MEAS-3 | **Support** tab: incidents by priority (count + person-days), Service Requests, User Clarifications, re-opened/aging tickets, first-time resolutions; computed SLA Compliance % by priority, Incident/SR/Clarification MTTR | **[Built]** |
| FR-MEAS-4 | **Professional Staffing** tab: request counts and response time by priority, profiles submitted, client interviews/selects, associates joined, lead time by priority; computed Average Response Time, % Profiles Qualifying, % Candidates Joining, Lead Time by priority | **[Built]** |
| FR-MEAS-5 | **Testing** tab: test cases designed/executed/passed/automated, design/execution effort; computed Execution Coverage %, Pass Rate %, Automation Coverage %, Design/Execution Productivity | **[Built]** |
| FR-MEAS-6 | **Cloud Maintenance** tab: total uptime, scheduled time, downtime; computed Service/Application Availability % | **[Built]** |
| FR-MEAS-7 | **Cloud Migration** tab: planned/actual applications migrated, migration attempts, start/end time; computed Migration % (Planned vs Actual), Success Rate, Downtime | **[Built]** |
| FR-MEAS-8 | Each tab captures data against an explicit Reporting Period/As-of Date and retains prior periods for trend viewing (not just the current snapshot) | **⚠ Open Item** — source data only explicitly mentions this for Development; extending it to all six tabs is proposed but unconfirmed (see §8, Open Item 4) |
| FR-MEAS-9 | Computed metrics are visually distinct from and never directly editable alongside entered values | **[Built]** |

### 4.6 Contractual Compliance

| ID | Requirement | Status |
|---|---|---|
| FR-CONT-1 | Define contractual commitments: Frequency (One Time / Weekly / Fortnight / Monthly / Quarterly / Half Yearly / Phase Wise), Name, Formula, Target, Penalty Applicable (Y/N), Penalty Value | **[Built]** |
| FR-CONT-2 | Record actuals against each commitment on its own Frequency, with a computed Met/Not Met status | **[Built]** |
| FR-CONT-3 | Define payment milestones: Name, Description, Expected Payment Date, Expected Payment Value | **[Built]** |
| FR-CONT-4 | Record milestone actuals: Actual Payment Date/Value, Status (Paid On Time / Delayed Payment / Yet To Be Paid), Remarks | **[Built]** |
| FR-CONT-5 | Contractual status and milestone status feed dedicated Dashboard tiles | **[Built]** |

### 4.7 Delivery Excellence Assessment

| ID | Requirement | Status |
|---|---|---|
| FR-DE-1 | DE performs a dated assessment per project, recording DE-Assessed Project Health (4-state RAG) | **[Built]** |
| FR-DE-2 | If the assessed rating is not Green, an Alert is raised: Alert ID, Category, Brief/Detailed Description, Raised By/On | **[Built]** |
| FR-DE-3 | Capture a numeric PCI Score per assessment | **[Built]** |
| FR-DE-4 | Capture Key Findings: sequence #, Classification (Observation/Recommendation), Action Taken, Date, Status (Open/Closed/On Hold/Deferred), Remarks | **[Built]** |
| FR-DE-5 | A project retains full assessment history, not just the latest; the latest assessment's rating shows read-only on the Project Charter | **[Built]** |
| FR-DE-6 | A Next Assessment Due Date drives overdue/reminder tracking | **⚠ Open Item** — assessment cadence (monthly vs quarterly) is unconfirmed (see §8, Open Item 5) |

### 4.8 Data Integrity Checklist

| ID | Requirement | Status |
|---|---|---|
| FR-DI-1 | Show, per project, which data points across every other module have or have not been updated for the current reporting period (Updated/Not Updated), grouped by module | **[Built]** |
| FR-DI-2 | Each checklist row is evaluated against *its own* expected cadence (weekly Status vs. monthly RAID vs. monthly/quarterly DE Assessment), not one blanket assumption | **⚠ Open Item** — depends on Open Items 3–5 being resolved first |
| FR-DI-3 | Filter to "Not Updated" items across a single project or the whole portfolio, drilling into the source module | **[Built]** |

### 4.9 Dashboard

| ID | Requirement | Status |
|---|---|---|
| FR-DASH-1 | Show role-scoped KPI tiles: Active Projects, Projects by Type, Delayed Projects, Open Risks/Issues, Pending Approvals, Contractual Commitment status, Milestones Linked to Payment | **[Built]** |
| FR-DASH-2 | Show Project Health and Account Health rollups, filterable by Geo/Account/Project Type/Health status, with drill-in to the underlying Charter or RAID log | **[Built]** |
| FR-DASH-3 | Aggregation is computed live from current module data, not a separately maintained figure | **[Built]** |
| FR-DASH-4 | Show a "data as of" / last-refreshed indicator per tile, since underlying modules update on different cadences | **⚠ Open Item** (see §8, Open Item 6) |

### 4.10 Reporting & Review Cascade (Account / Geo / CXO)

| ID | Requirement | Status |
|---|---|---|
| FR-REV-1 | Each Account has its own Reporting surface for self-authored account-level status, independent of any one project | **[Built]** |
| FR-REV-2 | Account Managers have a Review surface showing every Project in their Account(s), with an Approve/Reject action per rolled-up item | **[Built]** |
| FR-REV-3 | The same Reporting/Review pair exists one tier up for Geo Heads (reviewing Accounts) and for CXO (reviewing Geos) | **[Built]** |
| FR-REV-4 | Health rollup at every tier uses the worst-wins rule: a Red child forces its parent to at least Red | **[Built]** |

### 4.11 Administration

| ID | Requirement | Status |
|---|---|---|
| FR-ADM-1 | Manage users: create/deactivate, assign one of the eight roles, assign Account/Geo scope | **[Built]** |
| FR-ADM-2 | View an audit/activity log of system actions | **[Partial]** |
| FR-ADM-3 | Configure and monitor external integration connections: Microsoft 365, BCT Oracle Application, ticketing tools | **[Partial]** — the screen and connection-status model exist; **no integration currently syncs live data**. The one concrete integration touchpoint today is Oracle **project/resource ID mapping**, which stores the linkage but does not yet pull live resourcing data |
| FR-ADM-4 | Manage reference data: Project Types, Organization codes (BCTPL/BCTC/FT), Geo codes | **[Built]** |
| FR-ADM-5 | Trigger/monitor database backup per the Security sheet's requirement | **⚠ Open Item** — not confirmed as built |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Hosting:** on-premises, within the BCT network — not a public cloud deployment |
| NFR-2 | **Data residency:** no project, RAID, or contractual data leaves the BCT network |
| NFR-3 | **Access control:** every screen and record is scoped by role and by the user's assigned Account(s)/Geo(s); a user never sees data outside their scope by default |
| NFR-4 | **Auditability:** approvals, rejections, and health-rating changes are attributable to a user and a timestamp |
| NFR-5 | **Availability of historical data:** status reports, RAID review dates, and DE assessments are retained as history, not overwritten, so trends can be reconstructed |
| NFR-6 | **Usability target:** primarily desktop, data-entry-heavy forms and tables; mobile/tablet is a "should work," not a primary target |
| NFR-7 | **Security:** role-based access control, multi-factor authentication, encryption, and backup — per the source workbook's Security sheet (see §8, Open Item 1 for current status) |

---

## 6. Data Overview

Core entities the system is built around (see the codebase for full schema):

- **Organization / Geo / Account / Project Type** — reference and org-hierarchy data
- **Project** (+ Oracle ID mapping, resource mapping) — the master project record
- **User / Role** (+ Account/Geo scope assignment)
- **Health Declaration / Health Item** — category-level and itemized RAG ratings, at project and account level
- **Status Item** (+ rollup tracking) — the weekly narrative report and its pulled-up register entries
- **Risk / Issue / Dependency / Assumption / Opportunity Log** — the five RAID registers
- **Contractual Commitment / Milestone Payment**
- **DE Assessment** (+ findings, alerts)
- **Measurement records** — one family of tables per engagement type, plus targets
- **Data Integrity Checklist**
- **Audit / Activity Log**

---

## 7. Current Build Status Summary

| Status | Meaning | Coverage |
|---|---|---|
| **Built** | Working in the current system | Project Charter, Status reporting, all 5 RAID logs, all 6 Measurement tabs, Contractual Compliance, DE Assessment, Data Integrity, role-scoped Dashboards, the full Reporting/Review cascade with worst-wins rollup, Admin user/role/reference-data management |
| **Partial** | Started, not complete | Resource Allocation sync from Oracle (ID mapping only, not live data), audit-log coverage, integration connections (screen exists, nothing syncs live) |
| **Planned** | Specified, not yet built | Real authentication (LDAP bind or SSO) — today, sign-in matches an identifier to a user record with no password check; live M365/ticketing sync; backup/restore trigger |

**This gap is the single most important open item for go-live planning**: the application should not be exposed beyond a controlled pilot until FR-AUTH-1/2 (real authentication) are delivered.

---

## 8. Open Items Requiring Stakeholder Decision

| # | Open item | Why it matters | Related requirement |
|---|---|---|---|
| 1 | **Authentication mechanism.** Confirm whether login will bind to LDAP, use SSO, or another method — and whether MFA is enforced for every role or configurable. | No production/pilot rollout should happen before this is resolved. | FR-AUTH-1, FR-AUTH-2 |
| 2 | **Project Status naming.** The source workbook lists "Start Up"/"Execution"; the implemented system uses "Draft"/"Pending Approval"/"Approved". Confirm the workbook is superseded and the implemented naming is final. | This has been re-litigated more than once during development; needs a documented decision to stop recurring. | FR-CHART-7 |
| 3 | **RAID monthly-review consistency.** Should Issue, Dependency, and Opportunity logs get Last/Next Review Date fields to match Risk (Assumption already has an equivalent Validation Date)? | Needed for a consistent "due for review" experience across all five logs. | FR-RAID-8 |
| 4 | **Measurement reporting-period history.** Should all six Measurement tabs (not just Development) carry an explicit Reporting Period selector and retain prior periods? | Needed to support trend charts and historical comparison on the Dashboard. | FR-MEAS-8 |
| 5 | **DE Assessment cadence.** Monthly or quarterly, per project? | Drives the Next Assessment Due Date and Data Integrity's "not updated" logic. | FR-DE-6 |
| 6 | **Dashboard data-freshness indicator.** Should each KPI tile show a "data as of" timestamp, given modules update on different cadences? | Prevents users from misreading a stale number as current. | FR-DASH-4 |
| 7 | **Combined executive role split.** The source workbook grouped CEO/CDO/GEO Head/Delivery Manager as one access level; the system has since split GEO Head, Account Manager, and CXO into distinct roles. Confirm this split is final and whether a Delivery Manager role is still needed separately. | Affects the role table in §3.1 and every permission check downstream. | §3.1 |
| 8 | **Opportunity approval authority.** `Approval Required (Y/N)` / `Approved By` exist on the Opportunity Log, but the source doesn't state who approves. | Needed to assign the approval action to a specific role. | FR-RAID-6 |
| 9 | **Oracle resourcing sync.** Confirm whether Resource Allocation stays manually entered until a live Oracle integration exists, or whether ID mapping is a placeholder for near-term live sync. | Affects whether Resource Allocation fields are editable or read-only in the UI. | FR-CHART-3 |
| 10 | **Tool naming.** No confirmed product name exists yet (per the source workbook's own open action items); "Project Governance Tool" is used as a working title throughout this document. | Cosmetic but should be resolved before any external-facing rollout. | — |

---

## 9. Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| PMO Sponsor | | ☐ Approved ☐ Changes requested | |
| Delivery Excellence | | ☐ Approved ☐ Changes requested | |
| Geo Head (representative) | | ☐ Approved ☐ Changes requested | |
| Account Head (representative) | | ☐ Approved ☐ Changes requested | |
