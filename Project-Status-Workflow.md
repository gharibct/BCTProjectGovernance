# Project Status Workflow — Project Setup & Amend Project

How a project's status changes through **Project Setup** and **Amend Project**, and what the user can do on each screen.

Sources: `backend/app/api/v1/endpoints/projects.py`, `de_approval.py`, `backend/app/services/amendment.py`, `approval_readiness.py`, `frontend/src/lib/project-context-targets.ts`, `frontend/src/components/new-project/*`.

---

## 1. Two status fields

| Field | Values | Set by |
|---|---|---|
| `project_status` (approval workflow) | `Draft`, `Pending Approval`, `Approved`, `Under Amendment` | Send To Approval, Recall, Initiate Amend, DE decision |
| `lifecycle_status` (business state) | `Ongoing`, `Hold`, `Closed`, `Open Only for Billing` | Stamped `Ongoing` on the **first** DE approval; PM changes it on Amend → Project Profile ("Project Lifecycle") |

**The status badge in the page header shows `lifecycle_status` when one is set, otherwise `project_status`** (`effectiveProjectStatus`). Once a project has been approved once, the badge reads "Ongoing" (or Hold, etc.) even while the underlying workflow status is `Under Amendment` or `Pending Approval`. The statuses in this document are the underlying `project_status`.

---

## 2. Which projects load on each screen

The Project Context page (`/select-project/{menu}`) filters the picker with these rules (`project-context-targets.ts`):

| Screen | Eligible `project_status` | Rule |
|---|---|---|
| **Project Setup** (`/new-project/{id}/…`) | **Draft**, **Pending Approval** | `!isApproved` |
| **Amend Project** (`/amend-project/{id}/…`) | **Approved**, **Under Amendment** | `isApproved` = anything except Draft / Pending Approval |

Amend Project also lists projects whose lifecycle is `Closed`, but Initiate Amend refuses them (see §4).

---

## 3. Project Setup flow (first-time approval)

```
   Draft ──Send To Approve──▶ Pending Approval ──DE Approve──▶ Approved
     ▲                              │  │                        (lifecycle = Ongoing if empty)
     │◀──────Recall to Draft────────┘  │
     │◀──────────DE Return─────────────┘   (PM sees the DE's remarks)
```

| Event | `project_status` after | Other effects |
|---|---|---|
| Project arrives in Project Setup | **Draft** | Created as Draft (project-creation request approved by DE, or Admin bulk import). |
| **Send To Approve** clicked | **Pending Approval** | DE gets a `DE_APPROVAL_QUEUED` notification. |
| **Recall to Draft** (PM) | **Draft** | Only valid while Pending Approval; `de_review_status` cleared. |
| DE **Return** | **Draft** | `de_review_status = Returned`; remarks shown to the PM on the Send To Approval screen; PM notified. |
| DE **Approve** | **Approved** | `lifecycle_status = Ongoing` if it was empty; PM notified. Project leaves Project Setup and appears in Amend Project. |

### Send To Approve pre-conditions
The server rejects the request (HTTP 422, with a fresh readiness payload) unless:
1. `project_status` is `Draft` or `Under Amendment`, **and**
2. every **mandatory** module is complete: **Project Profile, Scope & Schedule, Measurement, Commitments, Milestones**.

**RAIDO Register is optional** and never blocks submission.

---

## 4. Amend Project flow (changing an approved project)

```
 Approved ──Initiate Amendment──▶ Under Amendment ──Send To Approve──▶ Pending Approval
    ▲                                  ▲   ▲                              │   │   │
    │                                  │   └──────────Recall──────────────┘   │   │
    │                                  └──────────────DE Return───────────────┘   │
    └───────────────────────────────DE Approve────────────────────────────────────┘
```

