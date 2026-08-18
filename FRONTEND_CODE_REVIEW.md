# Frontend Architecture & Code Quality Review

**Scope:** `frontend/` (Next.js App Router / React 19 / TypeScript / Tailwind v4 / shadcn-radix / TanStack Query / Zustand), reviewed against `backend/` (FastAPI) only where needed to verify an API contract or an authorization claim.

**Method:** Full inspection of the App Router tree, every `components/*` subdirectory, all `lib/api/*.ts` hooks, both Zustand stores, `menu-config.ts`, the auth/session rework files, plus `eslint` run against `src` for hard evidence on dead code. All findings below are backed by specific files; no generic best-practice filler is included unless the code demonstrably needed it.

This is a review only — **no application files were modified.**

---

## 1. Application Overview

**Routing.** Single App Router tree under `src/app/(app)/` (authenticated shell) plus `src/app/login/` and `src/app/login/callback/` (public). Route groups: `dashboard/*`, `new-project/[projectId]/*`, `project-reporting/[projectId]/*`, `project-review/[projectId]/*`, `account-reporting/[accountId]/*`, `account-review/[accountId]/*`, `geo-reporting/[geoId]/*`, `geo-review/[geoId]/*`, `admin/*`. Every `page.tsx` is a thin server component (keeps `metadata`) that renders one client component — a consistent, good pattern used almost everywhere (`app/(app)/project-review/[projectId]/page.tsx`, `app/(app)/account-review/[accountId]/page.tsx`, `app/(app)/geo-review/[geoId]/page.tsx` all just parameterize `<StatusReviewPage scope=... paramName=.../>`).

**Layouts.** `app/(app)/layout.tsx` wraps everything in `AuthGuard` + `AppHeader`/`AppSidebar`/`AppFooter`. Each route group adds its own `layout.tsx` for a `<main>` wrapper and, for project/account/geo screens, a side nav (`ProjectNav`, `AccountNav`, `GeoNav`).

**Auth/session (in-flight rework).** Backend: `backend/app/core/session.py` (JWT-in-httpOnly-cookie), `backend/app/api/deps.py::get_current_user`, `backend/app/main.py` (global `get_current_user` dependency on `api_router`), `backend/app/api/v1/endpoints/auth.py` (`no_password` dev path + OneLogin OIDC path). Frontend: `frontend/src/lib/api/auth.ts`, `frontend/src/lib/api/client.ts` (401 → clears Zustand + redirects), `frontend/src/app/login/callback/page.tsx`, `frontend/src/stores/session.ts`. The repo's own `Authentication.md` (untracked plan doc) confirms this rework's stated goal was closing the "no per-request identity check" gap — it explicitly did **not** scope in role/permission enforcement. See §13 for what that leaves open.

**Role-based menu.** `frontend/src/lib/menu-config.ts` defines `ROLE_MENUS` (which sidebar entries each role sees) and `ROLE_LANDING_ROUTE` (post-login redirect). Consumed by `app-sidebar.tsx`'s `has()` helper. This is the **only** place role gating happens on the frontend — see §13.

**Reporting vs Review pattern.** Three tiers — Project, Account, Geo — each have a "Reporting" surface (edit/submit periodic data) and a "Review" surface (read-only roll-up one level up, with Approve/Reject). The **Review** tier is already fully unified: `components/status-review/status-review-page.tsx` takes `scope: "project"|"account"|"geo"` and drives all three routes. The **Reporting** tier is only partially unified: `components/regional-reporting/*` already generalizes Account+Geo behind a `scope` prop, but Project keeps a separate, non-generalized implementation next to it (`components/project-reporting/*`, `components/project-status/*`, `components/shell/project-nav.tsx` vs `account-nav.tsx`/`geo-nav.tsx`). This asymmetry is the single largest architectural inconsistency found — detailed in §2 and §16.

**RAID logs.** Five modules (Risk/Issue/Dependency/Assumption/Opportunity), each ~200-260 lines, under **two** parallel directories: `components/raido/*` (used by Project Reporting) and `components/new-project/raido/*` (used by the New Project wizard). The API layer (`lib/api/raid.ts`) is already fully shared via generic `useRaidList/useRaidCreate/useRaidUpdate/useRaidDelete` factories, and the presentation primitives (`components/forms/entry-form.tsx`, `form-primitives.tsx`, `register-table.tsx`, `status-badge.tsx`) are also already shared. What's duplicated is the per-entity screen component itself (field defs + submit/edit/delete wiring), copy-pasted once per log × once per tree = 10 files for 5 conceptual entities. Detail in §2.

---

## 2. Componentization — Highest Priority

### Finding A (P1, largest issue): The "New Project" tree duplicates the "Project Reporting" tree almost file-for-file

Confirmed by direct diff, not by inspection alone. Every module used while a project is in Draft/Pending Approval ("Maintain Project", routed at `/new-project/[projectId]/...`) has a separately-maintained near-twin used once the project is Approved ("Project Reporting", routed at `/project-reporting/[projectId]/...`):

| Reporting-side file | New-project-side twin | Diff character |
|---|---|---|
| `components/project-charter/charter-form.tsx` (648 ln) | `components/new-project/charter-form.tsx` (785 ln) | Same 4 tab-forms (`ProjectDescriptionTab`, Profile, Scope/Schedule, Self-Assessment, Resource Allocation), route-param plumbing (`useParams`/`useSearchParams`) vs store plumbing (`useNewProjectId`/`useBaselinePeriodId`) is the main delta |
| `components/raido/{risk,issue,dependency,assumption,opportunity}-log.tsx` | `components/new-project/raido/{same 5 files}` | Reporting side supports edit+delete (`startEdit`/`cancelEdit`/`updateX`/`deleteX`); new-project side only supports add. Field defs, payload builders, `toValues()` helpers duplicated verbatim |
| `components/measurement/{cloud-maintenance,cloud-migration,development,shared,staffing,support,testing}-form.tsx` (7 files) | `components/new-project/measurement/{same 7 files}` | Same split |
| `components/contractual-compliance/{contractual-compliance-form,commitments-tab,milestones-tab}.tsx` | `components/new-project/contractual-compliance/{same 3}` | Same split |
| `components/de-assessment/{de-assessment-form,alert-register-tab,findings-register-tab}.tsx` | `components/new-project/de-assessment/{same 3}` | Same split, **and already drifted** — see Finding A.1 |
| `components/ai-hub/document-processing.tsx` (273 ln) | `components/new-project/ai-hub/document-processing.tsx` (247 ln) | Reporting side resolves `?period=` via `useReportingPeriods`/`currentPeriod`; new-project side has no period concept |

