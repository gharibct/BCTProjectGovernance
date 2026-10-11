# Project Template — Agent Guide

Blueprint for building a new app on this proven stack. Read fully before writing code. Follow the rules literally; deviate only when the user says so. `<entity>` / `<Entity>` = your domain object.

## 1. Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, async SQLAlchemy 2.0 (`Mapped[]` style), Pydantic v2 + pydantic-settings, asyncpg (Postgres) / aiosqlite (local dev + e2e), APScheduler, openpyxl, PyJWT |
| Frontend | Next.js (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4, shadcn/ui + Radix, TanStack Query v5, Zustand, sonner (toasts), lucide-react, xlsx, tiptap (rich text) |
| DB | PostgreSQL. **Hand-written SQL is the schema source of truth** (no Alembic) |
| Tests | pytest + pytest-asyncio (`asyncio_mode=auto`), httpx ASGITransport; Playwright e2e |
| Auth | Signed session cookie + shared `X-API-Key`; `AUTH_TYPE` = `no_password` \| `password` (scrypt) \| `onelogin` (OIDC) |

Next.js here has breaking changes vs. training data: read `node_modules/next/dist/docs/` before writing Next code. Keep `frontend/AGENTS.md` with that warning and `frontend/CLAUDE.md` containing `@AGENTS.md`.

## 2. Repo layout

```
backend/
  app/
    main.py            # app, CORS, SessionMiddleware, router wiring, lifespan (scheduler)
    core/              # config.py (Settings), db.py (engine/Base/get_db), security.py, session.py, scheduler.py, labels.py
    api/deps.py        # get_current_user, require_* role/scope guards, pagination_params
    api/v1/router.py   # includes every endpoint module
    api/v1/factory.py  # build_crud_router for simple resources
    api/v1/endpoints/  # one file per resource/screen
    models/            # SQLAlchemy models (+ mixins.py: UUIDPrimaryKey, TimestampColumns)
    schemas/           # Pydantic: <X>Create / <X>Update / <X>Read; enums.py (StrEnums); common.py (Page[T])
    crud/              # CRUDBase generic + per-model modules
    services/          # business logic, rollups, notifications, scans (no HTTP here)
    master_data/       # Excel import/template machinery
    data/              # YAML reference data
  scripts/             # bootstrap_sqlite, seed_sqlite_dev, import_*, set_password
  tests/               # test_<feature>.py + conftest.py
  import_templates/    # hand-formatted Excel templates
  .env.example
db/
  run_all.sql          # runs tables/*.sql in dependency order
  tables/NN_<name>.sql # fresh-install schema (numbered)
  add_<change>.sql     # idempotent migration for already-deployed DBs
frontend/
  src/app/(app)/<route>/page.tsx   # thin: metadata + one <XView/>; (app)/layout.tsx wraps AuthGuard+shell
  src/app/login/
  src/components/<feature>/        # feature views; ui/ (shadcn primitives); forms/ (shared form kit); shell/ (header/sidebar/nav); shared/
  src/lib/api/client.ts            # the only fetch wrapper; one <resource>.ts per backend resource
  src/lib/                         # menu-config.ts, role-labels.ts, format-date.ts, utils.ts (cn)
  src/stores/                      # zustand: session, page-banner, context stores
  src/hooks/  e2e/  next.config.ts (API rewrite)
docs/  product-brain/  prompts/    # specs, rules, design refs, reusable prompts
```

## 3. Backend rules

**Layering:** endpoint (HTTP + auth) → crud (persistence) → services (business rules). Never put business logic in endpoints or SQL in services' callers' routes beyond simple queries.

**Config:** every setting lives in `core/config.py` (`Settings`, `.env`), mirrored in `.env.example`. No `os.environ` elsewhere. Never commit `.env`.

**DB session:** `get_db` yields a session, commits on success, rolls back on error. Don't call `commit()` in endpoints. Use `await db.flush()` when you need generated values mid-request.

**Models:** `class X(Base, UUIDPrimaryKey, TimestampColumns)`. UUID PKs and timestamps are filled **in code** (`CRUDBase.create`), not by DB defaults. `Mapped[T | None]` for nullable. Timestamps are timezone-aware UTC (`datetime.now(UTC)`).

**Schema discipline:** no DB CHECK constraints — enforce value sets with Pydantic `StrEnum`s in `schemas/enums.py`. Store enums as text. Human-readable codes (e.g. `ACT-0001`) come from `services/code_generator.py`.

**Schemas:** separate `Create` / `Update` (all-optional, `exclude_unset` on patch) / `Read` (`from_attributes=True`). List endpoints return `Page[Read]` (`items,total,skip,limit`) using `pagination_params` (default 50, max 200).

**Endpoints:**
- Simple resource → `build_crud_router(...)` with `write_dependencies=[Depends(require_role(...))]`.
- Anything richer → hand-written router; register in `router.py`.
- Route-level guards go in `dependencies=[...]` so they 403 **before** body validation.
- All `/api/v1/*` (except `/auth/*`) require `verify_api_key` + `get_current_user`.
- Search/filter server-side (`search`, id filters); never ship large lists to the client to filter.

**Authorization (RBAC + scope):** roles are an enum (`RoleCode`). Guards in `api/deps.py`: `require_role`, `require_*_scope`, `require_project_access`-style resource guards. List endpoints must apply scope conditions (`project_scope_conditions`) so users only see what they own. Admin/oversight roles bypass scope explicitly. Never trust ids from the client without a scope check.

**Errors:** `HTTPException` with a string `detail`, or a structured `{code, message, ...}` for machine-handled cases (e.g. `PROJECT_LOCKED`, 422). Frontend reads `ApiError.code`.

**State locks:** guard writes by lifecycle state in one dependency (e.g. `ensure_baseline_editable`) — not scattered `if`s.

**Audit / activity:** a global dependency (`touch_project_on_write`) records activity after any successful write; add audit rows via `crud/audit.py` for sensitive changes.

**Notifications:** one write path `services/notifications.notify()`; idempotence via `dedupe_key` (unique per recipient); in-app inbox first. Scheduled scans run from an in-process APScheduler started in `lifespan`, off under pytest, switchable via `ENABLE_SCHEDULER` (only one instance may scan).

**Auth flow:** login sets httpOnly `pg_session` JWT cookie (HS256, TTL from settings). OIDC redirect URI must be the **frontend** origin (Next proxies `/api/v1` to the backend) so the cookie is same-origin. Users are pre-provisioned; no auto-create on login. Passwords: stdlib scrypt, self-describing hash string.

**Labels:** user-facing role/term labels that may be renamed live in one place per tier (`core/labels.py`, `frontend/src/lib/role-labels.ts`). Never hardcode them; keep internal codes stable.

**Bulk import:** Excel import/export via `master_data/` (registry → introspection → template generation → import). Each import grid has a hand-formatted template in `import_templates/` (falls back to auto-generated). Keep an `Import-Excel-Template-Readme.md` listing every grid + template filename; update on each new grid.

**AI features (if any):** suggestions are never shown automatically. Only after the user clicks an explicit "load/apply" button, and only for that visit. Store suggestions in their own tables; keep human-entered values separate and authoritative.

**Style:** type hints everywhere, `async def` for I/O, ruff-style formatting (line ≤ ~120), docstrings/comments explain *why* (business rule, trap), not *what*.

## 4. Database workflow

1. New table → `db/tables/NN_name.sql` (next number) **and** add `\ir` line to `db/run_all.sql` in dependency order.
2. Change to existing schema → `db/add_<change>.sql`, idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), plus update the matching `tables/NN_*.sql` so fresh installs match.
3. Match the model in `app/models/`. Index FKs and query filters; partial unique indexes for optional keys (e.g. `dedupe_key`).
4. Local: `DATABASE_URL=sqlite+aiosqlite:///./dev.db` → `python -m scripts.bootstrap_sqlite` then `scripts.seed_sqlite_dev`. SQLite FK enforcement is enabled in `core/db.py`; keep SQL portable (avoid Postgres-only features in code paths tests hit).
5. Never apply migrations to a shared DB yourself; hand the user the script and say so.

