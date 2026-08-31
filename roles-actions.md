# Role Activity Inventory — Project Governance Tool

Research deliverable (no code changed) combining what the frontend nav actually exposes (`frontend/src/lib/menu-config.ts`, `app-sidebar.tsx`) and what the backend actually enforces (`backend/app/api/deps.py`, `backend/app/api/v1/endpoints/*.py`) — the two disagree in places, called out below.

## 1. Project Manager (PM)

Any PM can edit any project (role-only, no per-PM assignment).

- **Charter**: create project, edit fields, Send To Approval, Approve (PM/Admin are the only roles reaching this screen, so PM effectively self-approves)
- **Scope & Schedule / Self-Assessment**: actual dates, RAG self-assessment
- **Resource Allocation**: add/update/delete
- **RAID Register** (Risk, Issue, Dependency, Assumption, Opportunity): full CRUD
- **Project Status Reports**: create/update report + items, set rollup-status, **Submit Report** (Draft → Submitted, goes to Account Head)
- **Health Declarations / RAG items**: create/update/delete
- **DE Assessment**: create assessment, set Assessed Health + PCI score, Submit
- **Findings Register**: add findings (Classification, Action Taken, Date, Status, Remarks)
- **Alert Register**: add alerts (auto-nudged if health ≠ Green with zero alerts logged)
- **Contractual Compliance**: create/update/delete Commitments and Milestone Payments, log actuals
- **Measurement**: fill the one form matching the project's type; set metric targets
- **AI Hub / Documents**: upload, process, view AI output, delete; apply/ignore AI suggestions
- **Action Tracker — Project level**: create/edit; default assignee. Can transition any action anywhere they're the assignee.

## 2. Account Head (`ACCOUNT_MANAGER`)

Scoped to assigned accounts (except Admin).

- **Account Reporting**: create/update Status Report, items, rollup-status
- **Account RAG/Health**: create/update declaration + items per category
- **Rollup (Project → Account)**: Pull / Ignore / Undo
- **Project Status Report Review**: Approve/Reject PM submissions for projects under their accounts
- **Action Tracker — Account level**: create/edit for owned accounts
- **Action Tracker — Project level (also)**: can create/edit on *any* project, role-only
- Does **not** review Account reports themselves (Geo Head does) or write project-level data directly

## 3. Geo Head (`GEO_HEAD`)

Scoped to assigned geos (except Admin).

- **Geo Reporting**: create/update Status Report, items, rollup-status
- **Geo RAG/Health**: create/update declaration
- **Rollup (Account → Geo)**: Pull
- **Executive Update**: build CXO-facing content (Delivery/People/Financials/Operations sections; rich text/image/table) — Save Draft only, no approval step
- **Account Status Report Review**: Approve/Reject Account Head submissions in their geo
- **Action Tracker — Geo level**: create/edit for owned geos
- **Action Tracker — Account level (also)**: for accounts in their geo
- Does **not** review Geo reports themselves (CXO does)

## 4. CXO

Lightest write footprint — top of the review chain, unscoped.

- **Geo Status Report Review**: Approve/Reject *any* geo's report, no ownership restriction
- **Action Tracker — Geo level**: create/edit/transition for any geo (explicit bypass, like Admin)
- Everything else read-only: portfolio dashboard (KPI tiles, Governance Matrix, Contractual Compliance/Milestone summaries, Top Highlights), Executive Updates (view), all module data

## 5. Delivery Excellence (DE) — confirmed intent vs. current gap

Confirmed intent (user, 2026-08-23): DE is meant to **create Findings and rate a project's monthly reviews** (DE Assessment: Assessed Health + PCI score). As implemented today, none of that is wired up:

- Menu gives DE only a dashboard-only stub (mock data), no path to DE Assessment
- Backend: `DELIVERY_EXCELLENCE` isn't in any write/approve gate anywhere — DE Assessment/Findings/Alerts writes are currently PM/Admin-only
- So DE's real job (logging findings, submitting monthly ratings) has no functioning path in the app yet — a prerequisite fix, separate from dashboard visual design, but doesn't block designing the dashboard's *content* now around what DE should be doing.

## 6. Admin

Superset of everything, plus:

- **Users & Roles**: create/edit/delete users, assign Role + Account/Geo scoping (the mechanism that drives Account Head/Geo Head scoping); user reads are admin-only unlike other resources
- **Accounts / reference data**: manage Organizations, Geos, Accounts, Project Types, Reporting Periods
- **Integrations**: manage connections, trigger backup/restore
- **Data Integrity checklist catalog**: manage items
- Can Approve/Reject at every review tier, and write actions at every Action Tracker level, anywhere, no ownership needed

## Action Tracker (cross-cutting)

| Level | Who can create/edit |
|---|---|
| PROJECT | PM, Account Head, Admin |
| ACCOUNT | Account Head, Geo Head, Admin |
| GEO | Geo Head, CXO, Admin |

The action's own **assignee can always transition it** (start/complete/close/cancel/comment) regardless of role or level. Anyone who can reach the entity's page can view its actions. Lifecycle: `OPEN → IN_PROGRESS → COMPLETED → CLOSED`, or → `CANCELLED`.

## Findings Register / Alert Register (cross-cutting)

Both are tabs inside DE Assessment (`project-reporting/[projectId]/de-assessment`) — written today only by PM/Admin (see DE gap above), readable by anyone who can reach that project's data.

## Other gaps worth knowing

- **PMO role** has the identical "no distinguishing permission" gap DE had — read-only everywhere, dashboard-only menu.
- **PM's own "My Summary" dashboard is still on mock data**, unlike Account Head/Geo Head/CXO/Admin's dashboards (which call the real `/dashboard/summary` API) — worth rewiring if you design a PM dashboard around it.
