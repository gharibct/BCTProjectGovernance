# ProjectGovernance Product-Brain — Document Generation Plan (driver file)

This file drives a **one-document-per-iteration** generation loop. Feed this entire file to
a fresh session. That session generates exactly **one** document from §4, writes it under
`product-brain/`, reports, and stops. Then you re-feed this same file for the next document.

The 27-document set, when complete, is a current-state product brain for **ProjectGovernance**
(working title), an internal Bahwan CyberTek (BCT) PMO / delivery-governance web application.
It is modelled on the reference pack at `D:\BCT\projects\TMS_ProductBrain\sample-docs`
("TransFlow TMS"), adapted because ProjectGovernance is a **greenfield build** (no legacy
stored procedures, no migration framework) rather than a modernization.

---

## §0. How to use this file — loop protocol

Operating mode: **stateless**. Progress = which files exist in `product-brain/`. You do not
maintain a ledger. Consistency comes from §1 (Canonical Facts) and from reading the
already-written documents before drafting.

Each iteration, do exactly this:

1. **Locate the target.**
   - If the user named a document number, that is the target.
   - Otherwise: list `product-brain/`. The target is the **lowest-numbered brief in §4
     whose output file does not yet exist**. `README.md` is generated last (after `26`).
   - If every file in §4 exists: there is nothing to generate — say so, and offer the
     reconciliation passes in §6.
2. **Load the rules.** Read §1 (Canonical Facts), §2 (House Style & Global Rules), and the
   §4 brief for the target document.
