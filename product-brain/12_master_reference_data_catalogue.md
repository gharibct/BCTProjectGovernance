# 12 — Master & Reference Data Catalogue

**Document type:** Product-Brain Reference
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/00, product-brain/01, product-brain/07, product-brain/10, product-brain/11
**Feeds:** product-brain/08, product-brain/17, product-brain/23

> **Purpose of this document.** The shared reference layer every transaction depends on:
> each master entity, its owner, its consumers, its validation, its active/inactive
> behaviour, and its source of truth (admin screen vs. seed script vs. Oracle mapping).
> `MD-*` IDs are defined here. Physical tables are in `product-brain/11` file 01 (+
> `add_regions.sql`, `add_critical_product_flags.sql`); business entities in
> `product-brain/10` §3.

---

## 1. Conventions

- **Master ID:** `MD-<NAME>`.
- **Governing module:** MOD-REF for all seven (`product-brain/01`); writes are `ADMIN`-only
  via `build_crud_router` with `write_dependencies = [require_role(ADMIN)]` (BR-REF-010);
  every authenticated role reads them (BR-REF-020).
- **Source values:**
  - `Admin screen` — created/edited through a UI screen.
  - `Seed-script` — exists only in `db/seed_dev.sql` / DB; **no admin screen yet**.
  - `Config` — a fixed code list seeded at implementation, rarely changed.
  - `Oracle-mapped` — linked to the BCT Oracle Application; the link is stored, **no live
    sync**.
  - `Import` — additionally loadable via the Excel master-data CLI (`backend/app/master_data/`,
    run as `python -m scripts.import_master_data` with a template from
    `generate_template.py`; all-or-nothing transaction).
