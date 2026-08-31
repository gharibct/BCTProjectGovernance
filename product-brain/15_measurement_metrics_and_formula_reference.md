# 15 — Measurement Metrics & Formula Reference

**Document type:** Product-Brain Specification
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/01, product-brain/04, product-brain/06, product-brain/13, product-brain/14
**Feeds:** product-brain/17, product-brain/23, product-brain/25, product-brain/26

> **Purpose of this document.** For each of the seven engagement types, what a
> `PROJECT_MANAGER` **enters** vs. what the system **computes**, with the exact formula, the
> unit, the baseline status, and where the target comes from. Formulas are transcribed from
> `backend/app/services/measurement_metrics.py` (`SVC-MEASUREMENT-METRICS`,
> `product-brain/13` A8). Where a doc-listed metric is permanently `None` because no raw
> input feeds it, that is stated. `METRIC-*` IDs are defined here.

---

## 1. Conventions

- **Metric ID:** `METRIC-<TYPE>-<NN>` — `TYPE` ∈ `DEV`, `SUP`, `STF`, `TST`, `CON`, `CLM`,
  `CMG`. Numbered in tens.
- **Entered vs Computed.** *Entered* = a `PROJECT_MANAGER` input on the Measurement form
  for the period. *Computed* = derived by `SVC-MEASUREMENT-METRICS` at write time,
  read-only, visually distinct (BR-MEAS-010).
- **`_safe_div(num, den, *, pct)`** returns `None` if `den` is `None` or `0`; multiplies by
  `100` when `pct=True`. **`_pct_variation(planned, actual)`** = `(actual − planned) /
  planned × 100`, `None` if either is `None` or `planned = 0`. A computed metric is stored
  as `None` (not `0`) when its inputs are missing (BR-MEAS-020).
- **Baseline.** `PendingPoints` #11: *"Baseline and Formula to be added in measurement
  section (QA to provide)"*. **No metric has a ratified baseline** — every baseline below is
  `QA — pending` (`GAD`, `product-brain/23`). #27: *"Measurement calculation to be
  implemented"* — some formulas below are proxies (noted).
- **Target.** Per-type targets live in `metric_target_<type>` (`MOD-TARGET`); dashboards
  compute variance / "Meeting Target %" against them (`RPT-MET-10`).
- **Cadence.** Monthly snapshot per reporting period (⚠ proposed for all types — see
  `product-brain/14` §4).

---

## 2. Development (`METRIC-DEV-*`)

**Table:** `measurement_development` (+ child `measurement_development_defects`).
**Source:** BRS FR-MEAS-2; `docs/ux-requirements.md` §4.10 "Development Projects".

### Entered inputs

| Field | Unit |
| --- | --- |
| Overall Planned Size / `actual_size` (end of project) | size units (FP / SLOC / story pts) |
| Overall Estimated Effort; `planned_effort_as_on_date`; `actual_effort_as_on_date` | person-hours/days |
| `planned_pct_completion`; `actual_pct_completion` | % |
| Total Test Cases Designed; `executed_test_cases`; `passed_test_cases` | count |
| UAT Defects (External); Production Defects (External) | count |
| Per SDLC stage (`SdlcStage`: URD, Proto, SRS, ADD, HLD, USP/LLD, Code, UTC, SITC, UT, SIT) — internal & external defect counts *(child table)* | count |
| Last Updated Date | date |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-DEV-10 | Productivity | `actual_size / actual_effort_as_on_date` | size / effort | QA — pending | `metric_target_development` |
| METRIC-DEV-20 | Effort Variation % | `(actual_effort_as_on_date − planned_effort_as_on_date) / planned_effort_as_on_date × 100` | % | QA — pending | as above |
| METRIC-DEV-30 | Schedule Performance Index (SPI) | `actual_pct_completion / planned_pct_completion` — **proxy** (a true SPI needs earned-value data not modelled) | ratio | QA — pending | as above |
| METRIC-DEV-40 | Cost Performance Index (CPI) | **`None`** — no cost baseline is modelled for Development | — | — | — |
| METRIC-DEV-50 | Defect Leakage % | `total_external / (total_internal + total_external) × 100` (`compute_defect_leakage_pct`); `None` if total = 0 | % | QA — pending | as above |
| METRIC-DEV-60 | Code Coverage % | **`None`** — no coverage-tool feed is modelled | — | — | — |
| METRIC-DEV-70 | Test Execution Coverage % | `executed_test_cases / total_test_cases_designed × 100` | % | QA — pending | as above |
| METRIC-DEV-80 | Test Pass Rate % | `passed_test_cases / executed_test_cases × 100` | % | QA — pending | as above |

**Notes.** BRS also lists "Schedule Performance Index" and "Cost Performance Index" as
required; CPI and Code Coverage are structurally unavailable (`None`) until a cost baseline
and a coverage feed are added (`GAD`). Defect Leakage is reported internal-vs-external.

---

