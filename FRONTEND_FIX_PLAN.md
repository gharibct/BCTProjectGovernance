# Frontend Remediation Plan

Derived from `FRONTEND_CODE_REVIEW.md`. Each section below is a standalone, self-contained prompt — run them one at a time (in the order given; later items assume earlier ones in the same section group are done). All files are checked into git, so any file superseded by a merge/refactor can be deleted outright rather than deprecated in place.

Order follows the review's own recommended sequence (§19.4), with the remaining P2/P3 backlog items appended at the end.
1. IT-01 — Backend role/scope authorization (P0, do first — everything else is secondary)
2. IT-05 — Delete confirmation dialog
3. IT-12 — Lint cleanups (trivial)
4. IT-06 — EmptyState extraction
5. IT-08 — useEditableEntry() hook
6. IT-03a — Merge RAID log trees (proves the merge pattern)
7. IT-03b — Merge measurement/compliance/DE-assessment/charter/AI-hub trees (includes the AI-suggestions drift fix)
8. IT-04 — Fold Project into the Account/Geo scope generalization
9. IT-02 — RequireRole page guards (explicitly gated on #1 landing first)
10. IT-07 — Centralize mandatory-field validation
11. IT-09 — Wire /dashboard to real data (or report back if no endpoint exists yet)
12. IT-10 — Shared QueryState loading/error wrapper
13. IT-11 — Accessibility fix for Governance Matrix color-only cells
14. IT-13 — Add root error.tsx
---

## Issue 1: No server-side role/scope authorization anywhere in the backend (IT-01, P0)

`get_current_user` (`backend/app/api/deps.py`) proves identity but nothing checks role or org-scope. Any authenticated user of any role — including `TEAM_MEMBER` — can call admin endpoints (e.g. `PUT /users/{id}/accounts`, `PUT /users/{id}/geos` in `backend/app/api/v1/endpoints/users.py`) or mutate any project/account/geo regardless of their `account_ids`/`geo_ids`, purely by knowing the URL. The frontend's role-based menu is cosmetic, not a security boundary, until this is fixed.

**Prompt:**
> In this FastAPI backend (`backend/app/`), `get_current_user` (in `app/api/deps.py`) authenticates the caller but no route enforces what their role is allowed to do. Add proper authorization:
>
> 1. Add a `require_role(*allowed_roles: RoleCode)` FastAPI dependency in `app/api/deps.py` that raises `403` if `current_user.role.code` is not in `allowed_roles`. Use the existing `RoleCode`/role enum already defined in the schemas.
> 2. Apply it to admin-only endpoints first: everything in `app/api/v1/endpoints/users.py` (user CRUD, `PUT /users/{id}/accounts`, `PUT /users/{id}/geos`) should require `ADMIN`.
> 3. Add a second dependency (or extend the same one) for org-scope checks: for project/account/geo mutation endpoints, verify the acting user's `account_ids`/`geo_ids` actually cover the target project's account/geo before allowing the write — mirror whatever scoping logic already exists for reads/dashboard filtering (check `app/api/v1/endpoints/` for where account/geo scoping is already applied to queries, and reuse that logic rather than re-deriving it).
> 4. Go through every router file under `app/api/v1/endpoints/` and apply the appropriate role/scope dependency — don't leave any mutation endpoint unguarded.
> 5. Do not change response shapes or existing authenticated-but-unauthorized-role behavior beyond adding the 403. Do not touch the frontend in this pass.
> 6. After changes, run the backend's existing test suite (if any) and manually verify: an admin-only endpoint called with a non-admin session token returns 403; a normal read-only endpoint used by non-admin roles still works unchanged.

---

## Issue 2: No delete confirmation anywhere in the app (IT-05, P2)

`RegisterTable`'s `onDelete` (`frontend/src/components/forms/register-table.tsx`) fires the delete mutation immediately on click, with zero confirmation, for every register in the app (Risk, Issue, Dependency, Assumption, Opportunity, Milestone, Commitment, Finding, Alert, etc.). A misclick permanently deletes data.

**Prompt:**
> In this Next.js/React app (`frontend/src/`), add a delete confirmation step before any register row is deleted. The shared table component is `frontend/src/components/forms/register-table.tsx`, whose `onDelete` prop is currently wired directly to each mutation's delete call by every register that uses it (e.g. `frontend/src/components/raido/risk-log.tsx`'s `handleDelete`).
>
> 1. Build a small reusable `ConfirmationDialog` component in `frontend/src/components/forms/` (or `frontend/src/components/ui/` if that's the more consistent location for primitives — check existing conventions), built on the existing Radix `Dialog` primitive at `frontend/src/components/ui/dialog.tsx`. It should accept a message/title and confirm/cancel callbacks.
> 2. Wire it once into `RegisterTable`'s delete affordance (not per-register) so every consumer gets the confirmation automatically without each register needing its own dialog logic.
> 3. Do not change `RegisterTable`'s public prop contract in a way that breaks existing callers — the `onDelete` callback should still fire the same way once confirmed, so no consumer needs to change.
> 4. Verify manually in the browser: deleting a Risk (or any register row) now shows a confirmation dialog, Cancel leaves the row intact, Confirm deletes it as before.

---

## Issue 3: Two lint-flagged cleanups (IT-12, P3)

`eslint` run against `src` flags: an unused import/variable in `de-assessment-form.tsx`, and a `react-hooks/set-state-in-effect` warning in `auth-guard.tsx`.

**Prompt:**
> Fix two small lint findings in `frontend/src/`:
>
> 1. `frontend/src/components/de-assessment/de-assessment-form.tsx`: remove the unused `AiFieldBadge` import (line ~13) and the unused `setAssessmentDate` assignment (line ~56) — confirm via `eslint` that they're genuinely dead before removing, since line numbers may have shifted since the review.
> 2. `frontend/src/components/shell/auth-guard.tsx` (around line 20): `setHydrated(useSession.persist.hasHydrated())` is called synchronously inside a `useEffect`, triggering `react-hooks/set-state-in-effect` and causing an extra render. Replace the synchronous check with a lazy `useState(() => useSession.persist.hasHydrated())` initializer, keeping only the `onFinishHydration` subscription itself inside the `useEffect`.
>
> Run `eslint` on `frontend/src` afterward and confirm both findings are gone with no new ones introduced. Verify the app still boots and auth-gating still works (a logged-out user is still redirected to `/login`).

---

## Issue 4: Copy-pasted empty-state markup in 37 files (IT-06, P2)

The literal class string for a dashed-border "nothing here yet" empty state is copy-pasted across ~37 files (every RAID log, every measurement form, `de-assessment-form.tsx`, `health-declaration.tsx`, `status-items-tab.tsx`, `charter-form.tsx`, etc.) instead of being a shared component.

**Prompt:**
> In `frontend/src/components/forms/`, add a small shared `EmptyState` component (e.g. `empty-state.tsx`) that renders the dashed-border "nothing here yet" pattern currently copy-pasted across the codebase — find the exact class string by grepping `frontend/src/components` for `border-dashed border-slate-300 bg-slate-50` to get the canonical markup, and support a `children` (or `message`) prop for the varying text.
>
> Replace the literal markup with `<EmptyState>` in the following files (grep for the same class string to find any not listed here, since the exact file list may have shifted): every RAID log under `frontend/src/components/raido/` and `frontend/src/components/new-project/raido/`, every form under `frontend/src/components/measurement/` and `frontend/src/components/new-project/measurement/`, `frontend/src/components/de-assessment/de-assessment-form.tsx`, `frontend/src/components/new-project/de-assessment/de-assessment-form.tsx`, `frontend/src/components/project-charter/health-items-tab.tsx`-adjacent `health-declaration.tsx` call sites, `frontend/src/components/project-status/status-items-tab.tsx`, `frontend/src/components/regional-reporting/status-items-tab.tsx`, `frontend/src/components/project-charter/charter-form.tsx`, `frontend/src/components/new-project/charter-form.tsx`.
>
> Do not change the visual appearance — this is a pure extraction, not a redesign. Verify a couple of the affected screens still render their empty state identically before/after.

---

## Issue 5: Duplicated edit-in-place state across all RAID logs (IT-08, P2)

Each of the 5 RAID logs (`components/raido/{risk,issue,dependency,assumption,opportunity}-log.tsx`) hand-rolls an identical `editingId`/`startEdit`/`cancelEdit` state trio.

**Prompt:**
> In `frontend/src/components/raido/`, the five log components (`risk-log.tsx`, `issue-log.tsx`, `dependency-log.tsx`, `assumption-log.tsx`, `opportunity-log.tsx`) each duplicate the same edit-in-place state pattern: local `editingId` state plus `startEdit`/`cancelEdit` functions with identical shape (see `risk-log.tsx` around lines 141-153 for the reference implementation).
>
> Extract this into a small shared hook, e.g. `useEditableEntry()`, placed alongside the existing `useEntryValues` hook in `frontend/src/components/forms/entry-form.tsx` (or a new sibling file in `frontend/src/components/forms/` if that keeps the file more focused — match whatever's more consistent with the existing organization). It should return `{ editingId, startEdit, cancelEdit }` (and whatever else the five call sites need — check all five before finalizing the shape so it doesn't need per-caller special-casing).
>
> Replace the duplicated logic in all five `components/raido/*-log.tsx` files with calls to the new hook. Do not change any behavior — this is a pure extraction. Verify manually: editing and canceling an edit still works identically for at least Risk and one other log type.
>
> Do not touch `components/new-project/raido/*` in this pass (those don't currently support edit, per the review) — that tree is addressed separately in Issue 6.

---

## Issue 6: `new-project` component tree duplicates the RAID logs file-for-file (IT-03, part 1 of 2 — P1)

`components/new-project/raido/{risk,issue,dependency,assumption,opportunity}-log.tsx` are near-duplicates of `components/raido/{same 5 files}`, differing mainly in add-only (new-project side) vs add+edit+delete (reporting side), and in how the project id is resolved (`useNewProjectId()`/`useBaselinePeriodId()` store hooks vs `useParams()`/`useSearchParams()`). These have already drifted once (see Issue 7 for the DE-assessment case) and the RAID pair is the cleanest place to prove out the merge pattern before tackling the larger trees.

**Prompt:**
> In `frontend/src/components/`, two directories each contain the same 5 RAID log components (Risk/Issue/Dependency/Assumption/Opportunity): `components/raido/*-log.tsx` (used by Project Reporting, supports add/edit/delete) and `components/new-project/raido/*-log.tsx` (used by the New Project wizard, add-only). The underlying API hooks (`frontend/src/lib/api/raid.ts`'s `useRaidList/useRaidCreate/useRaidUpdate/useRaidDelete` factories) and presentation primitives (`components/forms/entry-form.tsx`, `form-primitives.tsx`, `register-table.tsx`, `status-badge.tsx`) are already fully shared between the two trees — only the per-entity screen component itself is duplicated.
>
> Merge each pair into one component parameterized by a `mode: "create" | "maintain"` prop (or equivalent), where `"create"` gives the New Project wizard's add-only behavior and id resolution via `useNewProjectId()`/`useBaselinePeriodId()`, and `"maintain"` gives the Reporting side's full add/edit/delete behavior and id resolution via `useParams()`/`useSearchParams()`. Use the `Issue 5` (`useEditableEntry()`) hook if it's already been added — the merged `"maintain"` mode should use it rather than reintroducing duplicated edit state.
>
> Do this for all 5 RAID entities: Risk, Issue, Dependency, Assumption, Opportunity. Delete the `components/new-project/raido/*` copies once each is folded into its `components/raido/*` twin, and update every import site (`grep` for `new-project/raido` across `frontend/src` to find all call sites in the New Project route tree) to import the merged component with `mode="create"`.
>
> Verify manually: the New Project wizard's RAID tabs still work identically (add-only, correct id/period scoping) and Project Reporting's RAID tabs still work identically (add/edit/delete all functioning) after the merge.

---

## Issue 7: `new-project` tree duplicates measurement/compliance/DE-assessment/charter/AI-hub, and has already drifted (IT-03, part 2 of 2 — P1)

Same duplication pattern as Issue 6, but for the remaining ~20 files: `components/measurement/*` (7 files) vs `components/new-project/measurement/*`, `components/contractual-compliance/*` (3 files) vs `components/new-project/contractual-compliance/*`, `components/de-assessment/*` (3 files) vs `components/new-project/de-assessment/*`, `components/project-charter/charter-form.tsx` vs `components/new-project/charter-form.tsx`, and `components/ai-hub/document-processing.tsx` vs `components/new-project/ai-hub/document-processing.tsx`. The DE-assessment pair has **already drifted**: `AiRowSuggestionsPanel`/`useAiRowSuggestions` (`components/ai/ai-row-suggestions-panel.tsx`) was added to `components/de-assessment/{alert-register-tab,findings-register-tab}.tsx` but never ported to the `new-project` twins.

**Prompt:**
> Following the same merge pattern used for the RAID logs (a `mode: "create" | "maintain"` prop, `"create"` = New Project wizard add-only behavior with `useNewProjectId()`/`useBaselinePeriodId()` id resolution, `"maintain"` = Project Reporting's full behavior with `useParams()`/`useSearchParams()` id resolution), merge the remaining duplicated component trees in `frontend/src/components/`:
>
> 1. **Measurement forms** (7 files): `components/measurement/{cloud-maintenance,cloud-migration,development,shared,staffing,support,testing}-form.tsx` vs `components/new-project/measurement/{same 7}`.
> 2. **Contractual compliance** (3 files): `components/contractual-compliance/{contractual-compliance-form,commitments-tab,milestones-tab}.tsx` vs `components/new-project/contractual-compliance/{same 3}`.
> 3. **DE Assessment** (3 files): `components/de-assessment/{de-assessment-form,alert-register-tab,findings-register-tab}.tsx` vs `components/new-project/de-assessment/{same 3}`. **Important:** the Reporting-side `alert-register-tab.tsx`/`findings-register-tab.tsx` already have `AiRowSuggestionsPanel`/`useAiRowSuggestions` wired in and the `new-project` side does not — when merging, keep that feature and make sure it's present (and correctly gated, if it should only apply in one mode — check with the AI panel's own logic for whether it depends on data that only exists once a project is approved) in the merged component rather than silently dropping it.
> 4. **Charter form**: `components/project-charter/charter-form.tsx` vs `components/new-project/charter-form.tsx`.
> 5. **AI Hub document processing**: `components/ai-hub/document-processing.tsx` vs `components/new-project/ai-hub/document-processing.tsx` — the Reporting side resolves a `?period=` query param via `useReportingPeriods`/`currentPeriod` that the New Project side doesn't have a concept of; preserve that as mode-conditional behavior rather than forcing period-awareness onto the create flow.
>
> Delete each `components/new-project/*` file once its pair is merged, and update all import sites accordingly (grep `new-project/measurement`, `new-project/contractual-compliance`, `new-project/de-assessment`, `new-project/charter-form`, `new-project/ai-hub` across `frontend/src` to find every call site).
>
> Do this one pair/module at a time (e.g. all 7 measurement forms as one batch, then compliance, then DE-assessment, then charter, then ai-hub) rather than one giant change, so each step is independently reviewable. Verify manually after each module: the New Project wizard's corresponding tab still works (create-only), and Project Reporting's corresponding tab still works (full edit), including confirming the AI row-suggestions feature now shows up in both DE-assessment contexts (or confirm intentionally why it shouldn't in create mode, if that turns out to be the right call).

---

## Issue 8: Reporting tier unified for Account+Geo but not for Project (IT-04, P1)

`components/regional-reporting/*` already generalizes Account+Geo behind a `scope: "account" | "geo"` prop (its own code comments say so explicitly), but Project keeps a separate, non-generalized implementation nearby instead of extending the same union. This repeats across four independent component pairs. The Review tier (`components/status-review/status-review-page.tsx`) already does this correctly for all three tiers and should be the template.

**Prompt:**
> In `frontend/src/components/`, four component pairs already generalize Account+Geo reporting behind a `scope: "account" | "geo"` prop but leave Project as a separate, non-generalized copy:
>
> 1. `components/project-reporting/reporting-hub.tsx` vs `components/regional-reporting/reporting-hub.tsx`
> 2. `components/project-status/status-items-tab.tsx` vs `components/regional-reporting/status-items-tab.tsx`
> 3. `components/project-dashboard/project-dashboard-view.tsx` vs `components/regional-reporting/dashboard-view.tsx`, and `components/project-dashboard/submit-report-action.tsx` vs `components/regional-reporting/submit-report-action.tsx`
> 4. `components/shell/project-nav.tsx` vs `components/shell/account-nav.tsx`/`geo-nav.tsx`
>
> For each pair, extend the `scope` union type to `"project" | "account" | "geo"` (matching the `ReviewScope` type already defined in `frontend/src/lib/api/status-review.ts` — reuse that type rather than defining a new one, or align the two if reuse isn't directly possible) and fold the Project-only implementation's logic into the generalized component. Use `components/status-review/status-review-page.tsx` as the reference template, since it already correctly unifies all three tiers.
>
> Delete each project-only twin once its logic is folded in, and update every import site under `app/(app)/project-reporting/**` and `app/(app)/project-dashboard*` (grep for the deleted file names to find all call sites) to use the generalized component with `scope="project"`.
>
> Do this one pair at a time (reporting-hub, then status-items-tab, then dashboard-view/submit-report-action, then the nav components) — each is small and independently reviewable/testable. Verify manually after each: Project Reporting's corresponding screen still renders and behaves identically to before, and Account/Geo Reporting are unaffected.

---

## Issue 9: No page-level role guard — menu-hiding is the only access control on the frontend (IT-02, P1 — do after Issue 1)

`frontend/src/components/shell/auth-guard.tsx` only checks "is *any* user signed in," with no role concept. Role-based visibility is implemented **only** via `menu-config.ts` hiding sidebar links. A user who navigates directly to a URL outside their role (e.g. `/admin/users`) gets the full page rendered client-side, with no permission-denied state — the only real protection is the backend, and only once Issue 1 lands.

**Prompt:**
> This should only be done after backend role/scope authorization (see Issue 1) is in place, since a frontend-only guard without backend enforcement is not a real security boundary — it's UX polish on top of the real fix.
>
> In `frontend/src/`, add a lightweight page/layout-level role guard. `frontend/src/components/shell/auth-guard.tsx` currently only checks that a user is signed in (used once, in `app/(app)/layout.tsx`), with no role awareness. Role-based visibility today is implemented only via `frontend/src/lib/menu-config.ts`'s `ROLE_MENUS` hiding sidebar links in `app-sidebar.tsx`.
>
> 1. Add a `<RequireRole roles={[...]}>` component (or extend `auth-guard.tsx` to accept an optional `roles` prop) that reads the current user's role from `useSession` (the Zustand session store) and redirects (or shows a "not authorized" state) if the role isn't in the allowed list.
> 2. Wrap each role-scoped route group's `layout.tsx` under `app/(app)/**` with the appropriate allowed roles, matching what `ROLE_MENUS`/`ROLE_LANDING_ROUTE` in `menu-config.ts` already implies for that route (e.g. `app/(app)/admin/**` → `ADMIN` only).
> 3. This is purely a UX improvement to avoid a flash of unauthorized content before the backend's 403 (from Issue 1) would otherwise reject the underlying data calls — it must not be treated as a replacement for backend enforcement.
>
> Verify manually: a non-admin user navigating directly to `/admin/users` no longer sees the admin UI render (redirect or denied-state instead), while every role can still reach the routes `ROLE_LANDING_ROUTE`/`ROLE_MENUS` say they should.

---

## Issue 10: `FieldDef.mandatory` drives the UI badge but not actual submit validation (IT-07, P2 — easiest after Issue 6/7)

`Field`'s `error` prop renders uniformly, but each form hand-rolls its own single-field "required" check before submit rather than deriving it from `FieldDef.mandatory` (which already drives the `MandatoryBadge` display). Different forms validate different fields, inconsistently — e.g. `raido/risk-log.tsx`'s `submit()` only checks `risk_title`, while `de-assessment/alert-register-tab.tsx` checks `brief_description` via separate local state.

**Prompt:**
> In `frontend/src/components/forms/`, `FieldDef` (used by `entry-form.tsx`'s `EntryFields`/`useEntryValues`) already has a `mandatory` flag that drives the visual `MandatoryBadge`, but it isn't used to actually block submission — each form (e.g. `components/raido/risk-log.tsx`'s `submit()`, `components/de-assessment/alert-register-tab.tsx`'s `addAlert()`) hand-rolls its own single-field required check, inconsistently.
>
> Add a shared validation helper (e.g. `validateEntry(defs: FieldDef[], values: ...)` in `entry-form.tsx`, or as part of `useEntryValues`) that checks every field where `mandatory` is true has a non-empty value, and returns which fields are missing (so per-field error state can still be shown via the existing `Field` `error` prop).
>
> Replace the ad hoc per-form required-field checks with calls to this shared helper, across every form built on `EntryFields`/`useEntryValues` (RAID logs, measurement forms, contractual compliance, DE assessment, charter forms — grep for `.mandatory` and for local required-field checks like `?.trim()` guards in submit handlers to find all call sites).
>
> Do this incrementally, form-by-form, verifying after each that: a field marked mandatory now actually blocks submission with a visible error if left empty, and previously-working submissions (all mandatory fields filled) are unaffected.

---

## Issue 11: `/dashboard` (home for 4 of 8 roles) renders hard-coded sample data (IT-09, P2)

`components/dashboard/dashboard.tsx` + `components/dashboard/data.ts` is the landing page for `PROJECT_MANAGER`, `TEAM_MEMBER`, `DELIVERY_EXCELLENCE`, and `PMO`. It renders fixed, fake project names/numbers via a manual `useState`+`useEffect` fetch loop against sample data (`data.ts`'s own comment: "Sample portfolio data until there's a backend"), unlike the real API-backed `DashboardView` used by Admin/CXO/Account Manager/Geo Head.

**Prompt:**
> `frontend/src/components/dashboard/dashboard.tsx` (the `/dashboard` landing page for `PROJECT_MANAGER`, `TEAM_MEMBER`, `DELIVERY_EXCELLENCE`, and `PMO` roles) currently renders hard-coded sample data from `frontend/src/components/dashboard/data.ts`'s `fetchProjects()`, which simulates an async call but returns fixed fake data — real users on these 4 roles currently see fake project names/KPIs on their home screen.
>
> First check whether a real backend endpoint for this role-scoped "my projects" summary now exists (check `backend/app/api/v1/endpoints/` for anything dashboard/summary-related that isn't already consumed, and check `frontend/src/lib/api/` for an existing typed hook that isn't yet wired into this component). If one exists:
>
> 1. Add/use a typed TanStack Query hook in `frontend/src/lib/api/` for this endpoint, following the pattern used by `DashboardView`'s real data hooks.
> 2. Replace `dashboard.tsx`'s manual `useState`+`useEffect`+`data.ts` sample-data flow with the real hook.
> 3. Delete `components/dashboard/data.ts` once nothing references it.
>
> If no such backend endpoint exists yet, do not fabricate one — instead, stop and report back what the closest existing endpoint/data shape is, so a decision can be made about what the real summary should contain before backend work is scoped.
>
> Verify manually: the `/dashboard` page for at least one of the four affected roles shows real project data (or, if blocked on a missing endpoint, confirm the current sample-data behavior is unchanged and clearly report the blocker).

---

## Issue 12: No shared loading/error UI for query-level states (IT-10, P3)

Query-level (as opposed to mutation-level) loading/error states are handled ad hoc per screen — some render `null` while pending, others reuse the empty-state markup for what's really an initial-load state, and a failed query generally just leaves the UI showing empty/default data with no distinct "couldn't load" message. Mutation errors already have a clean shared mechanism via `usePageBanner`; queries don't have an equivalent.

**Prompt:**
> In `frontend/src/`, mutation errors are already handled well and centrally via `usePageBanner` (`frontend/src/stores/page-banner.ts`), but query-level loading/error states (`isLoading`/`isPending`/`isError` from TanStack Query hooks) are handled ad hoc per screen with no shared component.
>
> Add a small shared `<QueryState query={...}>` wrapper (render-prop or slot-based — pick whichever fits this codebase's existing conventions better, check how `EntryFields`/other primitives here expose slots) in `frontend/src/components/forms/` (or `frontend/src/components/shell/`, wherever the existing similar primitives live) that renders a consistent loading indicator while pending, a consistent "couldn't load, try again" message on error, and the children/content once the query has data.
>
> Do not do a sweeping app-wide replacement in one pass — adopt it on the 2-3 most-visited screens first (e.g. the main dashboard views, `status-review-page.tsx`) as a proof of the pattern, and leave the rest for opportunistic replacement as those files are touched for other reasons. Verify manually: a slow/failing network request on an adopted screen now shows a clear loading/error state instead of blank or default-looking content.

---

## Issue 13: Governance Matrix health cells convey status via color only (IT-11, P3)

`components/dashboard/governance-matrix.tsx`'s `RagCell` renders each health cell as a solid-color `<div>` with only a `title` tooltip (no visible text, no `aria-label`) conveying Red/Amber/Green/Potential-Red — inaccessible to screen-reader and colorblind users, and to touch devices where `title` doesn't show at all.

**Prompt:**
> In `frontend/src/components/dashboard/governance-matrix.tsx`, the `RagCell` component renders each health status cell as a solid-color `<div>` conveying Red/Amber/Green/Potential-Red via color plus a `title` attribute only. Add a visually-hidden label alongside the existing `title` so the status is available to screen readers and touch devices: `<span className="sr-only">{level.label}</span>` (or whatever the status label variable is actually called in that file) inside the cell, without changing its visual appearance.
>
> Verify manually: the matrix looks visually identical, and inspecting the DOM (or a screen reader) shows the status text is now present for each cell.

---

## Issue 14: No route-level `error.tsx` in the App Router tree (IT-13, P3)

No `frontend/src/app/(app)/error.tsx` (or any route-level `error.tsx`) exists anywhere — an unhandled render error in any authenticated screen currently falls through to Next.js's default error UI with no app-specific recovery affordance.

**Prompt:**
> Add a single root-level error boundary for the authenticated app shell: `frontend/src/app/(app)/error.tsx`, following Next.js App Router's `error.tsx` convention (a client component receiving `error`/`reset` props). Keep it simple: a message, a "try again" action calling `reset()`, and a "back to dashboard" link/button. Match the existing visual style used elsewhere in the shell (check `components/shell/` for existing layout/typography conventions to reuse rather than inventing new styling).
>
> Verify manually by temporarily throwing an error in a test component under the `(app)` route group, confirming the new error boundary catches it with the expected UI, then removing the temporary throw.

---

## Not recommended (from the review — do not implement)

- A universal `DataTable`/generic CRUD-grid abstraction on top of `RegisterTable` — it's already appropriately scoped and consistently used; a more "universal" grid would add indirection without solving any remaining duplication.
- Adopting Redux or another state-management library — TanStack Query + Zustand is the correct, settled choice here.
- Refactoring `lib/api/*.ts`, the Zustand store split, `components/forms/entry-form.tsx`/`form-primitives.tsx`, `components/status-review/status-review-page.tsx`, or `components/shell/global-mutation-overlay.tsx` — these are already the right shape and should be used as templates for the fixes above, not changed themselves.
