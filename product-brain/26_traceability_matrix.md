# 26 — Traceability Matrix

**Document type:** Product-Brain Specification
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/02, product-brain/04, product-brain/05, product-brain/06, product-brain/07, product-brain/08, product-brain/13, product-brain/15, product-brain/17, product-brain/20, product-brain/25
**Feeds:** verification & sign-off; change-impact analysis

> **Purpose of this document.** One place that links each capability across every layer of
> the pack, end to end:
>
> **Business Process → Functional Capability → Business Rule → Status / Workflow → Screen →
> API → Service / Table → Test Scenario.**
>
> It uses the IDs defined in the other documents (`BP-*`, `FC-*`, `BR-*`, `06` transitions,
> `SCR-*`, `API-*`, `SVC-*`, `TS-*`). A change to any one artefact can be traced to
> everything it touches; a blank cell is a coverage defect. This matrix should ultimately be
> **generated** from the ID references, not hand-maintained.

---

## 1. How to read the matrix

| Column | Source | Example |
| --- | --- | --- |
| Business Process | `product-brain/02` | `BP-01` Project Onboarding & Governance Approval |
| Functional Capability | `product-brain/04` | `FC-PROJ-060` Send for Approval |
| Business Rule(s) | `product-brain/05` | `BR-PROJ-050`, `BR-PROJ-060` |
| Status / Workflow | `product-brain/06` | Project `Draft` → `Pending Approval` |
| Screen | `product-brain/08` | `SCR-PROJ-30` |
| API | `product-brain/17` | `API-PROJ-40` `PUT /projects/{id}` |
| Service / Table | `product-brain/13` / `11` | `SVC-CODE-GENERATOR` / `projects` |
| Test Scenario | `product-brain/25` | `TS-BR-PROJ-10`, `TS-WF-PROJ-10`, `TS-E2E-01` |

`+` in a cell = "also involves". Multiple rules / screens per row are common.

---

## 2. Master traceability table

### BP-01 — Project Onboarding & Governance Approval

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | FC-PROJ-010 Create project | BR-PROJ-010, BR-PROJ-020, BR-PROJ-030 | Project *(none)* → `Draft` | SCR-PROJ-20 | API-PROJ-20 `POST /projects` | `SVC-CODE-GENERATOR` / `projects`, `id_sequences` | TS-PROJ-10, TS-BR-PROJ-* |
| T-02 | FC-PROJ-020..050 Complete charter, Oracle ID, resources | BR-PROJ-040, BR-PROJ-090, BR-PROJ-100 | Project `Draft` (edit) | SCR-PROJ-30/40/50/60 ★§3.1 | API-PROJ-40/50/60 | `projects`, `project_oracle_ids`, `project_resources` | TS-PROJ-10, TS-BR-PROJ-* |
| T-03 | FC-PROJ-060 Send for Approval | BR-PROJ-050, BR-PROJ-060 | Project `Draft` → `Pending Approval` | SCR-PROJ-30 | API-PROJ-40 (`project_status`) | `projects` | TS-BR-PROJ-10, TS-WF-PROJ-10 |
| T-04 | FC-DEAL-010/020 Allocate DE | BR-DEAL-010 | *(sets `delivery_excellence_id`)* | SCR-DEAL-10 | API-DEAL-10/20 | `projects` | TS-DEA-* |
| T-05 | FC-DEAP-010..040 Governance review | BR-DEAL-020, BR-DEAP-020, BR-DEAP-040 | `de_review_status` *(null)* → `In Review` | SCR-DEAP-10/20 | API-DEAP-10/20/30 | `SVC-GOVERNANCE-COMPLETENESS` / `de_project_module_reviews` | TS-WF-DEAP-10, TS-DEAP-GM-10 |
| T-06 | FC-DEAP-050 Decision | BR-DEAP-010, BR-DEAP-030, BR-PROJ-070 | Project `Pending Approval` → (`Approved` \| `Draft`); `de_review_status` → (`Approved` \| `Returned`) | SCR-DEAP-20 | API-DEAP-40 `PATCH …/decision` | `projects` | TS-WF-PROJ-10, TS-E2E-01, TS-BR-PROJ-10 |

