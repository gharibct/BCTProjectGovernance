# Frontend Architecture & Code Quality Review

Review the complete **frontend codebase** of this BCT Project Governance application (a PMO/delivery-governance tool with role-based reporting across Project → Account → Geo levels).

The frontend is built using **Next.js (App Router) / React / TypeScript / Tailwind CSS v4 / shadcn/ui (radix base) / TanStack Query / Zustand**. The backend is **FastAPI** (Python) — do not review it except where noted below.

This is a **review-only exercise**.

**Do not modify, refactor, delete, move, rename, or generate any application files.**

The objective is to understand the current frontend architecture and identify improvement opportunities. We will implement the improvements separately, one by one, after reviewing your findings.

Do not review backend code except where necessary to understand how the frontend calls an API.

## 1. First Understand the Application

Before making recommendations:

* inspect the complete frontend folder structure;
* identify Next.js routing structure;
* identify layouts and page hierarchy;
* identify shared components;
* identify feature-specific components;
* identify hooks;
* identify API/service code;
* identify state management;
* identify TypeScript models/interfaces;
* identify styling approach;
* identify third-party UI libraries (shadcn/ui usage in particular — is it used consistently or bypassed with ad hoc markup?);
* identify authentication/authorization handling, including the current session/login flow (`backend/app/core/session.py`, `frontend/src/app/login/callback/`, `frontend/src/lib/api/auth.ts` — this area is under active rework, so review the *current* code rather than assuming an older flow);
* identify role-based navigation/menu config (`frontend/src/lib/menu-config.ts`) and how it drives what each role (Admin, CXO, Geo Head, Account Head/`ACCOUNT_MANAGER`, Project Manager, Team Member, Delivery Excellence, PMO) sees;
* identify the mirrored "Reporting" vs "Review" surface pattern (Project Reporting/Review, Account Reporting/Review, Geo Reporting/Review — `frontend/src/components/status-review/` and siblings) and whether the three tiers stay consistent with each other;
* identify the five RAID log modules (Risk/Issue/Dependency/Assumption/Opportunity) and how much of their near-identical shape is actually shared vs re-implemented per module.

Do not make recommendations until you have inspected enough of the codebase to understand the existing patterns.

## 2. Componentization — Highest Priority

Perform a detailed review of React componentization.

Look specifically for:

* large page components containing too much UI and business logic;
* repeated JSX across multiple screens;
* repeated headers, cards, grids, forms, dialogs, banners and buttons;
* repeated field rendering logic;
* repeated loading/error/empty states;
* repeated confirmation dialogs;
* repeated status badges;
* repeated screen layouts;
* components that should be reusable but are implemented separately;
* components with too many responsibilities;
* excessive prop drilling;
* duplicated utility functions inside components.

Pay specific attention to two known duplication-prone areas:

1. **The 5 RAID log modules** (Risk, Issue, Dependency, Assumption, Opportunity) — each has ~15-25 fields and a very similar shape. Assess how much is genuinely shared today vs copy-pasted per module, and whether a shared RAID entry component/hook is warranted (or already exists and is just underused).
2. **The Reporting/Review tier pattern** — Project Reporting has a mirrored read-only "Review" surface one level up (Account Review), which repeats one level up again (Geo Review → CXO), with an Approve/Reject sign-off action. This was explicitly built to be copied for a potential 4th tier, so check whether the three existing tiers have actually stayed consistent with each other or have already drifted.

For every significant issue, identify the exact file(s).

Recommend what reusable component could be created.

Example:

```text
Problem:
The same screen header structure is implemented in 8 pages.

Files:
...

Recommendation:
Create a reusable PageHeader component.

Potential usage:
<PageHeader
    title="Project Profile"
    description="..."
    actions={...}
/>
```

Do not create the component yet.

## 3. Page vs Component Responsibilities

Check whether Next.js pages are primarily coordinating the screen or whether they contain excessive implementation logic.

Identify opportunities to separate:

```text
Page
  ↓
Feature Component
  ↓
Reusable UI Components
```

Also identify business logic that should potentially move into:

```text
custom hooks
services
utilities
```

