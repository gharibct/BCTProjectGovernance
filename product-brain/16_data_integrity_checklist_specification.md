# 16 — Data Integrity Checklist Specification

**Document type:** Product-Brain Specification
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/01, product-brain/05, product-brain/09, product-brain/13, product-brain/14
**Feeds:** product-brain/17, product-brain/23, product-brain/25, product-brain/26

> **Purpose of this document.** How the Data Integrity checklist decides, per project and
> per reporting period, which data points across every other module have or have not been
> updated — judged against **each item's own cadence**. The checklist is a **governance
> rollup computed at query time**, not stored source data. `DI-*` IDs label the known
> catalog items. Logic is from `SVC-DATA-INTEGRITY-ROLLUP` (`product-brain/13` A6).

---

## 1. Purpose & model

- **What it is** (BRS FR-DI-1, `docs/ux-requirements.md` §4.13): a per-project view showing,
  grouped by module, whether each data point was updated for the current period —
  `Updated` / `Not Updated` — with a last-updated date.
- **What it is not:** new source data. `data_integrity_checklist_items` only **catalogs**
  the items and their expected cadence; the status per project/period is derived from the
  other module tables at query time.
- **Catalog table** `data_integrity_checklist_items` (`ENT-DICHECKITEM`, `product-brain/11`
  file 20): `id`, `module_name` (free text), `item_name` (free text), `expected_cadence`
  (`Weekly | Monthly | Quarterly | Ad Hoc`), `is_active`. `UNIQUE (module_name, item_name)`.
- **Owner:** `ADMIN` maintains the catalog (`require_role(ADMIN)` on writes — BR-REF-010
  style). Intended day-to-day owner: `PMO` (read + act — `product-brain/07` §8 gap).

---

## 2. Known catalog items (`DI-*`)

The catalog rows are admin free text, but `SVC-DATA-INTEGRITY-ROLLUP` only knows how to
compute freshness for a **fixed set of 15 `module_name` values** (§3). Those are the
"known" items; anything else is reported conservatively as not updated (§5). `DI-*` IDs
below label the known set.

| DI ID | `module_name` | Module (`product-brain/01`) | Grouping |
| --- | --- | --- | --- |
| DI-STATUS-10 | `Project Status` | MOD-STATUS | Reporting |
| DI-RAID-10 | `Risk Log` | MOD-RAID | RAID(O) |
| DI-RAID-20 | `Issue Log` | MOD-RAID | RAID(O) |
| DI-RAID-30 | `Dependency Log` | MOD-RAID | RAID(O) |
| DI-RAID-40 | `Assumption Log` | MOD-RAID | RAID(O) |
| DI-RAID-50 | `Opportunity Log` | MOD-RAID | RAID(O) |
| DI-HEALTH-10 | `Delivery Declared Project Health` | MOD-HEALTH | Health |
| DI-HEALTH-20 | `DE Assessed Project Health` | MOD-DEA | Health |
| DI-MEAS-10 | `Development Metrics` | MOD-MEAS | Delivery Metrics |
| DI-MEAS-20 | `Support Metrics` | MOD-MEAS | Delivery Metrics |
| DI-MEAS-30 | `Professional Staffing Metrics` | MOD-MEAS | Delivery Metrics |
| DI-MEAS-40 | `Testing Metrics` | MOD-MEAS | Delivery Metrics |
| DI-MEAS-50 | `Cloud Maintenance Metrics` | MOD-MEAS | Delivery Metrics |
| DI-MEAS-60 | `Cloud Migration Metrics` | MOD-MEAS | Delivery Metrics |
| DI-CONTRACT-10 | `Contractual Commitment Actuals` | MOD-CONTRACT | Commercial |

**Not covered by a lookup** (would report "Not Updated" if added to the catalog):
Consulting Metrics, Milestone Payment actuals, Metric Targets, Contractual Commitment
*definitions*, Account/Geo status & health, Executive Update, Actions, Resource Allocation.
See §8.

---

## 3. Freshness source map

`MODULE_LOOKUP` (and its `MODULE_LOOKUP_BULK` twin for the portfolio view) maps each known
`module_name` to the table + date column that answers *"when was this last updated for this
project"*:

| DI ID | Source table | Date column | Strategy |
| --- | --- | --- | --- |
| DI-STATUS-10 | `project_status_reports` | `report_date` | `MAX(report_date)` for the project |
| DI-RAID-10..50 | `risk_log` / `issue_log` / `dependency_log` / `assumption_log` / `opportunity_log` | `updated_at` | `MAX(updated_at)::date` |
| DI-HEALTH-10 | `health_declarations` | `created_at` | `MAX(created_at)::date` |
| DI-HEALTH-20 | `de_assessments` | `assessment_date` | `MAX(assessment_date)` |
| DI-MEAS-10..60 | `measurement_development` / `_support` / `_staffing` / `_testing` / `_cloud_maintenance` / `_cloud_migration` | `as_of_date` | `MAX(as_of_date)` |
| DI-CONTRACT-10 | `contractual_commitment_actuals` (joined via `contractual_commitments`) | `period_date` | `MAX(period_date)` across the project's commitments |

An `is_active` catalog item whose `module_name` is **not** in this map: `last_updated = None`
→ reported **Not Updated** (BR-DI-020) — never guessed.

---

## 4. Per-item expected cadence

Each catalog row carries its own `expected_cadence`. The `SVC-DATA-INTEGRITY-ROLLUP`
evaluation compares the source's last-updated date to a **window** derived from that
cadence:

| Cadence | Expected window *(day count — `DECISION REQUIRED`, `product-brain/14` §8)* |
| --- | --- |
| `Weekly` | ~7 days |
| `Monthly` | ~30 days |
| `Quarterly` | ~90 days |
| `Ad Hoc` | always considered up to date (no staleness) |

Typical assignments: `Project Status` → Weekly; the five RAID logs → Monthly (register
review); `Delivery Declared Project Health` → Weekly *(proposed)*; `DE Assessed Project
Health` → Monthly or Quarterly *(open — Open Item 5)*; all Measurement items → Monthly;
`Contractual Commitment Actuals` → per commitment Frequency (Monthly used as the checklist
default). The **exact day counts are not pinned in code** — a `GAD`.

---

## 5. Evaluation logic

For each `(project, active catalog item)`:

```
last_updated = MODULE_LOOKUP[item.module_name](db, project_id)   # or None if not in the map

is_updated:
    if last_updated is None:            -> False        # never updated / unknown source
    if cadence is "always"/Ad Hoc:      -> True
    else:                              -> (today - last_updated).days <= window(cadence)

is_critical_gap:
    if last_updated is None:            -> True (or per implementation)
    if cadence is "always":             -> False
    else:                              -> (today - last_updated).days > 2 * window(cadence)
```

`compute_status_row(db, project_id, item)` returns
`{ module_name, item_name, expected_cadence, last_updated_date, is_updated }`
(+ `is_critical_gap` from `is_critical_gap(...)`).

- The evaluation is **relative to today**, not to a selected period id — freshness is
  "days since last update vs. the cadence window", so a stale item is flagged regardless of
  which period the UI is showing.
- There is no partial state — a row is `Updated`, `Not Updated`, or (for unmapped items)
  conservatively `Not Updated`.

---

## 6. Project view vs Portfolio view

| | Project view | Portfolio view |
| --- | --- | --- |
| Endpoint | `GET /data-integrity-checklist` per project | the Project Health "Data Integrity" grid (`RPT-DI-10`, `SCR-DASH-114`) |
| Service | `compute_status_row` per `(project, item)` | `compute_status_rows_bulk(db, project_ids, items)` — one `MAX(date)`-per-module query across **all** project ids, then per-project comparison |
| Columns | item name, module, cadence, last updated, Updated/Not Updated | Project, Check, Category, Status, Issue, Last Checked (`design-reference/project-health-screens.md`) |
| KPIs | per-project pass count | Checks Passed %, Projects With Gaps, Critical Gaps |
| Filter | — | filter to "Not Updated" across a single project **or the whole portfolio**; **drill into the source module** for a flagged row (BRS FR-DI-3) |
| Role | any (read) | `require_role(PMO, ADMIN, CXO)` (BR-DASH-020) |

---

## 7. Relationship to defaulter tracking

The Data Integrity checklist **is** the machine-readable form of the cadence model
(`product-brain/14`). A project with `Not Updated` rows for the current period is a
**defaulter** for those modules. Today this feeds:

- the portfolio KPIs "Projects With Gaps" / "Critical Gaps" (`RPT-DI-10`);
- the RAG grid's "Reporting Overdue" (`RPT-RAG-10`) for the Status item specifically.

A dedicated cross-tier defaulter screen and the `N-DI-DEFAULTER` push notification are
**Planned** (`product-brain/09` §B3, `14` §6).

---

## 8. Gaps

Each is a `GAD` entry in `product-brain/23`.

| Gap | Detail |
| --- | --- |
| **Freshness windows not pinned** | The day count per `Weekly` / `Monthly` / `Quarterly` cadence is implementation-defined; must be ratified with the cadence model (`product-brain/14` §8). |
| **Coverage holes in `MODULE_LOOKUP`** | No lookup for **Consulting Metrics**, **Milestone Payments**, **Contractual Commitment definitions**, **Account/Geo status/health**, **Executive Update**, **Actions**, or **Resource Allocation** — adding any of these to the catalog would falsely report "Not Updated". |
| **Not period-scoped** | Evaluation is "days since last update vs. today", so it cannot distinguish "updated for *this* period" from "updated recently for the *previous* period" — a project that reported last week but not this week may still show `Updated` inside the Weekly window. |
| **Catalog seeding** | Whether `data_integrity_checklist_items` is seeded (`seed_dev.sql` shows no rows) or must be populated by an admin is unconfirmed; an empty catalog produces an empty checklist. |
| **`PMO` cannot act** | Intended owner has no write permission (`product-brain/07` §8). |

---

## 9. Assumptions

| ID | Assumption |
| --- | --- |
| A-DI-001 | `ASSUMPTION:` `DI-*` IDs label the 15 code-known `module_name` values; actual catalog rows are admin free text and may not match these names exactly. |
| A-DI-002 | `ASSUMPTION:` `is_critical_gap` for a `None` `last_updated` is treated as a critical gap; confirm the exact branch in `data_integrity_rollup.py`. |
| A-DI-003 | `ASSUMPTION:` Cadence → window day counts (`Weekly ≈ 7`, `Monthly ≈ 30`, `Quarterly ≈ 90`) are indicative; the real values are in `_is_updated` and must be transcribed and ratified. |
| A-DI-004 | `ASSUMPTION:` `MeasurementDevelopment` / `_staffing` use `as_of_date` like the others (the lambda wraps `_max_date_column` with the type's date column); confirm the column name per table. |