### BP-02 — Weekly Project Status Reporting

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-10 | FC-STATUS-010 Create report | BR-STATUS-010, BR-STATUS-040 | Report *(none)* → `Draft` | SCR-STATUS-20 | API-STATUS-20 | `project_status_reports` | TS-STATUS-10, TS-BR-* |
| T-11 | FC-STATUS-020/030 Key Metrics + items | BR-STATUS-050 | Item `account_rollup_status = Pending` | SCR-STATUS-20 ★§3.5 | API-STATUS-50 | `project_status_items` | TS-STATUS-10 |
| T-12 | FC-STATUS-040 Submit | BR-STATUS-020 | Report `Draft` → `Submitted` | SCR-STATUS-20 | API-STATUS-30 (`status`) | `project_status_reports` | TS-WF-STATUS-10, TS-E2E-02 |
| T-13 | FC-STATUS-060 History | — | — | SCR-STATUS-20 | API-STATUS-10 `/latest` | `project_status_reports` | TS-STATUS-10 |

### BP-03 — Monthly Project Review

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-20 | FC-MEAS-010..050 Measurement entry | BR-MEAS-010, BR-MEAS-020, BR-MEAS-050 | *(period record)* | SCR-MEAS-10 | API-MEAS-20/40 | `SVC-MEASUREMENT-METRICS` / `measurement_*` | TS-MEAS-GM-*, TS-MEAS-<TYPE>-* |
| T-21 | FC-TARGET-010 Targets | BR-TARGET-010 | — | SCR-MEAS-10 | API-TARGET-10/20 | `metric_target_*` | TS-MEAS-* |
| T-22 | FC-CONTRACT-020/040 Actuals | BR-CONTRACT-020, BR-CONTRACT-030 | derived `Met`/`Not Met`; Paid status | SCR-CONTRACT-10 | API-CONTRACT-20/40 | `contractual_commitment_actuals`, `milestone_payment_actuals` | TS-CONTRACT-* |
| T-23 | FC-RAID-010..050 Register review | BR-RAID-030, BR-RAID-040, BR-RAID-060 | per-register lifecycles (`06` §11–15) | SCR-RAID-10 ★§3.3 | API-RAID-10..50 | `risk_log`, `issue_log`, … | TS-RAID-*, TS-WF-* |

### BP-04 — Monthly Delivery Excellence Assessment

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-30 | FC-DEA-010/020 Create + rate | BR-DEA-010, BR-DEA-050 | DE Assessment *(none)* → `Draft` | SCR-DEA-30 ★§3.4 | API-DEA-20 | `de_assessments` | TS-DEA-* |
| T-31 | FC-DEA-030 Findings | BR-DEA-060 | Finding `Open` → … → `Closed`/`Cancelled` | SCR-DEA-10/30 | API-DEA-40 | `de_assessment_findings` | TS-WF-* , TS-DEA-* |
| T-32 | FC-DEA-040 Alert if not Green | BR-DEA-020, BR-DEA-030 | *(alert raised)* | SCR-DEA-10/30 | API-DEA-50 | `SVC-CODE-GENERATOR` / `de_assessment_alerts` | TS-BR-DEA-10 |
| T-33 | FC-DEA-050 Submit → Charter | BR-DEA-040 | DE Assessment `Draft` → `Submitted`; `projects.de_assessed_project_health` refreshed | SCR-DEA-30 | API-DEA-30 | `SVC-HEALTH-ROLLUP` (`compute_overall_project_health`) / `projects` | TS-ROLLUP-GM-10, TS-HEALTH-* |