Total duplicated surface: ~25 files, roughly 4,000 lines, for what is fundamentally one set of forms operating in two lifecycle modes ("create" vs "maintain-approved"). Only **one** file in this whole area is genuinely shared: `HealthItemsTab` (`components/project-charter/health-items-tab.tsx`, imported directly by `components/new-project/health-declaration.tsx`) — proof that unifying these is achievable with the existing primitives, not a new pattern.

**Finding A.1 — the two trees have already drifted**, confirming they're being hand-maintained separately: `components/de-assessment/alert-register-tab.tsx` and `findings-register-tab.tsx` (Reporting side) wire in `AiRowSuggestionsPanel`/`useAiRowSuggestions` (`components/ai/ai-row-suggestions-panel.tsx`); `components/new-project/de-assessment/{alert-register-tab,findings-register-tab}.tsx` do not have this feature at all. A feature added to one copy did not propagate to its twin — exactly the drift risk this duplication creates going forward.

**Recommendation:** Parameterize each pair by a `mode: "create" | "maintain"` (or equivalent) prop, backed by the id-resolution each pair already abstracts differently (`useParams` route id vs `useNewProjectId()` store). The RAID logs are the best starting point — the API hooks and `EntryFields`/`RegisterTable` primitives are already unmodified between the two trees, so the merge is mostly deleting the second copy and adding a mode-conditional edit/delete affordance.

```text
Potential usage:
<RiskLog mode={editable ? "maintain" : "create"} />
```

### Finding B (P1): The Reporting hierarchy is unified for Account+Geo but not for Project

`components/regional-reporting/reporting-hub.tsx` takes `scope: "account"|"geo"` and its own comment says it "Mirrors project-reporting/reporting-hub.tsx" — i.e., the team already generalized the account/geo pair and left Project as a third, separately-maintained copy instead of extending the same `scope` union to `"project"`. The same shape repeats three more times:

- `components/project-status/status-items-tab.tsx` vs `components/regional-reporting/status-items-tab.tsx` — the latter's own comment: *"mirrors components/project-status/status-items-tab.tsx exactly, generalized by scope"*.
- `components/project-dashboard/project-dashboard-view.tsx` (63 ln) vs `components/regional-reporting/dashboard-view.tsx` (83 ln, scope-generalized for account/geo).
- `components/shell/project-nav.tsx` (202 ln) vs `components/shell/account-nav.tsx` (126 ln) / `geo-nav.tsx` (125 ln) — account-nav's own comment: *"Mirrors project-nav.tsx's shell exactly, generalized for Account Reporting."* All three already share `components/shell/nav-primitives.tsx`, so only the group-building function differs.
- `components/project-dashboard/submit-report-action.tsx` (90 ln) vs `components/regional-reporting/submit-report-action.tsx` (105 ln, scope-generalized).

This is a very consistent, well-evidenced pattern: **whatever gets built for Account+Geo gets correctly generalized to a two-way `scope` union; Project is then left as a separate, non-generalized copy nearby.** The Review tier (`status-review-page.tsx`) is the one place this was done correctly for all three tiers at once — it should be the template for fixing the Reporting tier and the nav components.

**Recommendation:** Extend each `scope: "account" | "geo"` union to `"project" | "account" | "geo"` (matching `ReviewScope` in `lib/api/status-review.ts`), and delete the project-only twin once the generalized component covers it. Do this file-pair by file-pair (`dashboard-view`, `submit-report-action`, `status-items-tab`, the nav components), not as one big-bang rewrite — each pair is small and independent.

### Finding C (P2): Repeated literal "empty state" markup

The exact class string `border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500` (or a near-identical variant) is copy-pasted in **37 files** (e.g. every RAID log, every measurement form, `de-assessment-form.tsx`×2, `health-declaration.tsx`×2, `status-items-tab.tsx`×2, `charter-form.tsx`×2) to render "nothing here yet" / "do X first" messages. No shared `EmptyState` component exists despite `RegisterTable` already having its own internal empty-row rendering (`emptyLabel` prop) — this literal-markup duplication is for the *screen-level* empty state that gates an entire tab before its register even mounts.

**Recommendation:** Extract a small `EmptyState({ children })` (or `icon`/`message`) component in `components/forms/` and swap in the 37 call sites opportunistically as those files are touched for Finding A/B work — not a standalone sweep.

### Finding D (P2): No confirmation before delete, anywhere

`RegisterTable`'s `onDelete` (`components/forms/register-table.tsx`) fires straight into the mutation with no intermediate confirmation — verified in `components/raido/risk-log.tsx`'s `handleDelete` (line 155) and structurally identical in every other RAID/measurement/compliance/de-assessment register. There is no `window.confirm`, no dialog, no undo anywhere in `src` (confirmed by grep — zero matches for `confirm(` or "Are you sure"). A misclick permanently deletes a register row (Risk, Milestone, Commitment, Finding, etc.) with only the global success/fail banner as feedback.

**Recommendation:** A shared `ConfirmationDialog` (the app already has a Radix `Dialog` primitive at `components/ui/dialog.tsx` to build it on) wired once into `RegisterTable`'s delete affordance, rather than per-register confirmation logic.

### What is already well-componentized (do not re-architect)

- `components/forms/entry-form.tsx` (`EntryFields`/`useEntryValues`, declarative `FieldDef[]`) and `components/forms/form-primitives.tsx` (`SectionCard`, `Field`, `Segmented`, `AutoBadge`, `MandatoryBadge`, `ButtonSpinner`) are genuinely shared, consistently used, well-documented primitives — every RAID/measurement/compliance/charter form is built on top of them.
- `components/forms/register-table.tsx` and `components/forms/status-badge.tsx` are shared list/status renderers used across all registers, with one central `TONE_MAP` for status coloring.
- `components/status-review/status-review-page.tsx` correctly unifies all three Review-tier routes.
- `components/shell/global-mutation-overlay.tsx` is a small, elegant, single-responsibility component (blocks the screen during any in-flight mutation via `useIsMutating()`) — a good pattern, not a duplication problem.

---

## 3. Page vs Component Responsibilities

Pages are consistently thin coordinators — nearly every `page.tsx` under `app/(app)/` is under 15 lines, delegating to one client component and only supplying `metadata`. This is followed uniformly; no exceptions found.

The responsibility problem is one level down: several **component files carry multiple, only loosely related responsibilities** rather than pages carrying too much:

