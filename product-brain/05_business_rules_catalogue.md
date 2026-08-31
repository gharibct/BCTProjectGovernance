# 05 — Business Rules Catalogue

**Document type:** Product-Brain Reference — **CRITICAL**
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/00, product-brain/01, product-brain/02, product-brain/04
**Feeds:** product-brain/06, product-brain/07, product-brain/08, product-brain/17, product-brain/25, product-brain/26

> **Purpose of this document.** The single authoritative register of enforceable business
> rules. Every rule has a stable `BR-<MOD>-<NNN>` ID that other documents reference instead
> of re-stating the rule. A rule here is a *testable constraint or automatic behaviour* —
> not a feature description. Where a rule is not yet enforced server-side but is design
> intent, it is listed with severity **Advisory** and a `GAD` note for `product-brain/23`.

---

## 1. How to Read This Catalogue

**Rule ID:** `BR-<MOD>-<NNN>` — module short code from `product-brain/01` §1, number in tens.

| Column | Meaning |
| --- | --- |
| Rule ID | Stable identifier, referenced pack-wide |
| Business Rule | The constraint / automatic behaviour, stated as testable |
| Trigger | The event that causes the rule to be evaluated |
| Condition | The predicate that must hold (or must not) |
| System Action | What the system does when the condition is / is not met |
| Enforcement | `UI` · `API` (FastAPI route logic) · `Service` (`app/services/*`) · `Pydantic-schema` (`app/schemas/*` incl. `StrEnum`) · `DB-trigger` · `External` · `Multiple` |
| Severity | `Blocking` (hard stop) · `High` (stop + escalate/notify) · `Medium` (stop, overridable) · `Low` (allowed, flagged) · `Advisory` (intended, not yet enforced) |

**Enforcement note.** ProjectGovernance has **no stored procedures and no DB CHECK
constraints**; value-set enforcement is entirely `Pydantic-schema`. Where a rule shows
`Multiple`, the definitive layer is named in the row. The frontend often re-checks a rule
for UX; the server re-check is authoritative.

**Configurable parameters** (reporting cadence, DE assessment frequency) are governed by
`product-brain/14`; unratified values are `ASSUMPTION` there.

---

## 2. Rule Count Summary

| Module | Rules | Module | Rules |
| --- | --- | --- | --- |
| Security / Access (SEC) | 9 | Rollup & Aggregation (ROLLUP) | 5 |
| Project Charter (PROJ) | 10 | Reporting / Review (REVIEW) | 5 |
| Project Status (STATUS) | 5 | Action Tracker (ACTION) | 6 |
| RAID(O) (RAID) | 6 | Executive Updates (EXEC) | 3 |
| Health Declarations (HEALTH) | 5 | Dashboards (DASH) | 3 |
| Measurement (MEAS) | 5 | AI Assist (AI) | 6 |
| Metric Targets (TARGET) | 2 | Reference / Master Data (REF) | 3 |
| Contractual (CONTRACT) | 5 | User & Role Admin (USER) | 3 |
| DE Assessment (DEA) | 6 | Data Integrity (DI) | 2 |
| DE Allocation (DEAL) | 2 | Integrations (INTG) | 2 |
| DE Governance Approval (DEAP) | 5 | Audit (AUDIT) | 2 |
| Account/Geo Reporting (ACCT/GEO) | 4 | **Total** | **~124 line-items across 84 rules** |

*(Count is the number of distinct `BR-*` IDs below.)*

---

