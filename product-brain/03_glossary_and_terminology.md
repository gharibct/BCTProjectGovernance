# 03 — Glossary & Terminology

**Document type:** Product-Brain Reference
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-29, pending review
**Depends on:** product-brain/00, product-brain/01
**Feeds:** every later document

> **Purpose of this document.** The canonical vocabulary for the product brain. Every other
> document uses these terms with these meanings and cites this file rather than
> re-defining. The canonical **status** vocabulary (state names and transitions) lives in
> `product-brain/06_status_workflow_catalogue.md`; this file names the status *concepts* and
> points there.

---

## 1. How to use this document

- If a term is used pack-wide and its meaning could be ambiguous, it is defined here once.
- Definitions are ≤ 3 sentences. Where a term is a status or a lifecycle, the definition is
  brief and `product-brain/06` is authoritative for its states and transitions.
- Role names always use the exact codes from `product-brain/00` §3
  (`ADMIN`, `CXO`, `GEO_HEAD`, `ACCOUNT_MANAGER`, `PROJECT_MANAGER`, `TEAM_MEMBER`,
  `DELIVERY_EXCELLENCE`, `PMO`).

---

## 2. Glossary

| Term | Definition | See also |
| --- | --- | --- |
| **Account** | The organisational tier between Project and Geo (a client account). A user is scoped to one or more Accounts. Accounts are reference data managed by `ADMIN`. | Geo, Scope |
| **Account Head** | Informal name for the `ACCOUNT_MANAGER` role. | Role |
| **Action (Action Tracker)** | A discrete tracked task raised against a Project, Account, or Geo, with an assignee, priority, due date, and a full history. | Action level, `product-brain/06` |
| **Action level** | The entity an Action is scoped to: `GEO`, `ACCOUNT`, or `PROJECT`. Determines which roles may create/edit it. | Action |
| **AI Hub** | The document-upload and AI-processing area of a reporting tree (`.../ai-hub/document-processing`). | AI suggestion |
| **AI suggestion** | A structured value the external LLM pipeline extracted from an uploaded document, stored for review. **Field suggestions** target one form control; **row suggestions** target a whole RAID(O) grid row. The AI never writes to business tables. | Confidence, Evidence, Apply / Ignore |
| **Alert (DE)** | A record raised in a DE Assessment when the DE-Assessed Health is not `Green`: category, brief and detailed description, raised by/on. | Finding, DE Assessment |
| **Applicable Phase** | A project's current delivery phase(s) — Requirement, Design, CUT, Build & Deployment, Testing, UAT, Warranty, Support — selectable as multiple values on the Charter. | Charter |
| **Apply / Ignore** | User actions on an AI suggestion. Apply copies the value into the form (field) or creates the real row via the normal create endpoint (row); Ignore dismisses it. Editing or saving a form also resolves its field suggestions. | AI suggestion |
| **Baseline** | A `PeriodType` used for one-time / project-start measurement and target values, as opposed to recurring `Weekly` / `Monthly` periods. | Reporting period |
| **BCT** | Bahwan CyberTek — the organisation ProjectGovernance is built for. It is an internal tool only. | — |
| **Charter** | The Project Charter — the system-of-record screen and record for a project's identity, contract/engagement attributes, dates, resource allocation, Oracle Project ID mapping, and cached health/approval state. | Send for Approval |
| **Confidence** | An AI suggestion's certainty (High / Medium / Low), shown as a coloured box before the affected control. | AI suggestion, Evidence |
| **Consulting** | One of the seven engagement / measurement types; its computed metrics are Effort Variation, SPI, and CPI. | Engagement type, Measurement |
| **Contract Type** | A Charter attribute: `FPP`, `T&M`, `Capped T&M`, or `Internal`. | Charter |
| **Contractual Commitment** | An SLA / contractual obligation with a Frequency, Name, Formula, Target, and optional Penalty; actuals are recorded per Frequency and yield a `Met` / `Not Met` status. | Milestone Payment, Frequency |
| **Data Integrity checklist** | A per-project, per-period view of which data points across every module have or have not been updated, each judged against its own expected cadence. | Freshness source, Defaulter |
| **DE** | Delivery Excellence — both the team and the `DELIVERY_EXCELLENCE` role. Performs assessments and governance approval. | DE Assessment, DE Governance Approval |
| **DE Assessment** | A dated per-project record: DE-Assessed Health (4-state RAG), PCI score, Key Findings, and an Alert when the rating is not Green. History is retained. | Finding, Alert, PCI Score |
| **DE-Assessed Health** | The project health rating set by Delivery Excellence in the latest DE Assessment; flows read-only onto the Charter and into the overall project health. | Delivery-Declared Health, Overall Project Health |
| **DE Governance Approval** | The module-by-module governance review a project passes before it is `Approved`; DE Approves (→ `Approved`) or Returns (→ `Draft`). | Governance module, `de_review_status` |
| **`de_review_status`** | A sub-state on the project used only during governance approval: *(null)* → `In Review` → `Returned` \| `Approved`. Distinct from `project_status`. | `product-brain/06` |
| **Declaration** | A dated health record authored by the tier itself (Project, Account, or Geo), as opposed to a DE-authored **Assessment**. | Assessment, Health Declaration |
| **Defaulter** | A project (or tier) that has not submitted / updated a required data point for the current period. Surfaced by Data Integrity and defaulter tracking. | Data Integrity checklist |
| **Delivery-Declared Health** | The 6-category RAG self-assessment authored by the `PROJECT_MANAGER`. | DE-Assessed Health, Health category |
| **Delivery Manager (DM)** | A Charter attribute (a named person); not a distinct system role in the current eight-role model. | Role |
| **Engagement type** | The delivery model that selects a project's Measurement tab: Development, Support, Professional Staffing, Testing, Consulting, Cloud Maintenance, Cloud Migration. | Measurement, Project Type |
| **Evidence** | The exact supporting text and source location (page / sheet / paragraph) an AI suggestion cites. | AI suggestion |
| **Executive Update** | Structured CXO-facing content (Delivery / People / Financials / Operations sections; rich-text / image / table blocks) prepared by a `GEO_HEAD`. Draft only — no approval step. | — |
| **Finding (DE)** | A Key Finding in a DE Assessment: sequence #, Classification, description, severity, action taken, dates, and a lifecycle status. | Alert, DE Assessment |
| **Freshness source** | The table/column the Data Integrity service reads to answer "when was this data point last updated for this project in this period". | Data Integrity checklist |
| **Frequency** | A Contractual Commitment's recurrence: One Time / Weekly / Fortnight / Monthly / Quarterly / Half Yearly / Phase Wise. Drives when actuals are captured. | Contractual Commitment |
| **Geo** | Geography / region — the organisational tier between Account and CXO (e.g. APAC, MEA, US). A user is scoped to one or more Geos. | Region, Account, Scope |
| **Governance completeness** | A score computed for DE Governance Approval: each governance module is Complete / Incomplete, with an overall percentage over the mandatory subset and a gap count. | DE Governance Approval, Governance module |
| **Governance module** | One of the project areas DE reviews during approval (Status, RAIDO, Health, Measurement, Contractual). Each gets a `Not Reviewed` / `Reviewed` / `Gap Identified` verdict. | DE Governance Approval |
| **Head Count / FTE** | Computed resourcing figures on the Charter, derived from the Resource Allocation list. | Resource Allocation |
| **Health category** | One of the six shared categories a health declaration and a DE alert are classified by: Core Delivery, People, Operational, Customer, Financial, Compliance. | Delivery-Declared Health |
| **Health Declaration** | A dated record holding a RAG rating per health category for a period, at project, account, or geo level. History is retained, never overwritten. | Health Item, Declaration |
| **Health Item** | One line item of a Health Declaration — a single category's rating for a period — in the newer itemised register (`project_health_items` / `account_health_items`). The older single-rating-per-category model coexists during migration. | Health Declaration |
| **Key Metrics** | Numeric fields captured on a status report (e.g. Revenue, Onsite FTE, Offshore FTE, Projects Count) that are summed up the tier chain during rollup. | Rollup, Status Report |
| **Milestone Payment** | A defined payment milestone (Name, Description, Expected Date, Expected Value); an actual (Date, Value) yields a status of `Paid On Time` / `Delayed Payment` / `Yet To Be Paid`. Renamed from "Milestone" (`PendingPoints` #14). | Contractual Commitment |
| **My Summary** | A role's landing dashboard (`/dashboard/<role>`), showing role-scoped KPI tiles and drill-ins. Formerly "…Dashboard". | Project Health |
| **no-password mode** | The current default authentication mode (`AUTH_TYPE=no_password`): sign-in matches a free-text identifier to a user record with no password check. A prototype stopgap. | OneLogin, Session |
| **Nudge** | A soft prompt shown when a required companion record is missing (e.g. DE health not Green with zero alerts logged). | Alert |
| **OneLogin** | The corporate OIDC identity provider that will replace no-password mode (`AUTH_TYPE=onelogin`); strict pre-provisioned users only. | Session |
| **Open Only for Billing** | A terminal-ish `project_status` value for a project that is delivery-complete but still billing. | `project_status` |
| **Oracle Project ID** | The identifier linking a project to the BCT Oracle Application. At least one is required to unlock a project's right-hand module menu (`PendingPoints` #1). The linkage is stored; no live data syncs. | Charter, Integration |
| **Overall Project Health** | The project's effective health: the worst of the 6 Delivery-Declared category ratings, combined with the latest DE-Assessed Health. | Worst-wins rollup |
| **Patch** | Informal term for the set of Accounts/Geos a scoped user owns — the data "patch" they can see and act on. | Scope |
| **PCI Score** | Delivery Excellence's numeric project compliance / quality index, captured per DE Assessment. | DE Assessment |
| **PMO** | Project Management Office — both the function and the `PMO` role. Intended owner of Contractual Compliance, Milestone Payments, and the Data Integrity checklist. | Role |
| **Product Flag / Product** | A Charter attribute: whether the project delivers a product; if so, a Product is chosen from reference data (`PendingPoints` #7). | Charter |
| **`project_status`** | The project lifecycle field: `Draft` → `Pending Approval` → `Approved`; plus `Hold`, `Closed`, `Open Only for Billing`. | `de_review_status`, `product-brain/06` |
| **Project Health (portfolio)** | The read-only portfolio view at `/project-health/*` — 14 filterable grids (Project List, RAG, RAIDO, Metrics, Commitments, Payment Milestones, Assessments, Findings, Actions, Data Integrity, …) with Geo / Account / Project filters. | My Summary |
| **Project Type** | Reference data selecting a project's delivery model and Measurement tab; includes Consulting (added later). | Engagement type |
| **RAG / health rating** | A four-state rating, worst to best: `Red`, `Potential Red`, `Amber`, `Green`. Used for project, category, account, and geo health. | Worst-wins rollup, Health category |
| **RAID / RAIDO** | The five per-project registers: **R**isk, **A**ssumption, **I**ssue, **D**ependency — plus **O**pportunity. "RAIDO" is used when Opportunity is included. | — |
| **Region** | Reference data added after the Geo tier; not yet used in RBAC scoping. Distinct from Geo. | Geo |
| **Reporting period** | A `Weekly`, `Monthly`, or `Baseline` bucket that scopes period data. See `product-brain/14` for how "current period" is resolved. | Reporting week |
| **Reporting surface** | The screen where a tier (Project / Account / Geo) enters its own status and health. | Review surface |
| **Reporting week** | A `Weekly` reporting period, keyed to its Monday date. | Reporting period |
| **Resource Allocation** | The Charter's list of resources with FTE, from which Head Count and total FTE are computed. Sourced from the BCT Oracle Application by intent; not yet synced. | Head Count / FTE |
| **Review surface** | The read-only, one-level-up screen where the next tier reviews and Approves/Rejects what was reported below it: `ACCOUNT_MANAGER` reviews Projects, `GEO_HEAD` reviews Accounts, `CXO` reviews Geos. | Reporting surface |
| **Role** | One of the eight `RoleCode` values. A user has exactly one role plus an Account/Geo scope. | Scope, Work Context |
| **Rollup** | Promoting a lower tier's data upward: **Pull** (adopt an item into the parent register), **Ignore** (dismiss it), **Undo** (revert either decision). Health and Key Metrics also roll up (worst-wins / sum). | Worst-wins rollup, Key Metrics |
| **Scope** | The Accounts and/or Geos a user is assigned to; it bounds every reporting, review, and dashboard screen. `ADMIN` (and `CXO` at geo level) bypass scope checks. | Patch |
| **Send for Approval** | The PM action that moves a project from `Draft` to `Pending Approval` (all Project Profile fields must be present). Labelled "Send To Approval" in the UI. | Charter, DE Governance Approval |
| **Session** | Server-side identity: a signed JWT in the httpOnly `pg_session` cookie, verified by `get_current_user` on every non-auth request, alongside a shared static `X-API-Key`. | no-password mode, OneLogin |
| **Status Item** | One categorised line of a status report (Key Accomplishments / Upcoming / Leadership Support / Key Risks & Issues), each carrying a rollup status. | Status Report, Rollup |
| **Status Report** | A dated narrative report at Project, Account, or Geo level: `Draft` → `Submitted` → `Approved` \| `Rejected`. Projects report weekly. | Status Item, Review surface |
| **Top Highlights** | A dashboard panel showing the most recent status items across a scope. | My Summary |
| **Work Context ("act as")** | A higher role viewing the app as a lower role within its own scope: `ACCOUNT_MANAGER` → `PROJECT_MANAGER`; `GEO_HEAD` → `ACCOUNT_MANAGER` / `PROJECT_MANAGER`. Changes menu, list scoping, and landing route; the backend independently enforces the lower-role writes. | Scope, Role |
| **Worst-wins rollup** | The rule that a parent's rating equals the worst rating among its children — across the 6 categories to an overall project rating, and from a child tier to its parent (project → account → geo → enterprise). One `Red` child forces the parent to at least `Red`. | RAG, Rollup |
| **`X-API-Key`** | A single shared static key required on every API request as defence-in-depth, separate from the user session. | Session |

---

## 3. Abbreviations

| Abbrev. | Expansion |
| --- | --- |
| BCT | Bahwan CyberTek |
| BRS | Business Requirements Specification (`docs/Project-Governance-Tool-BRS.md`, superseded) |
| CPI | Cost Performance Index (a computed measurement metric) |
| DE | Delivery Excellence |
| DM | Delivery Manager (Charter attribute) |
| FTE | Full-Time Equivalent |
| MTTR | Mean Time To Resolve (a computed Support metric) |
| OIDC | OpenID Connect (the OneLogin protocol) |
| PCI | Project Compliance/quality Index (DE score) |
| PMO | Project Management Office |
| PM | Project Manager (`PROJECT_MANAGER`) |
| RAG | Red / Amber / Green (here a 4-state variant with Potential Red) |
| RAID / RAIDO | Risk, Assumption, Issue, Dependency (+ Opportunity) |
| SLA | Service Level Agreement |
| SPI | Schedule Performance Index (a computed measurement metric) |
| SR | Service Request (a Support-metrics input) |
| SSO | Single Sign-On |
| UAT | User Acceptance Testing |

---

## 4. Status-vocabulary index

The state names and transitions for every status-bearing entity are authoritative in
`product-brain/06_status_workflow_catalogue.md`. The concepts:

| Concept | States (summary) | Owner doc |
| --- | --- | --- |
| Project lifecycle (`project_status`) | Draft → Pending Approval → Approved; Hold, Closed, Open Only for Billing | `06` |
| DE governance (`de_review_status`) | *(null)* → In Review → Returned \| Approved | `06` |
| Status Report (Project / Account / Geo) | Draft → Submitted → Approved \| Rejected | `06` |
| DE Assessment | Draft → Submitted ("Not Started" = no row) | `06` |
| DE Module Review | Not Reviewed → Reviewed \| Gap Identified | `06` |
| Rollup item | Pending → Pulled \| Ignored (Undo reverts) | `06` |
| Action | OPEN → IN_PROGRESS → COMPLETED → CLOSED; or → CANCELLED | `06` |
| DE Finding | Open → In Progress → Awaiting Closure → Closed; or → Cancelled | `06` |
| AI field suggestion | pending → ignored \| resolved | `06` |
| AI row suggestion | pending → ignored \| applied | `06` |
| Document AI status | Not Processed → Processing → Processed \| Excluded | `06` |
| RAID lifecycles (per register) | e.g. Risk Open/Monitoring/Closed; Issue New/Assigned/In Progress/Pending/Resolved/Closed | `06` |
| Backup / Restore | In Progress → Completed \| Failed | `06` |