- `components/project-charter/charter-form.tsx` (648 ln) and `components/new-project/charter-form.tsx` (785 ln) each export 4-5 independent tab components (`ProjectDescriptionTab`, `ProjectProfileForm`, `ScopeScheduleForm`, `SelfAssessmentForm`, `ResourceAllocationForm`) from one file. Each individual function is reasonably sized; the file as a whole is not. Splitting into one file per tab (they're already separately imported by different `page.tsx` routes — see `app/(app)/project-reporting/[projectId]/project-charter/page.tsx` vs `.../schedule/page.tsx` vs `.../self-assessment/page.tsx`) would let each route's bundle only pull what it needs and make the New-Project/Reporting merge (Finding A) easier to review file-by-file.
- `components/shell/app-sidebar.tsx` (459 ln) mixes: route-active-state derivation, per-role project/account/geo list filtering (business logic — "Review lists are scoped one level up the org hierarchy," duplicating logic that's also expressed in the backend's dashboard filters, per its own comment), and rendering. The filtering logic (`isApproved`, `reviewProjects`/`reviewAccounts`/`reviewGeos` scoping) is a reasonable candidate for a `useScopedEntities(role, ...)` hook, separating "what can this role see" from "how does the sidebar render it."

No component was found that needs splitting merely to reduce line count with no reuse/readability benefit — the two items above were flagged because they bundle unrelated concerns, not because they're long.

---

## 4. Forms

- **Consistent engine, consistent primitives** (§2) — this is the strongest part of the codebase. Every RAID/measurement/compliance/DE-assessment/charter form builds on the same `FieldDef[]` + `EntryFields`/`useEntryValues` engine, so field layout, spacing, and label/badge/hint/error rendering are already identical everywhere by construction, not by convention.
- **Required-field handling is inconsistent in *where* it's enforced, not in *how* it renders.** `Field`'s `error` prop renders uniformly, but which fields actually get validated before submit varies per form — e.g. `raido/risk-log.tsx`'s `submit()` only checks `values.risk_title?.trim()`, while `de-assessment/alert-register-tab.tsx`'s `addAlert()` checks `brief_description` and sets a local `descriptionError` state. Each form hand-rolls its own single-field "required" check rather than deriving it from `FieldDef.mandatory` (which already exists and drives the `MandatoryBadge` display) — the mandatory flag is declarative for *display* but not for *validation*, so a field marked "Mandatory" in the UI is not actually guaranteed to block submission consistently across forms.
- **Save/cancel handling** for edit-in-place (RAID logs in `components/raido/*`) is duplicated per log: each has its own local `editingId` state + `startEdit`/`cancelEdit` pair with identical shape (see `risk-log.tsx` lines 141-153, mirrored in `issue-log.tsx`/`dependency-log.tsx`/`assumption-log.tsx`/`opportunity-log.tsx`). This is a good candidate to fold into `useEntryValues` (or a sibling hook) as an `useEditableEntry()` that returns `{ values, set, reset, editingId, startEdit, cancelEdit }` — small effort, removes ~15 duplicated lines × 5 files.
- No form library (React Hook Form/Zod/etc.) is used or needed here — the declarative `FieldDef` engine is a reasonable, lighter-weight substitute for this app's shape, and introducing one is not warranted.

---

## 5. Grids and Lists

- `RegisterTable` (`components/forms/register-table.tsx`) is the single shared table primitive for every register across RAID, Contractual Compliance, and Resource Allocation, as its own comment states — genuinely reused, not reimplemented per screen.
- Two hand-rolled `<table>` markups exist **outside** `RegisterTable`, with the same structure duplicated between them: `components/project-reporting/reporting-hub.tsx` (lines 137-197, "Reporting History" table) and `components/regional-reporting/reporting-hub.tsx` (lines 65-120, near-identical "Reporting History" table — same columns, same `formatDate`, same `StatusBadge` usage). This duplication will be resolved automatically once Finding B (§2) unifies these two hub components under one `scope` prop.
- No pagination exists anywhere in the app (all registers use `?limit=200` per `lib/api/raid.ts` and render everything client-side) — reasonable for this data's expected volume (per-project RAID counts), not flagged as an issue.
- Filtering/sorting is minimal (period selectors via `?period=` query param, handled consistently through `useSearchParams`) — no duplicated filter logic found beyond the empty-state pattern already covered in §2 Finding C.
- Confirmation-before-delete gap already covered in §2 Finding D — it belongs to this section too (every register table lacks it).

---

## 6. API Integration

**The shared client is used consistently — no bypass found.** `grep` for raw `fetch(` in `src` returns exactly the three call sites inside `lib/api/client.ts` itself; every other network call goes through `api.get/post/put/patch/delete/postForm/getBlob`. This is a genuinely clean layer.

- `frontend/src/lib/api/client.ts` centralizes: base URL (relative `/api/v1`, proxied by `next.config.ts`'s `rewrites()` so the OneLogin session cookie works same-origin), the `X-API-Key` header, `credentials: "include"`, JSON/text content-negotiation, and a single `handleUnauthorized()` (401 → clear Zustand session + redirect to `/login`) shared by all three fetch wrappers (`request`, `postForm`, `getBlob`).
- Every domain gets its own `lib/api/<domain>.ts` file exporting typed TanStack Query hooks (`useProjects`, `useRisks`, `useDashboardSummary`, etc.) — no component calls `api.get` directly; components only call these hooks. This service-abstraction boundary is respected everywhere checked (raido, measurement, dashboard, status-review, regional-reporting).
- `lib/api/raid.ts`'s generic `useRaidList/useRaidCreate/useRaidUpdate/useRaidDelete` factory functions (§1) are a strong example of avoiding duplicated fetch/mutation boilerplate across the five RAID entities.
- No hard-coded absolute URLs found in components; the one absolute-URL-shaped value (`window.location.href = "/api/v1/auth/onelogin/login"` in `login-form.tsx`) is a full-page-redirect OAuth kickoff, which correctly cannot go through the JSON `api` client, so this is not a violation.
- **Drifted contract assumption:** `components/dashboard/reporting-hub.tsx`'s (project-reporting) `MILESTONES_STAT` is explicitly a hard-coded sample tile with a code comment "No Milestones backend yet — this tile stays sample data until one exists," sitting next to three real API-backed health tiles in the same grid. This is a real UI element permanently showing fake data (`12/15`, "On Track") next to real ones — worth surfacing to product, not just noting as tech debt, since a user could reasonably mistake it for live data.

---

## 7. State Management

**The TanStack Query / Zustand boundary is respected well overall.**

- **Zustand store boundaries are sensible and separated by concern**: `stores/session.ts` (auth identity, persisted), `stores/page-banner.ts` (global success/error/warning banner, with its own timer-cleanup logic), `stores/new-project-ui.ts` (one boolean, `isEditing`, deliberately kept in a store instead of local state because it must survive cross-tab navigation within the New Project wizard). No monolithic "app state" store; no evidence of unrelated state crammed into one store.
- **TanStack Query key consistency**: query keys are consistently array-tuples scoped by domain + id (`["raid", prefix, projectId]`, `["auth-me"]`, etc.) with `invalidateQueries` on every mutation's `onSuccess` — no key collisions found across the files reviewed. Global `staleTime: 30_000` + `retry: 1` is set once in `lib/api/query-provider.tsx` and not fought against elsewhere (a couple of hooks override `staleTime: Infinity` for genuinely static data like `useAuthConfig` — an appropriate, deliberate override, not an inconsistency).
- **One dashboard is not on TanStack Query at all**: `components/dashboard/dashboard.tsx` (the `/dashboard` landing page for Project Manager/Team Member/Delivery Excellence/PMO — 4 of the 8 roles) manages its own `useState`+`useEffect` fetch loop against `components/dashboard/data.ts`'s `fetchProjects()`, which is hard-coded sample data, not a real endpoint (the file's own header comment: *"Sample portfolio data until there's a backend... mimics an async API call so the grid can swap to a real endpoint without UI changes"*). This is intentionally temporary scaffolding, not a state-management bug, but it does mean 4 of 8 roles' home screen is currently disconnected from TanStack Query and shows fixed data (see §15).
- **Legitimate "sync state from a query on key change" pattern, done without `useEffect`**, appears independently in two places doing the same thing slightly differently: `components/ai/use-ai-review.ts` (`syncKey`/`syncedFor` guard, lines 47-52) and `components/measurement/shared.tsx`'s `useMeasurementForm` (`key`/`syncedFor` guard, lines 117-121). Both correctly use the "update state during render, guarded by a ref/id comparison" React pattern instead of a `useEffect`+`setState`, which is the *right* call here — but the guard logic itself (a few lines) is duplicated rather than factored into one small `useSyncedOnChange`-style helper. Low priority; noting for awareness, not urgent.
- One real `useEffect`+`setState`-in-effect flag from `eslint`: `components/shell/auth-guard.tsx` line 20 (`setHydrated(useSession.persist.hasHydrated())` called synchronously inside `useEffect`) — `react-hooks/set-state-in-effect` fires here. Functionally correct (it's the documented Zustand-persist SSR-hydration workaround) but the lint rule is right that this causes an extra render; a lazy `useState(() => ...)` initializer for the synchronous part, keeping only the `onFinishHydration` subscription in the effect, would remove the double render.

Redux or another state library is correctly not needed and not recommended here.

---

## 8. Next.js Architecture

- App Router used correctly and consistently; no Pages Router remnants.
- **131 of ~180 `.tsx` files are `"use client"`.** This is a deliberate consequence of the app's design choice (TanStack Query owns all data fetching client-side; nothing uses React Server Components for data), not an accident — every page correctly stays a server component for `metadata` and delegates immediately to a client component (e.g. `regional-reporting/hub-page.tsx`'s own comment: *"Thin client wrapper so the route's page.tsz can stay a server component... while still reading the dynamic route param"*). This is architecturally consistent, just worth naming explicitly: this app gets none of the RSC data-fetching/streaming benefits Next.js App Router offers, by design. Not a bug — flagging so it's a conscious, revisitable decision rather than an implicit one.
- `useSearchParams()`'s Suspense-boundary requirement is handled correctly and consistently everywhere it's used (`status-review-page.tsx`, `account-nav.tsx`, `ai-hub/document-processing.tsx` all wrap the param-reading part in `<Suspense fallback={null}>`, splitting an `...Inner`/`NavLinks` component out for it) — a repeated pattern, but a *correct* repeated pattern, not one worth abstracting further.
- No dedicated `loading.tsx`/`error.tsx` route-level files exist anywhere in the App Router tree — loading/error states are handled ad hoc per component via TanStack Query's `isLoading`/`isError` (see §12) rather than Next.js's route-level conventions. Given how thin every route is, adopting `loading.tsx` would add limited value app-wide, but the total absence of any route-level `error.tsx` means an unhandled render error in any screen falls through to Next's default error UI with no app-specific recovery affordance (no "back to dashboard" link, no report action). A single root-level `app/(app)/error.tsx` would be a small, high-value addition.
- No `next/image` usage found; the one `<img>` (executive content builder's image block, `components/executive-content-builder/blocks/image-block.tsx`) is explicitly and correctly opted out via an eslint-disable comment because its source is a `blob:`/authenticated-fetch URL, not an optimizable remote image — appropriate, not an issue.
- `next.config.ts` is minimal and purpose-built (one `rewrites()` entry proxying `/api/v1/*` for same-origin cookie auth) — no concerns.

---

## 9. TypeScript

- **No `any` usage found anywhere in `src`** (checked via multiple regex passes covering `: any`, `as any`, `<any>`, `Record<string, any>`). This is a genuinely strict, clean codebase on this axis.
- **`ProjectStatus` is correct and matches the required values** — `lib/api/projects.ts`: `"Draft" | "Pending Approval" | "Approved" | "Hold" | "Closed" | "Open Only for Billing"`, with a comment tying it explicitly to `backend/app/schemas/enums.py`. A full-codebase grep for `"Start Up"`/`"Execution"`/`StartUp` returned **zero matches** — the stale naming the review brief warned about is **not present**; this was checked and can be marked clean rather than assumed.
- **`RoleCode` is defined once** (`lib/api/auth.ts`) and imported everywhere it's used (`stores/session.ts`, `lib/menu-config.ts`, `components/shell/app-sidebar.tsx`, etc.) — no duplicated role-string unions found.
- **Repeated type-assertion workaround**: `as unknown as Record<string, string>` appears 6 times across the two RAID trees (`components/raido/{dependency,risk,assumption,issue,opportunity}-log.tsx` and once more in the new-project tree) to coerce an API-typed row into the generic form-values shape `EntryFields` expects. `risk-log.tsx` already extracts this into a local `toValues()` helper — that pattern isn't consistently applied to the other four logs. Minor; will naturally collapse to one implementation once Finding A (§2) merges the RAID trees.
- **Domain types are declared once and reused** (`Project`, `RiskLog`, `HealthRating`, etc. all live in their `lib/api/*.ts` file and are imported by components, not redeclared) — no duplicated interface definitions found in the components reviewed.
- No unnecessary type assertions found beyond the `as unknown as` case above.

---

## 10. Styling and UI Consistency

- Tailwind usage is disciplined: a single brand blue (`#1a6fc4` / `#1a4a7a` / `#15406b` family) and a single status-tone map (`components/forms/status-badge.tsx`'s `TONE_MAP`) are reused consistently for buttons, active nav states, and status pills — no evidence of ad hoc competing color choices for the same semantic meaning.
- The empty-state class-string duplication (§2 Finding C, 37 files) is the main concrete styling duplication found — it is a copy-pasted literal, not a design-token problem (the *design* is consistent; the *implementation* of that design is repeated by hand).
- `components/ui/*` (Button, Dialog, DropdownMenu, Input, Label, Checkbox, Popover, NativeSelect, Textarea) is the shadcn/radix layer and is used consistently by every form reviewed — no evidence of screens bypassing it with raw `<button>`/`<input>` markup for interactive controls (the few raw `<button>` elements found, e.g. `app-sidebar.tsx`'s `CollapsibleGroup` toggle and `document-processing.tsx`'s icon buttons, are deliberate lightweight cases with explicit `aria-label`s, not shadcn bypasses of a form control).
- No hard-coded colors found outside the deliberate brand palette and the `TONE_MAP` (which is itself the single source of truth for tone colors, correctly not re-declared per screen).

---

## 11. Performance

No unaddressed genuine performance problem was found. Specifically:

- No expensive computation found inside a render body beyond simple `.filter()`/`.find()` over already-small, already-cached arrays (project/account/geo lists, RAID items) — these are all bounded by realistic per-project/per-org counts, not a rendering hotspot.
- `GlobalMutationOverlay`'s use of `useIsMutating()` (rather than `useIsFetching()`) is a specifically-reasoned choice in its own comment to avoid false-positive "Saving…" flashes from routine background refetches — a performance/UX decision made correctly, not a smell.
- No sequential `await`-chained API calls found where a parallel `Promise.all` (or parallel independent `useQuery` hooks, which TanStack Query already parallelizes automatically) would help — every screen reviewed fires its several `useX()` hooks independently at the top of the component, which TanStack Query batches.
- No unnecessary re-render risk found worth memoizing — component trees are shallow (page → one or two feature components → primitives), and no prop-drilled callback was seen causing a measurable re-render cascade in a large list.
- The one real inefficiency: `components/dashboard/dashboard.tsx`'s `useEffect`-based fetch (§7) uses a manual `cancelled` flag instead of `AbortController`/TanStack Query — low-impact since it's operating on local sample data (§15), but would need fixing if/when that screen is wired to a real endpoint.

---

## 12. Error and Loading Handling

- Loading/error handling is present nearly everywhere data is fetched (45 files reference `isLoading`/`isPending`/`isError`), but the **presentation of each state is hand-rolled per screen** rather than routed through a shared component — e.g. some screens render `null` while pending (relying on the global `GlobalMutationOverlay` only for mutations, not queries), others render the dashed-border empty-state markup from §2 Finding C for a "no data yet" case that's really an initial-load state. There is no shared `<LoadingState>`/`<ErrorBanner>` for query-level (as opposed to mutation-level) states — mutation errors are handled centrally and well via `usePageBanner`'s `showError`, but query errors (a failed `useProjects()`, say) generally just leave the UI showing empty/default data rather than surfacing a distinct "couldn't load" message. This is a real, if not urgent, consistency gap — worth a shared `<QueryState query={...}>` wrapper (render-prop or slot-based) the next time more than one or two screens are touched together.
- Success/warning/error banners are centralized well through `usePageBanner` (`stores/page-banner.ts`) — auto-dismissing success, persistent error/warning, with a `persistThroughNavigation` escape hatch for post-redirect success messages. This is a clean, single mechanism used consistently by every mutation's `onSuccess`/`onError` reviewed.
- Permission errors: because there is no client-side role gate on protected pages (§13), there is also no "you don't have permission to view this" UI anywhere — a role that can navigate to a page it shouldn't see will get whatever the underlying query returns (likely empty data, since the backend doesn't scope by role either — §13), not an explicit permission-denied state.

---

## 13. Authentication & Session Handling — flagged issues

**Authentication mechanics are solid.** Session is a signed (`HS256`, `SESSION_SECRET`) JWT in an httpOnly, `SameSite=Lax` cookie (`backend/app/core/session.py`, `backend/app/api/v1/endpoints/auth.py::_set_session_cookie`), attached automatically via `credentials: "include"` on every `frontend/src/lib/api/client.ts` request. `backend/app/main.py` mounts `get_current_user` as a router-wide dependency on everything except `/auth/*`, so every API call is authenticated server-side — this is real, not just a login-screen swap (the repo's own `Authentication.md` plan doc frames it exactly this way). A 401 anywhere triggers `client.ts`'s `handleUnauthorized()`, which clears the Zustand session and hard-redirects to `/login` — correct behavior for an expired/invalid session, and it isn't gated behind any particular screen (it lives in the shared `request`/`postForm`/`getBlob` wrappers, so it's automatic everywhere).

The `/login/callback` flow (`frontend/src/app/login/callback/page.tsx`) is small and correct: it calls `useMe()`, and on success populates the Zustand store and routes via `ROLE_LANDING_ROUTE`; on a 403 from `/auth/me` (OneLogin-authenticated but no provisioned app account) it shows a specific, correctly-worded message rather than a generic failure — good attention to the "strict pre-provisioned, no JIT" policy documented in `Authentication.md`.

**P0 — No server-side authorization (role/scope enforcement) exists anywhere in the backend.** `get_current_user` proves *who* is calling, but nothing checks *what that role/scope is allowed to do*. Verified directly: `backend/app/api/v1/endpoints/users.py` (user CRUD, and `PUT /users/{id}/accounts` / `PUT /users/{id}/geos` — the endpoints that grant a user visibility into an account/geo) has no role check at all; a grep across all of `backend/app` for role/permission checks (`role.code`, `RoleCode`, `require_role`, etc.) returns matches only in `auth.py` (reading the role to *display* it in `/auth/me`) and in the Pydantic schema files — never in a route guard. Any authenticated user of any role (including `TEAM_MEMBER`) can currently call the admin user-management endpoints, create/edit any project regardless of `account_ids`/`geo_ids`, etc., purely by knowing the URL — the backend has no dependency equivalent to "require role ∈ {ADMIN}" or "require this project's account_id ∈ current_user.account_ids". `Authentication.md`'s own plan explicitly scoped this rework to identity (`get_current_user`) only, not authorization — this is a known, still-open gap, not a regression from this review's perspective, but it should be treated as the top-priority follow-up now that identity is solid.

**P1 — Frontend route protection is UI-hiding only, not enforcement, and there is no page-level role guard at all.** `frontend/src/components/shell/auth-guard.tsx` (used once, in `app/(app)/layout.tsx`) only checks "is *any* user signed in" — it has no concept of role. Role-based visibility is implemented **exclusively** by `menu-config.ts`'s `ROLE_MENUS` hiding sidebar links (`app-sidebar.tsx`'s `has()`). Verified directly: `app/(app)/admin/users/page.tsx` and `app/(app)/dashboard/admin/page.tsx` (and every other role-scoped route/layout checked) contain no role check whatsoever — a `TEAM_MEMBER` who navigates straight to `/admin/users` or `/dashboard/admin` will have `AdminUsersPage`/`AdminDashboardPage` render fully; the underlying data queries will succeed because the backend doesn't check role either (see the P0 above). This is exactly the "permission checks that only hide UI without the backend also enforcing them" pattern this review was asked to flag as P0/P1 — and here it's compounded, since the backend doesn't enforce it either. Once backend authorization (the P0 above) exists, a lightweight page/layout-level role guard (e.g. a `<RequireRole roles={[...]}>` wrapping each role-scoped layout, reading `useSession`) would still be worth adding, purely for UX (avoid a flash of admin UI before a 403 bounces the user), but it must not be treated as a substitute for the backend fix.

**No other security smells found**: no tokens or session data logged to `console` (checked — the only 3 `console.error` calls in the whole app are paste-failure diagnostics in `table-block.tsx`/`image-block.tsx`/`register-import-toolbar.tsx`, none touching auth data); the session cookie is httpOnly (can't be read by JS, so XSS can't exfiltrate it directly); `SESSION_COOKIE_NAME`/`X-API-Key` are not interpolated into any client-visible log or URL.

---

## 14. Accessibility

Practical scan, not a full audit:

- **No clickable `<div>`s found** (grep for `<div ... onClick=` returns zero matches) — all interactive elements use real `<button>`/`<a>`/form controls.
- Icon-only buttons consistently carry `aria-label` (`app-header.tsx`'s notification/sign-out buttons, `login-form.tsx`'s show/hide password toggle, `app-sidebar.tsx`'s menu toggle, `register-table.tsx`'s edit/delete icon buttons) — good, consistent coverage.
- Modals: `components/ui/dialog.tsx` is a Radix `Dialog` primitive, which provides correct focus trapping/`aria-*`/`Escape`-to-close out of the box — no custom modal implementation was found bypassing it.
- Form labels: every field goes through `Field`/`Label` (`form-primitives.tsx`), which wires `htmlFor`/`id` correctly by construction (`EntryFields` passes `def.key` as both) — consistent, correct pattern by design, not per-field diligence.
- The one `<img>` in the app (`executive-content-builder/blocks/image-block.tsx`) has an `alt` (falls back to `"Uploaded image"` when no caption is set) — fine.
- **Governance Matrix cells are color-only** (`components/dashboard/governance-matrix.tsx`'s `RagCell`): each health cell is a solid-color `<div>` with only a `title` tooltip (no visible text, no `aria-label`) conveying Red/Amber/Green/Potential-Red. `title` attributes are unreliable for screen readers and invisible on touch devices, so this is a real (if minor, P3) gap for a dashboard whose entire point is communicating health status — a colorblind or screen-reader user gets nothing from these cells. A visually-hidden `<span className="sr-only">{level.label}</span>` alongside the existing `title` would close this cheaply without changing the visual design.

---

## 15. Dead and Unnecessary Code

Grounded in an actual `eslint` run against `src` (not just inspection), which returned only 3 findings total — confirming this codebase is largely clean:

1. `components/de-assessment/de-assessment-form.tsx`: `AiFieldBadge` imported but never used (line 13); `setAssessmentDate` assigned but never read (line 56). Small, safe cleanup.
2. `components/shell/auth-guard.tsx` line 20: `react-hooks/set-state-in-effect` — see §7 for the fix.

Beyond lint-detectable issues:

- **`components/dashboard/dashboard.tsx` + `components/dashboard/data.ts` are sample/demo data still live in production routing** — this is the `/dashboard` landing page for `PROJECT_MANAGER`, `TEAM_MEMBER`, `DELIVERY_EXCELLENCE`, and `PMO` (4 of 8 roles, per `ROLE_LANDING_ROUTE` in `menu-config.ts`). `data.ts`'s own header comment confirms it: *"Sample portfolio data until there's a backend."* The KPI cards, "Critical Milestones," and "Executive Escalations" panels all render fixed, fake project names/numbers to real users on their home screen. This is presumably intentional/known scaffolding rather than an oversight (the sibling `DashboardView` used for Admin/CXO/Account Manager/Geo Head is fully real-API-backed and its own comment explicitly contrasts itself with "the sample-data 'My Summary' page"), but it should be tracked as a concrete backlog item, not left implicit — see backlog IT-09.
- No commented-out code blocks, no `TODO`/`FIXME`/`XXX` markers, and no console `log`/`warn`/`debug` calls found anywhere in `src` (only the 3 `console.error`s noted in §13, which are legitimate paste-failure diagnostics).
- `git status` shows no deleted/renamed files with dangling references — the working tree's modified/untracked files (`Authentication.md`, `frontend-review.md`, `backend/app/core/session.py`, `frontend/src/app/login/callback/`, and the modified auth/client files) are all part of the in-flight, still-referenced auth rework, not orphaned leftovers.
- No unused dependencies were identified in `frontend/package.json` by inspection — every listed dependency (`@tiptap/*` for the executive content builder's rich text, `xlsx` for `lib/excel-io.ts`'s Excel import/export, `sonner`, `radix-ui`, etc.) has active call sites.

---

## 16. Architecture Assessment

### Current architecture

```text
app/(app)/**/page.tsx  (thin server components — metadata only)
        ↓
app/(app)/**/layout.tsx  (route-group shell: <main>, ProjectNav/AccountNav/GeoNav)
        ↓
feature client component  (e.g. StatusReviewPage, ReportingHub, RiskLog)
        ↓                              ↘
shared UI primitives                    lib/api/*.ts (TanStack Query hooks)
(forms/*, ui/*, status-badge,                  ↓
 register-table, shell/*)               lib/api/client.ts (single fetch layer)
        ↓                                      ↓
Zustand stores                          FastAPI backend (session-cookie auth,
(session, page-banner, new-project-ui)   no role authorization yet — §13)
```

Two systemic deviations from this otherwise-clean shape, both already documented above:

1. **Two parallel component trees** (`components/new-project/*` vs `components/{raido,measurement,contractual-compliance,de-assessment,project-charter,ai-hub}/*`) sit side-by-side at the "feature client component" layer instead of one parameterized tree (§2 Finding A).
2. **The Reporting tier has two generalization levels** at the same layer — Account+Geo already collapsed into one `scope`-parameterized component, Project left as a separate implementation (§2 Finding B) — while the Review tier one layer over (`status-review-page.tsx`) already did this correctly for all three.

### Recommended target structure

```text
app/(app)/**/page.tsx
        ↓
app/(app)/**/layout.tsx
        ↓
feature client component, parameterized by
  scope: "project" | "account" | "geo"        (folds in Finding B)
  mode:  "create" | "maintain"                 (folds in Finding A, RAID/measurement/
                                                 compliance/DE-assessment/charter/ai-hub)
        ↓                              ↘
shared UI primitives                    lib/api/*.ts   (unchanged — already correct)
(+ new: EmptyState, ConfirmationDialog)        ↓
        ↓                               lib/api/client.ts  (unchanged — already correct)
Zustand stores (unchanged — already correct)   ↓
                                          FastAPI backend + role/scope authorization
                                          dependency (new — §13 P0)
```

This is **incremental, not a rewrite**: the API layer, the form primitives, the Zustand stores, and the Review-tier pattern are already built the right way and don't move. The work is (a) collapsing the two duplicated presentation trees pairwise behind `mode`/`scope` props, using `status-review-page.tsx` and `regional-reporting/*` as the existing templates, and (b) adding the missing backend authorization layer. No evidence supports a framework, state-library, or routing-architecture change.

---

## 17. Prioritized Improvement Backlog

| ID | Priority | Area | Issue | Files Affected | Recommendation | Effort | Risk |
|----|----------|------|-------|-----------------|-----------------|--------|------|
| IT-01 | P0 | Security/Backend | No role/scope authorization anywhere server-side — any authenticated user of any role can call any endpoint, including admin user management | `backend/app/api/v1/endpoints/users.py` and effectively every other endpoint file; `backend/app/api/deps.py` | Add a `require_role(...)`/scope-check FastAPI dependency and apply it per router/route, starting with `/users*` (admin) and project/account/geo mutation endpoints (scope to `account_ids`/`geo_ids`) | Large | Medium (backend-only change, but touches every router) |
| IT-02 | P1 | Frontend Security/UX | No page-level role guard — any signed-in user can navigate directly to any role-scoped route/page and it fully renders (menu hiding is the only gate) | `frontend/src/app/(app)/**/layout.tsx` (all role-scoped route groups), `frontend/src/lib/menu-config.ts` | Add a `<RequireRole roles={[...]}>` wrapper (reads `useSession`) per role-scoped layout; do this *after* IT-01 so it's UX polish, not the only gate | Medium | Low |
| IT-03 | P1 | Componentization | `new-project/*` component tree duplicates its `project-reporting`-adjacent twin file-for-file across RAID, measurement, contractual-compliance, DE-assessment, charter, AI-hub (~25 files); already drifted (AI row-suggestions only on one side) | `components/new-project/**/*` vs `components/{raido,measurement,contractual-compliance,de-assessment,project-charter,ai-hub}/**/*` | Merge each pair behind a `mode: "create" \| "maintain"` prop, starting with the 5 RAID logs (API/primitives already shared) | Large | Medium |
| IT-04 | P1 | Componentization | Reporting-tier components generalize Account+Geo via a `scope` prop but leave Project as a separate copy, unlike the Review tier which already unifies all three | `components/project-reporting/reporting-hub.tsx` vs `components/regional-reporting/reporting-hub.tsx`; `components/project-status/status-items-tab.tsx` vs `components/regional-reporting/status-items-tab.tsx`; `components/project-dashboard/*` vs `components/regional-reporting/dashboard-view.tsx`/`submit-report-action.tsx`; `components/shell/project-nav.tsx` vs `account-nav.tsx`/`geo-nav.tsx` | Extend each `scope` union to include `"project"`, using `components/status-review/status-review-page.tsx` as the template; delete the project-only twin per pair | Medium | Low–Medium |
| IT-05 | P2 | UX/Data integrity | No confirmation before delete on any register row (Risk, Issue, Milestone, Finding, etc.) | `components/forms/register-table.tsx` (delete affordance used by every RAID/measurement/compliance/DE-assessment register) | Add a shared `ConfirmationDialog` (build on existing `components/ui/dialog.tsx`) wired once into `RegisterTable`'s `onDelete` | Small | Low |
| IT-06 | P2 | Componentization/Styling | Screen-level "empty state" markup (dashed border card) copy-pasted identically in 37 files | See §2 Finding C file list | Extract `EmptyState` component in `components/forms/`; swap in opportunistically while touching each file for IT-03/IT-04 | Small | Low |
| IT-07 | P2 | Forms | `FieldDef.mandatory` drives the visual "Mandatory" badge but each form hand-rolls its own separate required-field check before submit, inconsistently (only some forms validate, differently) | Every RAID log, `de-assessment/alert-register-tab.tsx`, others using `EntryFields` | Derive submit-blocking validation from `FieldDef.mandatory` centrally (e.g. in `useEntryValues` or a new `validateEntry(defs, values)` helper) instead of ad hoc per-form checks | Medium | Low |
| IT-08 | P2 | State/Forms | Edit-in-place state (`editingId`/`startEdit`/`cancelEdit`) duplicated identically across all 5 RAID logs (and their new-project twins) | `components/raido/*-log.tsx` (×5), `components/new-project/raido/*-log.tsx` (×5) | Fold into a small `useEditableEntry()` hook alongside `useEntryValues`; naturally resolves further once IT-03 lands | Small | Low |
| IT-09 | P2 | Dead code/Product | `/dashboard` (home screen for 4 of 8 roles: PM, Team Member, Delivery Excellence, PMO) renders entirely hard-coded sample data, not real API data | `components/dashboard/dashboard.tsx`, `components/dashboard/data.ts` | Either wire to a real `/dashboard/summary`-style endpoint (mirroring `DashboardView`'s pattern) or explicitly flag/track as known placeholder with product sign-off | Large (if wiring real data) | Low |
| IT-10 | P3 | Error/Loading UX | Query-level loading/error states are handled ad hoc per screen; no shared loading/error UI for queries (mutations already have a good shared pattern via `usePageBanner`) | Broad — 45 files reference `isLoading`/`isError` independently | Introduce a small shared `<QueryState query={...}>` wrapper for the most-visited screens next time they're touched | Medium | Low |
| IT-11 | P3 | Accessibility | Governance Matrix health cells convey Red/Amber/Green/Potential-Red via color + `title` tooltip only, no visible/screen-reader text | `components/dashboard/governance-matrix.tsx` | Add a visually-hidden `sr-only` label alongside the existing `title` | Small | Low |
| IT-12 | P3 | Cleanup | Two lint-flagged issues: unused import/variable; synchronous `setState` in effect | `components/de-assessment/de-assessment-form.tsx`; `components/shell/auth-guard.tsx` | Remove unused `AiFieldBadge` import/`setAssessmentDate`; move `hasHydrated()` check to a lazy `useState` initializer | Small | Low |
| IT-13 | P3 | Next.js | No route-level `error.tsx` anywhere in the App Router tree — an unhandled render error falls through to the framework default with no app-specific recovery UI | `frontend/src/app/(app)/` (missing `error.tsx`) | Add one root-level `app/(app)/error.tsx` with a "back to dashboard" affordance | Small | Low |

---

## 18. Componentization Summary

| Proposed Component | Current Duplication | Files Using Pattern | Benefit | Priority |
|---|---|---|---|---|
| `EmptyState` | Identical dashed-border "nothing here yet" markup copy-pasted literally | 37 files (§2 Finding C) | Removes largest single literal-markup duplication in the app; one place to change the empty-state design | P2 |
| `ConfirmationDialog` | No confirmation exists anywhere before a destructive delete | `register-table.tsx`'s delete affordance, used by every RAID/measurement/compliance/DE-assessment register | Closes a real data-loss risk with one shared component built on the existing `Dialog` primitive | P2 |
| `useEditableEntry()` | `editingId`/`startEdit`/`cancelEdit` state trio duplicated identically per RAID log | `components/raido/*-log.tsx` ×5 (+ ×5 in `new-project/raido`) | Removes ~15 duplicated lines ×10 files; natural companion to existing `useEntryValues` | P2 |
| `mode`-parameterized RAID/measurement/compliance/DE-assessment/charter/AI-hub components | Whole trees duplicated between "create" and "maintain" lifecycle | ~25 files across `components/new-project/*` and its Reporting-side twins | The single biggest maintainability win in the codebase; also fixes the already-observed feature drift (AI row suggestions) | P1 |
| `scope`-parameterized Project/Account/Geo reporting-tier components | Account+Geo already unified via `scope`; Project left as a separate copy of the same component | `reporting-hub.tsx`, `status-items-tab.tsx`, `dashboard-view.tsx`/`submit-report-action.tsx` pairs, `project-nav.tsx`/`account-nav.tsx`/`geo-nav.tsx` | Extends a pattern the team already validated works (`status-review-page.tsx`) to the one tier where it's still missing | P1 |
| `RequireRole` | No role check exists at the page/layout level; role gating is menu-hiding only | Every role-scoped route group under `app/(app)/**` | UX-level defense in depth once backend authorization (IT-01) exists | P1 (blocked on IT-01) |

Not recommended: a universal `DataTable`/generic CRUD-grid abstraction — `RegisterTable` is already appropriately scoped (columns + optional edit/delete) and used consistently; building a more "universal" grid on top would add indirection without solving any duplication that isn't already solved.

---

## 19. Final Recommendation

**1. Overall frontend assessment.** This is a well-structured, disciplined codebase for its size — strict TypeScript (no `any` anywhere), a genuinely clean and consistently-used API/service layer, sensible Zustand store boundaries, a solid shared form-primitive system, and clean `eslint` output (3 findings total across the whole `src` tree). The architectural problems found are concentrated and structural rather than diffuse: the app was built by duplicating whole component trees for closely related lifecycle states/org-hierarchy tiers instead of parameterizing one tree, and that duplication has already begun to drift (a feature added to one copy, not its twin). The most serious issue found is not in the frontend at all — it's the complete absence of server-side role/scope authorization, which makes the frontend's role-based menu hiding cosmetic rather than a security boundary.

**2. Top architectural concerns.**
- No backend authorization layer (§13, IT-01) — everything else is secondary to this.
- The New-Project/Reporting duplicate-tree pattern (§2 Finding A, IT-03) — largest maintainability liability, and already causing feature drift.
- The Project-tier-left-out-of-generalization pattern repeating across four independent component pairs (§2 Finding B, IT-04).

**3. Top componentization opportunities.** `EmptyState` and `ConfirmationDialog` (small, immediate, zero-risk); `useEditableEntry()` (small); the two structural mode/scope-parameterization efforts (IT-03/IT-04) — larger, but each individual file pair within them is independently small and reviewable.

**4. Top 10 improvements, in the order they should be implemented.**
1. IT-01 — backend role/scope authorization (unblocks IT-02, and is the actual security fix)
2. IT-05 — delete confirmation dialog (small, immediate data-loss risk fix)
3. IT-12 — the two lint-flagged cleanups (trivial, do anytime)
4. IT-06 — `EmptyState` extraction (small, no dependencies)
5. IT-08 — `useEditableEntry()` hook (small, sets up IT-03)
6. IT-03 — merge RAID logs behind `mode` (start of the big duplication fix, highest-value single slice)
7. IT-03 (cont.) — merge measurement/compliance/DE-assessment/charter/ai-hub pairs, same pattern
8. IT-04 — fold Project into the Account/Geo `scope` generalization, pair by pair
9. IT-02 — add `RequireRole` page guards (now meaningful, since IT-01 landed)
10. IT-07 — centralize mandatory-field validation

**5. Can be implemented independently (any order, no dependencies):** IT-01, IT-05, IT-06, IT-08, IT-09, IT-10, IT-11, IT-12, IT-13.

**6. Have a dependency:** IT-02 depends on IT-01 (a frontend-only role guard without backend enforcement is the exact "cosmetic gate" problem being fixed, so it should follow, not precede, IT-01). IT-03's later file pairs benefit from IT-08 landing first (so the merged components inherit the extracted edit-state hook rather than needing a second pass). IT-07 is easiest once IT-03 has reduced the number of independent copies of each form to fix.

**7. Areas that should NOT be refactored.** The `lib/api/*.ts` service/hook layer (already the right shape — typed, consistent, no bypasses). The Zustand store split (`session`/`page-banner`/`new-project-ui` — already correctly scoped, no monolith risk). `components/forms/entry-form.tsx` + `form-primitives.tsx` (the declarative field engine — genuinely reused, not worth replacing with a form library). `components/status-review/status-review-page.tsx` (the one place the three-tier scope pattern was done right — use it as the template, don't touch it). `components/shell/global-mutation-overlay.tsx` (small, correct, single-purpose).

**8. Are the RAID modules and the Reporting/Review tier pattern internally consistent, or already drifted?**
- **RAID modules**: Internally consistent *within* each of the two trees (all 5 logs in `components/raido/*` follow the same shape; all 5 in `components/new-project/raido/*` follow the same shape) — but the **two trees have already drifted from each other**: AI row-suggestions (`AiRowSuggestionsPanel`) is wired into the Reporting-side `de-assessment` tabs and not their `new-project` twins, confirming this isn't hypothetical future risk, it has already happened once.
- **Reporting/Review tier pattern**: The **Review** tier (Project/Account/Geo) is fully consistent — one component, one behavior, for all three. The **Reporting** tier is only two-thirds consistent — Account and Geo are unified with each other via `scope`, but Project is a separate, non-generalized implementation sitting alongside each unified pair (reporting hub, status items, dashboard view, submit-report action, and the nav components all show this exact same split). This is a very legible, repeatable pattern rather than random drift, which makes it a tractable, low-risk fix (§2 Finding B, IT-04) — the target shape already exists in the code three times over; it just needs to be extended to cover Project too.
