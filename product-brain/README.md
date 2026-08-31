# ProjectGovernance — Product Brain

**What this is:** a complete, worked reference set for the **ProjectGovernance** application
— an internal Bahwan CyberTek (BCT) PMO / delivery-governance web app. It documents the
product end to end: modules, processes, business rules, workflows, screens, roles, data,
domain logic, APIs, security, NFRs, UX patterns, AI-assist, a register of open items, a
delivery roadmap, a test strategy, and a traceability matrix.

**What it is not:** the application's source of truth for *code* (that is the codebase) or a
finished specification. It is **current-state + forward plan**: it describes how the product
works today and, in `23`/`24`, what is unsettled and what comes next.

**Framing.** ProjectGovernance is a **greenfield build** (FastAPI + async SQLAlchemy +
PostgreSQL; Next.js 16 / React 19) replacing a patchwork of governance spreadsheets. There
is **no legacy stored-procedure tier and no ORM migration framework**, so this pack does
**not** use an AS-IS / TO-BE split — everything lives in one folder, and forward-looking
work is isolated to `23` (Gaps/Decisions) and `24` (Roadmap).

> `document-generation-plan.md` in this folder is the **generator** for this pack (a
> one-document-per-iteration driver), **not** a numbered pack document.

---

## 1. Structure

```
product-brain/
├── README.md                                   ← you are here
├── document-generation-plan.md                 ← the pack generator (meta, not content)
├── 00_product_overview.md
├── 01_module_catalogue.md
├── 02_end_to_end_business_processes.md
├── 03_glossary_and_terminology.md
├── 04_functional_specification.md
├── 05_business_rules_catalogue.md               (CRITICAL)
├── 06_status_workflow_catalogue.md              (CRITICAL)
├── 07_roles_permissions_matrix.md
├── 08_screen_catalogue.md
├── 09_reports_dashboards_notifications_catalogue.md
├── 10_data_entity_catalogue.md
├── 11_database_schema_reference.md
├── 12_master_reference_data_catalogue.md
├── 13_domain_logic_and_rollup_specification.md
├── 14_reporting_period_and_cadence_model.md
├── 15_measurement_metrics_and_formula_reference.md
├── 16_data_integrity_checklist_specification.md
├── 17_api_specification.md
├── 18_solution_architecture.md
├── 19_security_and_audit_specification.md
├── 20_non_functional_requirements.md
├── 21_ui_ux_pattern_specification.md
├── 22_ai_assist_specification.md
├── 23_gaps_assumptions_decisions_register.md
├── 24_build_status_and_delivery_roadmap.md
├── 25_test_and_regression_strategy.md
├── 26_traceability_matrix.md
└── assets/                                      ← screenshots / diagrams referenced by 08
```

---

## 2. What each document answers