## 3. Security / Access (SEC)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-SEC-010 | Every non-auth API request must carry a valid shared `X-API-Key`. | Any request under `/api/v1/*` except `/auth/*` | `X-API-Key` header equals the configured `API_KEY` | Reject with `401` if absent/wrong | API (`verify_api_key`, `main.py`) | Blocking |
| BR-SEC-020 | Every non-auth API request must present a valid session identifying an **active** user. | Any request under `/api/v1/*` except `/auth/*` | `pg_session` cookie decodes to a `User` with `is_active = true` | Reject with `401`; the client clears its session and redirects to `/login` | API (`get_current_user`) | Blocking |
| BR-SEC-030 | A user holds exactly one role; the role gates which endpoints they may call. | Any role-gated route | `role.code` ∈ the route's `allowed_roles` | `403` "Not authorized for this action." | API (`require_role` family) | Blocking |
| BR-SEC-040 | Account-scoped writes are limited to the caller's owned Accounts. | Write on an `/accounts/{account_id}/…` route | `account_id` ∈ `user_accounts` **or** its `geo_id` ∈ `user_geos` (for `require_account_or_geo_scope`) | `403` "You do not have access to this account." | API (`require_account_scope`, `require_account_or_geo_scope`) | Blocking |
| BR-SEC-050 | Geo-scoped writes are limited to the caller's owned Geos. | Write on a `/geos/{geo_id}/…` route | `geo_id` ∈ `user_geos` | `403` "You do not have access to this geo." | API (`require_geo_scope`) | Blocking |
| BR-SEC-060 | `ADMIN` bypasses all Account/Geo/Project scope checks. | Any scoped route | `role.code = ADMIN` | Scope predicate skipped; role check still applies | API (all `require_*_scope`) | High |
| BR-SEC-070 | `CXO` bypasses geo scope for Geo report review and Geo-level Actions only. | Geo review / GEO-level Action write | `role.code = CXO` and route passes `bypass_roles=(ADMIN, CXO)` | Scope predicate skipped | API (`_cxo_review`, `actions._geo_scope`) | High |
| BR-SEC-080 | Work Context ("act as") lets `ACCOUNT_MANAGER` / `GEO_HEAD` perform project-scoped writes only within their own patch. | Project-scoped write via `require_project_access` | `ACCOUNT_MANAGER`: project's `account_id` ∈ owned accounts; `GEO_HEAD`: project's (or its account's) `geo_id` ∈ owned geos; `PM`/`DE`/`ADMIN` unconditional | Allow / `403` | API (`require_project_access`) | Blocking |
| BR-SEC-090 | Under OneLogin, only pre-provisioned users may sign in; email (case-insensitive) is the join key. | `/auth/onelogin/callback` | A `User` row exists with the asserted `email` and `is_active` | Set session cookie / `403` — no auto-create | API (`auth.py`) | Blocking |

---

## 4. Project Charter (PROJ)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-PROJ-010 | A new project is created with `project_status = Draft` and a system-generated `project_code`. | `POST /projects` | always | `generate_code(db,"PROJECT")` → `PRJ-YYYY-NNNN`; status set to `Draft` | API (`projects.py`) | Blocking |
| BR-PROJ-020 | `project_code` is unique within the instance. | Project create | No existing project with that code | `id_sequences` row locked `FOR UPDATE`; sequential number issued | Service (`code_generator`) + DB | Blocking |
| BR-PROJ-030 | Project create/edit is restricted to `PROJECT_MANAGER` / `ACCOUNT_MANAGER` / `GEO_HEAD` / `ADMIN` (the latter two only within their patch). | `POST /projects`, `PUT /projects/{id}` | role + (for AM/GH) scope per BR-SEC-080 | `403` otherwise | API (`_pm_create`, `_pm_write`) | Blocking |
| BR-PROJ-040 | The Charter is editable only while `project_status = Draft`. | Edit attempt in the UI | `project.project_status = "Draft"` | UI shows the form editable; otherwise read-only with an "Edit Project" action that reverts to `Draft` | UI (`charter-form.tsx`) | Medium |
| BR-PROJ-050 | A project cannot be sent for approval until **every Project Profile field** is populated. | "Send To Approval" | all required Profile fields present | `PUT /projects/{id}` with `project_status: "Pending Approval"` proceeds; otherwise field errors | UI; **`ASSUMPTION:` server-side check to add** | High → Advisory (server) |
| BR-PROJ-060 | Sending for approval moves the project `Draft` → `Pending Approval`. | "Send To Approval" | `project_status = "Draft"` | status set to `Pending Approval`; project enters the DE approval queue | API | Blocking |
| BR-PROJ-070 | Only Delivery Excellence may move a project to `Approved` (via DE Governance Approval). | Approval decision | see BR-DEAP-030 | `project_status = Approved` | API (`de_approval.py`) | High |
| BR-PROJ-080 | After `Approved`, all Charter fields are immutable **except Project Type**. | Edit attempt on an `Approved` project | field ≠ Project Type | Block the change | **`ASSUMPTION:` not yet enforced server-side** | Advisory |
| BR-PROJ-090 | At least one **Oracle Project ID** must exist before the project's right-hand module menu unlocks. | Opening a module tab on the Charter | `count(project_oracle_ids) ≥ 1` | Menu enabled / disabled | UI (`PendingPoints` #1); **`ASSUMPTION:` server enforcement TBD** | High → Advisory |
| BR-PROJ-100 | Head Count and total FTE are derived from the Resource Allocation list and are read-only. | Add/edit/delete a resource | always | `.../resources/summary` recomputes | API/Service | Low |

---

## 5. Project Status Reporting (STATUS)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-STATUS-010 | A status report is created in `Draft` and edited only in `Draft`. | `POST` / `PUT /projects/{id}/status-reports` | report `status = Draft` for edits | Update proceeds / rejected | API (`project_status.py`) | High |
| BR-STATUS-020 | Submitting a report moves it `Draft` → `Submitted`. | Submit action | `status = Draft` | `status = Submitted`; the report appears on the Account Review surface | API | Blocking |
| BR-STATUS-030 | Only a `Submitted` report can be reviewed. | `PATCH .../status-reports/{rid}/review` | `report.status = Submitted` | Apply decision / `400` "Only Submitted reports can be reviewed" | API | Blocking |
| BR-STATUS-040 | `ASSUMPTION:` one status report per project per reporting period. | Create for a week already reported | no existing report for that period | Reject or return the existing one | **`ASSUMPTION:` enforcement to confirm** | Advisory |
| BR-STATUS-050 | Every status item carries an `account_rollup_status` of `Pending`, `Pulled`, or `Ignored`. | Item create / rollup action | value ∈ `RollupStatus` | Default `Pending`; changed only via rollup (BR-ROLLUP-*) or `PATCH .../rollup-status` | Pydantic-schema + API | Medium |

---

## 6. RAID(O) Registers (RAID)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-RAID-010 | Each RAID(O) entry gets a system-generated code (`RSK-`, `ISS-`, `DEP-`, `ASM-`, `OPP-` + `YYYY-NNNN`). | Create in any register | always | `code_generator` issues a locked sequential code | Service | Blocking |
| BR-RAID-020 | RAID(O) create/edit/delete is restricted to `PROJECT_MANAGER` (+ AM/GH in patch, + `ADMIN`). | Write on `/projects/{id}/{register}` | `require_project_access` roles | `403` otherwise | API (`_pm_write`) | Blocking |
| BR-RAID-030 | Risk Score = Probability × Impact; Severity is derived. | Risk create/update | Probability and Impact set | Compute and store the derived fields (read-only to the user) | Service/API | Low |
| BR-RAID-040 | Status, Category, Owner are enumerated value sets. | Any RAID(O) write | value ∈ the register's `StrEnum` | `422` otherwise | Pydantic-schema | Blocking |
| BR-RAID-050 | The RAID(O) registers are **not mandatory** for project approval; they are reviewed monthly. | DE Governance Approval; monthly review | — | RAIDO completeness informs but does not block DE approval (`PendingPoints` #15) | API (`governance_completeness`) | Low |
| BR-RAID-060 | Only Risk carries `Last Review Date` / `Next Review Date` today; extending them to Issue / Dependency / Opportunity is an open decision (Assumption uses `Validation Date`). | Monthly review | — | — | **`ASSUMPTION:` — `GAD`** | Advisory |

---

## 7. Health Declarations (HEALTH)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-HEALTH-010 | Overall project health = the **worst** of the 6 category ratings (order `Red > Potential Red > Amber > Green`). | Health declaration save | ratings supplied | `compute_overall_rating()` returns the first severity present; stored as `overall_rating` | Service (`health_rollup.py`) | High |
| BR-HEALTH-020 | Effective Overall Project Health = worst of {Delivery-Declared overall, latest DE-Assessed}. `None` only if both are absent. | Declaration save or DE Assessment submit | at least one input present | `compute_overall_project_health()`; cached on `projects` | Service | High |
| BR-HEALTH-030 | A health rating must be one of `Red`, `Potential Red`, `Amber`, `Green`. | Any health write | value ∈ `HealthRating` | `422` otherwise | Pydantic-schema | Blocking |
| BR-HEALTH-040 | Every health declaration is a dated, retained record — never overwritten. | New declaration for a period | — | Insert a new row; prior rows kept for trend/audit | API/Service | High |
| BR-HEALTH-050 | The itemised register (`project_health_items`) and the legacy single-rating-per-category model both feed the rollup during migration. | Rollup computation | either model has data | Both are read; neither is authoritative over the other yet | Service; **`ASSUMPTION:` — `GAD`** | Advisory |

---

## 8. Measurement / Delivery Metrics (MEAS)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-MEAS-010 | Computed metrics are derived at write time and are never directly editable. | Measurement create/update | always | `services/measurement_metrics.py` recomputes; UI renders them read-only and visually distinct | Service + UI | Medium |
| BR-MEAS-020 | A computed metric with no supporting raw input is left `None` (not `0`). | Metric derivation | required inputs absent | Metric stored as `None`; dashboards show "Not Reported" | Service | Low |
| BR-MEAS-030 | The Measurement tab shown is determined by the project's Project Type (one of the 7 engagement types). | Open Measurement | Project Type set | Route to `/measurements/{type}` | UI/API | Blocking |
| BR-MEAS-040 | `ASSUMPTION:` one measurement record per project per reporting period, with prior periods retained. | Create for an already-reported period | no existing record | Reject or supersede | **`ASSUMPTION:` — `GAD`** | Advisory |
| BR-MEAS-050 | Numeric inputs are range-validated (percentages 0–100; counts ≥ 0). | Any measurement write | value in range | `422` otherwise | Pydantic-schema | Blocking |

---

## 9. Metric Targets (TARGET)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-TARGET-010 | A project has at most one target set per engagement type (upsert semantics). | `PUT /projects/{id}/metric-targets/{type}` | — | Insert or update the single row | API | Low |
| BR-TARGET-020 | Targets drive variance / "Meeting Target %" on dashboards; baseline formulas are QA-provided and may be absent. | Dashboard metric computation | target present | Compute variance; if absent, show "No target" | Service; **`ASSUMPTION:` — `GAD` (formulas pending QA)** | Advisory |

---

## 10. Contractual Compliance (CONTRACT)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-CONTRACT-010 | A commitment's actuals are captured on its own `Frequency` (One Time / Weekly / Fortnight / Monthly / Quarterly / Half Yearly / Phase Wise). | Record commitment actual | Frequency set on the commitment | Actual row keyed to the period implied by Frequency | API/Pydantic-schema | Medium |
| BR-CONTRACT-020 | A commitment actual yields a computed `Met` / `Not Met` status against Target. | Actual saved | actual vs. Target | `met_status` derived | API/Service | Low |
| BR-CONTRACT-030 | A milestone actual yields `Paid On Time` / `Delayed Payment` / `Yet To Be Paid` from Actual Date vs. Expected Date. | Milestone actual saved / due date passes | dates present | Status derived; "Yet To Be Paid" until an Actual Date exists | API/Service | Low |
| BR-CONTRACT-040 | Penalty Value applies only when `Penalty Applicable = Y`. | Commitment definition / breach evaluation | flag = Y | Penalty considered; otherwise ignored | Pydantic-schema/Service | Low |
| BR-CONTRACT-050 | With no actuals-entry path on some flows, dashboards report the commitment/milestone as "Not Recorded" rather than Met/Not-Met. | Dashboard render | no actual exists | Show "Not Recorded" | UI/Service; **`ASSUMPTION:` known gap — `GAD`** | Advisory |

---

## 11. Delivery Excellence Assessment (DEA)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-DEA-010 | DE Assessment write is allowed to `PROJECT_MANAGER`, `DELIVERY_EXCELLENCE`, `ACCOUNT_MANAGER`, `GEO_HEAD` (in patch), `ADMIN`. | Any `.../de-assessments*` write | `require_project_access` roles incl. `DELIVERY_EXCELLENCE` | `403` otherwise | API (`_write_roles`) | Blocking |
| BR-DEA-020 | An Alert is required when DE-Assessed Health ≠ `Green`. | Assessment save with rating ≠ Green and zero alerts | at least one Alert logged | Nudge the user / block submit | API/UI; **`ASSUMPTION:` mandatory-block TBD** | High → Advisory |
| BR-DEA-030 | Each Alert gets a unique `ALT-YYYY-NNNN` code. | Alert create | always | `code_generator` issues a locked code | Service | Blocking |
| BR-DEA-040 | A project retains full assessment history; the latest assessment's rating is pushed read-only to the Charter and into overall health. | Assessment submit | — | `_finalize_assessment` writes the cached rating on `projects` | API/Service | High |
| BR-DEA-050 | DE Assessment status is `Draft` or `Submitted`; "Not Started" is the absence of any row, never stored. | Assessment lifecycle | — | Create default differs by path (`ASSUMPTION`) | Pydantic-schema | Medium |
| BR-DEA-060 | PCI Score and DE-Assessed Health are captured per assessment; findings carry their own lifecycle. | Assessment / finding save | value types valid | Store; findings `Open → In Progress → Awaiting Closure → Closed` (or `Cancelled`) | Pydantic-schema | Low |

---

## 12. DE Allocation (DEAL)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-DEAL-010 | Only `DELIVERY_EXCELLENCE` / `ADMIN` may allocate DE assessors. | `GET/PATCH /de-allocation*` | `role.code` ∈ {DE, ADMIN} | `403` otherwise | API (`_de`) | Blocking |
| BR-DEAL-020 | DE Governance Approval and DE Assessment writes require the caller to be the project's **allocated** DE (`projects.delivery_excellence_id`), unless `ADMIN`. | `de-approval` scoped writes | `project.delivery_excellence_id = current_user.id` or `ADMIN` | `403` otherwise | API (`require_project_de_scope`) | Blocking |

---

## 13. DE Governance Approval (DEAP)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-DEAP-010 | A project can only be governance-reviewed while `project_status = Pending Approval`. | `PATCH /de-approval/{id}/decision` | `project_status = "Pending Approval"` | Proceed / `400` "Only a project Pending Approval can be reviewed" | API | Blocking |
| BR-DEAP-020 | The first per-module verdict on a `Pending Approval` project moves `de_review_status` *(null)* → `In Review`. | `PUT /de-approval/{id}/modules/{key}` | `de_review_status is None` and `project_status = Pending Approval` | Set `In Review` | API | Medium |
| BR-DEAP-030 | Decision `Approve` sets `project_status = Approved` and `de_review_status = Approved`; `Return` sets `Draft` and `Returned`. | Decision submitted | valid decision value | Apply both status changes; record `de_reviewed_by` / `de_reviewed_at` / `de_review_remarks` | API | Blocking |
| BR-DEAP-040 | Governance completeness is computed as each module Complete/Incomplete, an overall % over the mandatory subset, and a gap count. | Queue / review-detail render | — | `compute_governance_completeness(db, project)` | Service | Low |
| BR-DEAP-050 | Each governance module gets a verdict of `Not Reviewed` / `Reviewed` / `Gap Identified`. | Per-module review | value ∈ `DeModuleReviewAction` | Upsert the `DeProjectModuleReview` row | Pydantic-schema/API | Low |

---

## 14. Account & Geo Reporting (ACCT / GEO)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-ACCT-010 | Account status/health writes are limited to an `ACCOUNT_MANAGER` who owns the account (or a `GEO_HEAD` whose geo contains it, or `ADMIN`). | `/accounts/{id}/status-reports*`, `/health-declarations*` | `require_account_or_geo_scope` | `403` otherwise | API (`_account_manager_write`) | Blocking |
| BR-ACCT-020 | Account and Geo status reports follow the same `Draft → Submitted → Approved` / `Rejected` lifecycle as project reports. | Any tier report action | — | Same transition guards as BR-STATUS-020/030 | API | Blocking |
| BR-GEO-010 | Geo status/health writes require `GEO_HEAD` ownership of the geo (or `ADMIN`). | `/geos/{id}/status-reports*`, `/health-declarations*` | `require_geo_scope` | `403` otherwise | API (`_geo_head_write`) | Blocking |
| BR-GEO-020 | Geo health-declaration endpoints exist but have **no UI**; geo-level health must be entered via the API until the screen is built. | Geo RAG entry | — | — | **`ASSUMPTION:` known gap — `GAD`** | Advisory |

---

## 15. Rollup & Aggregation (ROLLUP)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-ROLLUP-010 | An item can be **Pulled** only from `Pending`. | `POST /accounts/{id}/rollup` pull | `item.account_rollup_status = Pending` | Set `Pulled` + create the parent item / `RollupItemAlreadyHandledError` | Service (`account_rollup.pull_rollup_item`) | Blocking |
| BR-ROLLUP-020 | An item must belong to one of the parent's children to be pulled. | pull | item's project ∈ account's projects (or account ∈ geo's accounts) | proceed / `RollupItemNotFoundError` | Service | Blocking |
| BR-ROLLUP-030 | **Ignore** and **Undo** are the reverse operations: `Pending` → `Ignored`, and `Pulled`/`Ignored` → `Pending`. | ignore / undo action | current status permits it | Update `account_rollup_status`; remove the parent copy on Undo of a Pull | Service | Medium |
| BR-ROLLUP-040 | Health rolls up worst-wins at every hop (project category → project overall → account → geo → enterprise). | Any health rollup computation | — | `compute_overall_rating()` applied at each level | Service (`health_rollup`) | High |
| BR-ROLLUP-050 | Account/Geo Key Metrics are the period-scoped **sum** of the children's Key Metrics. | Rollup computation | period supplied | `_sum()` over child status-report Key Metrics; pre-fills the parent report | Service (`account_rollup`, `geo_rollup`) | Medium |

---

## 16. Reporting / Review Cascade (REVIEW)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-REVIEW-010 | Review happens exactly one tier up: `ACCOUNT_MANAGER` reviews Projects, `GEO_HEAD` reviews Accounts, `CXO` reviews Geos. | `PATCH .../review` | route's review dependency matches the tier | `403` otherwise | API (`_account_manager_review`, `_geo_head_review`, `_cxo_review`) | Blocking |
| BR-REVIEW-020 | A project's own `PROJECT_MANAGER` cannot review that project's report (segregation of duties). | Project review | reviewer role ∈ {AM, GH, ADMIN}, not PM | `403` | API (`_account_manager_review` excludes PM) | High |
| BR-REVIEW-030 | Account review requires the reviewer's owned geo to contain the account. | `PATCH /accounts/{id}/status-reports/{rid}/review` | `account.geo_id` ∈ `user_geos` or `ADMIN` | `403` otherwise | API (`require_account_geo_scope`) | Blocking |
| BR-REVIEW-040 | Geo review is not ownership-scoped — any `CXO` (or `ADMIN`) may review any geo's report. | `PATCH /geos/{id}/status-reports/{rid}/review` | `role.code` ∈ {CXO, ADMIN} | Proceed | API (`_cxo_review`) | Medium |
| BR-REVIEW-050 | A review decision records `decision` (`Approved`/`Rejected`), a comment, `reviewed_by`, and a server-set `reviewed_at`. | Review submitted | report is `Submitted` | Set the fields; a `Rejected` report returns to the author (`ASSUMPTION`) | API | Medium |

---

## 17. Action Tracker (ACTION)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-ACTION-010 | Action create/edit permission depends on the level: PROJECT → PM/AM/ADMIN; ACCOUNT → AM/GH/ADMIN (in patch); GEO → GH/CXO/ADMIN. | Action `POST`/`PUT` | level-appropriate role (+ scope for ACCOUNT/GEO) | `403` otherwise | API (`_project_role`, `_account_or_geo_scope`, `_geo_scope`) | Blocking |
| BR-ACTION-020 | The **assignee** may always transition their own action regardless of role or level. | `PATCH .../start\|complete\|close\|cancel` | `action.action_by_id = current_user.id` | Transition allowed | API | High |
| BR-ACTION-030 | Lifecycle order: `OPEN → IN_PROGRESS → COMPLETED → CLOSED`. | transition call | current status is the predecessor | Advance / reject | API | Blocking |
| BR-ACTION-040 | `CLOSED` is reachable only from `COMPLETED` (a separate sign-off step). | `PATCH .../close` | `status = COMPLETED` | `CLOSED` / reject | API | Blocking |
| BR-ACTION-050 | `CANCELLED` is reachable only from `OPEN` or `IN_PROGRESS`. | `PATCH .../cancel` | `status` ∈ {`OPEN`,`IN_PROGRESS`} | `CANCELLED` / reject | API | Blocking |
| BR-ACTION-060 | Every editable change and comment writes an `action_history` event (`CREATED`, `COMMENT`, `STATUS_CHANGE`, `OWNER_CHANGE`, `DUE_DATE_CHANGE`, `PRIORITY_CHANGE`). | Any action mutation | — | Append a history row with old/new values | API | Low |

---

## 18. Executive Updates (EXEC)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-EXEC-010 | Only a `GEO_HEAD` who owns the geo (or `ADMIN`) may create/edit an Executive Update. | `/geos/{id}/executive-updates` write | `require_geo_scope` | `403` otherwise | API (`_geo_head_write`) | Blocking |
| BR-EXEC-020 | An Executive Update is stored as **structured JSON** (sections + typed blocks with stable IDs), not one HTML blob. | Save | block `type` ∈ {`rich_text`,`image`,`table`} | Persist the structure | Pydantic-schema/API | Medium |
| BR-EXEC-030 | There is no approval step — Save Draft is the only state. | Save | — | Update in place; visible to `CXO` | API | Low |

---

## 19. Dashboards (DASH)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-DASH-010 | Dashboard output is filtered to the caller's Account/Geo scope. | Any `/dashboard/*` read | user's scope | Query restricted; empty scope → empty dashboard (not an error) | Service | High |
| BR-DASH-020 | The Project Health portfolio grids are restricted to `PMO` / `ADMIN` / `CXO`. | `/dashboard/project-health/*` | `role.code` ∈ {PMO, ADMIN, CXO} | `403` otherwise | API (`_project_health_role`) | Blocking |
| BR-DASH-030 | Dashboard figures are computed live from current module data, never a separately stored aggregate. | Dashboard render | — | Recompute on each request | Service | Medium |

---

## 20. AI Assist & Documents (AI)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-AI-010 | The AI never writes to business tables. AI output is stored only as suggestions for user review. | Suggestion ingest | — | Persist to `ai_field_suggestions` / `ai_row_suggestions` only | API (`ai_suggestions.py`) | Blocking |
| BR-AI-020 | A field suggestion is `pending` until the user **Ignores** it or **resolves** it implicitly by saving/editing/creating on its screen. | Save / edit / create / ignore | — | `pending → resolved` (on save/edit/create) or `pending → ignored` | API | Medium |
| BR-AI-030 | Applying a **row** suggestion creates the real RAID(O) row via that entity's normal create endpoint, then marks the suggestion `applied`. | `POST /ai-row-suggestions/{id}/apply` | suggestion `pending` | Create via the standard path; `pending → applied` | API | Medium |
| BR-AI-040 | Editing an AI-populated value removes its AI indicator; it becomes ordinary manual data. | User edits an AI field | — | Strip the indicator client-side | UI | Low |
| BR-AI-050 | The AI action button is available only when AI data exists for that screen. | Screen render | ≥ 1 suggestion for screen + period | Enable / disable the button (`PendingPoints` #2) | UI | Low |
| BR-AI-060 | Document AI status follows `Not Processed → Processing → Processed` (or `Excluded`). | Upload / process | — | Set `ai_status`; `Processed` once suggestions are stored | API/Pydantic-schema | Low |

---

## 21. Reference / Master Data (REF)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-REF-010 | Only `ADMIN` may create/edit reference data (Organizations, Geos, Regions, Project Types, Products, Accounts, Reporting Periods). | Any reference-data write | `role.code = ADMIN` | `403` otherwise | API (`_admin_write`) | Blocking |
| BR-REF-020 | Every authenticated role may read reference data (dropdowns, filters). | Any reference-data `GET` | valid session | Return the list | API | Low |
| BR-REF-030 | `ASSUMPTION:` a reference record in use cannot be hard-deleted (deactivate instead). | Delete attempt | referenced by ≥ 1 record | Block hard delete | **`ASSUMPTION:` to confirm — `GAD`** | Advisory |

---

## 22. User & Role Administration (USER)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-USER-010 | All user/role/scope administration is `ADMIN`-only, including user reads. | Any `/users*` or `/roles` call | `role.code = ADMIN` | `403` otherwise | API (`_admin_only`) | Blocking |
| BR-USER-020 | A user has exactly one role plus zero or more Account and Geo scope assignments. | User create/edit | one `role_id`; `user_accounts` / `user_geos` optional | Persist role + join rows | API/Pydantic-schema | Blocking |
| BR-USER-030 | Deactivating a user (`is_active = false`) invalidates their session on the next request. | Next API call after deactivation | `user.is_active = false` | `401` | API (`get_current_user`) | High |

---

## 23. Data Integrity (DI)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-DI-010 | Each checklist row is evaluated against **its own** expected cadence (weekly Status vs. monthly RAID vs. monthly/quarterly DE), not one blanket assumption. | Data Integrity render | item has a cadence + a mapped freshness source | `data_integrity_rollup` compares last-updated to the item's cadence | Service | Medium |
| BR-DI-020 | A checklist item with no mapped freshness source is shown as indeterminate, not `Not Updated`. | render | `module_name` not in the source map | Show indeterminate | Service | Low |

---

## 24. Integrations & Backup (INTG)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-INTG-010 | Integration and backup/restore administration is `ADMIN`-only. | `/integrations*`, `/backup-restore-log`, backup trigger | `role.code = ADMIN` | `403` otherwise | API (`_admin_only`) | Blocking |
| BR-INTG-020 | No integration syncs live data today; connection records carry status only. | Any integration action | — | Registry read/write only; no external call effected | API; **`ASSUMPTION:` — `GAD`** | Advisory |

---

## 25. Audit (AUDIT)

| Rule ID | Business Rule | Trigger | Condition | System Action | Enforcement | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| BR-AUDIT-010 | A successful write to a project-scoped route records project activity (`touch_project_on_write`). | Any project-scoped write | route matched, no error | Update the project's activity marker | API (`touch_project_on_write`) | Low |
| BR-AUDIT-020 | `ASSUMPTION:` approvals, rejections, and health-rating changes are attributable to a user and timestamp; full audit-log coverage across modules is unconfirmed (BRS FR-AUTH-4). | Any consequential action | — | Write an activity-log entry | **`ASSUMPTION:` coverage — `GAD`** | Advisory |

---

## 26. Cross-references & open items

- Rules with a **workflow effect** (BR-PROJ-060/070, BR-STATUS-020/030, BR-DEAP-010/030,
  BR-ACTION-030/040/050) are cited from and to `product-brain/06`.
- **Advisory** rules (design intent not yet enforced server-side) — BR-PROJ-050/080/090,
  BR-DEA-020, BR-RAID-060, BR-HEALTH-050, BR-MEAS-040, BR-CONTRACT-050, BR-TARGET-020,
  BR-GEO-020, BR-REF-030, BR-INTG-020, BR-AUDIT-020 — each becomes a `GAD` line in
  `product-brain/23`.

## Assumptions

| ID | Assumption |
| --- | --- |
| A-BR-001 | `ASSUMPTION:` `BR-*` IDs are defined here for the first time and are authoritative; `04`/`06`/`08`/`17` forward references must be reconciled to these. |
| A-BR-002 | `ASSUMPTION:` Several enforcement claims marked Advisory are inferred from UI code / BRS intent and were **not** found in server logic; a code audit is needed (`product-brain/25` covers the tests). |
| A-BR-003 | `ASSUMPTION:` "One record per project per period" for Status and Measurement is stated in the UX requirements but not verified in a uniqueness constraint (there are no DB CHECK/UNIQUE constraints on period). |
| A-BR-004 | `ASSUMPTION:` `DELIVERY_EXCELLENCE` is now inside the DE Assessment write gate (`_write_roles`) but **not** the generic project-scoped `_pm_write` gate; `PMO` and `TEAM_MEMBER` are in no write gate at all. |