### BP-05 — Reporting / Review Cascade (Project → Account → Geo → CXO)

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-40 | FC-REVIEW-010 Review project report | BR-STATUS-030, BR-REVIEW-010, BR-REVIEW-020 | Report `Submitted` → `Approved`\|`Rejected` | SCR-REVIEW-10 | API-STATUS-40 | `project_status_reports` | TS-BR-REVIEW-10, TS-WF-STATUS-10 |
| T-41 | FC-ROLLUP-010/020 Pull status item → account | BR-ROLLUP-010, BR-ROLLUP-020, BR-ROLLUP-050 | Item `Pending` → `Pulled`; account Key Metrics pre-filled | SCR-ACCT-20 | API-ACCT-50 | `SVC-ACCOUNT-ROLLUP` / `account_status_items` | TS-ROLLUP-GM-20/30, TS-BR-ROLLUP-10 |
| T-42 | FC-ACCT-010 Account report + Submit | BR-ACCT-010, BR-ACCT-020 | Account report `Draft` → `Submitted` | SCR-ACCT-20 ★§3.5 | API-ACCT-10 | `account_status_reports` | TS-STATUS-*, TS-E2E-05 |
| T-43 | FC-REVIEW-020 Geo Head reviews account | BR-REVIEW-010, BR-REVIEW-030 | Account report `Submitted` → decided | SCR-REVIEW-20 | API-ACCT-20 | `account_status_reports` | TS-RBAC-*, TS-E2E-05 |
| T-44 | FC-ROLLUP-040 Pull account item → geo | BR-ROLLUP-010, BR-ROLLUP-050 | Item `Pending` → `Pulled` | SCR-GEO-20 | API-GEO-50 | `SVC-GEO-ROLLUP` / `geo_status_items` | TS-ROLLUP-GM-20 |
| T-45 | FC-REVIEW-030 CXO reviews geo | BR-REVIEW-010, BR-REVIEW-040 | Geo report `Submitted` → decided (unscoped) | SCR-REVIEW-30 | API-GEO-20 | `geo_status_reports` | TS-RBAC-*, TS-E2E-05 |

### BP-06 — Health Declaration & Worst-Wins Rollup

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-50 | FC-HEALTH-010/020 Declare 6-category RAG | BR-HEALTH-030, BR-HEALTH-040 | *(dated row)* | SCR-PROJ-50 / SCR-HEALTH-10 ★§3.2 | API-HEALTH-20/30 | `health_declarations`, `project_health_items` | TS-HEALTH-*, TS-BR-HEALTH-10 |
| T-51 | FC-HEALTH-030 Worst-wins category → overall | BR-HEALTH-010 | *(computed `overall_rating`)* | SCR-PROJ-30 (Treatment/Health) | (write side of API-HEALTH-20) | `SVC-HEALTH-ROLLUP` (`compute_overall_rating`) | **TS-ROLLUP-GM-10** |
| T-52 | FC-HEALTH-040 Combine w/ DE-Assessed | BR-HEALTH-020 | `projects.overall_project_health` | SCR-PROJ-30 | (side effect of API-DEA-30 / API-HEALTH-20) | `SVC-HEALTH-ROLLUP` / `projects` (cached) | TS-ROLLUP-GM-10, GAD-413 |
| T-53 | FC-ROLLUP-030/050 Account/Geo health rollup | BR-ROLLUP-040 | Health item `Pending` → `Pulled` | SCR-ACCT-30 *(geo: gap GAD-206)* | API-ACCT-60 / API-GEO-40 | `SVC-ACCOUNT-HEALTH-ROLLUP` / `account_health_items` | TS-ROLLUP-GM-*, TS-E2E-06 |

### BP-07 — Executive Update Preparation

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-60 | FC-EXEC-010..050 Build & save | BR-EXEC-010, BR-EXEC-020, BR-EXEC-030 | *(saved `Draft`)* | SCR-EXEC-10 | API-EXEC-10 | `executive_updates` | TS-EXEC-*, TS-E2E-07 |
| T-61 | FC-EXEC-040 Paste image / Excel | BR-EXEC-020 | — | SCR-EXEC-10 | API-EXEC-20 (image) | local FS | TS-E2E-07 |

### BP-08 — Action Tracking

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-70 | FC-ACTION-020 Create | BR-ACTION-010 | Action *(none)* → `OPEN`; `ACT-*` | SCR-DASH-113 + panels | API-ACTION-20 | `SVC-CODE-GENERATOR` / `actions` | TS-ACTION-* |
| T-71 | FC-ACTION-040 Transitions | BR-ACTION-020, BR-ACTION-030, BR-ACTION-040, BR-ACTION-050 | `OPEN`→`IN_PROGRESS`→`COMPLETED`→`CLOSED`; →`CANCELLED` | SCR-DASH-113 | API-ACTION-40 | `actions`, `action_history` | **TS-WF-ACTION-10**, TS-E2E-08 |
| T-72 | FC-ACTION-030/050/060 Edit + comment + history | BR-ACTION-060 | *(history events)* | SCR-DASH-113 | API-ACTION-30/50 | `action_history` | TS-ACTION-* |