## 3. Support (`METRIC-SUP-*`)

**Table:** `measurement_support`. **Source:** BRS FR-MEAS-3; `ux` §4.10 "Support".

### Entered inputs

| Field | Unit |
| --- | --- |
| `incidents_p1_count` / `p2` / `p3` (count) and `incidents_p1_person_days` / `p2` / `p3` | count; person-days |
| Service Requests; User Clarifications | count |
| `# Tickets Re-opened`; `# Aging Tickets`; `# First-Time Resolutions` | count |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-SUP-10 | Incident SLA Compliance % (P1) | **`None`** — needs a per-priority SLA target threshold, not modelled | — | — | `metric_target_support` |
| METRIC-SUP-20 | Incident SLA Compliance % (P2) | **`None`** — as above | — | — | as above |
| METRIC-SUP-30 | Incident SLA Compliance % (P3) | **`None`** — as above | — | — | as above |
| METRIC-SUP-40 | Incident MTTR | `(Σ person_days(P1..P3) × 8) / Σ incidents(P1..P3)` — **8-hour workday assumption**; `None` if no incidents | hours | QA — pending | as above |
| METRIC-SUP-50 | Service Request MTTR | **`None`** — no duration field collected for SRs | — | — | as above |
| METRIC-SUP-60 | User Clarification MTTR | **`None`** — no duration field collected | — | — | as above |

**Notes.** The three SLA-compliance metrics and two of the three MTTRs are structurally
unavailable — the form does not collect SLA thresholds or SR/clarification durations
(`GAD`). Only Incident MTTR computes, on an assumed 8-hour day.

---

## 4. Professional Staffing (`METRIC-STF-*`)

**Table:** `measurement_staffing` (+ child `measurement_staffing_priority_metrics`, one row
per `StaffingPriority`: Critical / High / Medium / Low). **Source:** BRS FR-MEAS-4; `ux` §4.10.

### Entered inputs

| Field | Unit |
| --- | --- |
| `requests_count` | count |
| Per priority *(child)*: `response_time_hours` (Response Time to resource request), `lead_time_days` (Resource Request → Onboarding) | hours; days |
| `profiles_submitted_count` | count |
| `# Client Interviews`; `interview_selects_count`; `associates_joined_count` | count |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-STF-10 | % Profiles Qualifying for Client Submission | `profiles_submitted_count / requests_count × 100` — **approximation** (source does not separately track "profiles reviewed" vs "submitted") | % | QA — pending | `metric_target_staffing` |
| METRIC-STF-20 | % Candidates Resulting in Joining | `associates_joined_count / interview_selects_count × 100` | % | QA — pending | as above |
| METRIC-STF-30 | Average Response Time by priority | trailing mean of the last **4** periods' `response_time_hours` for that priority (`compute_staffing_priority_trailing_averages`, `trailing_periods = 4`) | hours | QA — pending | `metric_target_staffing_priority` |
| METRIC-STF-40 | Lead Time by priority | trailing mean of the last 4 periods' `lead_time_days` for that priority | days | QA — pending | as above |

**Notes.** METRIC-STF-30/40 are **rolling 4-period averages**, ordered by
`MeasurementStaffing.as_of_date` — the only trailing-window computation in the module. The
per-priority child table also stores the entered response/lead times.

---

## 5. Testing (`METRIC-TST-*`)

**Table:** `measurement_testing`. **Source:** BRS FR-MEAS-5; `ux` §4.10 "Testing".

### Entered inputs

| Field | Unit |
| --- | --- |
| `total_test_cases_designed`; `executed_test_cases`; `passed_test_cases`; `automated_test_cases` | count |
| `effort_test_case_design`; `effort_test_execution` | person-hours/days |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-TST-10 | Test Execution Coverage % | `executed_test_cases / total_test_cases_designed × 100` | % | QA — pending | `metric_target_testing` |
| METRIC-TST-20 | Test Pass Rate % | `passed_test_cases / executed_test_cases × 100` | % | QA — pending | as above |
| METRIC-TST-30 | Automation Coverage % | `automated_test_cases / total_test_cases_designed × 100` | % | QA — pending | as above |
| METRIC-TST-40 | Test Design Productivity | `total_test_cases_designed / effort_test_case_design` | cases / effort | QA — pending | as above |
| METRIC-TST-50 | Test Execution Productivity | `executed_test_cases / effort_test_execution` | cases / effort | QA — pending | as above |

**Notes.** All five compute cleanly from the entered inputs — the most complete type.

---

## 6. Consulting (`METRIC-CON-*`)

**Table:** `measurement_consulting` (added by `add_consulting_measurements.sql`).
**Source:** `PendingPoints` #10 (*"Add Consulting type and measurement: Effort Variation,
Schedule Performance Index, Cost Performance Index"*).

### Entered inputs

