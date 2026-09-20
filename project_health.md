# Project Health Dashboard — KPI Logic (revised, for implementation)

Page: `/project-health` (`frontend/src/components/dashboard/project-health-dashboard.tsx`)
API: `GET /dashboard/project-health` (`backend/app/api/v1/endpoints/dashboard.py::get_project_health_dashboard`)
Logic: `backend/app/services/dashboard.py`
Roles: PMO, Admin, CDO, Delivery Excellence.

This version applies the review changes. Items marked **[Assumption]** are gaps I filled with a default — please confirm or correct them (collected in §9).

---

## 0. Global rules

### 0.1 Filter bar
| Filter | Effect |
|---|---|
| Geo / Account / Project Type | Narrow the project set (and accounts/geos where noted). |
| Period | Weekly period combo, see 0.2. |

### 0.2 Period combo (changed)
- Lists **Weekly periods only** (no Monthly, no Baseline).
- Shows the **last 10 weekly periods including the current one**, newest first.
- **Defaults to the current weekly period** (the weekly period containing today). No "[Current]" blank option — a period is always selected.
- The header shows `Period: <label>`.
- Which widgets use it:

| Widget | Uses selected week? | How |
|---|---|---|
| Project Portfolio | No | Snapshot as of today |
| Project Health (RAG) | **Yes** | Health declared for the selected week |
| Account Health (RAG) | **Yes** | Health declared for the selected week |
| RAIDO | No | "as of today" |
| Metrics | **Yes** | Previous-month Project Performance report of the selected week |
| Commitments | **Yes** | Previous-month Project Performance report of the selected week |
| Payment Milestones | No | Snapshot as of today **[Assumption]** |
| Findings | No | Snapshot (New This Period removed) |
| DE Assessments | **Yes** | Latest assessment in the month before the selected week |
| Actions | No | Snapshot |
| Report Submissions (4 cards) | **Yes** | Selected week (Delivery Status) / previous month of selected week (Project Performance) |

### 0.3 "Previous month of the selected week"
Wherever a monthly source is needed, take the **calendar month before the month containing the selected week's start date** **[Assumption — confirm: week start vs. week end when a week straddles two months]**. e.g. week 14–20 Sep 2026 → August 2026.

### 0.4 Project scope
- The dashboard's project set = filtered projects that are **approved and not Draft** — i.e. `project_status` in (Approved, Under Amendment). Draft and Pending Approval are excluded everywhere **[Assumption: Pending Approval is what "Unapproved" means; Under Amendment stays because it is an already-approved live project]**.
- **Active Projects** = the above set with `lifecycle_status` ≠ Closed and ≠ Hold (i.e. Ongoing, Open Only for Billing, or unset) **[Assumption — see 1.1]**.
- "Active Accounts" = accounts in the Geo/Account filter that have at least one Active Project **[Assumption]**.

**Your decision:**

---

## 1. Project & Account

### 1.1 Project Portfolio — `project_portfolio_summary`
Scope: 0.4 project set (Draft / Pending Approval excluded). Snapshot, ignores Period.
| Number | Logic |
|---|---|
| **Total** | Projects in scope. |
| **Active** | `lifecycle_status` not Closed and not Hold. |
| **Hold** | `lifecycle_status = Hold`. **(new, shown next to Active and Completed)** |
| **Completed** | `lifecycle_status = Closed`. |

Active + Hold + Completed = Total. **Active is the anchor: every "must equal Active Projects" rule below uses this number.**

**Your decision:**

### 1.2 Project Health — for the selected week
Population = **Active Projects**. Each project falls in exactly one bucket, so the buckets always sum to Active Projects.
| Bucket | Logic |
|---|---|
| **Green / Amber / Pot. Red / Red** | The project's health declaration **for the selected weekly period**; bucket by its `overall_rating`. |
| **Not Submitted** | Active project with no submitted health declaration for the selected week. |