- **Active/inactive.** `ASSUMPTION:` the reference tables carry **no `is_active` column**
  (unlike `users` and `data_integrity_checklist_items`). Records are edited in place or
  deleted; there is no deactivate-and-hide behaviour. BR-REF-030 ("a record in use cannot
  be hard-deleted") is **Advisory** — not enforced.

---

## 2. Master Data Index

| MD ID | Entity | Table | Admin screen? | Source | Consumed by |
| --- | --- | --- | --- | --- | --- |
| MD-ORG | Organization | `organizations` | **No** (seed-script) | Config / Import | MOD-PROJ |
| MD-GEO | Geo | `geos` | **No** (seed-script) | Config / Import | MOD-PROJ, MOD-ACCT, MOD-GEO, MOD-USER (scope), MOD-DASH |
| MD-REGION | Region | `regions` | **No** (seed-script; `add_regions.sql`) | Import | MOD-PROJ (not RBAC-scoped) |
| MD-ACCOUNT | Account | `accounts` | **Yes** — `/admin/accounts` (SCR-REF-10) | Admin screen / Import | MOD-PROJ, MOD-ACCT, MOD-USER (scope), MOD-DASH |
| MD-PROJTYPE | Project Type | `project_types` | **No** (seed-script; `add_consulting_project_type.sql`) | Config / Import | MOD-PROJ, MOD-MEAS, MOD-TARGET |
| MD-PRODUCT | Product | `products` | **No** (seed-script; `add_critical_product_flags.sql`) | Config / Import | MOD-PROJ (when `product_flag = Yes`) |
| MD-PERIOD | Reporting Period | `reporting_periods` | **No** (seed-script) | Config / Import | MOD-STATUS, MOD-HEALTH, MOD-MEAS, MOD-CONTRACT, MOD-DEA, MOD-ACCT, MOD-GEO, MOD-AI — every period-scoped entity |

All seven have a `POST/PUT/DELETE` REST API (`/organizations`, `/geos`, `/regions`,
`/project-types`, `/products`, `/accounts`, `/reporting-periods`) gated to `ADMIN`; only
`/admin/accounts` has a screen. The others must be seeded or called via `/docs`.

---

## 3. Entities

### MD-ORG — Organization

| Attribute | Value |
| --- | --- |
| Purpose | The BCT legal entity a project is delivered under. |
| Key attributes | `id`, `code` (unique), `name`. Known values: **BCTPL, BCTC, FT**. |
| Owner | `ADMIN` (MOD-REF). |
| Used by | MOD-PROJ (`projects.organization_id`) — a Charter dropdown. |
| Validation | `code` unique; both `code` and `name` non-empty (Pydantic). |
| Active/inactive | none — edit or delete in place. |
| Source | `Config` (fixed 3-value list); `Import`. **No admin screen.** |

### MD-GEO — Geo

| Attribute | Value |
| --- | --- |
| Purpose | Geography tier between Account and CXO; a first-class **scope dimension** (`user_geos`). |
| Key attributes | `id`, `code`, `name`. Known values: **APAC, MEA, US**. |
| Owner | `ADMIN` (MOD-REF). |
| Used by | MOD-PROJ (`geo_id`), MOD-ACCT (`accounts.geo_id`), MOD-GEO (reporting, health, executive updates), MOD-USER (Geo Head scope), MOD-DASH (filter), MOD-ACTION (GEO-level `level_value`). |
| Validation | `code` unique; non-empty. |
| Active/inactive | none. |
| Source | `Config`; `Import`. **No admin screen** (DATA-ENTRY-GUIDE — seed-script only). |

### MD-REGION — Region

| Attribute | Value |
| --- | --- |
| Purpose | A reference tier added after Geo (`add_regions.sql` → `projects.region_id`). Intended to sit alongside or under Geo. |
| Key attributes | `id`, `code`, `name`. |
| Owner | `ADMIN` (MOD-REF). |
| Used by | MOD-PROJ (`region_id`) only. |
| Validation | `code` unique; non-empty. |
| Active/inactive | none. |
| Source | `Import`; `Seed-script`. **No admin screen.** |
| Note | `ASSUMPTION:` **not part of the RBAC scope model** — no role or `user_regions` join. Its relationship to Geo is unresolved (`GAD`, `product-brain/23`). |

### MD-ACCOUNT — Account

| Attribute | Value |
| --- | --- |
| Purpose | Client account tier between Project and Geo; a **scope dimension** (`user_accounts`). |
| Key attributes | `id`, `name`, `geo_id`. |
| Owner | `ADMIN` (MOD-REF) — via the **`/admin/accounts` screen** (Account Name + Geo → "Add Account"). |
| Used by | MOD-PROJ (`account_id`), MOD-ACCT (reporting, health, rollup), MOD-USER (Account Manager scope), MOD-DASH (governance matrix rows), MOD-ACTION (ACCOUNT-level). |
| Validation | `name` present; `geo_id` references an existing Geo. |
| Active/inactive | none — `ON DELETE CASCADE` from `projects`/reports means deleting an account is destructive. |
| Source | `Admin screen` (SCR-REF-10); `Import`. |

### MD-PROJTYPE — Project Type

| Attribute | Value |
| --- | --- |
| Purpose | The delivery model that selects a project's **Measurement tab** and its `metric_target_*` family. |
| Key attributes | `id`, `name`, `description`. Values map to the 7 engagement types: Development, Support, Professional Staffing, Testing, **Consulting**, Cloud Maintenance, Cloud Migration (Consulting seeded by `add_consulting_project_type.sql`). |
| Owner | `ADMIN` (MOD-REF). |
| Used by | MOD-PROJ (`project_type_id`), MOD-MEAS (tab selection), MOD-TARGET, MOD-DASH ("Projects by Type"). |
| Validation | `name` unique; description used as the dropdown help text. |
| Active/inactive | none. |
| Source | `Config`; `Import`. **No admin screen** — new types (like Consulting) are added by patch script. |

### MD-PRODUCT — Product

| Attribute | Value |
| --- | --- |
| Purpose | The named product a project delivers, chosen when `products` are relevant. |
| Key attributes | `id`, `name`, `description`. |
| Owner | `ADMIN` (MOD-REF). |
| Used by | MOD-PROJ (`product_id`) — required on the Charter only when `product_flag = Yes` (`PendingPoints` #7). |
| Validation | `name` present; `product_id` must be set when `product_flag = Yes`. |
| Active/inactive | none. |
| Source | `Seed-script` (`add_critical_product_flags.sql`); `Import`. **No admin screen.** |

### MD-PERIOD — Reporting Period

| Attribute | Value |
| --- | --- |
| Purpose | The `Weekly` / `Monthly` / `Baseline` bucket that scopes almost every period-dated record; weeks are keyed to a Monday date (`PendingPoints`). |
| Key attributes | `id`, period type (`PeriodType`), key date / start–end, label. |
| Owner | `ADMIN` (MOD-REF). |
| Used by | **every period-scoped module** — MOD-STATUS, MOD-HEALTH, MOD-MEAS, MOD-CONTRACT (via `period_date`), MOD-DEA, MOD-ACCT, MOD-GEO, MOD-AI. |
| Validation | (type, date) effectively unique; type ∈ `PeriodType`. |
| Active/inactive | none. |
| Source | `Config` / `Seed-script` — periods are pre-created; **no admin screen**. How the "current" period is resolved per screen is defined in `product-brain/14`. |

---

## 4. Excel master-data import (CLI)

`backend/app/master_data/` provides an operational path to bulk-load reference data without
per-entity screens:

| Module | Role |
| --- | --- |
| `generate_template.py` | emits a blank multi-sheet workbook (one sheet per master entity), with enum columns and business keys pre-labelled (`introspection.py`, `enum_columns.py`, `business_keys.py`). |
| `import_template.py` | imports a filled workbook in a **single all-or-nothing transaction** (`registry.py` maps sheets → models). |
| `propose_nullable_changes.py` | suggests schema nullability tweaks from the data. |

Run via `python -m scripts.import_master_data` (a CLI script — **not an API endpoint**).
Tests: `backend/tests/test_master_data_import.py`, `test_master_data_template.py`.

---

## 5. Gaps

| Gap | Detail | `GAD` |
| --- | --- | --- |
| No admin screens for Org / Geo / Region / Project Type / Product / Reporting Period | Only Accounts has a UI. The rest need a seed script, the Excel CLI, or `/docs`. Adding new reference values (Consulting, Regions) has been done by patch script. | yes |
| No active/inactive lifecycle on reference data | No `is_active` column; no deactivate-and-hide. Deleting an in-use record is blocked only by the (Advisory) BR-REF-030 and by FK `RESTRICT`/`CASCADE` behaviour. | yes |
| Region unscoped | `regions` has no RBAC role, no `user_regions`, and an unclear relationship to Geo. | yes |
| Reporting-period management | Periods are pre-seeded; there is no UI to open/close a period or mark the "current" one. See `product-brain/14`. | yes |

---

## 6. Assumptions

| ID | Assumption |
| --- | --- |
| A-MD-001 | `ASSUMPTION:` `MD-*` IDs are defined here for the first time; `08`/`17`/`23` reference them. |
| A-MD-002 | `ASSUMPTION:` The "no admin screen" status for Org/Geo/Region/Project Type/Product/Period is from `DATA-ENTRY-GUIDE.md`; a new screen may have been added since — verify against the running app. |
| A-MD-003 | `ASSUMPTION:` Reference tables carry no `is_active` column (not seen in `models/reference_data.py`); confirm against the DDL. |
| A-MD-004 | `ASSUMPTION:` The known value lists (BCTPL/BCTC/FT; APAC/MEA/US) come from BRS FR-CHART-1 / `docs/ux-requirements.md` §4.3; the seed data may differ. |