## 5. Frontend rules

**Routing:** each screen = `src/app/(app)/<route>/page.tsx` that only sets `metadata` and renders a feature view from `components/<feature>/`. Pages that need request-time data are dynamic (`export const dynamic = "force-dynamic"` in root layout).

**API access:** only through `lib/api/client.ts` (`api.get/post/put/patch/delete/postForm/getBlob`). It adds `credentials:"include"`, `X-API-Key`, relative `/api/v1` base (proxied by `next.config.ts` rewrite → `API_PROXY_TARGET`), throws `ApiError{status,detail,code}`, and signs out + redirects to `/login` on 401. One `lib/api/<resource>.ts` per backend resource exporting types, label maps, and `useQuery`/`useMutation` hooks. Types mirror backend schemas; enum label maps live beside the types.

**Data:** TanStack Query for all server state (stable query keys, invalidate on mutation). Zustand only for client state (session, selected context, banner). No fetch in components, no duplicated server state in stores.

**Auth/nav:** `AuthGuard` in `(app)/layout.tsx`; role-based menu in `lib/menu-config.ts` (single source for entries, landing page, "work as" contexts). Context stores remember the last selected entity per user.

**UI kit (reuse before inventing):** shadcn primitives in `components/ui`; shared form kit in `components/forms` — `FilteredCombo`/`ProjectPicker` (large lookups, server-side filter), `ResourcePicker` (async user search; never a native `<select>` for people), `RegisterTable`, `PaginationBar`, `StickyActionBar`, `ConfirmationDialog`, `EmptyState`, `StatusBadge`, import dialog/toolbar. Add new generic parts there, feature-specific parts in the feature folder.