| Event | `project_status` after | Amendment record (`project_amendments`) | Other effects |
|---|---|---|---|
| **Initiate Amendment** clicked | **Under Amendment** | created, `In Progress` | Snapshots the projects row plus every module table (Oracle IDs, resources, commitments, milestones, all metric targets, RAIDO logs, staffing priorities) into `project_amendment_snapshots`; clears `de_review_*`; notifies PM and DE (`AMENDMENT_INITIATED`). |
| **Send To Approve** (amend) | **Pending Approval** | `Submitted`, `submitted_at` set | Same mandatory-module check as §3; DE notified. |
| **Recall** (PM) | **Under Amendment** | back to `In Progress` | Only valid while Pending Approval. |
| DE **Return** | **Under Amendment** | back to `In Progress` | Remarks shown to the PM. |
| DE **Approve** | **Approved** | `Completed`, `completed_at` set | Existing lifecycle state (Hold, etc.) is left untouched. |

### Initiate Amendment pre-conditions
- `project_status == Approved` **and** `lifecycle_status != Closed`. `Hold` and `Open Only for Billing` can be amended.
- No amendment already `In Progress` / `Submitted` for the project.

---

## 4a. Status at a glance

| Moment | `project_status` | Screen family |
|---|---|---|
| Project loaded in Project Setup | Draft (or Pending Approval if already submitted) | Project Setup |
| Setup → **Send To Approve** | **Pending Approval** | Project Setup |
| Setup → Recall / DE Return | **Draft** | Project Setup |
| DE approves | **Approved** | Amend Project |
| Project loaded in Amend Project | Approved (or Under Amendment if already initiated) | Amend Project |
| Amend → **Initiate Amend** | **Under Amendment** | Amend Project |
| Amend → **Send To Approve** | **Pending Approval** | see caveat 1 in §7 |
| Amend → Recall / DE Return | **Under Amendment** | Amend Project |
| DE approves the amendment | **Approved** | Amend Project |

---

## 5. Actions per screen

### 5.1 Project Setup (`/new-project/{id}/…`)
Navigation rail groups: AI Hub, Project Charter, Project Baseline, Project Register, Approval.

| Screen | Actions available |
|---|---|
| **AI Document Processing** | Upload documents (drag-drop / browse), **Process** all pending documents, View AI output, Download, Delete. |
| **Map Oracle Projects** | Add an Oracle Project ID (validated), Remove a mapping. |
| **Project Profile** | Edit fields and **Save** (PUT); Load AI Suggestions. Editable only while `Draft`. When locked, the Save button is replaced by a link (see §5.3). |
| **Scope & Schedule** | Edit fields, **Save Scope & Schedule**; Load AI Suggestions. Editable only while `Draft`; when locked, replaced by the same link. |
| **Resource Allocation** | Read-only: KPI tiles, search/paginated resource grid, row drawer with month-wise allocation. Data comes from Oracle. |
| **Measurement** | Fill target metrics for the project's type (Development, Support, Professional Staffing, Testing, Cloud Maintenance, Cloud Migration, Consulting); **Save Targets** (range-checked against the metric reference). Benchmarks pre-fill empty fields. |
| **Contractual Compliance** | Add / Edit / Delete **Commitments**; Add / Edit / Delete **Payment Milestones**. |
| **RAIDO Register** | Add / Edit / Delete Risks, Assumptions, Issues, Dependencies, Opportunities. |
| **Send To Approval** | View the readiness checklist (completion %, modules complete/incomplete, critical gaps, per-module DE verdict, "View" links). **Send To Approve** (enabled when `can_submit`); **Recall to Draft** (enabled only when Pending Approval). Shows the DE's rejection remarks when returned. |

### 5.2 Amend Project (`/amend-project/{id}/…`)
Same rail as Project Setup, but **RAIDO Register is not in the rail** and the last group is **Amend & Approve** (Initiate Amend, Send To Approve) instead of Approval.

