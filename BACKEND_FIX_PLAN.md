# Backend Remediation Plan

Derived from `BACKEND_CODE_REVIEW_FEEDBACK.md`. Each section below is a standalone, self-contained prompt — run them one at a time, in the order given; later items assume earlier ones in the same order are done. All files are checked into git, so any file superseded by a fix can be adjusted in place rather than deprecated.

Order follows the review's own recommended sequence (its "Final Recommendation" §6), with two P3 cleanups appended at the end.

1. ID-1 — Project-scope write authorization (P0, do first — everything else is secondary)
2. ID-2 — `audit.py`/`dashboard.py` role & scope gate (P1)
3. ID-3 — `project_status` transition guard (P1)
4. ID-5 — Dashboard duplicate-query fix (P2)
5. ID-6 — Governance Matrix unbounded history load (P2)
6. ID-4 — Real business-logic test coverage (P1, do after #1/#3 land)
7. ID-7 — Consolidate the three rollup-pull services (P2, do after #6's tests land)
8. ID-8 — Audit-trail dead-code investigation (P2)
9. ID-10 — Document-upload write ordering (P3)
10. ID-11 — Stale role-code comment (P3)

---

## Issue 1: Project-scoped write endpoints check role only, not project ownership (ID-1, P0)

Ten router modules gate their write routes with `_pm_write = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN))]` and nothing else — any user holding the `PROJECT_MANAGER` role can create/edit/delete data on **any** project in the system, not just their own. `app/api/v1/endpoints/projects.py:28-31` documents this as a known, intentional gap: *"no per-PM project-assignment scoping exists in the schema (user_projects is unused groundwork), so this is a role-only gate."* That comment is slightly misleading, though — `Project` already has a `project_manager_id` field that's the actual right tool for this fix; `user_projects` is a separate, unrelated table.

**Prompt:**
> In this FastAPI backend (`backend/app/`), ten write-gated router modules restrict mutations to the `PROJECT_MANAGER`/`ADMIN` role only, with no check that the calling PM is actually assigned to the project being written to (see `app/api/v1/endpoints/projects.py:28-31`). Close this gap using data that already exists on the `Project` model — do **not** use `UserProject`/`user_projects` (`app/models/users.py:52-57`); its own code comment says it's unrelated groundwork for future Team-Member RAID-assignment scoping, not PM project ownership.
>
> 1. `app/models/projects.py:23` already has `Project.project_manager_id: Mapped[uuid.UUID | None]`. Add a `require_project_owner_scope(*allowed_roles: RoleCode)` dependency to `app/api/deps.py`, following the shape of the existing `require_project_account_scope` in the same file: resolve the `project_id` path param, 404 if the project doesn't exist, and — unless the caller's role is `RoleCode.ADMIN` — 403 unless `project.project_manager_id == current_user.id`.
> 2. Apply it to the write routes in the 10 affected modules: `app/api/v1/endpoints/projects.py`, `raid.py`, `measurement.py`, `metric_target.py`, `health_declarations.py`, `contractual.py`, `de_assessment.py`, `documents.py`, `ai_row_suggestions.py`, `ai_suggestions.py`. Check the exact path param name each router actually uses (`project_id` vs `id`) before wiring the dependency in — `projects.py`'s own `PUT /projects/{id}`/`DELETE /projects/{id}` differ from the `/projects/{project_id}/...`-nested routes in the other 9 files.
> 3. Before rolling this out everywhere, check whether `project_manager_id` is actually populated for existing projects (query the dev data, or check `backend/scripts/seed_sqlite_dev.py`). If a meaningful number of projects have a `NULL` project_manager_id, enforcing this check would lock legitimate PMs out of projects they should be able to edit — **stop and report that back** rather than shipping a change that breaks existing usage; that scenario needs a data-backfill/admin-assignment step first, not just the dependency.
> 4. Do not touch `UserProject`/`user_projects` in this pass — it's out of scope here (different purpose, no current consumer).
> 5. Verify: a `PROJECT_MANAGER` whose `project_manager_id` doesn't match a given project gets 403 on that project's write endpoints across all 10 modules; the same user succeeds on a project where they are the assigned PM; `ADMIN` is unaffected on both. Read-only (list/get) routes should remain unchanged unless the review of a specific file shows otherwise.

---

## Issue 2: `audit.py`/`dashboard.py` have no role or scope dependency at all (ID-2, P1)

Of the 25 endpoint modules under `app/api/v1/endpoints/`, only these two have zero `require_role`/scope dependency anywhere in the file. `GET /audit-log` (`audit.py::list_activity_log`) accepts an arbitrary `user_id` filter, and `GET /dashboard/summary` (`dashboard.py::get_dashboard_summary`) accepts arbitrary `account_id`/`account_ids`/`geo_id`/`geo_ids` filters — any authenticated user, including `TEAM_MEMBER`, can currently pull cross-account/geo dashboard data and the full portfolio-wide activity log.

**Prompt:**
> In `backend/app/`, two endpoint modules have no authorization gate at all, unlike every other router.
>
> 1. `app/api/v1/endpoints/audit.py::list_activity_log` — this is a portfolio-wide, cross-account audit trail, so gate it with a role check: `Depends(require_role(RoleCode.ADMIN, RoleCode.CXO))` (adjust the exact role set if a broader group should legitimately see the whole activity log — check `app/schemas/enums.py`'s `RoleCode` for the full list, and use the same judgment already applied to other admin-facing endpoints like `integrations.py`'s `_admin_only`).
> 2. `app/api/v1/endpoints/dashboard.py::get_dashboard_summary` — this is a landing page for multiple roles, not just admins, so a blanket role gate is wrong here. Instead, scope the *query results*: for callers whose role is not `ADMIN`/`CXO`, constrain the effective `account_ids`/`geo_ids` used in `DashboardFilters` to the caller's own `user_accounts`/`user_geos` — reuse the `_owned_account_ids`/`_owned_geo_ids` helpers already defined in `app/api/deps.py` rather than re-deriving that logic. Do this before the filters reach `app/services/dashboard.py`.
> 3. Do not change either endpoint's response shape — only add the access restriction.
> 4. Verify: a `TEAM_MEMBER` calling `GET /audit-log` now gets 403 (or is excluded from whatever role set you land on); a non-admin user calling `GET /dashboard/summary` with someone else's `account_id`/`geo_id` no longer sees that account's/geo's data, while their own scoped data still returns correctly; `ADMIN`/`CXO` are unaffected.

---

## Issue 3: `project_status` can jump to any value with no transition guard (ID-3, P1)

`app/schemas/projects.py:83`'s `ProjectUpdate.project_status` is a free-form optional field, and `update_project` (`app/api/v1/endpoints/projects.py`) passes it straight through generic `CRUDBase.update()` with no guard — a project can go from `Draft` directly to `Closed`, or be reopened from `Closed`, in a single `PUT /projects/{id}` call. `ProjectStatus` has 6 values (`app/schemas/enums.py:69-75`: `Draft`, `Pending Approval`, `Approved`, `Hold`, `Closed`, `Open Only for Billing`). This codebase already has the pattern for guarding a status transition — `app/api/v1/endpoints/project_status.py::review_status_report` does `if obj.status != ReportStatus.SUBMITTED: raise HTTPException(...)` before allowing its transition.

**Prompt:**
> In `app/api/v1/endpoints/projects.py::update_project`, add a transition guard for `Project.project_status` before applying the update, following the pattern already used in `app/api/v1/endpoints/project_status.py::review_status_report`.
>
> 1. When `payload.project_status` is set and differs from the project's current `project_status`, check whether that transition is allowed before calling `project_crud.update(...)`.
> 2. Define the allowed-transitions table explicitly (e.g. a `dict[ProjectStatus, set[ProjectStatus]]` constant near the top of `projects.py`, or in `app/schemas/enums.py` next to `ProjectStatus` itself) rather than inferring it silently. **Do not guess and hardcode a transition table as final** — a reasonable starting point given the status names is a roughly linear `Draft → Pending Approval → Approved → Hold/Closed`, with `Open Only for Billing` reachable only from `Closed`, but explicitly flag this proposed table in your response so it can be corrected against actual product requirements before being treated as settled.
> 3. Raise `HTTPException(status.HTTP_400_BAD_REQUEST, ...)` naming the invalid transition (`from` → `to`) when it's disallowed, matching `review_status_report`'s error style.
> 4. Verify: an allowed transition (e.g. `Draft` → `Pending Approval`) still succeeds; a disallowed one (e.g. `Draft` → `Closed` directly) now returns 400 with a clear message; `ProjectUpdate` calls that don't touch `project_status` are completely unaffected.

---

## Issue 4: Dashboard endpoint runs the same queries three times per request (ID-5, P2)

`get_dashboard_summary` (`app/api/v1/endpoints/dashboard.py`) calls `dashboard_service.account_health_rows(db, filters)` directly, but `account_health_matrix` (`app/services/dashboard.py:321`) and `account_highlights` (line 387) each call `account_health_rows()` again internally — same query, three executions. Identical pattern for `project_health_rows()`, re-run inside `project_health_matrix` (line 353) and `project_highlights` (line 412).

**Prompt:**
> In `app/services/dashboard.py`, eliminate the redundant re-querying in the dashboard summary path.
>
> 1. Change `account_health_matrix`, `account_highlights`, `project_health_matrix`, and `project_highlights` to accept the already-computed rows as a parameter instead of re-fetching internally (e.g. `account_health_matrix(db, filters, health_rows: list[...])`), and remove their internal calls to `account_health_rows()`/`project_health_rows()`.
> 2. In `get_dashboard_summary` (`app/api/v1/endpoints/dashboard.py`), compute `account_health_rows(...)` and `project_health_rows(...)` once each, and pass the results into the four functions above.
> 3. Do not change the response shape of `DashboardSummary` or any computed field's value — this is purely a performance fix; output must be identical before and after.
> 4. Verify: `GET /dashboard/summary` returns the same data as before the change (compare a response before/after for the same test data), and confirm — by reading the updated call graph, or with a temporary query-count check during development — that the account/project health queries now execute once each instead of three times.

---

## Issue 5: Governance Matrix loads unbounded historical data (ID-6, P2)

`account_health_matrix` and `project_health_matrix` (`app/services/dashboard.py:321`, `:353`) each query `AccountHealthDeclaration`/`HealthDeclaration` with no period filter and no limit — every historical declaration ever recorded for every in-scope account/project is loaded, then reduced to "latest per entity" in Python. This scales with reporting-history depth as well as entity count.

**Prompt:**
> In `app/services/dashboard.py`, bound the historical data loaded by `account_health_matrix` and `project_health_matrix`.
>
> 1. Replace the "load everything, reduce to latest-per-entity in Python" approach with a query that fetches only the latest declaration per account/project directly — a correlated subquery or a window function (`ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY created_at DESC)`) via SQLAlchemy 2.x. Before writing a new pattern, check `app/services/health_rollup.py` for whether "latest per entity" is already solved there in a way you can reuse.
> 2. If a windowed/subquery approach is significantly more complex than the current code for no clear benefit at today's data volumes, an acceptable alternative is filtering to a bounded recent window (e.g. the last N reporting periods) instead — pick whichever is the smaller, clearer change; note which you chose and why.
> 3. Do not change the matrix's actual output (still the latest declaration per account/project) — only how it's fetched.
> 4. Verify: the Governance Matrix endpoint returns the same data as before for existing test data.

---

## Issue 6: Entire test suite verifies auth wiring only, no business logic (ID-4, P1 — do after Issues 1 and 3 land)

Every test file under `backend/tests/` that exercises an endpoint runs through the `override_auth` fixture (`tests/test_authorization.py:242-259`), which overrides `get_db` app-wide with the `FakeDB` (`tests/test_authorization.py:56-105`) — a stub with no real storage (`add`/`flush`/`commit`/`delete` are no-ops; `execute()` returns an empty result for every query except two hardcoded ownership lookups). The suite can therefore only assert HTTP status codes for role/scope gates. There is no test anywhere for rollup-pull invariants, dashboard aggregation, measurement metrics, or health-rollup severity ordering.

**Prompt:**
> Do this after Issue 1 (project-scope authorization) and Issue 3 (project-status transition guard) are implemented — those are exactly the kind of new behavior worth locking in with a real test, rather than writing tests now against logic that's about to change.
>
> 1. Add a second test setup (alongside the existing `FakeDB`-based one in `tests/test_authorization.py` — keep that one as-is, it's fine for what it tests) that runs against a real SQLite database: an in-memory (`sqlite+aiosqlite:///:memory:`) or temp-file async engine, standing up the schema via `app/core/db.py`'s `Base.metadata.create_all`, following the same approach `backend/scripts/bootstrap_sqlite.py` uses for `dev.db`.
> 2. Write tests for the highest-value currently-untested logic, in this order of priority:
>    - The new project-scope check from Issue 1 (`require_project_owner_scope`), including the ADMIN-bypass case.
>    - The new project-status transition guard from Issue 3 (allowed transition succeeds, disallowed one 400s).
>    - Rollup-pull invariants in `app/services/account_rollup.py::pull_rollup_item` (a `PENDING` item transitions to `PULLED` on pull; pulling an already-`PULLED`/non-`PENDING` item raises `RollupItemAlreadyHandledError`).
> 3. If time allows, add measurement-metric (`app/services/measurement_metrics.py`) and health-rollup-severity (`app/services/health_rollup.py`) tests too — not required for this pass; if you don't get to them, say so explicitly as a follow-up rather than silently skipping.
> 4. Verify: `pytest` passes with the new real-DB tests included, and the existing `FakeDB`-based auth tests in `test_authorization.py` and elsewhere are unaffected.

---

## Issue 7: Three services duplicate the same rollup-pull workflow (ID-7, P2 — do after Issue 6's tests land)

`app/services/account_rollup.py`, `app/services/account_health_rollup.py`, and `app/services/geo_rollup.py` each independently implement the same "fetch source item → verify ownership → verify still `PENDING` → create rolled-up row → mark source `PULLED` → flush" shape. `account_health_rollup.py` already imports `RollupItemNotFoundError`/`RollupItemAlreadyHandledError` directly from `account_rollup.py` instead of defining its own — a sign these were written as copies of one pattern.

**Prompt:**
> Consolidate the rollup-pull logic in `app/services/account_rollup.py`, `app/services/account_health_rollup.py`, and `app/services/geo_rollup.py` into one shared implementation. Do this only after the tests from Issue 6 exist for the current three implementations — consolidating first risks silently baking in a bug from whichever copy gets picked as "the" implementation, with nothing to catch it.
>
> 1. Read all three current implementations closely first (field names may not line up 1:1 even though the shape matches) before designing the shared helper's parametrization.
> 2. Extract one generic function (e.g. `pull_rollup_item(db, *, source_crud, source_status_field, ownership_check, target_crud, target_schema_factory, ...)`) into a shared module — `app/services/rollup.py`, or wherever fits best alongside the existing `services/` files. Mirror the config-driven factory style already used for `RaidConfig`/`build_raid_router` (`app/api/v1/endpoints/raid.py`) and `MeasurementConfig`/`build_measurement_router` (`measurement.py`) rather than inventing a different pattern.
> 3. Replace the three services' `pull_*_item` functions with thin wrappers around the shared helper, keeping each module's existing public function name/signature so the corresponding endpoint modules don't need to change.
> 4. Verify: the tests added in Issue 6 for `account_rollup.py::pull_rollup_item` still pass unchanged after the refactor, and add (or confirm existing) equivalent coverage for the `geo_rollup.py`/`account_health_rollup.py` variants to prove the consolidation didn't change behavior for any of the three.

---

## Issue 8: Audit trail is fully wired but nothing writes to it (ID-8, P2)

`app/models/audit.py`, `app/crud/audit.py`, and `app/api/v1/endpoints/audit.py::list_activity_log` define and serve `UserActivityLog` via `GET /audit-log`, but no code path under `app/` ever inserts a row into it — a repo-wide search for `UserActivityLog(` and `user_activity_log_crud.create` outside those three files finds nothing.

**Prompt:**
> Investigate `UserActivityLog` before changing anything — this needs a decision, not a unilateral code change.
>
> 1. Check whether anything outside `backend/app/` populates this table: a DB trigger in a SQL script under `backend/scripts/` (including `migrate_2026_08_review.sql`), an external import job, or anything referenced in `.env.example`/deployment notes. Report back exactly what you find.
> 2. If nothing populates it: report that `GET /audit-log` currently always returns empty, and propose (without implementing yet) where writes should be added if this is meant to be a live feature — candidates include auth events in `app/api/v1/endpoints/auth.py` (login/logout/OneLogin callback) and key business-record mutations across the write endpoints. Let the response to this investigation determine whether that's actually built next, rather than guessing the full scope now.
> 3. Do not add speculative writes to `UserActivityLog` in this pass without that scope being confirmed first — an audit log wired up inconsistently (some mutations logged, most not) is arguably more misleading than one that's honestly empty and clearly flagged as such.

---

## Issue 9: Document upload writes the file before the DB row exists (ID-10, P3)

`app/api/v1/endpoints/documents.py::upload_document` writes the uploaded file to disk (`(base_dir / relative_path).write_bytes(content)`) before creating the `ProjectDocument` row. A crash between those two steps leaves an orphaned file on disk with no DB record pointing at it. Low impact (no DB row ever references a missing file, so nothing breaks for users) but worth a small ordering fix.

**Prompt:**
> In `app/api/v1/endpoints/documents.py::upload_document`, reduce the orphaned-file window.
>
> 1. Create the `ProjectDocument` row via `project_document_crud.create(...)` before writing the file bytes to disk, rather than after — or, if the DB insert genuinely needs the final on-disk path first, keep the current order but wrap both steps so a failed DB insert cleans up the just-written file (reuse the existing `file_path.unlink(missing_ok=True)` idiom already used in this same file's `delete_document`).
> 2. Pick whichever of the two options above is the smaller change given how `get_db()`'s commit-on-success pattern already works (`app/core/db.py`) — don't introduce a new transaction/session pattern for this.
> 3. Verify: uploading a document still works end-to-end (file present on disk, `ProjectDocument` row created, `GET .../download` still serves it correctly).

---

## Issue 10: Stale role list in a model comment (ID-11, P3)

`app/models/users.py:14`'s comment on `Role.code` lists `ADMIN, EXECUTIVE, PROJECT_MANAGER, TEAM_MEMBER, DELIVERY_EXCELLENCE, PMO` — the actual `RoleCode` enum (`app/schemas/enums.py:20-25`) is `ADMIN, CXO, ACCOUNT_MANAGER, GEO_HEAD, PROJECT_MANAGER, TEAM_MEMBER`. No functional impact, but it misleads anyone reading the model file about what roles exist.

**Prompt:**
> In `app/models/users.py:14`, replace the inline comment listing role codes on `Role.code` with a pointer to the actual source of truth: `app/schemas/enums.py::RoleCode`. Either quote the current list from that enum, or (preferred, so it can't drift again) just reference the enum by name instead of duplicating the list. No other change needed.

---

## Not recommended (from the review — do not implement)

- **`app/api/v1/endpoints/data_integrity.py::get_data_integrity_status`'s one-query-per-checklist-item loop (ID-9)** — bounded by the admin-configured checklist size (~12-15 items today). The review's own recommendation is to leave this as-is unless the checklist grows meaningfully; revisit only if that changes.
- **The AI-suggestion endpoints** (`app/api/v1/endpoints/ai_row_suggestions.py`, `ai_suggestions.py`) — confirmed intentional stubs ahead of a documented future Kafka-fed local-LLM pipeline (the router's own comment in `ai_suggestions.py:15-19` names this directly, referencing `AI-Implementation.md`). Do not attempt to "complete" these into a real pipeline as part of this backend backlog — that's separately scoped, larger work.
- **The RAID/Measurement/Metric-Target router factories** (`raid.py`, `measurement.py`, `metric_target.py`) — large files, but each is one parametrized factory instantiated per entity, not duplicated code. Do not split them into per-entity router files.
- **`app/services/code_generator.py`'s `SELECT ... FOR UPDATE` sequence locking** — correct, deliberate concurrency handling. Do not change.
- **`app/api/v1/endpoints/executive_updates.py`'s path-traversal guard on image download** — already more defensive than `documents.py`'s DB-backed-path approach. Do not change.
- **`app/models/types.py`'s `PortableJSON`/`PortableINET` dialect-agnostic column helpers** — a clean pattern for the Postgres/SQLite dual setup; keep as the template for any future dialect-variant columns, don't replace it.
- **`app/core/db.py`'s `get_db()` session-per-request pattern** — correct as-is; Issue 9 above only changes the *order* of operations inside `documents.py`, not this function.
