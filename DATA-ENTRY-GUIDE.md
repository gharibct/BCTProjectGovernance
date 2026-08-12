# Data Entry Guide — Getting Data to Show on Every Screen

This app has two layers of records: **master data** (Projects, Accounts, Geos, Users — you said you already have this) and **narrative/period data** (status reports, health declarations, RAID logs, contractual commitments) that most screens actually render. If a screen looks empty, it's almost always because the narrative/period data for that project/account/geo hasn't been entered yet — the screen itself isn't broken.

Everything below assumes you already have at least one Project, its Account, and its Geo created, and users assigned to the `ACCOUNT_MANAGER`/`GEO_HEAD`/`CXO` roles with the right account/geo scope.

**Creating that master data**, if you still need to: sign in as Admin.
- **Accounts**: sidebar → "Accounts" (`/admin/accounts`) — Account Name + Geo, then "Add Account".
- **Users**: sidebar → "Users & Roles" (`/admin/users`) — Username/Full Name/Email/Role, plus multi-select Accounts (Account Manager scope) and Geos (Geo Head scope) in the same form.
- **Geos/Project Types/Organizations**: no admin screen yet — these are seed-script/DB only for now.

## Screens (quick list)

**Maintain Project (baseline setup, per project)**
1. Project Profile — `/new-project/[projectId]/project-charter`
2. Scope and Schedule — `/new-project/[projectId]/project-charter/schedule`
3. Contractual Compliance — `/new-project/[projectId]/contractual-compliance`
4. Project RAIDO Register — `/new-project/[projectId]/raido`
5. Self Assessment (RAG) — `/new-project/[projectId]/project-charter/self-assessment`
6. DE Assessment — `/new-project/[projectId]/de-assessment`

**Project Reporting (per project, per period)**
7. Project Status — `/project-reporting/[projectId]/project-status`
8. RAG Status — `/project-reporting/[projectId]/project-charter/self-assessment`
9. Resource Allocation — `/project-reporting/[projectId]/resource-allocation` (Monthly only)
10. Measurement — `/project-reporting/[projectId]/measurement` (Monthly only)
11. Contractual Compliance — `/project-reporting/[projectId]/contractual-compliance` (Monthly only)
12. Project RAIDO Register — `/project-reporting/[projectId]/raido` (Monthly only)
13. DE Assessment — `/project-reporting/[projectId]/de-assessment` (Monthly only)

**Account Reporting (per account, per period)**
14. Account Status — `/account-reporting/[accountId]/status`
15. RAG Status — `/account-reporting/[accountId]/rag-status`

**Geo Reporting (per geo, per period)**
16. Geo Status — `/geo-reporting/[geoId]/status`
17. ~~RAG Status~~ — **not built yet, see Known Gaps**

**Review (read-only + Approve/Reject)**
18. Project Review — `/project-review/[projectId]`
19. Account Review — `/account-review/[accountId]`
20. Geo Review — `/geo-review/[geoId]`

**Dashboards**
21. CXO Dashboard — `/dashboard/cxo`
22. Admin Dashboard — `/dashboard/admin`
23. Geo Head Dashboard — `/dashboard/geo-head`
24. Account Manager Dashboard — `/dashboard/account-manager`

---

## Step-by-step: populate in this order

### 1. Make sure the Project is Approved
Project Reporting/Review only list a project once it's past Draft/Pending Approval.
- Go to **Project Profile** (`/new-project/[projectId]/project-charter`).
- **Create Project** (if not created) → **Send To Approval** → **Approve**.
- Until this is done, the project only shows under "Maintain Project" in the sidebar, not "Project Reporting" or "Project Review".

