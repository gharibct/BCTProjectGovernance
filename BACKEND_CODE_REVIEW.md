# Backend Architecture & Code Quality Review

Review the complete **backend codebase** of this Project Governance application.

The backend is built using **Python and FastAPI**.

This is a **review-only exercise**.

**Do not modify, refactor, delete, move, rename, or generate any application files.**

The objective is to understand the current backend architecture and identify improvement opportunities. We will implement the improvements separately, one by one, after reviewing your findings.

Do not review frontend code except where necessary to understand API usage.

## 0. Actual Backend Architecture — Read This First

This section is a factual snapshot of the current backend, captured so the review starts oriented instead of rediscovering the basics from zero. Treat it as a map, not a conclusion — verify anything you rely on before citing it as a finding.

**Entry point & wiring** — `app/main.py`. One `FastAPI()` app. `CORSMiddleware` driven by `settings.cors_origin_list`. Starlette `SessionMiddleware` is mounted only to hold Authlib's transient OIDC state/nonce/PKCE during the OneLogin redirect round-trip — it is *not* the app's own session mechanism. `/health` is the only route with no auth at all. `auth.router` is mounted at `/api/v1` behind `verify_api_key` only (must stay reachable pre-session: login/callback/config). Every other router is mounted via `app/api/v1/router.py`'s single `api_router`, behind both `verify_api_key` **and** `get_current_user` at the `include_router` level in `main.py` — i.e. auth is enforced centrally, not per-router.

**Auth model** — two independent layers stacked on almost every request:
- A static shared secret (`X-API-Key` header, checked in `app/core/security.py::verify_api_key` against `settings.api_key`) — same value for every client, not user-specific.
- A JWT session cookie (`pg_session`, HS256, `app/core/session.py`) set on login, decoded in `app/api/deps.py::get_current_user`. `settings.auth_type` toggles between `"no_password"` (dev-only: `POST /auth/login` looks up a user by `ldap_username`/`email`, no password check, disabled when `auth_type=onelogin`) and `"onelogin"` (real OIDC via Authlib in `app/api/v1/endpoints/auth.py`, strict pre-provisioned — no JIT user auto-creation on callback). Logout only clears the cookie; the JWT itself isn't revocable server-side before `exp` (`session_ttl_minutes`, default 480).

**Authorization** — `app/api/deps.py` defines role/scope dependency factories: `require_role`, `require_account_scope`, `require_geo_scope`, `require_project_account_scope`, `require_account_geo_scope` (each layers a role check plus, where relevant, an ownership check against `user_accounts`/`user_geos`, bypassed for `RoleCode.ADMIN`). These were added recently (see commit `a6c607e`, "No server-side role/scope authorization anywhere in the backend (IT-01, P0)") and are now used in 22 of the 25 endpoint routers under `app/api/v1/endpoints/`. `app/api/v1/endpoints/audit.py` (`GET /audit-log`, arbitrary `user_id`/`entity_type` filters) and `app/api/v1/endpoints/dashboard.py` (`GET /dashboard/summary`, arbitrary `geo_id`/`account_id`/`geo_ids`/`account_ids` filters) currently carry no role or scope dependency at all — any authenticated user can query any account/geo's data through them. Worth checking first, as the natural remaining surface for the same class of issue `a6c607e` fixed elsewhere. `tests/test_authorization.py` unit-tests the `deps.py` factories directly against a hand-rolled fake `AsyncSession` (no live DB needed).