Do not split components merely to make files smaller. Recommend extraction only when it improves reuse, readability, testability or separation of responsibilities.

## 4. Forms

Review all forms and identify:

* duplicated form patterns;
* repeated validation;
* repeated field layouts;
* inconsistent validation behavior;
* unnecessary local state;
* repeated save/cancel handling;
* inconsistent required-field handling;
* opportunities for reusable form controls.

Pay particular attention to similar Project Governance screens.

## 5. Grids and Lists

Review grids, tables and lists.

Look for repeated:

* table structures;
* action columns;
* add/edit/delete logic;
* pagination;
* filtering;
* sorting;
* status rendering;
* empty states;
* confirmation handling.

Identify where common components or hooks would reduce duplication.

Do not recommend creating one universal grid that becomes overly complicated.

## 6. API Integration

Review how frontend code calls backend APIs.

Identify:

* API calls directly inside page components;
* duplicated fetch/axios logic;
* duplicated error handling;
* duplicated loading handling;
* inconsistent API patterns;
* hard-coded URLs;
* missing service abstraction;
* opportunities for reusable hooks;
* consistency of the shared API client (`frontend/src/lib/api/client.ts`) — is it used everywhere, or do some screens bypass it with raw `fetch`?

Recommend a consistent frontend API architecture if the existing implementation is fragmented.

Do not review or change backend implementation, except to note (without inspecting deeply) where the frontend's assumptions about an endpoint's shape appear to have drifted from what it actually returns.

## 7. State Management

The app has already standardized on **TanStack Query for server state** and **Zustand for client state** — review whether that boundary is actually being respected, not whether to adopt them.

Review:

* useState usage that duplicates what TanStack Query already caches (e.g. manually mirroring fetched data into local state);
* useEffect usage, especially effects used to sync/fetch data instead of a TanStack Query hook;
* context usage;
* Zustand store organization — one store vs many, and whether store boundaries make sense (e.g. auth/session state vs UI state vs per-feature state);
* TanStack Query usage — query key consistency/collisions, missing `staleTime`/cache invalidation after mutations, duplicated query-fetching logic across screens that should be a shared hook;
* server state;
* duplicated state;
* derived state being unnecessarily stored;
* unnecessary effects;
* state shared between unrelated components.

Identify state-management complexity that can be simplified.

Do not recommend Redux or another state-management library — TanStack Query + Zustand is the settled choice for this app.

## 8. Next.js Architecture

Check whether the application is following appropriate Next.js practices.

Review:

* App Router / Pages Router usage;
* layouts;
* route organization;
* client vs server components;
* unnecessary `"use client"`;
* data fetching;
* loading states;
* error boundaries;
* route parameters;
* navigation;
* shared layouts.

Identify concrete improvement opportunities.

## 9. TypeScript

Review TypeScript usage.

Identify:

* `any`;
* duplicated interfaces;
* weak typing;
* unnecessary type assertions;
* inconsistent API response types;
* duplicated enums/constants;
* types declared inside components that should be shared;
* stale or inconsistent status/enum values — in particular, project status should only ever be `Draft` / `Pending Approval` / `Approved`; flag any lingering references to older status naming (e.g. "Start Up"/"Execution") as a bug, not just a style issue;
* role codes/enums duplicated instead of imported from one source (`ADMIN`, `CXO`, `ACCOUNT_MANAGER`, `GEO_HEAD`, `PROJECT_MANAGER`, `TEAM_MEMBER`, `DELIVERY_EXCELLENCE`, `PMO`).

Recommend where common domain types should be established.

## 10. Styling and UI Consistency

Review:

* duplicated Tailwind classes;
* inconsistent spacing;
* inconsistent typography;
* duplicated style definitions;
* hard-coded colors;
* inconsistent buttons;
* inconsistent form controls;
* inconsistent cards/dialogs;
* opportunities for shared design primitives.

Do not propose a complete UI redesign.

## 11. Performance

Look for genuine performance problems such as:

* unnecessary re-renders;
* expensive calculations during render;
* very large client components;
* repeated API requests;
* incorrect useEffect dependencies;
* unnecessary sequential API calls;
* large dependencies;
* inappropriate image handling;
* loading unnecessary data.