- **Overdue is removed** (replaced by Not Submitted) **[Assumption]**.
- **[Assumption]** "Health for the period" = the project's Delivery Status (weekly) report for the selected week, in Submitted/Approved status, carrying that week's health declaration; a Draft report → Not Submitted. Confirm whether the source should be the declaration row (`health_declarations.period_id`) or the weekly status report.
- Requires the health declaration to be looked up by period, not "latest ever" (current behaviour).

**Your decision:**

### 1.3 Account Health — for the selected week
Population = **Active Accounts** (0.4). Buckets always sum to Active Accounts.
| Bucket | Logic |
|---|---|
| **Green / Amber / Pot. Red / Red** | The account's health declaration for the selected weekly period, by `overall_rating`. |
| **Not Submitted** | Active account with no submitted account health declaration / weekly account status report for the selected week. |

Overdue removed. Same source **[Assumption]** as 1.2, using `account_status_reports` / `account_health_declarations`.

**Your decision:**

---

## 2. RAIDO (as of today)

**Section heading renamed to "RAIDO (as of today)".** Snapshot; ignores Period. Scope: 0.4 project set filtered by Geo/Account/Type. **[Assumption: Active Projects only — confirm, or should Hold/Closed projects' records still show?]**

### 2.1 Risks
| Number | Logic |
|---|---|
| **Open** | `current_status` in (Open, Monitoring) |
| **High/Crit** | Open AND severity in (High, Critical) |
| **Overdue** | Open AND `target_resolution_date < today` |
| **No Mitigation** | Open AND `mitigation_plan` null/empty |

### 2.2 Issues
| Number | Logic |
|---|---|
| **Open** | `status` not in (Resolved, Closed) |
| **Critical** | Open AND severity = Critical |
| **Overdue** | Open AND `due_date < today` |

### 2.3 Dependencies
| Number | Logic |
|---|---|
| **Open** | `dependency_status != Completed` |
| **Overdue** | Open AND `required_by_date < today` |
| **Critical** | Open AND `criticality = Critical` |

### 2.4 Assumptions
| Number | Logic |
|---|---|
| **Open** | `current_status = Open` |
| **Review Due** | Open AND `validation_status = Pending` |
| **Overdue** | Review Due AND `validation_date < today` |

### 2.5 Opportunities
| Number | Logic |
|---|---|
| **Open** | `status` in (Identified, Approved) |
| **High Priority** | Open AND `impact = High` |
| **Pending Approval** | `approval_required = true` AND `status = Identified` |

Records with no due date are never Overdue.

**Your decision:**

---

## 3. Performance & Commercial

Metrics and Commitments are **project-level**: each **Active Project** is counted **once** in exactly one bucket, so the buckets always sum to Active Projects. Source is the project's **Project Performance report of the previous month of the selected week** (0.3).

### 3.1 Metrics
Per Active Project, evaluate every metric reported in that Project Performance report against its target:
| Bucket | Logic |
|---|---|
| **Compliant** | Project has a Performance report for the month **and every metric meets its target**. *(renamed from "Below Target"; the "≤20% below target" rule is removed)* |
| **Critical Variance** | Report exists and **at least one metric misses its target** (any miss, no 20% threshold). |
| **Not Reported** | No Project Performance report / no measurements for the month (or nothing comparable against a target — **[Assumption]**). |

Compliant + Critical Variance + Not Reported = Active Projects. The tile shows the three counts (and Compliant % = Compliant ÷ Active Projects **[Assumption]**). The former "Below Target" tile is dropped, Critical Variance remains.
- "Miss" uses the existing direction rule (higher_better: actual < target; lower_better: actual > target).
- **Fix carried over:** a project with several disciplines must be evaluated across **all** of them (worst wins), not last-discipline-wins as today.

**Your decision:**

### 3.2 Commitments
Per Active Project, from the same previous-month Project Performance report (commitment actuals recorded in that month):
| Bucket | Logic |
|---|---|
| **Met** | Project has commitment actuals reported for the month and **every** commitment is Met. |
| **Not Met** | At least **one** commitment is not Met (Not Met / Breached). |
| **Not Reported** | No commitment actual reported for the month (**[Assumption]** — includes projects with no commitments defined; alternatively a separate "No commitments" treatment). |

Met + Not Met + Not Reported = Active Projects. Open / Due Soon / Overdue / Breached tiles are replaced by these three buckets.

**Your decision:**

### 3.3 Payment Milestones
No change requested — current logic retained; snapshot as of today, project scope 0.4.
| Number | Logic |
|---|---|
| **Value Due** | Sum of `expected_payment_value` for milestones with no actual payment. **Note:** currently sums across currencies — open point. |
| **Due** | Unpaid, `expected_date` null or ≥ today (upcoming) |
| **Overdue** | Unpaid, `expected_date < today` |

**Your decision (currency handling, meaning of "Due"):**

---

## 4. Delivery Excellence & Governance

### 4.1 Findings — snapshot
**"New This Period" removed.** Remaining tiles:
| Number | Logic |
|---|---|
| **Open Findings** | `status = Open` **[Assumption — carried over; confirm whether Open should include In Progress / Awaiting Closure]** |
| **Overdue** | Open AND `finding_date` > 30 days ago |
| **Awaiting Closure** | `status` in (On Hold, Deferred) **[carried over — confirm: should this be `status = Awaiting Closure`?]** |

No longer period-dependent (also removes the "0 if no period" forcing).

**Your decision:**

### 4.2 DE Assessments — project-level (reworked)
Population = **Active Projects**; each in exactly one bucket, buckets sum to Active Projects.
Source = the project's **latest DE Assessment done in the previous month of the selected week** (0.3). **[Assumption: only Submitted assessments count; Draft is ignored.]**
| Bucket | Logic |
|---|---|
| **Green** | Latest assessment's `de_assessed_project_health` = Green. |
| **Need Attention** | Latest assessment's health in (**Amber, Potential Red, Red**). |
| **Not Assessed** | No (Submitted) assessment in that month. |

Completed / Avg PCI / Due / Red-Amber tiles are replaced by these three buckets **[Assumption — Avg PCI dropped; confirm]**.

**Your decision:**

### 4.3 Actions — snapshot (not period dependent)
**"Due This Week" removed.**
| Number | Logic |
|---|---|
| **Open** | status not in (Completed, Closed, Cancelled) |
| **In Progress** | Open AND status = In Progress |
| **Overdue** | Open AND `due_date < today` |

Scope unchanged: with no Geo/Account/Type filter → all actions at every level; with any filter → Project-level actions of in-scope projects only (UI note retained).

**Your decision:**

### 4.4 Data Integrity — **REMOVED**
The Data Integrity card is removed from the dashboard (frontend card + `data_integrity_card_summary` in the summary payload). The drill-down `/project-health/data-integrity` screen and nav entry: **[Assumption — remove the card only, leave the drill-down; confirm or remove everything]**.

---

## 5. Report Submissions

Section is a Submitted / Not Submitted tracker. **Draft reports are never counted as Submitted.** Filed = status Submitted or Approved (Rejected and Draft = Not Submitted **[Assumption]**). Population is **Active** entities only **[Assumption]**. Every card has exactly two buckets, **Submitted + Not Submitted = Expected**.

### 5.1 Weekly reports — for the selected week (Monthly excluded)
| Card | Population | Submitted when |
|---|---|---|
| **Delivery Status — Projects** | Active Projects | Project weekly status report for the selected week is Submitted/Approved |
| **Delivery Status — Account** | Active Accounts | Account weekly status report for the selected week is Submitted/Approved |
| **Delivery Status — Geo** | Geos in filter (all geos when unfiltered) | Geo weekly status report for the selected week is Submitted/Approved |

- Only the selected weekly period is evaluated — no longer "every started period since onboarding". Entities onboarded after the week's start are not expected **[Assumption — keep the existing onboarding-date rule]**.

### 5.2 Project Performance (renamed from "Metrics — Projects")
- **Monthly** report. For the selected week, the **previous month's** Project Performance report (0.3).
- Population = Active Projects. Buckets **Submitted / Not Submitted**.
- **[Assumption]** "Submitted" for a Performance report = the project's monthly completion is fully complete for that month (`compute_monthly_completion` → `all_complete`: Measurement, Commitments, Payment Milestones and the 5 RAIDO logs each saved or attested "Reviewed – No Changes"). The Performance report currently has no Draft/Submitted status of its own. Alternative: any measurement row for the month (today's "Metrics — Projects" rule) — please choose.