### BP-09 — Data Integrity & Defaulter Tracking

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-80 | FC-DI-010 Catalog | BR-REF-010 style | — | *(admin, no dedicated screen)* | API-DI-10 | `data_integrity_checklist_items` | TS-DI-* |
| T-81 | FC-DI-020 Freshness rollup | BR-DI-010, BR-DI-020 | computed `Updated`/`Not Updated` | SCR-DASH-114 | API-DI-20 | `SVC-DATA-INTEGRITY-ROLLUP` | **TS-DI-GM-10** (post GAD-312) |
| T-82 | FC-DI-030 Portfolio filter + drill-in | BR-DASH-020 | — | SCR-DASH-114 | API-DASH-30 (`/project-health/data-integrity`) | `SVC-DASHBOARD-AGGREGATION` | TS-DI-*, TS-DASH-* |

### BP-10 — AI-Assisted Data Entry

| # | FC | BR | Status transition | Screen | API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-90 | FC-AI-010 Upload + process | BR-AI-060 | Document `Not Processed`→`Processing`→`Processed` | SCR-AI-10 | API-AI-30 | `project_documents` / local FS | TS-AI-* |
| T-91 | FC-AI-020 Field suggestions | BR-AI-010, BR-AI-020, BR-AI-040 | Suggestion `pending`→`resolved`\|`ignored` | SCR-PROJ-30 / SCR-STATUS-20 | API-AI-10 | `ai_field_suggestions` | **TS-BR-AI-10**, TS-AI-*, TS-E2E-09 |
| T-92 | FC-AI-030 Row suggestions | BR-AI-030 | Suggestion `pending`→`applied`\|`ignored`; real row via normal create | SCR-RAID-10 | API-AI-20 + the register's `API-RAID-20` | `ai_row_suggestions` → `risk_log` etc. | TS-AI-*, TS-BR-AI-10 |

### Cross-cutting

| # | Concern | BR | Screen / API | Service / Table | Test |
| --- | --- | --- | --- | --- | --- |
| X-01 | Every request authenticated + keyed | BR-SEC-010, BR-SEC-020 | all `API-*` | `verify_api_key`, `get_current_user` | **TS-BR-SEC-10**, TS-SEC-* |
| X-02 | Role + scope on every write | BR-SEC-030..080 | all write `API-*` | `require_*` factories | **TS-RBAC-*** (`test_authorization.py`) |
| X-03 | Human-readable codes unique | BR-PROJ-020, BR-RAID-010, BR-DEA-030, BR-ACTION-010 | create endpoints | `SVC-CODE-GENERATOR` / `id_sequences` | TS-* (per area) + a concurrency test |
| X-04 | Dashboards scoped + live | BR-DASH-010, BR-DASH-020, BR-DASH-030 | `API-DASH-*` | `SVC-DASHBOARD-AGGREGATION` | TS-DASH-* |
| X-05 | Audit on write | BR-AUDIT-010, BR-AUDIT-020 | project-scoped writes | `touch_project_on_write` / `user_activity_log` | TS-AUDIT-* |
| X-06 | Reference data ADMIN-only | BR-REF-010/020, BR-USER-010, BR-INTG-010 | `API-REF-*`, `API-USER-*`, `API-INTG-*` | `build_crud_router` | TS-REF-*, TS-USER-* |

---

## 3. Coverage check

**Coverage rule (`product-brain/25` §14):** every `BR-*`, every `product-brain/06`
transition, every `SCR-*` action, every `API-*` endpoint, and every `NFR-*` must appear in
≥ 1 row above with a `TS-*`. A blank is a coverage defect.

### 3.1 By ID family