| Screen | Actions available |
|---|---|
| **AI Document Processing**, **Map Oracle Projects**, **Scope & Schedule**, **Resource Allocation**, **Measurement**, **Contractual Compliance** | Same as Project Setup (§5.1). Contractual Compliance keeps full add/edit/delete here; Project Reporting only records actuals. |
| **Project Profile** | Same as §5.1, plus a **Project Lifecycle** card with the Project Status combo (Ongoing / Hold / Closed / Open Only for Billing). The combo is editable **only while `Under Amendment`**; in that status every field is editable **except Project Type**. |
| **Initiate Amend** | One button: **Initiate Amendment** (enabled only when Approved and not Closed). If already Under Amendment it says an amendment is in progress; otherwise it states the project's current status. |
| **Send To Approve** | Readiness checklist, **Send To Approve** (enabled when Under Amendment and all mandatory modules complete), **Recall** (enabled only when Pending Approval). If the project isn't Under Amendment it says "Initiate an amendment first". |

### 5.3 Editing rules by status (baseline lock)

The project **baseline** — Project Profile, Scope & Schedule, Oracle mapping, resources, measurement targets, commitments, milestones and "create"-context AI documents — is writable **only in `Draft` and `Under Amendment`**. The server enforces this (HTTP 422, code `PROJECT_LOCKED`); the UI mirrors it by disabling the controls and showing a notice.

| `project_status` | Baseline | What the user sees |
|---|---|---|
| Draft | Editable | Normal forms. |
| Under Amendment | Editable (Project Type fixed; lifecycle combo enabled) | Normal forms. |
| Pending Approval | **Locked** | Notice "With Delivery Excellence…" with a **Recall it to make changes** link to Send To Approval. |
| Approved | **Locked** | Notice "Approved: this project's baseline is locked" with an **Initiate an amendment to edit** link to Initiate Amend. |

There is no "Edit Project" unlock any more.

Reporting data is **not** baseline and is never locked: commitment/milestone **actuals**, per-period **measurements**, the **RAIDO** register, health/status reports, actions, and "reporting"-context documents. Viewing and downloading existing documents also stays available.

Extra `PUT /projects/{id}` rules: `lifecycle_status` can change only while Under Amendment; `project_type_id` cannot change once the project has been approved (i.e. while Under Amendment); `delivery_excellence_id` is not settable through this endpoint (DE Allocation owns it).

The route guard keeps each project on the screen family that owns its status (Draft → Project Setup; Approved / Under Amendment → Amend Project; Pending Approval → whichever family it came from, using `has_active_amendment`), so a bookmark or notification link to the wrong family redirects to the right one.

---

## 6. DE side (for reference)

Approve Project Setup / Amendment (`/de-approval`): the queue shows projects that are `Pending Approval`. Opening the workspace and marking any section moves `de_review_status` from *Awaiting Review* to *In Review*. The DE reviews each section (Reviewed / Gap Identified), then submits **Approve** or **Return** with remarks. A decision is only accepted while the project is Pending Approval. Whether **Return** lands in `Draft` or `Under Amendment` depends on whether an active amendment exists.

---

## 7. Behaviour that changed with the baseline lock

Earlier versions of this document listed these as open gaps; they are now closed:

1. **A submitted amendment now stays under Amend Project.** The picker uses `has_active_amendment` (server-computed) so a Pending Approval amendment is listed under Amend Project, and Recall reads "Recall to Under Amendment" (or "Recall to Draft" for a first-time submission).
2. **Locking is enforced on the server**, not just in the browser. Editing a Pending Approval or Approved project is rejected with `PROJECT_LOCKED`; "Edit Project" no longer unlocks anything.
3. **All baseline screens lock**, not just Profile and Scope & Schedule: Map Oracle Projects, Measurement, Contractual Compliance and AI Document Processing (uploads/processing/deletes) follow the same rule.
4. **The header shows both states** — the workflow status and, once set, the lifecycle status — so "Under Amendment" and "Pending Approval" stay visible for a previously approved project.
5. The Amend rail still hides RAIDO (it is maintained from Reporting), although `/amend-project/{id}/raido` remains a route.

Still open (not part of this change): the amendment snapshot is never read (no diff / rollback / cancel), the DE approval screen shows no amendment diff, edits during an amendment go straight to live tables, and any PM can write to any project (no per-project ownership check).