| # | Document | The question it answers |
| --- | --- | --- |
| 00 | Product Overview | *What is ProjectGovernance, who uses it, what's in/out of scope, and what is the governance lifecycle?* |
| 01 | Module Catalogue | *What are the 24 `MOD-*` modules and how do they depend on each other?* |
| 02 | End-to-End Business Processes | *How does the product behave across modules?* `BP-01…BP-10` with flows, rules, statuses, diagrams. |
| 03 | Glossary & Terminology | *What does each domain term mean, pack-wide?* |
| 04 | **Functional Specification** | *What does each module do, in detail?* 16-part template per module; `FC-*` capabilities. |
| 05 | **Business Rules Catalogue** *(CRITICAL)* | *What are the enforceable rules, and where is each enforced?* ~110 `BR-*` with enforcement layer + severity. |
| 06 | **Status & Workflow Catalogue** *(CRITICAL)* | *What states can each entity be in and what transitions are legal?* 19 entities + state diagrams. |
| 07 | Roles & Permissions Matrix | *Who can do what — per module, action, status, scope?* 8 roles, scope factories, SoD, DE/PMO gaps. Supersedes `roles-actions.md`. |
| 08 | Screen Catalogue | *What screens exist, who uses them, what does each action call?* Every route with `SCR-*`; field-level for 5 screens. |
| 09 | Reports, Dashboards & Notifications | *What does the product surface?* Per-role dashboards, 14 Project Health grids, `N-*` events. |
| 10 | Data / Entity Catalogue | *What are the business entities, their attributes, relationships, lifecycles?* `ENT-*` + ER diagram. |
| 11 | Database Schema Reference | *What is the physical schema of record (no migration tool)?* 47 `db/tables/*.sql`, triggers, no CHECK constraints. |
| 12 | Master & Reference Data Catalogue | *What reference data exists, who owns it, where does it come from?* `MD-*` (7 entities). |
| 13 | Domain Logic & Rollup Specification | *What is the computed logic behind the screens?* `SVC-*` service contracts + worst-wins / rollup / period-sum semantics. |
| 14 | Reporting Period & Cadence Model | *How does the time model work, and what must be ratified?* Weekly/Monthly/Baseline, "current period", cadence per module. |
| 15 | Measurement Metrics & Formula Reference | *For each engagement type, what is entered vs computed, and by what formula?* `METRIC-*`, exact formulas. |
| 16 | Data Integrity Checklist Specification | *How does the checklist decide "updated / not updated"?* `DI-*`, freshness source map, evaluation logic. |
| 17 | API Specification | *What are the REST APIs?* `API-*` per domain, mapped to authz + service + status preconditions; 7 examples. |
| 18 | Solution Architecture | *What does the system look like and how is it deployed?* Logical + deployment diagrams; integration seams. |
| 19 | Security & Audit Specification | *How are auth, authz, sessions, sensitive data, and audit handled?* Two auth modes; a severity-ranked risk register. |
| 20 | Non-Functional Requirements | *What are the measurable targets?* `NFR-*` — every value a `TARGET:` (nothing baselined). |
| 21 | UI/UX Pattern Specification | *What common patterns do all screens follow, and how do status + permissions drive the UI?* |
| 22 | AI-Assist Specification | *How does the AI assistant work, and what does it guarantee?* Pipeline boundary; "never writes to business tables". Supersedes `AI-Implementation.md`. |
| 23 | **Gaps, Assumptions & Decisions Register** | *What don't we know, what did we assume, what must someone decide?* 82 `GAD-*`. |
| 24 | Build Status & Delivery Roadmap | *Where is each module today, and in what order does the rest get done?* Per-module status + 15 workstreams + pilot gate. |
| 25 | Test & Regression Strategy | *How is it verified?* Golden-fixture regression of the domain services as the centrepiece; `TS-*`. |
| 26 | Traceability Matrix | *How does every capability link across all layers?* `BP → FC → BR → Workflow → SCR → API → SVC/Table → TS`. |

---

## 3. Recommended reading order

### First pass — orientation (anyone)
1. **00 Product Overview** — the domain and the lifecycle.
2. **01 Module Catalogue** — the map.
3. **02 End-to-End Business Processes** — how it flows.
4. **23 Gaps, Assumptions & Decisions** — what's unsettled (read early, so you read the rest with the right scepticism).
5. **24 Build Status & Delivery Roadmap** — what's real vs. planned.

### Second pass — by interest

| If you are… | Read, in order |
| --- | --- |
| **Business analyst / product** | 04 → 05 → 06 → 07 → 08 → 09 → 14 → 15 → 16 |
| **Backend developer** | 05 → 06 → 13 → 17 → 10 → 11 → 15 → 04 (for your module) |
| **Frontend developer** | 08 → 21 → 07 → 06 → 09 → 22 |
| **Solution architect** | 18 → 13 → 10 → 11 → 17 → 19 → 20 |
| **QA / test lead** | 05 → 06 → 13 → 17 → 25 → 26 |
| **Security** | 07 → 19 → 18 → 20 (§security) |
| **Delivery / programme** | 23 → 24 → 25 → 20 |

When working on a specific capability, follow its row in **26 Traceability Matrix** — it
names every document and section that capability touches.

---

## 4. Audience classification