**UX patterns (follow consistently):**
- Register add/edit forms open in a **right drawer** (`ui/sheet.tsx`, shared width), max 2 controls per row, inline field errors.
- Feedback = toast (sonner) + inline message via the `page-banner` store.
- Primary actions in a sticky action bar. Destructive/irreversible actions use a confirmation dialog.
- Disable (don't hide) actions that are unavailable and show why; gate read-only states with one wrapper component.
- Loading, empty, and error states are mandatory for every query (`QueryErrorState`, `EmptyState`).
- Dates formatted via `lib/format-date.ts`; class merging via `cn()`; Tailwind tokens/CSS variables, no ad-hoc colors (color maps live in `lib/*-colors.ts`).
- Every list that can be large is paginated and filtered server-side.

**Code style:** `"use client"` only where needed; named exports for components; files kebab-case; no `any`; keep components focused (split view / form / table); comments explain *why*.

## 6. Environments & config

- `backend/.env` (from `.env.example`): `DATABASE_URL, API_KEY, CORS_ORIGINS, DOCUMENT_STORAGE_DIR, AUTH_TYPE, SESSION_SECRET, SESSION_TTL_MINUTES, SESSION_COOKIE_SECURE, FRONTEND_BASE_URL, ENABLE_SCHEDULER, NOTIFICATION_SCAN_HOUR, ONELOGIN_*`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_KEY` (= backend `API_KEY`), optional `API_PROXY_TARGET`.
- Defaults are dev-only placeholders (`change-me-*`); real secrets per environment, never in git. `SESSION_COOKIE_SECURE=true` once on HTTPS (mandatory for OneLogin outside localhost).
- Git-ignore: `.venv, node_modules, .next, *.db, storage/, .env, .env.local, test-results, playwright-report`.
- Deployment: backend `uvicorn app.main:app`, frontend `next build && next start`, Postgres; document steps in `deployment.md`.

## 7. Testing & quality gates

- Every endpoint gets a pytest in `tests/test_<feature>.py` using the `client` fixture (ASGITransport). Cover: happy path, validation error, **authorization per role and scope**, locked/invalid-state cases.
- Business-rule services get direct unit tests.
- Playwright specs per major flow in `frontend/e2e/`, logging in once per role via `auth.setup.ts` storageState.
- `scripts/pre-release-check.ps1`: fresh SQLite backend → pytest → frontend build → Playwright → lint. Must pass before release.
- Before declaring done: `pytest`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean. Report failures honestly.

## 8. Documentation to maintain (keep in repo, update with the code)

`product-brain/` (numbered specs: overview, modules, processes, glossary, business rules, status workflows, roles matrix, screens, API, architecture, security, NFRs, decisions register, build status, test strategy, traceability) · `docs/` (BRS, UX requirements) · `Authentication.md` · `deployment.md` · `Import-Excel-Template-Readme.md` · `design-reference/` (HTML/MD mockups) · `prompts/` (reusable change prompts). When a business rule or workflow changes, update the relevant doc in the same change.

## 9. Build a new feature — checklist

1. Read the relevant spec/rule docs; confirm the roles and states involved.
2. SQL: `db/tables/NN_*.sql` + `run_all.sql` (+ `add_*.sql` if deployed DBs exist).
3. Model → schemas (Create/Update/Read, enums) → crud → service (rules) → endpoint (guards) → register in `router.py`.
4. Tests (incl. authorization) green.
5. `lib/api/<resource>.ts` types + hooks → feature component(s) → thin `page.tsx` → `menu-config.ts` entry per role.
6. Use shared form kit and drawer pattern; handle loading/empty/error; toast + banner feedback.
7. Add notifications / audit / import template if the feature needs them.
8. Update docs; run all gates in §7.

## 10. Agent conduct

- Match surrounding code style; extend existing helpers instead of duplicating.
- Don't start/stop the dev server yourself — ask the user to run it; verify with tsc/eslint/build/pytest.
- Don't apply DB migrations to shared databases, push, or deploy without being asked.
- Confirm before destructive or outward-facing actions (delete data, force push, send messages).
- No speculative features, abstractions, or "while I'm here" refactors. Do what was asked, minimally and completely.
- Persist durable user decisions (domain rules, UX choices) in the project's docs/memory, not just in chat.