| Family | Defined in | In this matrix | Notes / gaps |
| --- | --- | --- | --- |
| `BP-01..10` | `02` | **10 / 10** | all have ≥ 1 row |
| `FC-<MOD>-*` | `04` | core capabilities of the 15 full modules covered | condensed-module `FC-*` (AUTH, REF, USER, TARGET, DEAL, DI, AI, INTG, AUDIT) covered via cross-cutting rows X-01..06 and BP-09/10 |
| `BR-<MOD>-*` | `05` | all `Blocking`/`High` referenced | **Advisory** rules (BR-PROJ-050/080/090, BR-DEA-020, BR-RAID-060, BR-HEALTH-050, BR-MEAS-040, BR-CONTRACT-050, BR-TARGET-020, BR-GEO-020, BR-REF-030, BR-INTG-020, BR-AUDIT-020) are referenced but their `TS-*` are `xfail` until enforced (GAD links in `05` §26) |
| `06` transitions | `06` | Project, `de_review_status`, all 3 reports, DE Assessment, DE Module Review, Rollup Item, Action, RAID×5, DE Finding, AI×3, Backup/Restore | **anchor** `TS-WF-*` per §5 of `25`; per-transition tests are the build-out task |
| `SCR-*` | `08` | the action-bearing screens (Charter, Status, RAID, Health, DE Assessment, DE Approval, Account/Geo reporting, Review, Executive Update, Action, Dashboards) | read-only `SCR-DASH-101..114` covered by TS-DASH-*; `SCR-AUTH-*` by TS-SEC-* |
| `API-*` | `17` | every domain has ≥ 1 row | per-endpoint × role × status matrix is `TS-RBAC-*` / `TS-WF-*` (defined by pattern, not enumerated here) |
| `SVC-*` | `13` | all 9 | `SVC-HEALTH-ROLLUP`, `SVC-*-ROLLUP`, `SVC-GOVERNANCE-COMPLETENESS`, `SVC-MEASUREMENT-METRICS`, `SVC-DATA-INTEGRITY-ROLLUP` have golden fixtures; `SVC-CODE-GENERATOR` via X-03; `SVC-DASHBOARD-AGGREGATION` via X-04 |
| `METRIC-*` | `15` | all 7 types | `TS-MEAS-<TYPE>-*` per metric (`25` §8) |
| `NFR-*` | `20` | mapped to verification activities, not BP rows | `NFR-PERF-*` → perf tests; `NFR-SEC-*` → `TS-SEC-*` + VAPT; `NFR-A11Y-10` → axe pass; `NFR-RET/RES-*` → schema + data-flow review; `NFR-AVAIL/BR-*` → ops drills — **none baselined** (`20`) |
| `GAD-*` | `23` | referenced inline where a row is affected (GAD-206, GAD-312, GAD-413) | the register is the backlog, not a coverage target |

### 3.2 Known coverage gaps (blanks to fill)

| Gap | Detail | Owner |
| --- | --- | --- |
| Per-transition workflow tests | `25` defines anchors; a test per `06` transition row must be written | Backend/QA |
| Per-`BR-*` tests | every rule needs its tagged test; Advisory rules need the `xfail`→pass flip | Backend/QA |
| Per-endpoint RBAC matrix | `TS-RBAC-*` defined by pattern; the full endpoint × 8-role × status grid must be generated | Backend/QA |
| Golden fixtures | not yet checked in for any service (`25` §7) | Backend |
| `SCR-*` field-level | field-level specs exist for 5 screens (`08` §3); the rest are section-level — field-level tests limited accordingly | QA |
| `NFR-*` | nothing baselined; perf/ops verification not yet run (`20` §4) | Backend + Ops |
| Geo RAG screen | `SCR` and its `TS` do not exist — `GAD-206` | Frontend |
| Contractual actuals UI | `T-22` `SCR-CONTRACT-10` covers definitions; actuals-entry screen missing — `GAD-205` | Frontend |
| Notifications | no `N-*` has a `TS-*` — no delivery mechanism (`GAD-213`) | Backend |

### 3.3 Change-impact usage

To assess the blast radius of a change, find its ID in a matrix row and read across:
changing `BR-ROLLUP-010`, for example, touches `FC-ROLLUP-010/020`, the Rollup Item
`Pending → Pulled` transition, `SCR-ACCT-20`, `API-ACCT-50`, `SVC-ACCOUNT-ROLLUP` /
`account_status_items`, and `TS-ROLLUP-GM-20/30` + `TS-BR-ROLLUP-10`.

---

## 4. Assumptions

| ID | Assumption |
| --- | --- |
| A-TM-001 | `ASSUMPTION:` This matrix is a **representative** hand-built cut, not exhaustive; the intent (`document-generation-plan.md`, sample README §6.7) is to **generate** it from the ID references so CI can fail on an untested `BR-*` or unmapped `API-*`. |
| A-TM-002 | `ASSUMPTION:` `TS-*` IDs referenced here follow `product-brain/25`'s scheme; the concrete test files are the build-out task. |
| A-TM-003 | `ASSUMPTION:` Condensed-module `FC-*` (`04`) are covered transitively via the cross-cutting rows; a full pass should give each its own row. |
| A-TM-004 | `ASSUMPTION:` `NFR-*` coverage is via verification *activities* (`25` §2 table), not `BP-*` rows — that is the correct shape, not a gap. |