| Business-facing | Development-facing | Forward-plan |
| --- | --- | --- |
| 00, 01, 02, 03, 04, 05, 06, 07, 08, 09, 12, 14, 15, 16 | 05, 06, 10, 11, 13, 17, 18, 19, 20, 21, 22, 25, 26 | 23, 24 |

`05` and `06` are both — **business-owned, development-enforced**.

---

## 5. ID conventions

Numbered in tens so inserts don't renumber references.

`MOD-*` modules · `BP-*` processes · `FC-<MOD>-*` functional capabilities ·
`BR-<MOD>-*` business rules · `06` transitions keyed by entity + state ·
`SCR-<MOD>-*` screens · `RPT-*` reports · `DASH-*` dashboards · `N-*` notifications ·
`ENT-*` entities · `MD-*` master data · `SVC-*` service/domain-logic contracts ·
`API-<AREA>-*` endpoints · `METRIC-<TYPE>-*` metrics · `DI-*` data-integrity items ·
`NFR-<CATEGORY>-*` targets · `TS-<AREA>-*` test scenarios · `GAD-<NNN>` gaps/assumptions/decisions.

Invented / unverified content is marked `ASSUMPTION: … — to confirm with {owner}`;
unmeasured numbers `TARGET: … — baseline {date}`. Every document has an **Assumptions**
section; the substantive ones are consolidated in **23**.

---

## 6. How to keep it in sync

1. **IDs generate traceability — don't hand-maintain it.** A rule test tags its `BR-*`; an
   endpoint declares its authz (`07`) and its service (`13`); **26** is then generated. Aim
   for CI to fail on an untested `BR-*` or an unmapped `API-*`.
2. **`05` and `06` are the anchors.** Everything references them; keep them correct first.
3. **Resolve `<!-- pending: reconcile with product-brain/NN -->` markers.** A few forward
   references were left while the pack was generated one document at a time; a reconciliation
   pass (`document-generation-plan.md` §6) clears them, plus a light `05-R` / `06-R` sweep
   after `04`/`07`/`08`/`13`, and a `23` sweep to collect every `ASSUMPTION:` raised.
4. **Regenerate `26` and this README** after any structural change.
5. **When code disagrees with a doc, code wins** — fix the doc and, if material, add a
   `GAD` to `23`.

---

## 7. Legacy documents

The following originals are **superseded by this pack** and should move to `docs/legacy/`
(retained for provenance, not maintained):

| Legacy file | Superseded by |
| --- | --- |
| `docs/Project-Governance-Tool-BRS.md` | 00, 01, 04, 05, 06, 23, 24 |
| `docs/ux-requirements.md` | 08, 21, 14 |
| `docs/PendingPoints.txt` | 23, 24 |
| `docs/e2e-test-flow.csv` | 25 |
| `roles-actions.md` | 07 |
| `AI-Implementation.md` | 22 |
| `Authentication.md` | 18, 19 |
| `DATA-ENTRY-GUIDE.md` | 02, 08 |
| `deployment.md` | 18 |
| `design-reference/*.md` | 08 (+ images → `product-brain/assets/`), 09, 13, 21 |

**Not absorbed** (engineering-internal, leave in place): `BACKEND_CODE_REVIEW*.md`,
`BACKEND_FIX_PLAN.md`, `FRONTEND_CODE_REVIEW.md`, `FRONTEND_FIX_PLAN.md`,
`frontend-review.md`, `vapt-prompt.txt` — the security *intent* from the last two feeds `19`.

---

## 8. Status

| Group | Documents | Status |
| --- | --- | --- |
| Reference | 00–12 | Draft (generated 2026-08-29 / 08-30) |
| Specification | 13–22, 25, 26 | Draft |
| Forward-plan | 23, 24 | Draft |
| This README | — | Draft |

All 27 numbered documents plus this README are present. Every quantitative value is a
`TARGET:`; every invented detail is an `ASSUMPTION:`; `23_gaps_assumptions_decisions_register.md`
is the register of everything a real review must confirm, decide, or investigate. Pending a
reconciliation pass to clear forward-reference markers and a review against the running
system.