3. **Read the sources.** From the brief:
   - `Read first → repo:` — read these files/dirs in the ProjectGovernance repo for ground
     truth. Code and DB DDL win over any prose.
   - `Read first → absorb:` — read the existing doc(s) this one supersedes; carry their
     substance forward, corrected against code.
   - `Read first → TMS:` — read the named template doc under
     `D:\BCT\projects\TMS_ProductBrain\sample-docs\` for structure and depth.
   - `Consumes:` — read every listed `product-brain/NN_*.md` that already exists. For any
     that does **not** exist yet, use §1 Canonical Facts as the fallback and leave an
     inline `<!-- pending: reconcile with product-brain/NN -->` marker at each spot that
     will need it.
4. **Draft** to the brief's `Required outline` and `Depth`.
5. **Self-check** against the brief's `Done when` list **and** the global checklist in §2.
   Fix every gap before writing.
6. **Write** the file to the brief's exact `Output` path. Do not create, move, edit, or
   delete any other file. (Only exception: on the very first iteration, when
   `product-brain/` contains only this file, also create the empty directory
   `product-brain/assets/` — see §7.)
7. **Report and stop.** Output a short summary:
   - file written (path, approx line count);
   - IDs this document defines (ranges/list);
   - assumptions raised, each as a line starting `ASSUMPTION:` ;
   - any decision the user must make;
   - the next target document.
   Do **not** continue to another document.

Hard constraints: **one document per iteration**; never generate ahead; never touch
`docs/legacy/` or move/delete files during an iteration (§5 is a separate one-time step);
never invent an ID family another document owns (see `Defines IDs` per brief).

---

## §1. Canonical Facts — single source of truth

Copy terminology, IDs, role codes, and lifecycle values from here verbatim. Never
contradict this section. If the codebase contradicts it, follow the codebase and flag the
discrepancy in your report.

### 1.1 Product

ProjectGovernance is an internal BCT PMO / delivery-governance platform. It replaces a
patchwork of per-project / per-account / per-geography governance spreadsheets with one
system of record covering the full reporting chain from an individual project up to CXO:
project charter & master data; health declaration with a worst-wins Red/Amber/Green rollup
(project → account → geo → enterprise); a report-and-review workflow at each tier; five
RAID registers; weekly status reporting; delivery metrics by engagement type; contractual
SLA & milestone-payment tracking; Delivery Excellence assessment and governance approval;
a data-integrity checklist; an action tracker; executive updates; role-based dashboards;
and user/role administration. Internal only — no customer-facing surface. On-premises,
within the BCT network.

- **Working name:** "ProjectGovernance". No confirmed product name exists — record as a
  `DECISION REQUIRED` in `23`.
- **Nature:** greenfield build, actively under construction. Some areas are Partial/Planned
  (real auth, DE/PMO write-enablement, live Oracle/M365 sync, contractual/milestone
  actuals UI, geo RAG screen).

### 1.2 Technology facts

| Layer | Fact |
|---|---|
| Backend | FastAPI 0.115, Python; SQLAlchemy 2.0 **async**; Pydantic v2 |
| DB | PostgreSQL (asyncpg) in shared/prod; SQLite (aiosqlite) for local/dev & tests |
| Schema management | **No migration framework** (no Alembic). Schema of record = hand-written `db/tables/*.sql` (47 files) applied via `db/run_all.sql`; ad-hoc `db/add_*.sql` patch scripts. Tests build from `Base.metadata`. |
| DB-side logic | **None** beyond `pgcrypto` and one generic `set_updated_at()` BEFORE-UPDATE trigger per table. No stored procedures, packages, or business functions. |
| Value-set enforcement | **No CHECK constraints.** `backend/app/schemas/enums.py` `StrEnum`s are the only enforcement of status/category value sets. |
| Auth | `AUTH_TYPE` = `no_password` (dev: identifier lookup, **no password check**) or `onelogin` (OIDC SSO via Authlib, strict pre-provisioned users, no JIT). Session = signed JWT in httpOnly cookie `pg_session` (PyJWT HS256). Every non-auth route also requires a shared static `X-API-Key`. |
| AI | No LLM library in-process. External pipeline (local vLLM, OpenAI-compatible; document parsing outside the LLM) POSTs extraction JSON to the app. App stores/serves it and never writes AI values to business tables. |
| Excel | `openpyxl` (backend master-data import CLI only); SheetJS `xlsx` on the frontend for register import/export and clipboard paste. |
| Frontend | Next.js 16 (App Router) + React 19; TanStack Query (server state); Zustand + `persist` (session/UI state); Radix UI + shadcn conventions + Tailwind v4; `lucide-react`; `sonner` toasts; TipTap 3 (executive-update rich text); Playwright (e2e). |
| Frontend↔backend | Custom `fetch` wrapper `src/lib/api/client.ts`; base `/api/v1` (relative); `next.config.ts` rewrite proxies to FastAPI so the browser is same-origin; `credentials: "include"` + `X-API-Key` on every request; `401` clears the Zustand session and hard-redirects to `/login`. |
| Hosting | On-prem, BCT network. `uvicorn` + `next start`, process-managed (NSSM/Task Scheduler). OneLogin needs HTTPS redirect URIs → reverse-proxy + TLS is a prerequisite for `AUTH_TYPE=onelogin` outside localhost. |

### 1.3 Roles (exact codes — from `RoleCode` in `backend/app/schemas/enums.py`)

| Code | Name | Org scope | Core responsibility |
|---|---|---|---|
| `ADMIN` | Admin | All | Users/roles/scope, reference data, integrations, backups. Superset; can approve/reject at every tier; bypasses scope checks. |
| `CXO` | CXO | Enterprise (unscoped) | Reviews/approves every Geo's rolled-up status; enterprise dashboard. Lightest write footprint. Creates/edits Geo-level Actions. |
| `GEO_HEAD` | Geo Head | One or more Geos | Reviews/approves Accounts in their Geo(s); authors Geo status + Geo health; pulls Account→Geo rollup; builds the CXO Executive Update (draft only). |
| `ACCOUNT_MANAGER` | Account Manager ("Account Head") | One or more Accounts | Reviews/approves Projects in their Account(s); authors Account status + Account health; Pull/Ignore/Undo Project→Account rollup. |
| `PROJECT_MANAGER` | Project Manager (PM) | Their project(s) — today role-only, any PM can edit any project | Owns Charter, Scope/Schedule, Resource Allocation, all 5 RAID logs, Health Declarations, Status Reports (+ Submit), Measurement entry, Contractual, uploads to AI Hub. Sends project for approval. |
| `TEAM_MEMBER` | Team Member | Assigned project(s) | Updates RAID items assigned to them; read-only on Charter/Status. Thin in implementation (dashboard-only menu). |
| `DELIVERY_EXCELLENCE` | Delivery Excellence (DE) | Cross-project (audit) | *Intended:* DE Assessment (Assessed Health + PCI), Findings, Alerts; governance approval of projects (PM → Send for Approval → DE Approve/Return). *State:* menu + route trees + DE dashboard exist; **backend write/approve gates for `DELIVERY_EXCELLENCE` are still partial** — verify against code and flag. |
| `PMO` | PMO | Cross-project | *Intended:* owns Contractual Compliance + Milestone Payments, runs Data Integrity checklist. *State:* no distinguishing write permission yet — read-only + dashboard/Project-Health menu. Flag. |

`roles-actions.md` is the closest existing role×action inventory but is **stale on DE** and
notes PM self-approval and PM "My Summary" on mock data. Verify against `backend/app/api/deps.py`.

### 1.4 Hierarchy & surfaces

`Project → Account → Geo → CXO (enterprise)`. Each non-project tier has two surfaces:
**Reporting** (the tier's own self-authored status/health) and **Review** (read-only rollup
of the tier below, with per-item Approve/Reject one tier up: Account Manager reviews
Projects; Geo Head reviews Accounts; CXO reviews Geos). The pattern is identical at every
tier by design.

### 1.5 Health & rollup

- **RAG, worst → best:** `Red`, `Potential Red`, `Amber`, `Green` (`HealthRating` enum;
  `HEALTH_RATING_SEVERITY` orders them worst-first).
- **Worst-wins rollup:** a parent's rating = the worst rating among its children. Applies
  (a) across the 6 categories → overall project health, and (b) child tier → parent tier.
- **6 health categories** (`Category` enum, shared by Health Declaration and DE Alert):
  `Core Delivery`, `People`, `Operational`, `Customer`, `Financial`, `Compliance`.
- **Two health inputs per project:** Delivery-Declared (PM self-assessment, 6 categories)
  and DE-Assessed (from the latest DE Assessment). `services/health_rollup.py`
  `compute_overall_project_health(delivery_declared, de_assessed)` combines them.
- Health Declarations are **dated, retained records** (never overwritten) — trendable.
  A newer *itemized* register (`project_health_items`, one line per category per period)
  is replacing the older single-rating-per-category model; **both coexist mid-migration.**
- Health exists at project (`health_declarations`), account (`account_health_declarations`),
  and geo (`geo_health_declarations`) level.

### 1.6 Engagement / measurement types (7)

`Development`, `Support` (Application/Infrastructure), `Professional Staffing`, `Testing`,
`Consulting`, `Cloud Maintenance`, `Cloud Migration`. Each has its own `measurement_*` and
`metric_target_*` table family and its own entry form. Entered inputs vs. read-only
computed metrics (`services/measurement_metrics.py`); some doc-listed metrics are left
`None` where no raw input exists. Baselines/formulas for several metrics are "QA to
provide" — an open gap.

### 1.7 Lifecycles (from `backend/app/schemas/enums.py`)

| Entity | Field | States |
|---|---|---|
| Project | `project_status` (`ProjectStatus`) | `Draft` → `Pending Approval` → `Approved`; plus `Hold`, `Closed`, `Open Only for Billing` |
| Project (DE governance) | `de_review_status` (`DeReviewStatus`) | *(null = allocated, not opened)* → `In Review` → `Returned` \| `Approved` |
| Project / Account / Geo Status Report | `ReportStatus` | `Draft` → `Submitted` → `Approved` \| `Rejected` |
| DE Assessment | `DEAssessmentStatus` | `Draft` → `Submitted` (*"Not Started"* = no row) |
| DE Module Review | `DeModuleReviewAction` | `Not Reviewed` → `Reviewed` \| `Gap Identified` |
| Rollup item (project→account, account→geo) | `RollupStatus` | `Pending` → `Pulled` \| `Ignored` (with Undo) |
| Action (Action Tracker) | `ActionStatus` | `OPEN` → `IN_PROGRESS` → `COMPLETED` → `CLOSED`, or → `CANCELLED` |
| DE Finding | `FindingStatus` | `Open` → `In Progress` → `Awaiting Closure` → `Closed`, or → `Cancelled` (+ legacy `On Hold`/`Deferred`) |
| AI field suggestion | `AiSuggestionStatus` | `pending` → `ignored` \| `resolved` |
| AI row suggestion | `AiRowSuggestionStatus` | `pending` → `ignored` \| `applied` |
| Backup/Restore | `BackupRestoreStatus` | `In Progress` → `Completed` \| `Failed` |
| RAID entities | per-entity `*Status` enums | Risk `Open/Monitoring/Closed`; Issue `New/Assigned/In Progress/Pending/Resolved/Closed`; Dependency `Not Started/In Progress/Completed/Blocked`; Assumption `Open/Closed/Cancelled` + Validation `Pending/Validated/Invalid`; Opportunity `Identified/Approved/Implemented/Closed` |

Reporting periods: `PeriodType` = `Weekly` \| `Monthly` \| `Baseline`. Weeks are keyed to
the Monday date. Project Status = weekly; Monthly Review = Measurements + Contractual +
RAIDO; DE Assessment cadence (monthly vs quarterly) is an **open decision**.

### 1.8 Module list (provisional — `01` is authoritative and may refine)

`MOD-` IDs, numbered as listed. Short code in brackets is used by `BR-*` / `SCR-*` / `FC-*`.

| MOD | Short | Module | Primary backend | Primary routes |
|---|---|---|---|---|
| MOD-AUTH | AUTH | Authentication & Access | `endpoints/auth.py`, `api/deps.py`, `core/session.py`, `core/security.py` | `/login`, `/login/callback` |
| MOD-REF | REF | Reference / Master Data | `endpoints/reference_data.py` | `/admin/accounts` |
| MOD-USER | USER | User & Role Administration | `endpoints/users.py` | `/admin/users` |
| MOD-PROJ | PROJ | Project Charter | `endpoints/projects.py` | `/new-project/[id]/project-charter*`, `/project-reporting/[id]/project-charter*` |
| MOD-STATUS | STATUS | Project Status Reporting | `endpoints/project_status.py` | `/project-reporting/[id]/project-status` |
| MOD-RAID | RAID | RAID(O) Registers | `endpoints/raid.py` | `.../raido` |
| MOD-HEALTH | HEALTH | Project Health Declarations | `endpoints/health_declarations.py` | `.../project-charter/self-assessment` |
| MOD-MEAS | MEAS | Measurement / Delivery Metrics | `endpoints/measurement.py`, `services/measurement_metrics.py` | `.../measurement` |
| MOD-TARGET | TARGET | Metric Targets | `endpoints/metric_target.py` | `.../measurement` (targets) |
| MOD-CONTRACT | CONTRACT | Contractual Compliance | `endpoints/contractual.py` | `.../contractual-compliance` |
| MOD-DEA | DEA | Delivery Excellence Assessment | `endpoints/de_assessment.py` | `.../de-assessment`, `/de-assessment/[id]` |
| MOD-DEAL | DEAL | DE Allocation | `endpoints/de_allocation.py` | `/de-allocation` |
| MOD-DEAP | DEAP | DE Governance Approval | `endpoints/de_approval.py`, `models/de_project_review.py`, `services/governance_completeness.py` | `/de-approval`, `/de-approval/[id]` |
| MOD-DI | DI | Data Integrity Checklist | `endpoints/data_integrity.py`, `services/data_integrity_rollup.py` | `/project-health/data-integrity` |
| MOD-ACCT | ACCT | Account Reporting & Health | `endpoints/regional_status.py` (account*), `endpoints/account_health_declarations.py` | `/account-reporting/[id]/*` |
| MOD-GEO | GEO | Geo Reporting & Health | `endpoints/regional_status.py` (geo*), `endpoints/geo_health_declarations.py` | `/geo-reporting/[id]/*` |
| MOD-ROLLUP | ROLLUP | Rollup & Aggregation | `endpoints/account_rollup.py`, `account_health_rollup.py`, `geo_rollup.py`; `services/*rollup*.py` | rollup panels inside reporting screens |
| MOD-REVIEW | REVIEW | Reporting / Review Cascade | review actions in `regional_status.py`, `project_status.py` | `/project-review/[id]`, `/account-review/[id]`, `/geo-review/[id]` |
| MOD-EXEC | EXEC | Executive Updates | `endpoints/executive_updates.py` | `/geo-reporting/[id]/executive-update` |
| MOD-ACTION | ACTION | Action Tracker | `endpoints/actions.py` | `/project-health/actions` + action panels |
| MOD-DASH | DASH | Dashboards | `endpoints/dashboard.py`, `services/dashboard.py` | `/dashboard/*`, `/project-health/*` |
| MOD-AI | AI | AI Assist & Documents | `endpoints/ai_suggestions.py`, `ai_row_suggestions.py`, `documents.py` | `.../ai-hub/document-processing` |
| MOD-INTG | INTG | Integrations & Backup | `endpoints/integrations.py` | `/admin/integrations` (menu present; `system-health` link dead) |
| MOD-AUDIT | AUDIT | Audit / Activity Log | `endpoints/audit.py`, `models/audit.py` | (no dedicated screen yet) |

### 1.9 ID conventions

`MOD-` modules · `BP-` processes · `FC-<MOD>-<NNN>` functional capabilities ·
`BR-<MOD>-<NNN>` business rules · workflows referenced by entity + state name ·
`SCR-<MOD>-<NN>` screens · `RPT-<NN>` reports · `DASH-<ROLE|SCOPE>-<NN>` dashboards ·
`N-<AREA>-<NAME>` notifications · `ENT-<NAME>` entities · `MD-<NAME>` master data ·
`SVC-<NAME>` service/domain-logic contracts · `API-<AREA>-<NN>` endpoints ·
`METRIC-<TYPE>-<NN>` measurement metrics · `NFR-<CATEGORY>-<NN>` targets ·
`TS-<AREA>-<NN>` test scenarios · `GAD-<NNN>` gaps/assumptions/decisions.
**Number in tens** (`010`, `020`, …) so inserts don't renumber references.

### 1.10 Source-material map

| Source | Path | Authoritative for |
|---|---|---|
| BRS | `docs/Project-Governance-Tool-BRS.md` | functional requirements (`FR-*`), scope, open items (§8), business objectives, current build status (§7). **v0.1 draft; predates Action Tracker, Executive Updates, DE Approval, Project Health portfolio, Consulting, Regions.** |
| UX requirements | `docs/ux-requirements.md` | per-screen fields/actions/states for the original 15 screens; proposed cadence controls (§7). Many items marked "⚠ proposed". |
| Role inventory | `roles-actions.md` | role × action, nav-vs-backend divergences. **Stale on DE.** |
| AI spec | `AI-Implementation.md` | the AI-assist pipeline, confidence model, apply/ignore, grid rows. |
| Auth plan | `Authentication.md` | OneLogin OIDC target design, `no_password` stopgap, session/`X-API-Key` model. |
| Data-entry guide | `DATA-ENTRY-GUIDE.md` | screen list, "populate in this order" flow, known UI gaps (geo RAG, contractual/milestone actuals). |
| Deployment | `deployment.md` | on-prem env vars, run steps, reverse-proxy/TLS prerequisite. |
| Design reference | `design-reference/*.md` + images | Action table columns (`Action-Table-Design.md`), Executive Content Builder spec (+ enh01), Project Health 14 sub-screens (`project-health-screens.md`). |
| Backlog | `docs/PendingPoints.txt` | ~50 decided/pending change requests (remove Billing Type & Engagement Type; add Critical/Product flags + Product combo; Applicable Phase multi-select; rename dashboards "My Summary"; RAIDO non-mandatory for approval, moved to a "Project Register"; approval routes to DE; Oracle ID mandatory to unlock right menu; etc.). |
| E2E flows | `docs/e2e-test-flow.csv` | existing end-to-end test scenarios. |
| Code | `backend/app/**`, `frontend/src/**`, `db/**` | **ground truth — always wins over prose above.** |
| TMS sample | `D:\BCT\projects\TMS_ProductBrain\sample-docs\**` | structure & depth template only (fictional product — do not import its domain facts). |

### 1.11 Legacy-doc → superseding document

| Legacy file | Superseded by |
|---|---|
| `docs/Project-Governance-Tool-BRS.md` | 00, 01, 04, 05, 06, 23, 24 |
| `docs/ux-requirements.md` | 08, 21, 14 |
| `roles-actions.md` | 07 |
| `AI-Implementation.md` | 22 |
| `Authentication.md` | 18, 19 |
| `DATA-ENTRY-GUIDE.md` | 02, 08 |
| `deployment.md` | 18 |
| `design-reference/*.md` | 08 (+ images → `product-brain/assets/`), 09, 13, 21 |
| `docs/PendingPoints.txt` | 23, 24 |
| `docs/e2e-test-flow.csv` | 25 |
| `BACKEND_CODE_REVIEW*.md`, `*_FIX_PLAN.md`, `FRONTEND_CODE_REVIEW.md`, `frontend-review.md`, `vapt-prompt.txt` | *not absorbed* — engineering-internal; security intent feeds 19 |

---

## §2. House style & global rules

**Front-matter block.** Every generated document opens with:

```
# NN — <Title>

**Document type:** Product-Brain Reference | Product-Brain Specification | Product-Brain Forward-Plan
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated <YYYY-MM-DD>, pending review
**Depends on:** product-brain/NN, product-brain/NN …   (or: none)
**Feeds:** product-brain/NN, product-brain/NN …

> **Purpose of this document.** <one paragraph: what question it answers and how later docs use it.>

---
```

Use today's date. `Document type`: **Reference** for 00–12, **Specification** for 13–22 & 26,
**Forward-Plan** for 23–24, and 25 is Specification.

**Rules:**
- Mirror the structure and heading style of the `Mirrors:` TMS doc; adapt every fact to
  ProjectGovernance. Do **not** carry TransFlow domain content across.
- Tables carry the detail; prose stays short. Add a Mermaid diagram wherever the mirrored
  TMS doc has one (state diagram, flowchart, or ER).
- **Cross-reference by ID.** Never restate a rule, status definition, or entity definition
  that another document owns — cite it (`see product-brain/05 §BR-PROJ-020`).
- Mark invented or unverified facts `ASSUMPTION: <fact> — to confirm with {owner}`. Mark
  unmeasured numbers `TARGET: <value> — baseline {date}`.
- If a `Consumes:` document does not exist yet, use §1 as fallback and leave
  `<!-- pending: reconcile with product-brain/NN -->` at each affected spot.
- **Code wins.** Where code/DDL disagrees with §1 or a legacy doc, follow the code and note
  the discrepancy in your report (and, if material, add a `GAD` line for `23`).
- Keep terminology identical to §1 everywhere (role codes, RAG values, category names,
  status strings, module short codes).
- No AS-IS/TO-BE split. Describe current behaviour; put in-flight/planned work in a clearly
  labelled subsection and cross-link `24`.
- No silent `TODO`s. Either fill it, mark it `ASSUMPTION:`, or record it as a `GAD` for `23`.

**Global Done-when checklist (every document):**
- [ ] Front-matter block present and correct.
- [ ] Section headings match the brief's `Required outline`.
- [ ] Every ID it defines is unique and follows §1.9; numbered in tens.
- [ ] Every ID it cites resolves in §1, an existing `product-brain/*.md`, or carries a `pending` marker.
- [ ] Assumptions marked `ASSUMPTION:`; targets marked `TARGET:`.
- [ ] Role codes / RAG values / status strings / module codes match §1 exactly.
- [ ] Depth within the brief's line-range target.
- [ ] Mermaid diagram(s) present where the mirrored TMS doc has one, and syntactically valid.

**Depth definitions:**
- **full** — enumerate every item; one table row per rule/status/screen/entity/endpoint;
  mirror TMS density. Target 300–600 lines.
- **lean** — every required section and ID present; tables for the material items only;
  diagrams only where they earn their place; prose tight. Target 120–300 lines.

---

## §3. Output layout & progress rule

```
product-brain/
├── document-generation-plan.md   ← this file (not a numbered doc)
├── 00_product_overview.md … 26_traceability_matrix.md
├── README.md                     ← generated last
└── assets/                       ← images/diagrams referenced by 08
```

Next target = lowest-numbered brief in §4 whose file is missing. `README.md` only after
`26` exists. When all exist, offer §6.

---

## §4. Per-document briefs

Template fields: **Output · Depth · Mirrors · Answers · Required outline · Read first
(repo / absorb / TMS) · Must include · Defines IDs · Consumes · Diagrams · Done when.**

---

### 00 — Product Overview
- **Output:** `product-brain/00_product_overview.md`
- **Depth:** lean (150–220 lines)
- **Mirrors:** `sample-docs\as-is-reference\00_product_overview.md` — same section shape; drop "Target Organizations" (single internal tenant).
- **Answers:** What is ProjectGovernance, who uses it, what is in/out of scope, and what is the end-to-end governance lifecycle?
- **Required outline:** 1 Product Purpose · 2 Business Problem (spreadsheet-patchwork table) · 3 User Groups (the 8 roles, one line each) · 4 In Scope · 5 Out of Scope · 6 Major Capabilities · 7 Major Modules (pointer to `01`) · 8 High-Level Governance Lifecycle (Mermaid) · 9 Major Integrations (OneLogin, AI pipeline, Oracle, M365/ticketing, backup — status each) · 10 Key Terminology (pointer to `03`) · 11 Assumptions.
- **Read first:** repo: `docs/Project-Governance-Tool-BRS.md` §1–2 §6–7, `docs/ux-requirements.md` §1, `backend/app/api/v1/router.py`, `roles-actions.md` · absorb: BRS §1–2 §6 · TMS: `00_product_overview.md`
- **Must include:** greenfield replacing spreadsheets; internal-only; on-prem + data-residency; Project→Account→Geo→CXO cascade with Reporting/Review surfaces; worst-wins RAG; the 8 role codes; `ASSUMPTION:` no confirmed product name; auth today is a no-password prototype.
- **Defines IDs:** none (references `MOD-*` from `01`).
- **Consumes:** 01, 03 → fallback §1.8 / §1.4.
- **Diagrams:** one Mermaid flowchart — the governance lifecycle (onboarding → weekly/monthly reporting → tiered review → executive update).
- **Done when:** 8 roles with exact codes; scope in & out both non-empty; lifecycle diagram renders; every integration has a status; assumptions marked.

---

### 01 — Module Catalogue
- **Output:** `product-brain/01_module_catalogue.md`
- **Depth:** full (350–550 lines)
- **Mirrors:** `sample-docs\as-is-reference\01_module_catalogue.md` — Module Index + one attribute table per module + relationship diagram + dependency matrix.
- **Answers:** What are the modules and how do they depend on each other?
- **Required outline:** 1 Module Index (MOD id, short code, name, lifecycle group) · 2 Module Details (one table per module: Module ID · Name · Purpose · Primary Users · Major Functions · Main Screens · Upstream Modules · Downstream Modules · Integrations · Major Business Entities) · 3 Module Relationships (Mermaid flowchart) · 4 Dependency Matrix · 5 Assumptions.
- **Read first:** repo: `backend/app/api/v1/router.py`, `backend/app/api/v1/endpoints/*.py` (skim each), `backend/app/models/*.py`, `frontend/src/lib/menu-config.ts`, `frontend/src/app/(app)/**` route tree · absorb: BRS §4 FR groups · TMS: `01_module_catalogue.md`
- **Must include:** the §1.8 module set (refine as code dictates — this doc is authoritative); note MOD-REVIEW & MOD-ROLLUP are cross-cutting patterns; note MOD-DEAL/DEAP/EXEC/ACTION/DASH(Project Health) are newer than the BRS; mark `TEAM_MEMBER`/`PMO` menus as dashboard-only today.
- **Defines IDs:** `MOD-*` (authoritative); module short codes used pack-wide.
- **Consumes:** 00 → fallback §1.
- **Diagrams:** operational-flow flowchart + cross-cutting flowchart (as TMS does).
- **Done when:** every backend endpoint file maps to exactly one module; every module lists ≥1 screen or is marked headless; upstream/downstream cited modules all resolve in the index.

---

### 02 — End-to-End Business Processes
- **Output:** `product-brain/02_end_to_end_business_processes.md`
- **Depth:** full (400–650 lines)
- **Mirrors:** `sample-docs\as-is-reference\02_end_to_end_business_processes.md` — Process Index + per-process (Field/Detail table, Main Flow, Alternate Flows, Exceptions, Business Rules referenced, Status Changes, System Interactions, Notifications, Outputs, Mermaid).
- **Answers:** How does the product behave across modules for the scenarios the business cares about?
- **Required outline:** Process Index (BP id, name, primary modules, start state, end state) · one H2 per process BP-01…BP-10.
- **Processes:** `BP-01` Project onboarding → charter → Send for Approval → DE governance approval → Approved. `BP-02` Weekly project status reporting (Draft → Submit). `BP-03` Monthly project review (Measurements + Contractual + RAIDO). `BP-04` DE monthly assessment (Assessed Health + PCI + Findings + Alert-if-not-Green). `BP-05` Reporting/Review cascade Project→Account→Geo→CXO (author → submit → pull/ignore/undo → approve/reject). `BP-06` Health declaration & worst-wins rollup (category → overall → tier). `BP-07` Executive Update preparation (Geo Head, draft-only). `BP-08` Action tracking lifecycle. `BP-09` Data-integrity / defaulter tracking. `BP-10` AI-assisted data entry (upload → extract → apply/ignore).
- **Read first:** repo: `DATA-ENTRY-GUIDE.md`, `backend/app/api/v1/endpoints/{projects,project_status,de_approval,de_assessment,regional_status,account_rollup,geo_rollup,actions}.py`, `backend/app/services/{account_rollup,geo_rollup,health_rollup,governance_completeness}.py` · absorb: BRS §3.2, DATA-ENTRY-GUIDE flow · TMS: `02_end_to_end_business_processes.md`
- **Must include:** PM self-approval today vs. intended DE approval (flag); pull/ignore/undo semantics; worst-wins at each hop; "report must be Submitted before Review shows Approve/Reject"; geo RAG screen gap (BP-06 alternate).
- **Defines IDs:** `BP-01…BP-10`.
- **Consumes:** 01 (modules), 05 (BR ids), 06 (status names), 07 (actors) → fallback §1; leave `pending` on specific `BR-*`.
- **Diagrams:** one Mermaid flowchart per process.
- **Done when:** all 10 processes present with every subsection; start/end states use §1.7 strings; every actor is a §1.3 role or `SYSTEM`; referenced `BR-*`/status names resolve or are `pending`.

---

### 03 — Glossary & Terminology
- **Output:** `product-brain/03_glossary_and_terminology.md`
- **Depth:** lean (120–200 lines)
- **Mirrors:** the "Key Terminology" section of TMS `00_product_overview.md`, expanded to a standalone A–Z.
- **Answers:** What does each domain term mean, used consistently pack-wide?
- **Required outline:** 1 How to use (this is the canonical vocabulary; other docs cite it) · 2 Glossary (alphabetical table: Term · Definition · Notes/see-also) · 3 Abbreviations · 4 Status-vocabulary index (pointer to `06`).
- **Read first:** repo: `backend/app/schemas/enums.py`, `roles-actions.md`, `docs/Project-Governance-Tool-BRS.md` §1.4 · absorb: BRS §1.4 · TMS: `00_product_overview.md` (terminology)
- **Must include:** RAG 4-state + worst→best order; worst-wins rollup; RAID / RAIDO; Reporting surface vs Review surface; Geo vs Region vs Account; Patch / scope; Work Context ("act as"); PCI Score; DE; PMO; Charter; Declaration vs Assessment; Health Item vs Health Declaration; Status Item vs Status Report; Reporting Period (Weekly/Monthly/Baseline); Monday-keyed week; Rollup (Pull / Ignore / Undo); Governance module (DE approval); Defaulter; My Summary; Project Health (portfolio); Executive Update; Key Metrics; Applicable Phase; Send for Approval; Open Only for Billing.
- **Defines IDs:** none (owns the term vocabulary).
- **Consumes:** 06 → fallback §1.7.
- **Diagrams:** none.
- **Done when:** every term used pack-wide appears once; each definition ≤ 3 sentences; no term contradicts §1.

---

### 04 — Functional Specification
- **Output:** `product-brain/04_functional_specification.md`
- **Depth:** full (500–800 lines)
- **Mirrors:** `sample-docs\as-is-reference\03_functional_specification.md` — 16-part template per module; Full vs Condensed depth per module.
- **Answers:** What does each module do, in detail?
- **Required outline:** Contents table (FS id, module, depth) · one H1/H2 per module using the 16 headings: Purpose · Actors · Preconditions · Functional Capabilities (`FC-<MOD>-*`) · Main Process · Inputs · Outputs · Business Rules (`BR-*` refs) · Validations · Status Behaviour · Exceptions · Notifications · Integration Points · Reports · Dependencies · Assumptions.
- **Full depth modules:** PROJ, STATUS, RAID, HEALTH, MEAS, CONTRACT, DEA, DEAP, ACCT, GEO, ROLLUP, REVIEW, ACTION, EXEC, DASH. **Condensed:** AUTH, REF, USER, TARGET, DEAL, DI, AI, INTG, AUDIT.
- **Read first:** repo: every `backend/app/api/v1/endpoints/*.py` (the target module's in full), matching `schemas/*.py`, `services/*.py`; `frontend/src/lib/api/*.ts` for the module · absorb: BRS §4 (all `FR-*`), `docs/ux-requirements.md` §4 · TMS: `03_functional_specification.md`
- **Must include:** the itemized vs. legacy health model coexistence (HEALTH); the 7 measurement types (MEAS); DE approval = per-governance-module review + completeness score (DEAP); work-context act-as (REVIEW); PM self-approval note (PROJ); AI never writes to business tables (AI).
- **Defines IDs:** `FC-<MOD>-<NNN>` (authoritative).
- **Consumes:** 01 (modules/short codes), 05 (BR), 06 (status), 09 (reports/notifications) → fallback §1; `pending` on unresolved `BR-*`/`N-*`.
- **Diagrams:** optional per-module Main Process flowchart for the most complex 3–4 modules.
- **Done when:** every §1.8 module has an entry; all 16 headings present for full-depth modules; every `FC-*` id unique; `BR-*`/status/report refs resolve or `pending`.

---

### 05 — Business Rules Catalogue  *(CRITICAL)*
- **Output:** `product-brain/05_business_rules_catalogue.md`
- **Depth:** full (400–650 lines); **≥ 60 rules**.
- **Mirrors:** `sample-docs\as-is-reference\04_business_rules_catalogue.md` — same columns + "How to Read" preamble + per-module rule count summary.
- **Answers:** What are the enforceable rules, uniquely identified, and where is each enforced?
- **Required outline:** 1 How to Read (columns; `BR-<MOD>-<NNN>`; severity scale `Blocking/High/Medium/Low/Advisory`; enforcement-layer convention) · 2 Rule Count Summary (per module) · 3…N one H2 per module with a rule table (Rule ID · Module · Business Rule · Trigger · Condition · System Action · Enforcement Layer · Severity · Remarks) · last H2 Cross-Module / Security.
- **Enforcement Layer values:** `UI` · `API` · `Service` · `Pydantic-schema` · `DB-trigger` · `External` · `Multiple` (name the definitive layer in Remarks).
- **Read first:** repo: `backend/app/api/deps.py`, all `backend/app/services/*.py`, endpoints `{projects,raid,project_status,health_declarations,de_assessment,de_approval,regional_status,account_rollup,account_health_rollup,geo_rollup,ai_suggestions,ai_row_suggestions,contractual,measurement,actions}.py`, `backend/app/schemas/enums.py`, `backend/tests/test_authorization.py`, `docs/PendingPoints.txt` · absorb: BRS §4 rule-like clauses, `roles-actions.md` enforcement notes · TMS: `04_business_rules_catalogue.md`
- **Must include:** worst-wins rollup (category→overall; child→parent); Send-for-Approval requires all Project Profile fields; project fields immutable after `Approved` except Project Type; account/geo scope enforcement (`require_account_scope`/`require_geo_scope`/`require_*_or_geo_scope`); `ADMIN` bypass; work-context act-as bounds; DE Alert mandatory when DE-Assessed health ≠ `Green`; AI suggestions never write to business tables + indicator stripped on edit/save/create; rollup Pull/Ignore idempotency + Undo; human-readable code uniqueness (`id_sequences`, `SELECT … FOR UPDATE`); status report must be `Submitted` before review; report `Draft→Submitted→Approved/Rejected` gating; computed measurement metrics not user-editable; commitment `Met/Not Met` & milestone `Paid On Time/Delayed/Yet To Be Paid` derivation; Oracle Project ID mandatory to unlock the right-hand menu (`PendingPoints` #1); DE/PMO write-gate gaps (record as `Advisory` + `GAD`); period/cadence rules (detail deferred to `14`).
- **Defines IDs:** `BR-<MOD>-<NNN>` (authoritative). Module short codes = `01`.
- **Consumes:** 01 (codes), 06 (status names), 07 (roles/scope) → fallback §1; `pending` where a status/role ref is unresolved.
- **Diagrams:** none.
- **Done when:** ≥ 60 rules; every column filled; every module code resolves; severity from the scale; each rule a single testable condition; rules enforced by a workflow transition cross-referenced to/from `06`.

---

### 06 — Status & Workflow Catalogue  *(CRITICAL)*
- **Output:** `product-brain/06_status_workflow_catalogue.md`
- **Depth:** full (400–650 lines)
- **Mirrors:** `sample-docs\as-is-reference\05_status_workflow_catalogue.md` — Conventions + per-entity Status Definitions table + Status Transitions table + Mermaid state diagram; rejection/cancellation/reopen/auto-vs-manual called out; transitions cite `BR-*` and `N-*`.
- **Answers:** What states can each entity be in and what transitions are legal?
- **Required outline:** 1 Conventions (table columns; Actor values incl. `SYSTEM`; transition type manual/automatic; Reversible? Yes/No/Restricted; flags vs statuses) · 2 Status-bearing entity index · 3…N one H2 per entity.
- **Entities:** Project (`project_status`) + `de_review_status` (sub-state) + flags; Project Status Report; Account Status Report; Geo Status Report; DE Assessment; DE Module Review; Rollup Item (project→account, account→geo); Action + Action History event types; Risk; Issue; Dependency; Assumption (+ Validation Status); Opportunity; DE Finding; AI Field Suggestion; AI Row Suggestion; Backup/Restore.
- **Read first:** repo: `backend/app/schemas/enums.py` (all `*Status` enums), endpoints `{projects,de_approval,de_assessment,project_status,regional_status,account_rollup,geo_rollup,actions,raid,ai_suggestions,ai_row_suggestions,integrations}.py`, `design-reference/Action-Table-Design.md` · absorb: BRS status mentions (FR-CHART-7 etc.) · TMS: `05_status_workflow_catalogue.md`
- **Must include:** Project `Draft→Pending Approval→Approved` + `Hold/Closed/Open Only for Billing`; `de_review_status` null→`In Review`→`Returned`/`Approved`; report `Draft→Submitted→Approved`/`Rejected` (reject → back to Draft for revision — verify); DE Assessment `Draft→Submitted` ("Not Started" = no row); Rollup `Pending→Pulled`/`Ignored` + Undo; Action `OPEN→IN_PROGRESS→COMPLETED→CLOSED`/`CANCELLED`, assignee-can-always-transition; per-RAID lifecycles from §1.7; AI suggestion lifecycles.
- **Defines IDs:** none new (owns the status vocabulary; `03` points here).
- **Consumes:** 05 (`BR-*`), 09 (`N-*`) → fallback §1; `pending` on specific ids.
- **Diagrams:** one Mermaid `stateDiagram-v2` per entity with a non-trivial lifecycle (≥ 8).
- **Done when:** every §1.7 entity covered; each transition row has actor + preconditions + BR ref (or `pending`) + reversibility; terminal states marked; auto vs manual labelled.

---

### 07 — Roles & Permissions Matrix
- **Output:** `product-brain/07_roles_permissions_matrix.md`
- **Depth:** full (350–550 lines)
- **Mirrors:** `sample-docs\as-is-reference\08_roles_permissions_matrix.md` — Roles table · Permission Verbs · Role × Permission matrix per module · status-dependent permissions · override authority · segregation of duties · scope model.
- **Answers:** Who can do what — per module, per action, per entity status, per scope?
- **Required outline:** 1 Roles (the 8, with code, who they are, typical scope) · 2 Permission Verbs · 3 Role × Permission Matrix by Module (one grid per module; legend ✔/–/S status-dependent/scope/own) · 4 Status-Dependent Permissions · 5 Scope Model (account/geo/global; `user_accounts`/`user_geos`; ADMIN bypass; `require_*` dependency factories) · 6 Work Context ("act as") · 7 Segregation of Duties · 8 Known Gaps (DE, PMO, PM self-approval).
- **Read first:** repo: `backend/app/api/deps.py` (every `require_*`), a slice of endpoints showing which dependency guards which route, `frontend/src/lib/menu-config.ts` (`ROLE_MENUS`, `WORK_CONTEXTS`, `ROLE_LANDING_ROUTE`), `backend/tests/test_authorization.py` · absorb & **supersede** `roles-actions.md`; BRS §3; `docs/ux-requirements.md` §2 · TMS: `08_roles_permissions_matrix.md`
- **Must include:** exact `RoleCode` values; the dependency factories `require_role`, `require_account_scope`, `require_geo_scope` (+ `bypass_roles`), `require_account_or_geo_scope`, `require_account_geo_scope`, `require_project_account_scope`, `require_project_de_scope`, `require_project_access`; ADMIN = superset + scope bypass; CXO also bypasses geo scope for review + Actions; Work Context: ACCOUNT_MANAGER→PM, GEO_HEAD→ACCOUNT_MANAGER/PM (client menu + list scoping; backend independently allows the lower-role writes within owned scope); DE & PMO not in most write/approve gates (gap); PM self-approves today.
- **Defines IDs:** none (owns the permission-verb vocabulary).
- **Consumes:** 01 (modules), 06 (statuses for status-dependent cells) → fallback §1.
- **Diagrams:** optional scope-model Mermaid (user → scope → visible records).
- **Done when:** all 8 roles × all modules covered; every `require_*` factory documented; work-context map matches `menu-config.ts`; gaps section names DE, PMO, PM self-approval with a `GAD` pointer.

---

### 08 — Screen Catalogue
- **Output:** `product-brain/08_screen_catalogue.md`
- **Depth:** full (500–800 lines)
- **Mirrors:** `sample-docs\as-is-reference\07_screen_catalogue.md` — Conventions · Screen Index (priority + condensed) · per-screen spec · field-level tables for a few key screens.
- **Answers:** What screens exist, who uses them, what do they do, and what does each action call?
- **Required outline:** 1 Conventions (`SCR-<MOD>-<NN>`; screen types List/Detail/Form/Workbench/Hub/Dashboard/Wizard; field-spec columns Field · Type · Mandatory · Source · Editable · Default · Validation · Business Rule) · 2 Screen Index · 3 Field-level specs (Project Charter/Profile; Self-Assessment RAG / health items; Risk register; DE Assessment; Account/Geo Status Report) · 4 Per-screen specs (ID, module, route, purpose, roles, sections, fields, actions→API, validations, `BR-*`, status/permission-driven behaviour, nav rail, navigation).
- **Read first:** repo: `frontend/src/app/(app)/**` full route tree, `frontend/src/components/**` domain folders, `frontend/src/lib/api/*.ts`, `frontend/src/lib/menu-config.ts`, `frontend/src/components/shell/*nav*.tsx` · absorb: `docs/ux-requirements.md` §3–4, `design-reference/*.md` + screenshots, `design-reference/project-health-screens.md`, `DATA-ENTRY-GUIDE.md` screen list · TMS: `07_screen_catalogue.md`
- **Must include:** the three reporting trees (`/new-project`, `/project-reporting`, `/account-reporting`, `/geo-reporting`) and their nav rails; the three review screens; `/project-health/*` 14 sub-screens (grids from `project-health-screens.md`); the 6 per-role `/dashboard/*` My Summary pages; `/de-allocation`, `/de-approval[/id]`, `/de-assessment[/id]`; `/admin/users`, `/admin/accounts`; login + callback; dead `system-health` link; AI Hub document-processing sub-route under each tree. Copy referenced screenshots into `product-brain/assets/` (list them; do not move originals until §5).
- **Defines IDs:** `SCR-<MOD>-<NN>` (authoritative).
- **Consumes:** 01 (modules), 05 (BR), 06 (status), 07 (roles), 17 (API ids) → fallback §1; `pending` on `API-*`.
- **Diagrams:** optional navigation-map Mermaid.
- **Done when:** every `page.tsx` route has a `SCR-*` entry; field-level tables present for the 5 named screens; each action names its API path or a `pending` marker; nav rails documented.

---

### 09 — Reports, Dashboards & Notifications Catalogue
- **Output:** `product-brain/09_reports_dashboards_notifications_catalogue.md`
- **Depth:** full (300–500 lines)
- **Mirrors:** `sample-docs\as-is-reference\11_reports_notifications_catalogue.md` — Part A reports/dashboards, Part B notifications; ID conventions; standard behaviours.
- **Answers:** What does the product surface as reports, dashboards, and alerts?
- **Required outline:** Part A — 1 Conventions · 2 Per-role My Summary dashboards (`DASH-*`: purpose, audience, tiles, data source, drill-ins) · 3 Project Health portfolio (14 grids: KPIs + columns) · 4 Governance / Account matrix + Top Highlights · 5 Account/Geo dashboards. Part B — 6 Notification & nudge events (`N-*`: trigger, recipients, channel, template intent).
- **Read first:** repo: `backend/app/services/dashboard.py`, `backend/app/api/v1/endpoints/dashboard.py`, `frontend/src/lib/api/{dashboard,pm-dashboard,account-head-dashboard,geo-head-dashboard,pmo-dashboard,de-dashboard,project-health-dashboard,project-health-lists}.ts`, `frontend/src/components/dashboard/**`, `design-reference/project-health-screens.md`, dashboard screenshots · absorb: BRS §4.9 · TMS: `11_reports_notifications_catalogue.md`
- **Must include:** which dashboards call the real API vs. still on mock data (PM My Summary mock; DE My Summary real; per `roles-actions.md` + frontend agent notes — verify); "aggregation is computed live, not stored"; proposed "data as of" indicator (`ASSUMPTION` / `GAD`); notification events even if not yet implemented (DE alert nudge, weekly/monthly submission reminder, defaulter list, review-pending, approval decision) — mark implemented vs. planned.
- **Defines IDs:** `RPT-*`, `DASH-*`, `N-*` (authoritative).
- **Consumes:** 01, 07 (audience), 14 (cadence for reminders) → fallback §1.
- **Diagrams:** none required.
- **Done when:** all 6 My Summary dashboards + 14 Project Health grids listed with tiles/columns; each `N-*` has trigger + recipients + channel + implemented/planned flag.

---

### 10 — Data / Entity Catalogue
- **Output:** `product-brain/10_data_entity_catalogue.md`
- **Depth:** full (400–650 lines)
- **Mirrors:** `sample-docs\as-is-reference\12_data_entity_catalogue.md` — business entities (not tables); per-entity attribute set; conceptual Mermaid ER.
- **Answers:** What are the business entities, their attributes, relationships, and lifecycles?
- **Required outline:** 1 Conventions (`ENT-<NAME>`; key = business code + surrogate; relationship notation; Lifecycle → `06` or "no status") · 2 Entity Index · 3…N per entity (Purpose · Key identifier · Major attributes · Relationships · Owning module · Lifecycle · Retention) · last Conceptual ER Diagram.
- **Read first:** repo: every `backend/app/models/*.py`, `backend/app/models/mixins.py`, `backend/app/services/code_generator.py` (business keys) · absorb: BRS §6 · TMS: `12_data_entity_catalogue.md`
- **Must include:** Project (+ Oracle IDs, Resources), Health Declaration + Health Item (project/account), Status Report + Status Item (project/account/geo), the 5 RAID entities, Measurement (per type) + child tables (dev defects, staffing priority metrics), Metric Target (per type), Contractual Commitment + Actual, Milestone Payment + Actual, DE Assessment + Finding + Alert, DE Module Review, Action + History, Executive Update, Rollup-tracking tables, Project Document, AI Field/Row Suggestion, User/Role/UserAccount/UserGeo, Reporting Period, Organization/Geo/Region/Account/Project Type/Product, Audit/Activity Log, `id_sequences`. Retention: NFR-5 "history retained, never overwritten".
- **Defines IDs:** `ENT-*` (authoritative).
- **Consumes:** 01 (owning module), 06 (lifecycle), 11 (physical tables) → fallback §1; `pending` on table refs.
- **Diagrams:** one conceptual Mermaid `erDiagram` (core lifecycle + rollup).
- **Done when:** every model class maps to an `ENT-*` (or is noted as a join/child); each entity names owning module + lifecycle; ER diagram covers the core chain.

---

### 11 — Database Schema Reference
- **Output:** `product-brain/11_database_schema_reference.md`
- **Depth:** full (450–700 lines)
- **Mirrors:** no direct TMS doc (TMS had a stored-procedure interface); model on TMS `12`'s table discipline but describe **physical DDL**.
- **Answers:** What is the physical schema of record, given there is no migration framework?
- **Required outline:** 1 How the schema is managed (`db/tables/*.sql` + `db/run_all.sql` include order; `db/add_*.sql` patch scripts; `Base.metadata` for tests; **no Alembic** — risk) · 2 Extensions & functions (`00_extensions_and_functions.sql`: `pgcrypto`, `set_updated_at()` trigger pattern) · 3 Table groups (reference/users, project & charter, health, status, RAID, measurement, metric targets, contractual, DE, data integrity, rollup tracking, executive updates, actions, AI, documents, integrations, audit, sequences) · 4 Per-table summary (name · purpose · key columns · FKs · generated columns · triggers · notable absences) · 5 Value-set enforcement note (no CHECK constraints; Pydantic StrEnums only) · 6 `id_sequences` mechanism · 7 Known schema risks (no migrations; patch-script drift; enums-as-strings).
- **Read first:** repo: `db/run_all.sql`, every `db/tables/*.sql`, `db/add_*.sql`, `backend/scripts/migrate_2026_08_review.sql`, `backend/app/core/db.py`, `BACKEND_CODE_REVIEW.md` (schema notes) · absorb: none · TMS: `12_data_entity_catalogue.md` (format discipline only)
- **Must include:** the 47-file list with include order; `set_updated_at` `BEFORE UPDATE` trigger on each table; generated duration columns on `projects`; the "no CHECK constraint" fact; `id_sequences` + `SELECT … FOR UPDATE`; the patch-scripts (`add_regions`, `add_consulting_*`, `add_critical_product_flags`, `add_de_approval_fields`, `add_de_assessment_workspace_fields`) as the de-facto migration trail.
- **Defines IDs:** none (uses table names as ids; `10` `ENT-*` map to these).
- **Consumes:** 10 (`ENT-*` ↔ table map) → fallback: build the map here and mark `pending` for `10`.
- **Diagrams:** optional table-group Mermaid.
- **Done when:** every `db/tables/*.sql` file represented; include order stated; enforcement-gap and no-migration-tool risks called out; each table lists FKs + triggers.

---

### 12 — Master & Reference Data Catalogue
- **Output:** `product-brain/12_master_reference_data_catalogue.md`
- **Depth:** lean (150–260 lines)
- **Mirrors:** `sample-docs\as-is-reference\09_master_data_catalogue.md` — `MD-<NAME>`; per-entity 8 attributes; lifecycle; source.
- **Answers:** What reference data exists, who owns it, who consumes it, and where does it come from?
- **Required outline:** 1 Conventions (`MD-*`; source values Internal-admin / Seed-script / Oracle-mapped / Config) · 2 Master Data Index · 3…N per entity (Purpose · Key attributes · Owner · Used-by modules · Validation · Active/inactive behaviour · Source).
- **Entities:** Organization (BCTPL/BCTC/FT), Geo (APAC/MEA/US), Region, Account, Project Type (incl. Consulting), Product, Reporting Period.
- **Read first:** repo: `backend/app/models/reference_data.py`, `backend/app/api/v1/endpoints/reference_data.py`, `backend/app/master_data/**`, `db/tables/01_reference_data.sql`, `db/add_regions.sql`, `db/seed_dev.sql` · absorb: BRS FR-ADM-4, `docs/ux-requirements.md` §4.15, `DATA-ENTRY-GUIDE.md` (which have admin screens vs seed-only) · TMS: `09_master_data_catalogue.md`
- **Must include:** which entities have an admin screen (Accounts) vs. seed-script/DB only (Geos, Project Types, Organizations, Reporting Periods per DATA-ENTRY-GUIDE — verify current); the Excel master-data import CLI (`backend/app/master_data/`, `python -m scripts.import_master_data`); Region added later and not yet scoped in RBAC.
- **Defines IDs:** `MD-*` (authoritative).
- **Consumes:** 01 (used-by modules), 10 (entities) → fallback §1.
- **Diagrams:** none.
- **Done when:** all 7 entities documented with 8 attributes each; source classified; admin-screen vs seed-only stated per entity.

---

### 13 — Domain Logic & Rollup Specification
- **Output:** `product-brain/13_domain_logic_and_rollup_specification.md`
- **Depth:** full (400–650 lines)
- **Mirrors:** `sample-docs\as-is-reference\06_database_sp_interface_specification.md` — but each "contract" is a **Python service**, not a stored procedure. Same spirit: name it, state what it does, its inputs/outputs, the rules it enforces, the status transitions it drives.
- **Answers:** What is the computed/domain logic behind the screens, and exactly how do the rollups work?
- **Required outline:** Part A — Service Contracts: 1 Conventions (`SVC-<NAME>`; params direction; error modes) · 2…N per service (Purpose · Callers · Inputs · Outputs · Business rules enforced (`BR-*`) · Related status transitions · Error modes · Remarks). Part B — Rollup & Aggregation Semantics: worst-wins reducer (category → overall; child tier → parent); `compute_overall_project_health(delivery_declared, de_assessed)`; period-scoped Key Metrics summation (project → account → geo); Status Item vs Health Item rollup; Pull/Ignore/Undo state machine; what is computed live vs. cached on `projects`; DE governance completeness scoring.
- **Services:** `health_rollup`, `account_rollup`, `account_health_rollup`, `geo_rollup`, `data_integrity_rollup`, `governance_completeness`, `measurement_metrics`, `code_generator`, `dashboard` aggregation.
- **Read first:** repo: every `backend/app/services/*.py`, `backend/app/crud/*.py` (esp. `base.py`), `backend/app/api/v1/factory.py`, endpoints that call the services · absorb: none (new) · TMS: `06_database_sp_interface_specification.md`
- **Must include:** the exact worst-wins ordering (`HEALTH_RATING_SEVERITY`); that rollups are computed at query time (not stored) except cached health on `projects`; `code_generator` prefixes (`PRJ-YYYY-NNNN`, `RSK/ISS/DEP/ASM/OPP/ALT/ACT-*`) + `FOR UPDATE`; `measurement_metrics` leaves some metrics `None`; `governance_completeness` `GovernanceModuleKey` + % over mandatory subset.
- **Defines IDs:** `SVC-*` (authoritative).
- **Consumes:** 05 (`BR-*`), 06 (transitions), 10 (`ENT-*`), 14 (period model), 15 (metric formulas) → fallback §1; `pending` on `BR-*`.
- **Diagrams:** one Mermaid flowchart of the rollup chain (project category → project overall → account → geo → enterprise) + one of the Pull/Ignore/Undo state machine.
- **Done when:** all 9 services have a contract; Part B explains worst-wins + period summation + pull/ignore precisely enough to re-implement; cached-vs-live is explicit.

---

### 14 — Reporting Period & Cadence Model
- **Output:** `product-brain/14_reporting_period_and_cadence_model.md`
- **Depth:** lean (150–280 lines)
- **Mirrors:** no direct TMS doc; structure like a focused spec with decision callouts.
- **Answers:** What is the period/cadence model, and what must be ratified?
- **Required outline:** 1 Period types (`Weekly` / `Monthly` / `Baseline`) · 2 Week keying (Monday date) · 3 "Current period" resolution per screen · 4 Per-module expected cadence (table: module · cadence · source of truth) · 5 Monthly Review composition (Measurements + Contractual + RAIDO) · 6 Submission & defaulter tracking (per tier) · 7 Interaction with Data Integrity (`16`) · 8 Open decisions (each as `DECISION REQUIRED` → `23`).
- **Read first:** repo: `backend/app/models/reference_data.py` (`reporting_periods`), `frontend/src/lib/period-utils.ts`, `frontend/src/components/shell/reporting-period-badge.tsx`, `frontend/src/components/shell/project-nav.tsx` (Weekly/Monthly filtering), `backend/app/api/v1/endpoints/{project_status,measurement,contractual,de_assessment}.py` · absorb: `docs/ux-requirements.md` §7 + §4 cadence notes, BRS §8 Open Items 3–6 · TMS: (structure only)
- **Must include:** which cadences are confirmed vs. "⚠ proposed"; DE Assessment monthly-vs-quarterly is open; RAID Last/Next Review Date exists only on Risk today (Open Item 3); Measurement reporting-period history proposed for all 6→7 tabs (Open Item 4); the "data as of" dashboard indicator (Open Item 6).
- **Defines IDs:** none (feeds `05`, `16`).
- **Consumes:** 05 (period `BR-*`), 16 (data-integrity cadence) → fallback §1.
- **Diagrams:** optional timeline/Gantt-style Mermaid of a monthly cycle.
- **Done when:** every module has a stated cadence + source; open decisions each have a `GAD` line; "current period" resolution documented for status, measurement, DE assessment, dashboards.

---

### 15 — Measurement Metrics & Formula Reference
- **Output:** `product-brain/15_measurement_metrics_and_formula_reference.md`
- **Depth:** full (350–600 lines)
- **Mirrors:** no direct TMS doc; catalogue style, one section per engagement type.
- **Answers:** For each engagement type, what is entered vs. computed, and by what formula?
- **Required outline:** 1 Conventions (`METRIC-<TYPE>-<NN>`; Entered vs Computed; unit; baseline; target source) · 2…8 one H2 per type (Development, Support, Professional Staffing, Testing, Consulting, Cloud Maintenance, Cloud Migration): Input fields table · Computed metrics table (id · name · formula · unit · baseline · target) · Child tables · Notes · 9 Gaps (metrics left `None`; "QA to provide" baselines/formulas).
- **Read first:** repo: `backend/app/models/measurement.py`, `backend/app/models/metric_target.py`, `backend/app/services/measurement_metrics.py`, `backend/app/api/v1/endpoints/{measurement,metric_target}.py`, `frontend/src/components/new-project/measurement/**`, `db/tables/11-16*.sql`, `db/tables/24-29*.sql`, `db/add_consulting_measurements.sql` · absorb: BRS §4.5, `docs/ux-requirements.md` §4.10, `docs/PendingPoints.txt` #10/#11/#27 · TMS: (structure only)
- **Must include:** Development SPI/CPI/Effort Variation/Defect Leakage/coverage; Support SLA compliance % by priority + MTTRs; Staffing response-time / % qualifying / % joining / lead time by priority; Testing execution & automation coverage, productivity; Cloud Maintenance availability %; Cloud Migration success rate / downtime; Consulting = Effort Variation, SPI, CPI (per `PendingPoints` #10); explicitly flag every formula/baseline that is "QA to provide" as `ASSUMPTION`/`GAD`.
- **Defines IDs:** `METRIC-<TYPE>-<NN>` (authoritative).
- **Consumes:** 13 (`SVC-measurement_metrics`), 04 (MEAS spec) → fallback §1.
- **Diagrams:** none.
- **Done when:** all 7 types present; every computed metric has a formula or an explicit `ASSUMPTION: formula pending QA`; entered vs computed clearly separated; child tables noted.

---

### 16 — Data Integrity Checklist Specification
- **Output:** `product-brain/16_data_integrity_checklist_specification.md`
- **Depth:** lean (150–260 lines)
- **Mirrors:** no direct TMS doc; focused spec.
- **Answers:** How does the checklist decide "updated / not updated" per project per period?
- **Required outline:** 1 Purpose · 2 Catalog items (table: item · module · grouping) · 3 Freshness source map (item → table/column that answers "last updated for this project in this period") · 4 Per-item expected cadence · 5 Evaluation logic (Updated / Not Updated) · 6 Project view vs portfolio view · 7 Relationship to defaulter tracking (`14`) · 8 Gaps.
- **Read first:** repo: `backend/app/services/data_integrity_rollup.py`, `backend/app/api/v1/endpoints/data_integrity.py`, `backend/app/models/data_integrity.py`, `db/tables/20_data_integrity_checklist.sql` · absorb: BRS §4.8, `docs/ux-requirements.md` §4.13 · TMS: (structure only)
- **Must include:** the `module_name` → source-table/column mapping the service uses; that each row is judged against its own cadence (weekly status vs monthly RAID vs monthly/quarterly DE); admin-managed catalog; portfolio "Not Updated" filter with drill-in.
- **Defines IDs:** `DI-*` for checklist items (authoritative).
- **Consumes:** 14 (cadence), 13 (`SVC-data_integrity_rollup`), 01 (modules) → fallback §1.
- **Diagrams:** none.
- **Done when:** every catalog item mapped to a freshness source + cadence; evaluation logic stated precisely; portfolio vs project view distinguished.

---

### 17 — API Specification
- **Output:** `product-brain/17_api_specification.md`
- **Depth:** full (450–750 lines)
- **Mirrors:** `sample-docs\modernization\16_api_specification.md` — Conventions + representative endpoints per domain; each endpoint mapped to its service + `BR-*` + status preconditions; several full request/response examples.
- **Answers:** What are the REST APIs and what does each enforce?
- **Required outline:** 1 Conventions (base `/api/v1`; `X-API-Key` + `pg_session` cookie; the Next rewrite proxy; error shape; pagination `skip`/`limit`; `PaginationParams`) · 2 AuthN · 3 AuthZ (dependency factories from `07`) · 4…N one H2 per domain with an endpoint table (`API-<AREA>-<NN>` · Method · Path · Purpose · Auth · Authz dependency · Request · Response · Validations · `BR-*` · Status preconditions · Service/CRUD · Errors) · last: ≥ 6 full request/response examples.
- **Read first:** repo: `backend/app/main.py`, `backend/app/api/v1/router.py`, `backend/app/api/v1/factory.py` (generic CRUD router), `backend/app/api/deps.py`, every `backend/app/api/v1/endpoints/*.py`, matching `backend/app/schemas/*.py`, `backend/app/core/{security,session,config}.py` · absorb: none · TMS: `16_api_specification.md`
- **Must include:** the two-gate model (`verify_api_key` + `get_current_user`) + `touch_project_on_write`; `/auth/*` is pre-session; `factory.build_crud_router` pattern (reference data, etc.); domains: auth, reference data, users, projects (+ send-for-approval / approve), project-status (+ items), raid (5), health-declarations (+ items), account/geo health, regional status (+ items + review), rollup (account/geo/health), de-assessment, de-allocation, de-approval, data-integrity, measurement, metric-target, contractual, executive-updates, actions, ai-suggestions, ai-row-suggestions, documents (multipart), integrations, audit, dashboard.
- **Defines IDs:** `API-<AREA>-<NN>` (authoritative).
- **Consumes:** 05 (`BR-*`), 06 (status), 07 (authz), 13 (`SVC-*`), 10/11 (entities/tables) → fallback §1; `pending` on `BR-*`.
- **Diagrams:** optional request-lifecycle Mermaid (proxy → gates → route → service → DB).
- **Done when:** every endpoint module has a table; each row names its authz dependency + service + status preconditions; ≥ 6 complete examples; error shape documented once.

---

### 18 — Solution Architecture
- **Output:** `product-brain/18_solution_architecture.md`
- **Depth:** lean (180–320 lines)
- **Mirrors:** `sample-docs\modernization\15_target_solution_architecture.md` — principles + logical diagram + deployment diagram + component descriptions; but this is **current-state** (with forward items flagged), not TO-BE.
- **Answers:** What does the system look like, and how is it deployed?
- **Required outline:** 1 Architectural principles · 2 Logical architecture (Browser SPA → Next.js App Router + rewrite proxy → FastAPI [2 gates + touch-on-write] → services/CRUD → SQLAlchemy async → PostgreSQL) + Mermaid · 3 Identity (OneLogin OIDC; `no_password` dev toggle) · 4 Integration seams (AI pipeline: vLLM + external parsing + Kafka, POST-in; BCT Oracle: ID mapping only; M365 / ticketing: registry only; backup/restore: logged trigger) · 5 Document storage (local filesystem) · 6 Logging / audit · 7 Deployment topology (on-prem, `uvicorn` + `next start`, process manager, DB host, reverse-proxy/TLS prerequisite for OneLogin) + Mermaid · 8 Forward items (cross-link `24`).
- **Read first:** repo: `backend/app/main.py`, `backend/app/core/{config,db,security,session}.py`, `frontend/next.config.ts`, `frontend/src/lib/api/client.ts`, `deployment.md`, `Authentication.md` · absorb: `deployment.md`, `Authentication.md` (context) · TMS: `15_target_solution_architecture.md`
- **Must include:** no stored procedures / no migration framework; same-origin via Next rewrite (why: session cookie); `X-API-Key` as defence-in-depth; the HTTP-only-on-internal-IPs → HTTPS prerequisite; DB at `192.168.1.175` (`ASSUMPTION:` if not re-confirmed).
- **Defines IDs:** none.
- **Consumes:** 01, 17 (API), 19 (security), 22 (AI) → fallback §1.
- **Diagrams:** logical Mermaid + deployment Mermaid (both required).
- **Done when:** both diagrams present; every integration seam has a current status; forward items cross-link `24`; principles reflect greenfield reality (not TMS's SP-retention principle).

---

### 19 — Security & Audit Specification
- **Output:** `product-brain/19_security_and_audit_specification.md`
- **Depth:** lean (180–320 lines)
- **Mirrors:** `sample-docs\modernization\18_security_audit_specification.md` — objectives, authN, authZ, sessions, sensitive data, audit tiers, integration security.
- **Answers:** How are authentication, authorization, sessions, sensitive data, and audit handled?
- **Required outline:** 1 Security objectives · 2 Authentication (`no_password` stopgap risk; OneLogin OIDC target; `X-API-Key`; `pg_session` JWT cookie; strict pre-provisioned users) · 3 MFA (open decision) · 4 Authorization (RBAC + account/geo scope; dependency factories; ADMIN bypass; work-context; DE/PMO gaps) · 5 Session management (TTL, cookie flags, 401 handling) · 6 Sensitive data & data residency (on-prem, NFR-1/2; documents on local FS) · 7 Audit & activity logging (`user_activity_log`; coverage gaps; `touch_project_on_write`) · 8 Integration security (client secret handling, HTTPS prerequisite) · 9 Known gaps & risks (→ `23`).
- **Read first:** repo: `backend/app/core/{security,session,config}.py`, `backend/app/api/deps.py`, `backend/app/api/v1/endpoints/{auth,audit}.py`, `backend/app/models/audit.py`, `Authentication.md`, `vapt-prompt.txt`, `deployment.md` · absorb: `Authentication.md`, BRS §5/§7, `vapt-prompt.txt` intent · TMS: `18_security_audit_specification.md`
- **Must include:** "sign-in matches an identifier to a user record with no password check" is the current default — highest-priority `RISK`/`DECISION`; the single shared `X-API-Key`; no per-request identity before the recent `get_current_user` addition (now present — verify); audit-log coverage "needs confirmation" (BRS FR-AUTH-4).
- **Defines IDs:** none (may add `NFR-SEC-*` placeholders → `20` owns them).
- **Consumes:** 07 (authz model), 17 (API auth), 20 (`NFR-SEC-*`) → fallback §1.
- **Diagrams:** optional auth-flow Mermaid (OneLogin redirect round-trip).
- **Done when:** both auth modes documented; DE/PMO gaps + no-password default recorded as `GAD`; audit tiers listed with coverage status; data-residency stated.

---

### 20 — Non-Functional Requirements
- **Output:** `product-brain/20_non_functional_requirements.md`
- **Depth:** lean (150–280 lines)
- **Mirrors:** `sample-docs\modernization\19_non_functional_requirements.md` — `NFR-<CATEGORY>-<NN>` with Requirement · Target · Measurement · Verified by; "how to read an NFR"; load model.
- **Answers:** What are the measurable targets, and how is each verified?
- **Required outline:** 1 How to read an NFR · 2 Load model (`ASSUMPTION:` — internal user counts) · 3…N per category: Performance, Availability, Scalability/Concurrency, Security, Reliability, Maintainability, Observability, Browser support, Accessibility, Backup/Recovery, Data retention, Data residency.
- **Read first:** repo: `docs/Project-Governance-Tool-BRS.md` §5, `deployment.md`, `backend/app/services/dashboard.py` (aggregation cost), `frontend/package.json` (browser targets) · absorb: BRS §5 (one-line table — expand each) · TMS: `19_non_functional_requirements.md`
- **Must include:** on-prem hosting & data residency as hard NFRs (NFR-1/2/3); "history retained, never overwritten" (NFR-5); desktop-first, mobile "should work" (NFR-6); RBAC + MFA + encryption + backup (NFR-7); every quantitative value marked `TARGET: … — baseline {date}` (nothing is baselined yet).
- **Defines IDs:** `NFR-<CATEGORY>-<NN>` (authoritative).
- **Consumes:** 18 (architecture), 19 (security), 13 (aggregation perf) → fallback §1.
- **Diagrams:** none.
- **Done when:** every NFR has target + measurement + verification method; unbaselined values all marked `TARGET:`; residency/retention/desktop-first present.

---

### 21 — UI/UX Pattern Specification
- **Output:** `product-brain/21_ui_ux_pattern_specification.md`
- **Depth:** lean (200–340 lines)
- **Mirrors:** `sample-docs\modernization\17_ui_ux_specification.md` — common patterns, not per-screen redesign; how status + permissions drive the UI.
- **Answers:** What common UX patterns do all screens follow, and how do status/permissions drive the UI?
- **Required outline:** 1 Scope & principles · 2 App shell (header, role-aware sidebar `menu-config`, Work Context combo, footer) · 3 Navigation (route groups, nested layouts, nav rails per reporting tree) · 4 List / register tables (filter/sort, import via Excel/clipboard paste, export, pagination bar, register-import match) · 5 Entry forms (`form-primitives`, `editable-text-list`, `multi-select-checklist`, entry-form, confirmation-dialog) · 6 Status & health display (RAG 4-state semantic colour, `status-badge`) · 7 Computed vs entered fields · 8 AI assist surfacing (confidence box before control, info popup, Apply/Ignore, row-level for grids) · 9 Reporting-period selector/badge · 10 Review approve/reject action bar · 11 Feedback (sonner toasts, global mutation overlay, empty/loading/error states) · 12 Responsive (desktop-first) · 13 Accessibility.
- **Read first:** repo: `frontend/src/components/shell/**`, `frontend/src/components/forms/**`, `frontend/src/components/ui/**`, `frontend/src/lib/{menu-config,excel-io,clipboard-table-parse,health-categories,section-accent-colors}.ts`, `frontend/src/components/ai/**`, `design-reference/{executive-content-builder,executive-content-builder-enh01,Action-Table-Design}.md`, `design-reference/*.html` · absorb: `docs/ux-requirements.md` §5 · TMS: `17_ui_ux_specification.md`
- **Must include:** "server re-checks; UI never relies on hiding for security"; RAG as a semantic 4-state (not a 2/3-state badge); AI indicator removed on edit/save/create; clipboard image + Excel-range paste (no spreadsheet lib, merged cells flattened); Work Context only changes menu + list scoping + landing route (backend independently enforces).
- **Defines IDs:** none.
- **Consumes:** 07 (permissions), 06 (status), 08 (screens), 22 (AI) → fallback §1.
- **Diagrams:** optional app-shell/layout Mermaid.
- **Done when:** every pattern from the mirrored TMS doc has a ProjectGovernance answer; RAG colour convention stated; AI surfacing + Work Context documented; no per-screen redesign.

---

### 22 — AI-Assist Specification
- **Output:** `product-brain/22_ai_assist_specification.md`
- **Depth:** lean (180–300 lines)
- **Mirrors:** no direct TMS doc; consolidate `AI-Implementation.md` into pack format.
- **Answers:** How does the AI assistant work, and what are its guarantees?
- **Required outline:** 1 Objective & non-goals · 2 Pipeline boundary (parse outside → LLM extract → app stores JSON; local vLLM OpenAI-compatible; Kafka) · 3 Supported inputs · 4 Extraction schemas (Project Creation / Project Reporting / General) · 5 Output JSON shape (value, confidence, source, location, evidence) · 6 Field suggestions vs row suggestions (RAID grids) · 7 Confidence model + info box · 8 Apply / Ignore + lifecycle (`pending → ignored/resolved` | `pending → ignored/applied`) · 9 "AI never writes to business tables" + indicator removal on edit/save/create · 10 Screens covered · 11 Backing tables & endpoints · 12 Gaps / open items.
- **Read first:** repo: `AI-Implementation.md`, `backend/app/api/v1/endpoints/{ai_suggestions,ai_row_suggestions,documents}.py`, `backend/app/models/{ai_suggestions,ai_row_suggestions,documents}.py`, `backend/app/schemas/enums.py` (`AiSuggestionStatus`, `AiRowSuggestionStatus`, `DocumentAiStatus`, `DocumentContext`), `frontend/src/components/ai/**`, `frontend/src/lib/api/{ai-suggestions,ai-row-suggestions,documents}.ts`, `db/tables/{30,31,32}*.sql`, `backend/tests/test_ai_suggestions.py` · absorb & **supersede** `AI-Implementation.md` · TMS: (none)
- **Must include:** row suggestion "Apply" calls that entity's normal create endpoint; `DocumentAiStatus` Not Processed/Processing/Processed/Excluded; `DocumentContext` create/reporting; per-screen + per-period scoping of suggestions; PendingPoints #2 ("AI button enabled only if AI data available for the screen").
- **Defines IDs:** none (may reference `SCR-*`, `API-*`).
- **Consumes:** 06 (suggestion lifecycles), 08 (screens), 17 (endpoints) → fallback §1.
- **Diagrams:** one Mermaid flowchart of the extract → review → apply flow.
- **Done when:** pipeline boundary explicit; both suggestion types documented; the "never writes to business tables" guarantee and indicator-removal rule stated; backing tables/endpoints listed.

---

### 23 — Gaps, Assumptions & Decisions Register
- **Output:** `product-brain/23_gaps_assumptions_decisions_register.md`
- **Depth:** full (350–600 lines)
- **Mirrors:** `sample-docs\as-is-reference\13_gaps_assumptions_decisions.md` — `GAD-<NNN>`; Type / Module / Description / Impact / Recommendation / Owner / Status; summary counts; highest-attention list.
- **Answers:** What don't we know, what did we assume, and what must someone decide?
- **Required outline:** 1 Conventions (types `GAP` / `ASSUMPTION` / `DECISION REQUIRED` / `RISK` / `DEPENDENCY`; statuses `OPEN`/`IN REVIEW`/`CONFIRMED`/`DECIDED`/`MITIGATED`/`CLOSED`) · 2 Summary counts · 3 Highest-attention entries · 4…N register tables by type.
- **Read first:** repo: `docs/Project-Governance-Tool-BRS.md` §8 (10 items), `docs/ux-requirements.md` §7 (14 proposed controls) + §6 (5 questions), `docs/PendingPoints.txt` (~50 items — triage each: decided / pending / done), `roles-actions.md` (DE/PMO gaps), `BACKEND_CODE_REVIEW.md` / `FRONTEND_CODE_REVIEW.md` (open risks) · absorb: BRS §8, ux §6–7, PendingPoints · TMS: `13_gaps_assumptions_decisions.md`
- **Must include:** no confirmed product name; `no_password` auth default; DE + PMO not write-enabled; PM self-approval; no DB migration framework; itemized-vs-legacy health models coexisting; geo RAG screen missing; contractual/milestone actuals UI missing; DE assessment cadence undecided; RAID review-date inconsistency; measurement baselines/formulas "QA to provide"; Oracle live sync absent; "data as of" indicator; every `ASSUMPTION:` / `TARGET:` raised in docs 00–22 rolled up here.
- **Defines IDs:** `GAD-<NNN>` (authoritative).
- **Consumes:** all of 00–22 (their `ASSUMPTION:`/`TARGET:`/gap notes). Generate after as many as exist; on later re-run, sweep newly-added markers (see `23` in §6).
- **Diagrams:** none.
- **Done when:** every prior-doc `ASSUMPTION:`/`TARGET:` has a `GAD` row; BRS §8 + ux §6–7 fully absorbed; PendingPoints triaged; each row has impact + recommendation + owner + status.

---

### 24 — Build Status & Delivery Roadmap
- **Output:** `product-brain/24_build_status_and_delivery_roadmap.md`
- **Depth:** lean (200–340 lines)
- **Mirrors:** `sample-docs\modernization\14_modernization_mapping.md` + `20_migration_implementation_roadmap.md` — reframed: no legacy to migrate, so this is per-module build status + a forward delivery sequence.
- **Answers:** Where is each module today, and what is the forward plan?
- **Required outline:** Part A — Build Status: per-module table (`MOD-*` · Built / Partial / Planned · notes · correcting stale BRS entries). Part B — Delivery Roadmap: 1 Guiding approach (incremental, module-by-module, pilot-gated) · 2 Workstreams in sequence (Auth hardening + OneLogin rollout; DE role write-enablement; PMO role write-enablement; Oracle resourcing sync; M365 / ticketing go-live; Contractual + Milestone actuals UI; Geo RAG screen; Cadence + defaulter tracking; Measurement formula/baseline sign-off; itemized-health migration completion; audit-log coverage) · 3 Pilot-gating criteria (no exposure beyond controlled pilot until real auth) · 4 Dependencies (→ `23`).
- **Read first:** repo: `docs/Project-Governance-Tool-BRS.md` §7, `docs/PendingPoints.txt`, `DATA-ENTRY-GUIDE.md` "Known gaps", `frontend/src/lib/menu-config.ts`, backend endpoints (to confirm what's actually wired) · absorb: BRS §7, PendingPoints · TMS: `14_modernization_mapping.md`, `20_migration_implementation_roadmap.md`
- **Must include:** correct the BRS where stale (DE menu + route trees now exist; DE dashboard wired; Executive Updates + Action Tracker + Project Health portfolio shipped); keep "should not be exposed beyond a controlled pilot until real authentication is delivered" as the headline gate.
- **Defines IDs:** none (references `MOD-*`, `GAD-*`).
- **Consumes:** 01 (modules), 23 (gaps/decisions), 19 (auth risk) → fallback §1.
- **Diagrams:** optional roadmap Mermaid (sequence of workstreams).
- **Done when:** every `MOD-*` has a status; every workstream has entry criteria + a `GAD`/BR link; pilot gate stated.

---

### 25 — Test & Regression Strategy
- **Output:** `product-brain/25_test_and_regression_strategy.md`
- **Depth:** lean (200–360 lines)
- **Mirrors:** `sample-docs\modernization\21_test_regression_strategy.md` — objectives, test pyramid, per-type strategy, per-module gates; **swap "golden-master of stored procedures" for "golden-fixture regression of the rollup/aggregation services"** as the centrepiece.
- **Answers:** How do we verify behaviour and prevent regressions?
- **Required outline:** 1 Objectives & the "no unintended change" principle (for the rollup math) · 2 Test pyramid & ownership · 3 Functional testing · 4 API contract testing (endpoint × role × status) · 5 Workflow / status regression (every `06` transition) · 6 Business-rule regression (keyed to `BR-*`) · 7 Rollup & aggregation regression (golden fixtures: worst-wins, period metric sums, pull/ignore/undo, `compute_overall_project_health`) · 8 Measurement-formula tests · 9 AI apply/ignore tests · 10 E2E (Playwright) key journeys · 11 Security / RBAC tests · 12 UAT per role · 13 Per-module gates · 14 Coverage rule (feeds `26`).
- **Read first:** repo: `backend/tests/**` (all ~30 modules — note what exists), `frontend` Playwright config + any specs, `docs/e2e-test-flow.csv`, `backend/app/services/*.py` (what needs golden fixtures) · absorb: `docs/e2e-test-flow.csv` · TMS: `21_test_regression_strategy.md`
- **Must include:** existing `backend/tests/test_*.py` inventory mapped to areas; `test_authorization.py` as the RBAC anchor; golden-fixture approach for `services/*rollup*` and `health_rollup` and `measurement_metrics`; `TS-<AREA>-<NN>` id scheme; per-module gate = its `BR-*` + its `06` transitions + its API contract all green.
- **Defines IDs:** `TS-<AREA>-<NN>` (authoritative).
- **Consumes:** 05 (`BR-*`), 06 (transitions), 13 (services), 15 (formulas), 17 (`API-*`), 20 (`NFR-*`) → fallback §1.
- **Diagrams:** test-pyramid ASCII/Mermaid.
- **Done when:** each test type has a concrete ProjectGovernance approach; rollup golden-fixture strategy specified; `TS-*` scheme defined; per-module gate defined; coverage rule stated for `26`.

---

### 26 — Traceability Matrix
- **Output:** `product-brain/26_traceability_matrix.md`
- **Depth:** full (300–550 lines)
- **Mirrors:** `sample-docs\modernization\22_traceability_matrix.md` — one row per capability linking every layer, by ID.
- **Answers:** How does every capability link across all layers?
- **Required outline:** 1 How to read (column → source doc) · 2 Master table: Business Process (`BP-*`) → Functional Capability (`FC-*`) → Business Rule (`BR-*`) → Status/Workflow transition → Screen (`SCR-*`) → API (`API-*`) → Service/Table (`SVC-*` / table) → Test Scenario (`TS-*`) · 3 Coverage check (every `BR-*`, every `06` transition, every `SCR-*` action, every `API-*`, every `NFR-*` appears ≥ once with a `TS-*`; blanks = coverage defects).
- **Read first:** repo: none (pure synthesis) · absorb: none · TMS: `22_traceability_matrix.md`
- **Must include:** rows for the 10 `BP-*`; explicit coverage-gap list.
- **Defines IDs:** none (consumes all).
- **Consumes:** **02, 04, 05, 06, 08, 13, 15, 17, 20, 25** — generate only when all exist (else stop and say which are missing).
- **Diagrams:** none.
- **Done when:** every `BP-*` has ≥ 1 row; coverage check run; every unmatched `BR-*`/`API-*`/transition listed as a gap.

---

### README — Pack Index
- **Output:** `product-brain/README.md`
- **Depth:** lean (120–200 lines)
- **Mirrors:** `sample-docs\README.md` — purpose, structure, what each doc answers, reading order, audience classification, ID conventions, maintenance.
- **Answers:** What is this pack, in what order do I read it, and how is it kept in sync?
- **Required outline:** 1 Purpose · 2 Structure (the file tree) · 3 What each document answers (one-line table, 00–26) · 4 Recommended reading order (orientation pass; then by role) · 5 Audience classification (business / development / forward-plan) · 6 ID conventions (from §1.9) · 7 How to keep it in sync (IDs generate traceability; regenerate `26` on change; reconciliation passes) · 8 Legacy docs (pointer to `docs/legacy/`, and the §1.11 mapping).
- **Read first:** repo: `product-brain/*.md` (all 27) · absorb: none · TMS: `README.md`
- **Must include:** the greenfield framing; "current-state + forward plan, no AS-IS/TO-BE split"; that `document-generation-plan.md` is the generator, not a pack doc.
- **Defines IDs:** none.
- **Consumes:** all of 00–26 — generate only when all exist.
- **Diagrams:** the file-tree code block.
- **Done when:** every doc 00–26 has a one-line entry; reading order + audience tables present; legacy pointer included.

---

## §5. Legacy-doc disposition — one-time, after the pack is complete (or on explicit request)

**Not part of any generation iteration.** When 00–26 + README all exist and are reviewed:

| Action | Files |
|---|---|
| `git mv` → `docs/legacy/` | `docs/Project-Governance-Tool-BRS.md`, `docs/ux-requirements.md`, `docs/PendingPoints.txt`, `docs/e2e-test-flow.csv`, `roles-actions.md`, `AI-Implementation.md`, `Authentication.md`, `DATA-ENTRY-GUIDE.md`, `deployment.md` |
| `git mv` → `docs/legacy/design-reference/` | `design-reference/*.md` (copy the images referenced by `08` into `product-brain/assets/` first) |
| Leave in place | `BACKEND_CODE_REVIEW*.md`, `BACKEND_FIX_PLAN.md`, `FRONTEND_CODE_REVIEW.md`, `FRONTEND_FIX_PLAN.md`, `frontend-review.md`, `vapt-prompt.txt` |
| Add | `docs/legacy/README.md` — "superseded by `product-brain/`; retained for provenance; see `product-brain/README.md` §8." |

---

## §6. Reconciliation passes — run only when the user names them

- **`05-R` / `06-R`** — after `04`, `07`, `08`, `13` exist: re-read those, then sweep `05`
  and `06` for rules/transitions they surfaced that are missing or now contradicted.
  Edit `05`/`06` in place; keep IDs stable.
- **`23` sweep** — after `00`–`22` all exist: re-scan every doc for `ASSUMPTION:` / `TARGET:`
  / `<!-- pending -->` and ensure each has a `GAD` row; resolve or downgrade stale ones.
- **`26` + `README`** — (re)generate after `00`–`25` exist and after any `-R` pass.
- **`pending` marker sweep** — grep `product-brain/` for `<!-- pending: reconcile` and
  resolve each against the now-existing target doc.

---

## §7. Bootstrap (first iteration only)

When `product-brain/` contains only this file: create `product-brain/assets/` (empty), then
proceed with the target document (which will be `00`). Do not create placeholder files for
any other document.