### 2. Enter baseline project data (Maintain Project)
These feed the KPI counts and RAG rollups everywhere downstream.
- **Project RAIDO Register**: add at least one Risk, Issue, Dependency, Assumption, and Opportunity.
- **Contractual Compliance**: add at least one Commitment and one Milestone (Commitments/Milestones tabs on the same screen).
- **Self Assessment**: rate all 6 categories (Core Delivery, People, Operational, Customer, Financial, Compliance) and Submit — this is a `HealthDeclaration` row, needed for the Project Governance Matrix on the Account Manager dashboard and for the Overview/RAG Status sections on Project Review.

### 3. Submit a Project Status Report
- Go to **Project Status** (`/project-reporting/[projectId]/project-status`), pick a reporting period (top-right).
- Fill Key Metrics (Revenue, Onsite FTE, Offshore FTE, Projects Count).
- Add at least one entry under each of the 4 tabs (Key Accomplishments, Upcoming Releases, Leadership Support, Key Risks/Issues) — these are what populate the Overview quadrants on Project Review and the Top 5 Highlights on the Account Manager dashboard.
- Click **Submit Report** — this flips the report from Draft to Submitted, which is required before...

### 4. Approve/Reject on Project Review
- Sign in as a user with the `ACCOUNT_MANAGER` role who's assigned to this project's account.
- Go to **Project Review** (`/project-review/[projectId]`) — the Approve/Reject action bar only appears once the report is Submitted (step 3). Before that it's blank by design.

### 5. Repeat for Account Reporting
- **Account Status** (`/account-reporting/[accountId]/status`): same Key Metrics + 4-category items + Submit Report flow as step 3.
- **RAG Status** (`/account-reporting/[accountId]/rag-status`): same 6-category declaration as step 2's Self Assessment.
- These two feed Account Review, and (once you have data for multiple accounts) the Account Governance Matrix + Top 5 Highlights on the CXO/Admin/Geo Head dashboards.
- Approve/Reject on **Account Review** requires a `GEO_HEAD` user assigned to this account's geo.

### 6. Repeat for Geo Reporting — with one gap
- **Geo Status** (`/geo-reporting/[geoId]/status`): same flow as above.
- **Geo RAG Status**: **there is no screen for this yet** (see Known Gaps below) — Geo Review's RAG Status section and any geo-level health rollup will stay empty until either that screen is built or you enter it directly via the API.
- Approve/Reject on **Geo Review** requires a `CXO` (or `ADMIN`) user.

### 7. Dashboards
Once the above exists for a few accounts/projects:
- **CXO / Admin / Geo Head dashboards**: the Account Governance Matrix shows one row per account with data from step 5's RAG Status declarations; Top 5 Highlights pulls the 5 most recent Account Status items (any category) across accounts in scope; KPI row pulls from RAID logs/DE Assessments/Opportunities entered in step 2; Contractual Compliance widget will show everything as "Not Recorded" — see Known Gaps.
- **Account Manager dashboard**: same shape but rows = Projects, sourced from step 2/3's project-level data instead.
- Use the **Geo Selection** / **Account Selection** dropdown (top-right) to narrow the whole page to one geo/account, or leave it on "All" for everything you're scoped to.

---

## Known gaps — can't be populated via the UI yet

1. **Geo RAG Status has no screen.** The backend endpoints exist (`GET/POST /geos/{geoId}/health-declarations`), but no page/form calls them. Until it's built, you can create test data directly via the API docs at `/docs` on your backend (`POST /geos/{geoId}/health-declarations`), or ask for the screen to be built.
2. **Contractual Compliance and Milestone Payment "Actuals" have no screen.** You can create Commitment and Milestone *definitions* (including a milestone's expected payment date), but there's no UI anywhere to record whether a commitment was actually Met/Not Met, or a milestone's actual payment date. Effect on the dashboards: the Contractual Compliance widget will always show everything as "Not Recorded" no matter how many commitments you enter (nothing can ever become Met/Not Met). The Milestone Payments widget is only partially affected — Upcoming vs. Overdue is computed correctly from each milestone's expected date, but nothing can ever move into "Paid" since that requires an actual payment date that has no entry screen.