Adherence % (Submitted ÷ Expected) and Missing (= Not Submitted) may remain as display values.

**Your decision:**

---

## 6. Bucket integrity rules (implementation must assert)
| Widget | Buckets | Must equal |
|---|---|---|
| Project Health | Green + Amber + Pot. Red + Red + Not Submitted | Active Projects |
| Account Health | Green + Amber + Pot. Red + Red + Not Submitted | Active Accounts |
| Metrics | Compliant + Critical Variance + Not Reported | Active Projects |
| Commitments | Met + Not Met + Not Reported | Active Projects |
| DE Assessments | Green + Need Attention + Not Assessed | Active Projects |
| Delivery Status (Projects/Account/Geo) | Submitted + Not Submitted | Expected |
| Project Performance | Submitted + Not Submitted | Active Projects |
| Portfolio | Active + Hold + Completed | Total |

---

## 7. Drill-down screens affected
Each card's list screen should use the same population/period and show the bucket per row: `/project-health/project-list`, `/rag`, `/account-rag`, `/metrics`, `/commitments`, `/assessments`, `/findings`, `/actions`, `/report-submissions/*` (Metrics-projects route/label → Project Performance), and `/data-integrity` (see 4.4). Drill-downs should honour the same Period combo for period-driven cards.

## 8. Summary of changes vs. previous version
1. Period combo: Weekly only, last 10 incl. current, defaults to current.
2. Portfolio: Draft/Pending Approval excluded; Hold added.
3. Project & Account Health: per selected week, Not Submitted bucket, sums to Active; Overdue removed.
4. RAIDO heading → "RAIDO (as of today)".
5. Metrics: project-level from previous-month Performance report; Below Target → Compliant; 20% rule removed; any miss = Critical Variance; Active only.
6. Commitments: project-level Met / Not Met / Not Reported; Active only.
7. Findings: New This Period removed.
8. DE Assessments: project-level Green / Need Attention / Not Assessed from previous month's assessment.
9. Actions: Due This Week removed.
10. Data Integrity card removed.
11. Report Submissions: weekly-only Delivery Status cards, Submitted/Not Submitted, Draft excluded; "Metrics — Projects" → "Project Performance" (previous month).

## 9. Open questions to confirm
1. "Unapproved" = Pending Approval (and Draft)? Should Under Amendment stay in?
2. Is Hold excluded from Active (my assumption) — and therefore from all the "= Active Projects" widgets?
3. "Previous month" of a week: use week start date or end date when it straddles months?
4. Project/Account Health "for the period": source = weekly status report's health declaration vs. declaration row by period?
5. Is a Pending/Rejected weekly report treated as Not Submitted?
6. "Not Reported" for Metrics: also cover "report exists but no target set"? For Commitments: projects with no commitments defined → Not Reported?
7. What defines a Project Performance report as "Submitted" (all sections complete vs. any measurement row)?
8. DE Assessments: Draft assessments ignored? Avg PCI dropped?
9. RAIDO / Payment Milestones / Findings / Actions: restrict to Active Projects, or keep all in-scope projects?
10. Data Integrity: remove only the card, or also the drill-down screen and nav entry?
11. Findings: keep "Open = status Open only" and "Awaiting Closure = On Hold/Deferred"?
12. Payment Milestones: multi-currency Value Due handling.