**Router layer** — 25 routers registered in `app/api/v1/router.py`, flat under `/api/v1`, no versioning beyond that prefix. `app/api/v1/factory.py::build_crud_router()` generates list/get/create/update/delete for a model + schema set with `write_dependencies` gating only create/update/delete (list/get are open to any authenticated caller by design — see the factory's own docstring). It's used directly for simple resources (e.g. `integrations.py`) and as a base that `raid.py` and `measurement.py` extend with extra filtering on top.

**Data access** — `app/crud/base.py::CRUDBase` is the one generic get/list/create/update/delete implementation; every `app/crud/*.py` module is a thin subclass/instance of it (no separately-named "repository" layer — `crud/` *is* the data-access layer here). It fills `id`/`created_at`/`updated_at` centrally on create.

**Service layer** — `app/services/` holds 8 modules (`account_health_rollup`, `account_rollup`, `code_generator`, `dashboard`, `data_integrity_rollup`, `geo_rollup`, `health_rollup`, `measurement_metrics`). These do real aggregation/business logic (rollups, dashboard summaries, metrics), with grouping/summing done in Python rather than SQL aggregates — `account_rollup.py`'s own docstring notes this is deliberate given small portfolio sizes. `services/dashboard.py` (434 lines) is the largest file in the backend outside routers and backs a single `GET /dashboard/summary` endpoint that assembles ~14 separate aggregates.

**Database** — SQLAlchemy 2.0 async throughout (`app/core/db.py`): `asyncpg` for Postgres, `aiosqlite` for local dev (`dev.db` — no Postgres required to run). `get_db()` follows a correct session-per-request pattern (commit on success, rollback on exception, single `try/except` — the only `except Exception` in the whole `app/` tree). SQLite FK enforcement is turned on manually per-connection since SQLite ignores it by default. **There is no Alembic** (or any other migration tool) — schema stands up via `scripts/bootstrap_sqlite.py` / `scripts/seed_sqlite_dev.py` plus a one-off `scripts/migrate_2026_08_review.sql`; there's no visible versioned migration chain for how Postgres schema changes actually roll out over time.

**Config** — `app/core/config.py`, a single flat `pydantic-settings` `Settings` class reading `.env`, no per-environment split. Several defaults are dev-placeholder values (`api_key: str = "change-me-local-dev-key"`, `session_secret: str = "change-me-session-secret"`) that also serve as the silent fallback if the env var is simply absent.

**AI features are stubs, not a real pipeline** — `app/api/v1/endpoints/ai_row_suggestions.py`, `ai_suggestions.py`, and the `/process` action in `documents.py` are explicitly documented in their own code comments as placeholders ("no real AI/LLM pipeline exists in this repo yet", "the app never writes directly to business tables"). `documents.py::process_documents` just flips a status enum after `asyncio.sleep(1.5)`; `ai_row_suggestions.py::seed_test_suggestions` fabricates canned rows per RAID entity type for frontend testing. Do not assume a vLLM/prompt/RAG implementation exists to critique under Section 17 — confirm this stub status first.

**External integrations** — `app/api/v1/endpoints/integrations.py` is a CRUD registry of `IntegrationConnection` rows plus a `BackupRestoreLog` endpoint whose `trigger_backup_restore` only inserts a log row with status `"In Progress"` — nothing actually invokes a backup. The only external network call the backend itself makes is to OneLogin's OIDC endpoints via Authlib in `auth.py`. No Oracle (or other enterprise API) client code exists yet in this backend.

**Document storage** — `app/api/v1/endpoints/documents.py` stores uploads on local disk under `settings.document_storage_dir`, one subfolder per project. Filenames/folder segments are regex-sanitized before touching the filesystem (`_sanitize_segment`), and `storage_path` is persisted server-side and read back from the DB (not re-derived from user input) on download — this looks deliberately hardened already; treat it as a confirm-don't-assume item.

**Logging & error handling** — no `import logging` / logger and no `print()` calls anywhere in `app/`. No global exception handler is registered on the FastAPI app. Error responses are whatever FastAPI/Starlette produce by default for unhandled exceptions, plus explicit `HTTPException` raises scattered through endpoints (fairly consistent in style). The relevant question for Section 11 is less "is logging done badly" and more "does this app need any application logging yet, and where would it matter most (auth failures, AI stub boundary, document storage writes)."

**Audit trail** — `app/models/audit.py` / `app/crud/audit.py` / `app/api/v1/endpoints/audit.py` define and expose `UserActivityLog` (`GET /audit-log`), but no other code path in the repo appears to ever write a row into it. Confirm whether it's populated by a DB trigger, an import script, or is simply an unfinished feature before flagging it as dead code.

**Tests** — `backend/tests/`, pytest + pytest-asyncio (`asyncio_mode = auto` in `pytest.ini`), 21 files, mostly 1:1 with an endpoint module (`test_projects.py`, `test_raid.py`, `test_measurement.py`, etc.) plus `test_authorization.py` (fake-DB unit tests for the `deps.py` scope dependencies, no live DB) and `test_health.py`. Check `tests/conftest.py` to see whether the rest of the suite runs against `aiosqlite` or requires Postgres.

**Dependencies** (`backend/requirements.txt`, flat pip file, no `pyproject.toml`): `fastapi==0.115.6`, `uvicorn[standard]==0.34.0`, `sqlalchemy==2.0.36`, `asyncpg==0.30.0`, `aiosqlite==0.20.0`, `pydantic==2.10.4`, `pydantic-settings==2.7.1`, `python-dotenv==1.0.1`, `python-multipart==0.0.20`, `httpx==0.28.1`, `authlib==1.3.2`, `pyjwt==2.10.1`, `itsdangerous==2.2.0`, `pytest==8.3.4`, `pytest-asyncio==0.25.0`. Test dependencies live directly in this same file (no separate dev-requirements split).

**Largest files** (candidates worth a closer look under Sections 3–4): endpoints — `measurement.py` (541 lines), `ai_suggestions.py` (530), `ai_row_suggestions.py` (356, though roughly 200 of those lines are canned fixture data for `seed_test_suggestions`, not endpoint logic), `regional_status.py` (314), `metric_target.py` (267), `raid.py` (237), `documents.py` (211), `health_declarations.py` (201), `contractual.py` (195); services — `dashboard.py` (434), `measurement_metrics.py` (165), `account_rollup.py` (130), `geo_rollup.py` (120).

## 1. First Understand the Backend

Before making recommendations:

* inspect the complete backend folder structure;
* identify FastAPI application entry points;
* identify routers/endpoints;
* identify service/business logic;
* identify repositories/data-access code;
* identify SQLAlchemy models;
* identify Pydantic schemas;
* identify configuration/settings;
* identify authentication/authorization;
* identify utility/helper modules;
* identify background jobs if any;
* identify external integrations;
* identify tests;
* identify database migration approach.

Do not make recommendations until you understand the existing structure and patterns.

## 2. Architecture & Separation of Responsibilities — Highest Priority

Review whether responsibilities are properly separated.

Look for:

* large endpoint functions containing business logic;
* database access directly inside routers;
* repeated business rules;
* repeated validation logic;
* tightly coupled modules;
* services with too many responsibilities;
* circular dependencies;
* utility modules becoming dumping grounds;
* duplicate code across features.

The preferred direction should generally be:

```text
Router
  ↓
Service
  ↓
Repository / Data Access
  ↓
Database
```

Pydantic schemas should handle API contracts, while business rules should remain in the service layer.

Do not recommend layers merely for theoretical purity. Recommend separation only where it improves maintainability, reuse, testability or clarity.

For every significant issue, mention the exact file(s).

Project-specific starting points: `app/crud/base.py` (`CRUDBase`) is the de facto repository layer — check whether services and routers go through it consistently or bypass it with ad-hoc `db.execute(select(...))` calls (e.g. `app/services/account_rollup.py`, `app/services/dashboard.py` query models directly, which may be appropriate for read-only aggregation or may be duplicating what a CRUD method should own). Check whether the generic `build_crud_router` in `app/api/v1/factory.py` (used by `raid.py`, `measurement.py`, `integrations.py`, and others) ever needs business-rule hooks that routers are currently working around locally.

## 3. FastAPI Router Review

Review all API routers/endpoints.

Identify:

* very large endpoint functions;
* repeated request/response handling;
* inconsistent route naming;
* inconsistent HTTP verbs;
* incorrect status codes;
* inconsistent response models;
* missing response models;
* missing validation;
* duplicated dependency handling;
* excessive use of request objects;
* inconsistent query/path/body parameter usage.

Check whether routers are focused mainly on HTTP concerns rather than business logic.

Project-specific starting points: the largest endpoint modules are `app/api/v1/endpoints/measurement.py` (541 lines), `app/api/v1/endpoints/ai_suggestions.py` (530), `app/api/v1/endpoints/regional_status.py` (314, four routers in one file), and `app/api/v1/endpoints/metric_target.py` (267) — check these first for oversized handler functions or HTTP-layer code doing more than request/response shaping. Check `app/api/v1/endpoints/audit.py` and `app/api/v1/endpoints/dashboard.py` specifically for missing `require_role`/scope dependencies (see Section 0) — every other router applies one. Compare status-code and response-model conventions between hand-written routers (e.g. `raid.py`) and the `build_crud_router`-generated ones (`app/api/v1/factory.py`) for consistency.

## 4. Service Layer

Review business/service logic.

Identify:

* services that are too large;
* business rules duplicated across services;
* services calling each other in confusing ways;
* service methods with too many responsibilities;
* repeated transaction logic;
* unclear domain boundaries;
* helper methods that should be shared;
* logic that belongs in repositories or validators instead.

Do not split every service into tiny classes. Recommend changes only where there is clear value.

Project-specific starting points: `app/services/dashboard.py` (434 lines) backs a single endpoint (`GET /dashboard/summary` in `dashboard.py`) and computes roughly 14 separate aggregates — check whether it's one cohesive read model or several unrelated concerns bundled together. `app/services/account_rollup.py` and `app/services/geo_rollup.py` (and their `account_health_rollup.py`/`geo_rollup.py`/`health_rollup.py` counterparts) look structurally similar (project → account/geo aggregation) — check for logic that's duplicated rather than shared. Grouping/summing is done in Python rather than SQL (`account_rollup.py`'s own docstring calls this out as deliberate for small portfolio sizes) — worth a sanity check on whether that assumption still holds where it's applied.

## 5. Database & SQLAlchemy

Review database usage carefully.

Check:

* SQLAlchemy 2.x usage;
* sync vs async consistency;
* session lifecycle;
* transaction handling;
* commits and rollbacks;
* N+1 queries;
* repeated queries;
* inefficient joins;
* unnecessary full-table loads;
* incorrect relationship loading;
* missing indexes suggested by query patterns;
* database calls inside loops;
* duplicate repository logic;
* raw SQL where ORM/query builder would be clearer;
* ORM usage where raw SQL may actually be more appropriate.

Also review whether sessions are safely managed per request.

Identify places where partial writes could occur if an exception happens.

Project-specific starting points: `app/core/db.py::get_db()` is the single session-per-request implementation used everywhere (async, commit-on-success/rollback-on-exception) — confirm no endpoint or service opens its own session or calls `db.commit()` directly, which would break that boundary. There is no Alembic or other migration tool (see Section 0) — `scripts/bootstrap_sqlite.py`, `scripts/seed_sqlite_dev.py`, and the one-off `scripts/migrate_2026_08_review.sql` are the only schema-provisioning artifacts found; assess whether that's an actual gap for how Postgres schema changes reach environments beyond local dev, or whether migration tooling lives outside this repo. Multi-step writes to review for partial-commit risk: `app/api/v1/endpoints/documents.py::upload_document` (writes the file to disk, then creates the DB row — a crash between the two would leave an orphan file) and `app/services/account_rollup.py::pull_rollup_item` (creates a new `AccountStatusItem` row, then mutates and flushes the source `ProjectStatusItem` — same `db.flush()`/transaction, so likely fine, but worth confirming both flush points share one transaction).

## 6. Repository / Data Access Layer

If a repository layer exists, review whether it is useful and consistent.

Identify:

* routers bypassing repositories;
* services bypassing repositories inconsistently;
* repositories containing business logic;
* repeated CRUD code;
* overly generic repositories;
* repositories that add no value;
* database-specific logic leaking into higher layers.

If no repository layer exists, do not automatically recommend creating one everywhere. Recommend it only where duplicated or complex data access justifies it.

Project-specific starting points: `app/crud/base.py::CRUDBase` already functions as this layer for straightforward models — the open question is consistency of use, not whether one exists. Note the design choice documented in its docstring: `create()`/`update()` fill `id`/`created_at`/`updated_at` centrally so individual endpoints don't have to — check that no router/service re-implements this instead of relying on it.

## 7. Pydantic Schemas & Validation

Review all request/response models.

Identify:

* duplicated schemas;
* overly broad schemas;
* use of `dict` where typed models are appropriate;
* missing validation;
* validation logic duplicated in endpoints/services;
* inconsistent optional/required fields;
* incorrect defaults;
* unsafe use of `Any`;
* inconsistent enum handling;
* response models exposing internal database fields;
* input schemas reused incorrectly as response schemas.

Check Pydantic v2 compatibility and patterns.

Project-specific starting points: the stack is Pydantic v2 (`pydantic==2.10.4`) throughout, including `pydantic-settings` for config — check for any leftover v1-style patterns (`.dict()`, `class Config`, `@validator`) rather than v2 idioms (`.model_dump()`, `model_config`, `@field_validator`). `app/schemas/enums.py` centralizes enum definitions (e.g. `DocumentContext`, role codes) — check whether every schema/model that should use these actually does, versus any place still using bare strings.

## 8. Domain Models & Business Rules

Review whether important business rules are explicitly implemented.

For Project Governance, check areas such as:

* project creation;
* project reporting;
* Account / Geo / CXO reporting;
* reporting periods;
* RAIDO handling;
* measurements;
* contractual compliance;
* assessments;
* AI-applied changes;
* role-based access;
* project lifecycle/status transitions.

Identify rules that are:

* duplicated;
* implied rather than enforced;
* implemented only in the frontend;
* inconsistent across endpoints.

Backend should enforce critical business rules even if the frontend also validates them.

Project-specific starting points: the "AI-applied changes" area (`app/api/v1/endpoints/ai_row_suggestions.py`, `ai_suggestions.py`) is currently a stub, not a real pipeline — see Section 0 and Section 17 before reviewing it as if extraction logic existed. `RollupStatus`/rollup-pull rules live in `app/services/account_rollup.py::pull_rollup_item` and `app/services/geo_rollup.py` — check these enforce the same invariants the frontend assumes (e.g. an item can only be pulled once, per `RollupItemAlreadyHandledError`). Project lifecycle/status values are per the existing memory note that `ProjectStatus` values are `Draft`/`Pending Approval`/`Approved` — check `app/models/project_status.py` and `app/schemas/enums.py` for where transitions between these are actually enforced server-side versus assumed from the frontend.

## 9. Authentication & Authorization

Review backend security handling.

Check:

* authentication mechanism;
* token/session validation;
* role checks;
* project-level access;
* account-level access;
* geo-level access;
* CXO access;
* admin access;
* authorization dependencies;
* repeated permission logic;
* missing access checks;
* trust placed on frontend-supplied role/user IDs.

If OneLogin/OIDC integration is present, review token validation and claim usage.

Do not assume the frontend is trusted.

Project-specific starting points (see Section 0 for the full picture): auth is two-layered — a static shared `X-API-Key` (`app/core/security.py::verify_api_key`, same value for every client) plus a JWT session cookie (`app/core/session.py`, HS256, decoded in `app/api/deps.py::get_current_user`). `app/api/v1/endpoints/auth.py` implements both `auth_type=no_password` (dev identifier-only login, no password) and `auth_type=onelogin` (real OIDC via Authlib, strict pre-provisioned — no JIT account creation). Confirm the `no_password` path is actually unreachable whenever `auth_type=onelogin` in every deployed environment, not just gated by the one runtime check in `login()`. Role/scope enforcement lives in `app/api/deps.py` (`require_role`, `require_account_scope`, `require_geo_scope`, `require_project_account_scope`, `require_account_geo_scope`, added in commit `a6c607e`) and is applied in 22 of 25 routers; `audit.py` and `dashboard.py` currently have none — check whether that's intentional (e.g. deliberately global read-only views) or the same gap class `a6c607e` fixed elsewhere. Logout (`auth.py::logout`) only clears the cookie — the JWT itself has no server-side revocation before `session_ttl_minutes` (480 min default) elapses; assess whether that's an acceptable tradeoff for this app.

## 10. Error Handling

Review how exceptions are handled.

Identify:

* bare `except`;
* generic 500 responses;
* stack traces exposed to users;
* duplicated HTTPException logic;
* swallowed exceptions;
* inconsistent error response formats;
* database exceptions leaking through;
* unclear validation errors;
* missing global exception handlers.

Recommend a consistent error-response strategy if needed.

Project-specific starting points: no global exception handler (`@app.exception_handler`) is registered in `app/main.py` — unhandled exceptions fall through to FastAPI/Starlette's default 500 response. Error handling elsewhere is explicit `HTTPException` raises scattered through each endpoint module (fairly consistent in shape: status + plain-string `detail`) rather than a shared error-response schema. `app/core/db.py::get_db()` is the one place with a `try/except Exception` (rollback-then-reraise) — check it isn't masking anything, and that no other module swallows exceptions silently.

## 11. Logging

Review logging practices.

Identify:

* `print()` statements;
* excessive debug logging;
* missing correlation/request IDs;
* sensitive data logged;
* tokens/passwords/document content logged;
* inconsistent log levels;
* exceptions logged without useful context;
* duplicate logging at multiple layers.

Recommend structured logging only where useful.

Project-specific starting points: there is currently no `logging` usage and no `print()` calls anywhere in `app/` — this is a from-scratch decision, not a cleanup of bad existing logging. Frame any recommendation as "should logging be introduced, and where would it matter most" (candidates: auth failures in `app/api/deps.py`/`auth.py`, the document-storage write path in `documents.py::upload_document`, the AI-stub boundary in `ai_row_suggestions.py`/`ai_suggestions.py` once real extraction lands) rather than "logging is done inconsistently."

## 12. Configuration & Secrets

Review configuration management.

Check:

* environment variables;
* Pydantic settings;
* hard-coded URLs;
* hard-coded credentials;
* database connection strings;
* CORS configuration;
* model/service URLs;
* environment-specific settings;
* development flags leaking into production.

Identify configuration duplicated in multiple files.

Project-specific starting points: `app/core/config.py` is the single `pydantic-settings` `Settings` class (reads `.env`, `extra="ignore"`), no per-environment split (dev/staging/prod share the same class with `.env`-driven overrides). Several fields default to obviously-dev placeholder values when the env var is absent — `api_key: str = "change-me-local-dev-key"`, `session_secret: str = "change-me-session-secret"` — check whether anything guards against these silently shipping unchanged in a non-local environment. `.env.example` documents the OneLogin redirect-URI gotcha (must be the frontend's origin, proxied to the backend, or the session cookie ends up scoped wrong) — worth confirming that constraint is actually satisfied by the current Next.js rewrite config referenced there, if in scope.

## 13. API Consistency

Review consistency across APIs.

Check:

* naming conventions;
* plural/singular resource names;
* response envelopes;
* pagination style;
* filtering;
* sorting;
* date formats;
* enum representations;
* error format;
* success response patterns.

Do not propose a major API redesign unless inconsistencies are significant.

## 14. Performance

Look for genuine backend performance issues:

* database queries inside loops;
* repeated database reads;
* N+1 query patterns;
* unnecessary object serialization;
* loading large datasets without pagination;
* synchronous blocking operations inside async routes;
* inefficient file handling;
* unnecessary external API calls;
* repeated configuration/model loading;
* long-running operations inside request handlers.

Do not recommend caching unless there is a clear need.

Project-specific starting points: rollup/dashboard aggregation (`app/services/dashboard.py`, `account_rollup.py`, `geo_rollup.py`, `account_health_rollup.py`) sums and groups in Python after fetching rows, rather than pushing aggregation into SQL — `account_rollup.py`'s docstring explicitly justifies this by current portfolio size. Check whether `dashboard.py`'s ~14 aggregates (backing one `GET /dashboard/summary` call) run as 14 separate queries and whether any could reasonably be combined.

## 15. Async / Sync Usage

Review FastAPI async usage carefully.

Identify:

* `async def` endpoints calling blocking database or file operations;
* sync functions incorrectly awaited;
* blocking HTTP clients in async code;
* unnecessary async usage;
* inconsistent SQLAlchemy async/sync patterns;
* event-loop blocking operations.

Recommend one consistent pattern.

Project-specific starting points: the stack is async end-to-end (`asyncpg`/`aiosqlite`, all endpoints `async def`, `httpx` available for async HTTP). `app/api/v1/endpoints/documents.py::upload_document` does `content = await file.read()` then a synchronous `(base_dir / relative_path).write_bytes(content)` — a blocking disk write inside an async route; check whether upload sizes/volume in this app make that a real concern or a non-issue worth leaving alone. `documents.py::process_documents` uses `asyncio.sleep(1.5)` to simulate processing delay — fine as a stub (see Section 0/17), but flag if it survives once real processing is implemented.

## 16. External Integrations

Review external integration code such as:

* OneLogin;
* Oracle;
* vLLM;
* file storage;
* other enterprise APIs.

Check:

* timeouts;
* retry behavior;
* connection reuse;
* error handling;
* hard-coded endpoints;
* client initialization;
* response validation;
* resilience to unavailable services.

Do not deeply review external systems themselves.

Project-specific starting points: OneLogin is the one real external integration — `app/api/v1/endpoints/auth.py` registers an Authlib `OAuth` client at import time (`oauth.register(name="onelogin", ...)`) using `settings.onelogin_*`; check timeout/retry behavior on `oauth.onelogin.authorize_access_token()` and whether client registration failing at import time (e.g. malformed `onelogin_issuer`) takes down app startup even when `auth_type=no_password` and OneLogin isn't in use. "Oracle" and "vLLM" named in the generic checklist below do not have any client/integration code in this backend yet — do not review them as if they exist. `app/api/v1/endpoints/integrations.py` is a CRUD registry table (`IntegrationConnection`) plus a `BackupRestoreLog` endpoint that only logs an intended action (`trigger_backup_restore` inserts a row with status `"In Progress"` and does nothing else) — review it as a stub/placeholder, not a live backup system. File storage (`documents.py`) is local disk, not an external service — see Section 0's note on its existing sanitization.

## 17. AI / vLLM Integration

If AI extraction code exists, review:

* vLLM/OpenAI client initialization;
* prompt/config loading;
* timeout handling;
* structured output handling;
* JSON parsing;
* validation of LLM output;
* retries;
* model configuration;
* prompt duplication;
* field/grid extraction patterns;
* RAG query handling if implemented;
* logging of sensitive document text;
* hallucination safeguards;
* error handling.

Check that critical LLM output is validated before being applied to application data.

Do not redesign the AI architecture unless there is a specific issue.

**Important — confirm before reviewing this section**: as of this snapshot, `app/api/v1/endpoints/ai_row_suggestions.py` and `ai_suggestions.py` contain no vLLM/OpenAI client, no prompt template, and no real extraction logic. Their own code comments say so directly ("no real AI/LLM pipeline exists in this repo yet"). What exists: an `AiRowSuggestion`/`AiSuggestion` data model with a status lifecycle (pending → applied/ignored, see `AiRowSuggestionStatus` in `app/schemas/enums.py`), a `POST /projects/{project_id}/ai-row-suggestions/seed-test-data` endpoint (`ai_row_suggestions.py`) that fabricates canned candidate rows per RAID entity type (risks, issues, dependencies, assumptions, opportunities, commitments, milestones, DE-assessment alerts/findings) for frontend testing, and an `/apply`/`/ignore` pair that only transitions status — the frontend is documented to create the real Risk/Issue/etc. row itself via that entity's own create endpoint, meaning "apply" never writes business data on the backend's behalf. Most of Section 17's checklist (client init, prompt/config loading, structured output parsing, hallucination safeguards) has nothing to inspect yet — the useful review here is confirming the stub boundary is intentional and consistently documented, not auditing extraction logic that doesn't exist.

## 18. Transactions & Data Integrity

Review operations that update multiple tables.

Identify where explicit transaction boundaries are needed.

Check:

* partial saves;
* multiple commits in one business operation;
* missing rollbacks;
* inconsistent update ordering;
* orphan records;
* duplicate records;
* concurrent update risks;
* optimistic/pessimistic locking needs where relevant.

Project reporting and RAIDO updates should be especially reviewed for consistency.

Project-specific starting points: `app/services/account_rollup.py::pull_rollup_item` performs a read (`ProjectStatusItem`), a create (`account_status_item_crud.create`), and a mutation of the original item (`account_rollup_status`, `rolled_up_account_item_id`) inside one `get_db()`-scoped request — check it's genuinely one transaction (it appears to be, via a shared `db.flush()` without an intermediate commit) and that `RollupItemAlreadyHandledError`/`RollupItemNotFoundError` can't race under concurrent pulls of the same item. `app/api/v1/endpoints/documents.py::upload_document` writes the file to disk *then* creates the DB row — a failure between those two steps leaves an orphaned file with no DB record (minor/low-risk given it's not the reverse — no DB row ever points at a missing file — but worth noting).

## 19. Security Review

Perform a practical backend security review.

Check for:

* SQL injection risks;
* unsafe raw SQL;
* mass assignment;
* insecure direct object references;
* missing authorization checks;
* sensitive data exposure;
* weak CORS settings;
* unrestricted file handling;
* unvalidated IDs;
* unsafe deserialization;
* path traversal;
* secrets in code;
* debug mode;
* overly permissive endpoints.

Prioritize real findings over generic security checklists.

Project-specific starting points: the shared `X-API-Key` (`app/core/security.py`) is a single static value common to every client — not a per-user or per-service credential; assess what it actually defends against given the session cookie already carries user identity. `app/api/v1/endpoints/audit.py` and `app/api/v1/endpoints/dashboard.py` have no `require_role`/scope dependency (Section 0/9) — the concrete IDOR-shaped question is whether a non-admin user can read another account's/geo's audit trail or dashboard data by simply passing its ID as a query param. `app/api/v1/endpoints/documents.py` sanitizes filenames/folder segments before filesystem use and reads `storage_path` back from the DB rather than re-deriving it from user input on download — check this holds for every code path that touches `settings.document_storage_dir`, including `delete_document`. `settings.session_cookie_secure` defaults to `False` (documented as intentional for plain-HTTP internal envs) — confirm it's actually `True` wherever the app is reachable over HTTPS or by anyone outside a trusted internal network.

## 20. Testing

Review the existing tests.

Identify:

* critical services without tests;
* endpoint tests missing;
* database tests missing;
* authorization tests missing;
* tests tightly coupled to implementation;
* excessive mocking;
* missing negative cases;
* missing transaction tests;
* missing integration tests.

Recommend the most valuable tests first.

Do not suggest 100% coverage as a goal.

Project-specific starting points: `backend/tests/` has 21 files, mostly 1:1 with an endpoint module by name. `test_authorization.py` unit-tests the `app/api/deps.py` scope dependencies against a hand-rolled fake `AsyncSession` (no live DB) — check `tests/conftest.py` to see what the rest of the suite runs against (`aiosqlite` vs. a live Postgres) and whether that choice is applied consistently. Given `audit.py` and `dashboard.py` currently have no scope dependency (Section 0/9/19), check whether `test_audit.py`/`test_dashboard.py` (if scoping is added) or a new test would be the fastest way to lock in the fix. No `test_ai_row_suggestions.py`/similar appears in the list — confirm whether that module's stub behavior (seed/apply/ignore status transitions) has any coverage.

## 21. Dead / Unnecessary Code

Identify:

* unused routers;
* unused services;
* unused models;
* duplicate helper functions;
* commented-out code;
* temporary code;
* obsolete endpoints;
* unused dependencies;
* development-only logic.

Do not delete anything.

Project-specific starting points: `app/models/audit.py` / `app/crud/audit.py` / `app/api/v1/endpoints/audit.py::list_activity_log` define and expose `UserActivityLog`, but no other module in the repo appears to insert a row into it — confirm whether it's populated by a DB trigger or import script outside `app/`, or is an unfinished feature, before calling it dead. `auth_type=no_password` in `app/api/v1/endpoints/auth.py::login` is explicitly dev-only per its own comment — confirm it's disabled (not just discouraged) in any environment where `onelogin` should be the only path. `documents.py::process_documents`'s `asyncio.sleep(1.5)` is development-only simulated latency (Section 0/17) — flag for removal once real processing exists, not now.

## 22. Dependency Review

Review `requirements.txt`, `pyproject.toml`, or equivalent.

Identify:

* duplicate dependencies;
* unused packages;
* very old packages;
* unnecessary frameworks;
* dependency overlap;
* dev dependencies mixed with runtime dependencies.

Do not upgrade packages automatically.

Project-specific starting points: `backend/requirements.txt` is the only dependency manifest — flat pip list, no `pyproject.toml`/`poetry.lock`, and test-only packages (`pytest`, `pytest-asyncio`) are mixed directly into the same file as runtime dependencies (see the exact list in Section 0). Check pin freshness against what's actually imported (e.g. `python-multipart` is only needed for the `documents.py` upload form; `itsdangerous` backs Starlette's `SessionMiddleware`, used only for the transient OneLogin state — confirm it's still needed if OIDC is ever dropped).

## 23. Current vs Recommended Architecture

Show the current backend architecture in simple form.

As a starting point, the actual current shape (see Section 0 for the file-level detail) is closer to:

```text
FastAPI (app/main.py)
  ↓  (verify_api_key + get_current_user, enforced at include_router level)
Routers (app/api/v1/endpoints/*.py — either hand-written, or generated by
         app/api/v1/factory.py::build_crud_router for simple/RAID/Measurement resources)
  ↓
Services (app/services/*.py — aggregation/rollup logic only; not every router goes through one)
  ↓
CRUDBase (app/crud/*.py — the de facto data-access layer; routers/services call it directly)
  ↓
SQLAlchemy 2.x async (app/core/db.py)
  ↓
Database (asyncpg/Postgres in prod, aiosqlite/dev.db locally)
```

Confirm against the actual code whether this holds consistently (some routers/services query models directly via `db.execute(select(...))` rather than going through a `crud` module — see Section 2/6) before treating it as settled fact.

Then show the recommended target structure based on the actual code.

Prefer incremental improvement over a rewrite.

## 24. Produce a Prioritized Improvement Backlog

Create a table:

| ID | Priority | Area | Issue | Files Affected | Recommendation | Effort | Risk |
| -- | -------- | ---- | ----- | -------------- | -------------- | ------ | ---- |

Use:

* P0 — correctness/security/data integrity issue
* P1 — high-value architecture improvement
* P2 — maintainability/consistency improvement
* P3 — optional improvement

Effort:

* Small
* Medium
* Large

Risk:

* Low
* Medium
* High

Group similar issues together instead of listing every occurrence separately.

## 25. Architecture / Refactoring Summary

Provide a separate table:

| Proposed Improvement | Current Problem | Files/Modules | Benefit | Priority |
| -------------------- | --------------- | ------------- | ------- | -------- |

Examples may include:

* central API error handler;
* shared repository pattern;
* service extraction;
* common authorization dependency;
* shared transaction boundary;
* centralized settings;
* common response models;
* shared AI client;
* reusable validation service.

These are examples only.

Recommend them only if the code shows a real need.

## 26. Final Recommendation

At the end, provide:

1. Overall backend assessment.
2. Top architecture concerns.
3. Top correctness/data-integrity risks.
4. Top security concerns.
5. Top performance issues.
6. Top 10 improvements in recommended implementation order.
7. Which improvements can be implemented independently.
8. Which improvements depend on others.
9. Areas that are already well-designed and should not be refactored.
10. Any changes that should be avoided because the risk exceeds the benefit.

## Important Rules

This must be an evidence-based review.

Do not give generic Python/FastAPI best practices unless they apply to the actual code.

Always mention specific files when identifying an issue.

Do not over-engineer.

Do not recommend microservices.

Do not recommend Kafka, Redis, queues, caching, repositories, or additional architectural layers unless the existing code demonstrates a real requirement.

Prefer incremental refactoring.

Most importantly:

**DO NOT CHANGE ANY CODE.**

Create the review as:

`BACKEND_CODE_REVIEW_FEEDBACK.md`

The report should be detailed enough that we can later select each recommendation individually and ask you to implement it without repeating the full review.