Do not recommend memoization everywhere. Only identify cases where it provides meaningful value.

## 12. Error and Loading Handling

Review whether screens consistently handle:

* loading;
* API failure;
* empty data;
* validation errors;
* permission errors;
* unexpected errors.

Identify duplicated patterns that could become reusable components.

## 13. Authentication & Session Handling

Authentication is under active rework in this codebase (session handling, a login callback route, and related API client/header changes). Review:

* how the session/token is stored and attached to API requests (`frontend/src/lib/api/client.ts`, `frontend/src/lib/api/auth.ts`);
* the `/login/callback` flow — error handling, redirect logic, and what happens on an invalid/expired session;
* whether role/permission checks are duplicated across components instead of centralized;
* whether client-side route protection is consistent across role-scoped pages, or whether some pages rely solely on the backend to reject unauthorized requests.

Flag anything that looks like a security gap (e.g. sensitive data fetched before an auth check resolves, tokens logged to console, permission checks that only hide UI without the backend also enforcing them) as P0/P1, not just a style note.

## 14. Accessibility

Perform a practical review for obvious problems:

* buttons without labels;
* clickable divs;
* missing form labels;
* keyboard accessibility;
* modal accessibility;
* image alt text;
* focus handling.

Prioritize significant issues rather than producing a large theoretical accessibility checklist.

## 15. Dead and Unnecessary Code

Identify:

* unused components;
* unused imports;
* duplicate utilities;
* obsolete code;
* commented-out implementations;
* temporary development code;
* console logging;
* unused dependencies;
* broken imports pointing at deleted/renamed files (check `git status` for files marked deleted that may still be referenced elsewhere — this has happened before in this codebase after a component was replaced but old call sites weren't updated).

Do not delete anything.

## 16. Architecture Assessment

After reviewing the code, show the current frontend architecture in a simple form.

For example:

```text
app/
  pages/routes
       ↓
  page components
       ↓
  shared components
       ↓
  hooks/services
       ↓
  API
```

Then show the recommended target structure.

Do not recommend a major rewrite unless there is strong evidence that one is necessary.

Prefer incremental refactoring.

## 17. Produce a Prioritized Improvement Backlog

This is the most important output.

Create a table:

| ID | Priority | Area | Issue | Files Affected | Recommendation | Effort | Risk |
| -- | -------- | ---- | ----- | -------------- | -------------- | ------ | ---- |

Use priorities:

* P0 — serious correctness/security problem
* P1 — high-value architectural improvement
* P2 — maintainability/consistency improvement
* P3 — optional improvement

Use effort:

* Small
* Medium
* Large

Use risk:

* Low
* Medium
* High

Group related duplicate occurrences into **one improvement item**, rather than producing dozens of nearly identical recommendations.

## 17. Componentization Summary

Provide a separate table specifically for potential reusable components:

| Proposed Component | Current Duplication | Files Using Pattern | Benefit | Priority |
| ------------------ | ------------------- | ------------------- | ------- | -------- |

Examples could include:

```text
PageHeader
FormSection
StatusBadge
ConfirmationDialog
EditableTextList
DataTable
LoadingState
ErrorBanner
```

These are examples only.

Do not recommend them unless the code actually demonstrates the need.

## 18. Final Recommendation

At the end, give me:

1. Overall frontend assessment.
2. Top architectural concerns.
3. Top componentization opportunities.
4. Top 10 improvements in the order they should be implemented.
5. Which improvements can be safely implemented independently.
6. Which improvements depend on another improvement being completed first.
7. Any areas that are already well-designed and should NOT be refactored.

## Important Rules

This review must be evidence-based.

Do not give generic React/Next.js best-practice recommendations unless they apply to the actual code.

Always mention specific files when identifying an issue.

Do not over-componentize.

Do not recommend abstractions merely because two pieces of code look slightly similar.

Prefer reusable **business/UI patterns** over tiny generic components.

Most importantly:

**DO NOT CHANGE ANY CODE.**

Create the review as a Markdown file:

`FRONTEND_CODE_REVIEW.md`

The report should be detailed enough that we can later take each recommendation individually and ask you to implement it without repeating the complete analysis.