| Field | Unit |
| --- | --- |
| `planned_effort_as_on_date`; `actual_effort_as_on_date` | person-hours/days |
| `planned_pct_completion`; `actual_pct_completion` | % |
| `planned_cost`; `actual_cost` | currency |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-CON-10 | Effort Variation % | `(actual_effort_as_on_date − planned_effort_as_on_date) / planned_effort_as_on_date × 100` | % | QA — pending | `metric_target_consulting` |
| METRIC-CON-20 | Schedule Performance Index (SPI) | `actual_pct_completion / planned_pct_completion` — **proxy**, same approach as Development | ratio | QA — pending | as above |
| METRIC-CON-30 | Cost Performance Index (CPI) | `planned_cost / actual_cost` — Consulting **does** model cost, unlike Development | ratio | QA — pending | as above |

**Notes.** Consulting is the only type where CPI computes (it collects `planned_cost` /
`actual_cost`).

---

## 7. Cloud Maintenance (`METRIC-CLM-*`)

**Table:** `measurement_cloud_maintenance`. **Source:** BRS FR-MEAS-6; `ux` §4.10.

### Entered inputs

| Field | Unit |
| --- | --- |
| `total_uptime_hours` | hours |
| `total_scheduled_time_hours` | hours |
| `application_downtime_hours` | hours |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-CLM-10 | Service Availability % | `total_uptime_hours / total_scheduled_time_hours × 100` | % | QA — pending | `metric_target_cloud_maintenance` |
| METRIC-CLM-20 | Application Availability % | `(total_scheduled_time_hours − application_downtime_hours) / total_scheduled_time_hours × 100` | % | QA — pending | as above |

---

## 8. Cloud Migration (`METRIC-CMG-*`)

**Table:** `measurement_cloud_migration`. **Source:** BRS FR-MEAS-7; `ux` §4.10.

### Entered inputs

| Field | Unit |
| --- | --- |
| `planned_application_migration_count`; `applications_migrated_count` | count |
| `total_migration_attempts`; `successful_migrations` | count |
| `migration_start_time`; `migration_end_time` | datetime |

### Computed metrics

| ID | Metric | Formula | Unit | Baseline | Target |
| --- | --- | --- | --- | --- | --- |
| METRIC-CMG-10 | Applications Migrated % (Planned vs Actual) | `applications_migrated_count / planned_application_migration_count × 100` | % | QA — pending | `metric_target_cloud_migration` |
| METRIC-CMG-20 | Migration Success Rate % | `successful_migrations / total_migration_attempts × 100` | % | QA — pending | as above |
| METRIC-CMG-30 | Migration Downtime | `(migration_end_time − migration_start_time)` in minutes; `None` unless `end ≥ start` | minutes | QA — pending | as above |

---

## 9. Gaps

Each is a `GAD` entry in `product-brain/23`.

| Gap | Detail |
| --- | --- |
| **No ratified baselines** | `PendingPoints` #11 — QA has not provided baseline values or confirmed formulas for any metric. Every `Baseline` cell above is `QA — pending`. |
| **Proxy SPI** | `METRIC-DEV-30` / `METRIC-CON-20` use `% completion` ratio, not earned value. A true SPI needs planned-value / earned-value data (hours or currency) that the form does not collect. |
| **Development CPI & Code Coverage permanently `None`** | No cost baseline and no coverage-tool feed modelled for Development. |
| **Support SLA compliance & 2 of 3 MTTRs permanently `None`** | The form collects no per-priority SLA threshold and no duration for Service Requests / User Clarifications. |
| **Staffing "% profiles qualifying" is an approximation** | Uses `requests_count` as the denominator because "profiles reviewed" is not tracked separately from "submitted". |
| **Support MTTR assumes an 8-hour workday** | Person-days → hours conversion is hard-coded at ×8. |
| **`PendingPoints` #27** | "Measurement calculation to be implemented" — confirm every `compute_*` function is actually wired into the write path for each type (Development and Staffing have dedicated routers; others use the generic `MeasurementConfig` factory). |

---

## 10. Assumptions

| ID | Assumption |
| --- | --- |
| A-MET-001 | `ASSUMPTION:` `METRIC-*` IDs are defined here for the first time; `17`/`25`/`26` reference them. |
| A-MET-002 | `ASSUMPTION:` Input field names are transcribed from `services/measurement_metrics.py` `data.get(...)` keys; the exact column names in `db/tables/11–16, 45` may differ slightly. |
| A-MET-003 | `ASSUMPTION:` All computed metrics are stored on the measurement row at write time and returned by the read schema (`ReadWithDefects` / `ReadWithPriorities` for the two with children). |
| A-MET-004 | `ASSUMPTION:` The trailing window for `METRIC-STF-30/40` is 4 periods (`trailing_periods = 4` default); whether the UI exposes this is unknown. |
| A-MET-005 | `ASSUMPTION:` Targets exist per `(project, type)` in `metric_target_*`; the metric→target-field mapping for the dashboard's "Meeting Target %" is defined in `SVC-DASHBOARD-AGGREGATION`, not here. |
