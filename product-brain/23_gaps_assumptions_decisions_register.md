# 23 — Gaps, Assumptions & Decisions Register

**Document type:** Product-Brain Forward-Plan
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/00–22 (all)
**Feeds:** product-brain/24, product-brain/25, verification & sign-off

> **Purpose of this document.** Every point across `product-brain/00`–`22` where information
> was missing, invented, unverified, or genuinely undecided — made visible and managed
> instead of silently hardening into a "requirement". Each entry is **classified**,
> **owned**, **impact-assessed**, and given a **recommendation** and a **status**. It
> consolidates BRS §8 (10 open items), `docs/ux-requirements.md` §6–7 (5 questions + 14
> proposed controls), `docs/PendingPoints.txt` (~50 backlog items), the code-review
> findings, and every `ASSUMPTION:` / `TARGET:` raised in the pack. `GAD-<NNN>` IDs.

---

## 1. Conventions

**Type:**

| Type | Meaning | What to do |
| --- | --- | --- |
| `GAP` | Should exist / be known for the pack to be complete, but is not. | Investigate: read code, ask an SME, run the system. |
| `ASSUMPTION` | A statement invented or inferred to let work proceed. | Validate against the real product; if wrong it is a change, not a surprise. |
| `DECISION REQUIRED` | A genuine choice the team/business must make; the pack picked a working default. | Escalate to the owner; record the decision + date. |
| `RISK` | Something that could go wrong if not actively managed. | Assign owner, mitigation, review cadence. |
| `DEPENDENCY` | Something outside the app's control the plan relies on. | Track with the counterpart; confirm dates/interfaces. |

**Status:** `OPEN` · `IN REVIEW` · `CONFIRMED` (assumption validated / gap answered) ·
`DECIDED` · `MITIGATED` · `CLOSED`. For this first pass, all entries are `OPEN` or
`IN REVIEW` — the point is to show the register, not pre-resolve it.

**Numbering:** `GAD-1xx` Assumptions · `GAD-2xx` Gaps · `GAD-3xx` Decisions Required ·
`GAD-4xx` Risks · `GAD-5xx` Dependencies.

---

## 2. Summary

| Type | Count | Highest-attention |
| --- | --- | --- |
| `ASSUMPTION` | 22 | GAD-110 (server-side rule enforcement), GAD-104 (health-model migration) |
| `GAP` | 20 | GAD-201 (audit coverage), GAD-210 (no migration tool), GAD-214 (geo RAG screen) |
| `DECISION REQUIRED` | 18 | GAD-301 (product name), GAD-305 (DE cadence), GAD-310 (role split final?) |
| `RISK` | 14 | GAD-401 (no-password auth), GAD-402 (no migration chain), GAD-407 (stored-XSS) |
| `DEPENDENCY` | 8 | GAD-501 (OneLogin app + TLS), GAD-503 (Oracle integration), GAD-505 (QA formulas) |
| **Total** | **82** | |

---

## 3. Highest-attention entries

| GAD | Type | One line | Blocks |
| --- | --- | --- | --- |
| GAD-401 | RISK | `AUTH_TYPE=no_password` — sign-in with no credential check is the default. | pilot / prod exposure |
| GAD-402 | RISK | No migration framework; no versioned chain for Postgres schema changes. | safe environment promotion |
| GAD-301 | DECISION | No confirmed product name. | external-facing rollout |
| GAD-110 | ASSUMPTION | Many business rules are enforced only in the UI / by intent, not server-side. | correctness of the rule catalogue |
| GAD-305 | DECISION | DE Assessment cadence (monthly vs quarterly) undecided. | Data Integrity "not updated" logic, `next_assessment_due_date` |
| GAD-311 | DECISION | `DELIVERY_EXCELLENCE` and `PMO` write/approve authority not fully wired. | those roles doing their job |
| GAD-403 | RISK | Insecure hardcoded fallback secrets if `.env` is absent. | any misconfigured environment |
| GAD-407 | RISK | Executive Update rich text rendered unsanitised — stored-XSS risk. | data integrity / account safety |
| GAD-501 | DEPENDENCY | OneLogin OIDC app per environment + reverse-proxy/TLS. | real authentication |
| GAD-505 | DEPENDENCY | QA to provide measurement baselines & confirm formulas. | trustworthy metrics |

---

## 4. Assumptions (`GAD-1xx`)

| GAD | Area | Description | Impact | Recommendation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| GAD-100 | Naming | "ProjectGovernance" is a working title used throughout the pack. | cosmetic; rename churn if changed late | See GAD-301 | PMO sponsor | OPEN |
| GAD-102 | Roles | The eight-role model (`00` §3) is treated as final. | every permission check | See GAD-310 | PMO sponsor | IN REVIEW |
| GAD-104 | Health | The legacy single-rating and the itemised `project_health_items` model **coexist**; both feed the rollup. | ambiguous source of truth for project health | Finish the migration; retire the legacy columns | Backend lead | OPEN |
| GAD-106 | Workflow | A `Rejected` status report has no automatic revert; re-open-to-`Draft` is inferred. | review loop behaviour | Confirm the re-open path or add one | Backend lead | OPEN |
| GAD-108 | Workflow | Project post-`Approved` transitions (`Hold`/`Closed`/`Open Only for Billing`) are not guarded in code. | invalid lifecycle states possible | Add transition guards | Backend lead | OPEN |
| GAD-110 | Rules | Several `BR-*` are marked **Advisory** — enforced in the UI or by BRS intent, **not** verified in server logic (`05` §26). | the rule catalogue overstates enforcement | Code-audit each Advisory rule; promote to server checks | Backend lead | OPEN |
| GAD-112 | Rules | "One record per project per reporting period" (Status, Measurement) is not backed by a DB constraint. | duplicate period records possible | Add a `UNIQUE (project_id, period_id)` where intended | Backend lead | OPEN |
| GAD-114 | DE | `DELIVERY_EXCELLENCE` is in the DE-Assessment write gate but **not** the generic `_pm_write` gate; `PMO`/`TEAM_MEMBER` are in no write gate. | roles cannot act as specified | See GAD-311 | Backend lead | IN REVIEW |
| GAD-116 | Data | `id_sequences` rows may need lazy creation on first use per `(entity_code, year)`. | first create of a year could fail | Seed the rows or lazy-insert | Backend lead | OPEN |
| GAD-118 | Data | No retention / archival / purge policy for any entity; dated history accumulates indefinitely. | storage growth; compliance | Define a retention policy | PMO + IT | OPEN |
| GAD-120 | Data | `projects.billing_type` / `engagement_type` and legacy free-text status columns are still present though slated for removal. | ambiguity | Drop after confirming no reads | Backend lead | OPEN |
| GAD-122 | Cadence | Every "⚠ proposed" cadence in `14` §4 is used as the working default. | Data Integrity verdicts, defaulter lists | Ratify the cadence model | PMO | OPEN |
| GAD-124 | Data Integrity | Freshness-window day counts (`Weekly`/`Monthly`/`Quarterly`) are indicative, not transcribed exactly. | `Updated`/`Not Updated` correctness | Transcribe `_is_updated` and ratify | Backend lead | OPEN |
| GAD-126 | Measurement | Metric input field names are from `data.get()` keys; column names may differ. | doc-to-schema mapping | Reconcile `15` with `db/tables/11–16, 45` | Backend lead | OPEN |
| GAD-128 | API | Some list endpoints return a bare array, others a `Page[T]` envelope. | client handling | Standardise or document per endpoint | Backend lead | OPEN |
| GAD-130 | Rollup | "Ignore"/"Undo" are endpoint logic over the rollup services; only `pull_*` is public. | re-implementation clarity | Name and test the ignore/undo paths | Backend lead | OPEN |
| GAD-132 | Architecture | Kafka fronts the **external** AI pipeline, not `app/`. | integration understanding | Confirm the pipeline topology | AI/infra | OPEN |
| GAD-134 | Deployment | DB host `192.168.1.175` / db `Project_Governance_01` from `deployment.md` may differ per environment. | ops | Maintain a per-environment inventory | IT | OPEN |
| GAD-136 | Security | The AI pipeline authenticates as a provisioned service principal — mechanism unconfirmed. | integration security | Specify and document | Backend + AI | OPEN |
| GAD-138 | UI | `auth-guard.tsx` is authentication-only; pages may render for users who cannot act. | UX (not security — server gates) | Optionally add per-page role gates | Frontend lead | OPEN |
| GAD-140 | UI | Rich-text sanitisation is not yet applied. | See GAD-407 | Frontend lead | OPEN |
| GAD-142 | Master data | "No admin screen" for Org/Geo/Region/Project Type/Product/Period is from `DATA-ENTRY-GUIDE.md`; may have changed. | admin workflow | Verify against the running app | Frontend lead | OPEN |

---

## 5. Gaps (`GAD-2xx`)

| GAD | Area | Description | Impact | Recommendation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| GAD-200 | Docs | No product overview / architecture doc existed before this pack; the source workbook's "Architecture" sheet is empty. | onboarding | This pack fills it | — | IN REVIEW |
| GAD-201 | Audit | `user_activity_log` exists; coverage of what is logged is unconfirmed (BRS FR-AUTH-4). No login-event log, no write-once store. | attributability / compliance (NFR-4) | Define the audit event set; implement full coverage | Backend lead | OPEN |
| GAD-202 | Auth | No per-request identity or role check existed before commit `a6c607e`; confirm the fix covers **every** route (`data_integrity.py`, `documents.py` list/download flagged). | authorization completeness | Route sweep + VAPT | Backend lead | OPEN |
| GAD-203 | Docs | Several shipped modules (Action Tracker, Executive Updates, DE Approval, Project Health portfolio, Consulting, Regions) were undocumented in the BRS. | scope clarity | This pack documents them; refresh the BRS or retire it | PMO | IN REVIEW |
| GAD-204 | Roles | `roles-actions.md` is stale on DE (says DE has no path; menu + routes + dashboard now exist). | misleading reference | Superseded by `product-brain/07` | — | IN REVIEW |
| GAD-205 | Contractual | No UI to record commitment "Met/Not Met" actuals or milestone actual payment date on some flows. | dashboards show "Not Recorded" forever | Build the actuals-entry screens | Frontend lead | OPEN |
| GAD-206 | Geo | Geo RAG-status screen does not exist — endpoints only. | geo health must be entered via API | Build the screen (mirror Account RAG) | Frontend lead | OPEN |
| GAD-207 | RAID | Only Risk has `Last/Next Review Date`; Issue/Dependency/Opportunity do not (Assumption has `Validation Date`). | inconsistent "due for review" filter | See GAD-303 | PMO | OPEN |
| GAD-208 | Measurement | Reporting-period selector + history guaranteed only for Development. | trend charts, Data Integrity per-tab cadence | See GAD-304 | PMO | OPEN |
| GAD-209 | Measurement | Development CPI & Code Coverage, Support SLA-compliance & SR/clarification MTTRs are permanently `None` — no input feeds them. | metrics the BRS lists never populate | Add the inputs or drop the metrics | QA + Backend | OPEN |
| GAD-210 | Schema | No Alembic / migration tool; no versioned chain for Postgres schema changes (see GAD-402). | environment drift | Adopt Alembic | Backend lead | OPEN |
| GAD-211 | Schema | DDL scripts vs. ORM models can drift (tests build from `Base.metadata`). | schema of record ambiguous | CI schema-diff check | Backend lead | OPEN |
| GAD-212 | Schema | Zero DB CHECK constraints — value sets enforced only by Pydantic. | invalid states via any non-API write | Add CHECK constraints or a single enforced enum source | Backend lead | OPEN |
| GAD-213 | Notifications | No notification-delivery mechanism (no email/SMS lib); all `N-*` "sends" are Planned. | no reminders / alerts to users | Choose and integrate a channel (M365 mail?) | Backend + IT | OPEN |
| GAD-214 | Defaulters | No dedicated cross-tier defaulter screen; only derived KPIs today (BRS §7, `PendingPoints` #25). | "view defaulters at all levels" unmet | Build the defaulter view on the cadence model | Frontend lead | OPEN |
| GAD-215 | Dashboards | PM "My Summary" is on mock data. | PMs get no real dashboard | Wire to `/dashboard/summary` | Frontend lead | OPEN |
| GAD-216 | Data Integrity | `MODULE_LOOKUP` has no entry for Consulting Metrics, Milestone Payments, Account/Geo status, Executive Update, Actions, Resource Allocation. | those items would falsely show "Not Updated" | Extend the lookup map | Backend lead | OPEN |
| GAD-217 | Data Integrity | Freshness is "days since last update vs. today", not truly period-scoped. | a project that skipped this week can still show `Updated` inside the window | Re-scope to the reporting period | Backend lead | OPEN |
| GAD-218 | Observability | No structured logging, metrics, or tracing configured. | operability | Add a logging/metrics stack | IT + Backend | OPEN |
| GAD-219 | Storage | Documents/images on local filesystem, no object storage, no AV scan, no upload allow-list. | resilience + security | Object storage + upload hardening | Backend + IT | OPEN |
| GAD-220 | Testing | No consolidated test plan; only `e2e-test-flow.csv` and `backend/tests/`. | verification coverage | `product-brain/25` defines it | QA lead | IN REVIEW |

---

## 6. Decisions Required (`GAD-3xx`)

| GAD | Area | Decision | Working default | Why it matters | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| GAD-300 | Auth | LDAP bind vs SSO vs other; MFA per-role or configurable? (BRS Open Item 1) | OneLogin OIDC; MFA mandatory for `ADMIN`/`CXO` | no rollout before this | PMO + IT security | OPEN |
| GAD-301 | Naming | Confirm the product name. (BRS Open Item 10) | "Project Governance Tool" | external rollout | PMO sponsor | OPEN |
| GAD-302 | Project status | Confirm implemented values (`Draft`/`Pending Approval`/`Approved`/…) supersede the workbook's "Start Up"/"Execution". (BRS Open Item 2) | implemented values final | re-litigated repeatedly | PMO | OPEN |
| GAD-303 | RAID | Add `Last/Next Review Date` to Issue/Dependency/Opportunity? (BRS Open Item 3) | add them for consistency | monthly-review filter + defaulters | PMO | OPEN |
| GAD-304 | Measurement | All 7 tabs get a period selector + history? (BRS Open Item 4) | yes | trend charts, cadence | PMO | OPEN |
| GAD-305 | DE | DE Assessment cadence — monthly or quarterly per project? (BRS Open Item 5) | monthly | `next_assessment_due_date`, Data Integrity | Delivery Excellence | OPEN |
| GAD-306 | Dashboards | Per-tile "data as of" indicator? (BRS Open Item 6) | add it | prevents misreading stale numbers | PMO | OPEN |
| GAD-307 | Roles | Is the CEO/CDO/GEO Head/Delivery Manager split into `CXO`/`GEO_HEAD`/`ACCOUNT_MANAGER` final; is a separate Delivery Manager role needed? (BRS Open Item 7) | split final; DM is a Charter field, not a role | every permission check | PMO | OPEN |
| GAD-308 | RAID | Who approves an Opportunity (`Approved By`)? (BRS Open Item 8) | Delivery Manager / `ACCOUNT_MANAGER` | assigns the approval action | PMO | OPEN |
| GAD-309 | Oracle | Resource Allocation stays manually entered until a live Oracle integration exists, or is ID mapping a near-term placeholder? (BRS Open Item 9) | manual until live sync | Charter field editability | PMO + IT | OPEN |
| GAD-310 | Roles | Confirm the 8-role model is final and no ninth role (e.g. Delivery Manager, Team Lead) is needed. | 8 roles | §3 role table + downstream | PMO | OPEN |
| GAD-311 | Roles | Wire `DELIVERY_EXCELLENCE` as the sole project approver and `PMO` as owner of Contractual + Data Integrity — confirm and implement. | as intended in BRS §3.1 | those roles' core jobs; removes PM self-approval | PMO + Backend | OPEN |
| GAD-312 | Cadence | Ratify the freshness-window day counts for Weekly/Monthly/Quarterly. | ~7 / ~30 / ~90 | Data Integrity verdicts | PMO + Backend | OPEN |
| GAD-313 | Periods | Provide a period-management admin screen (open/close/roll; mark "current"). | seed-only today | a new week/month needs a script | Frontend lead | OPEN |
| GAD-314 | Schema | Adopt a migration tool (Alembic) — decide and schedule. | adopt Alembic | environment promotion safety | Backend lead | OPEN |
| GAD-315 | DE Assessment | Apply `PendingPoints` — "Alert should be removed; Finding should have Alert". | not yet applied | DE Assessment data model | Delivery Excellence | OPEN |
| GAD-316 | Charter | Confirm the `PendingPoints` field changes (remove Billing Type, remove Engagement Type, add Critical/Product flags + Product combo, add Region, Applicable Phase multi-select, Geo Head defaulted). | partially applied | Charter form + schema | PMO | OPEN |
| GAD-317 | RAIDO | Confirm RAIDO is non-mandatory for approval and moves to a separate "Project Register" section (`PendingPoints` #15). | non-mandatory | DE governance completeness weighting | PMO | OPEN |
| GAD-318 | MFA | MFA scope (every role vs privileged only). | privileged only | login friction vs security | IT security | OPEN |

---

## 7. Risks (`GAD-4xx`)

| GAD | Area | Risk | Severity | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| GAD-400 | Delivery | Large gap between "Built" and "production-ready" (auth, DE/PMO enablement, integrations, actuals UI). | High | Sequence with `product-brain/24`; pilot-gate | PMO | OPEN |
| GAD-401 | Security | `no_password` auth is the default — anyone with an identifier signs in as anyone. | Critical | Do not expose beyond a controlled pilot until OneLogin ships | IT security | OPEN |
| GAD-402 | Schema | No versioned migration chain for Postgres. | High | Adopt Alembic before further schema change (GAD-314) | Backend lead | OPEN |
| GAD-403 | Security | Insecure hardcoded fallback secrets if `.env` absent (`"change-me-*"`). | High | Fail-fast on default secrets in non-local | Backend lead | OPEN |
| GAD-404 | Security | HTTP-only on internal IPs; no TLS enforced. | High | Reverse proxy + TLS in front of all shared environments | IT | OPEN |
| GAD-405 | Security | No rate limiting anywhere, including `/auth/login`. | High | Add rate limiting / lockout | Backend lead | OPEN |
| GAD-406 | Security | Possible IDOR — `documents.py` list/download may be ungated. | High | Verify + gate; run VAPT | Backend lead | OPEN |
| GAD-407 | Security | Executive Update rich text rendered via `dangerouslySetInnerHTML`, sanitisation unverified — stored-XSS. | High | Sanitise server + client | Frontend lead | OPEN |
| GAD-408 | Security | Shared static `X-API-Key` ships in the public JS bundle; no rotation. | Medium | Accept as defence-in-depth; document; rotate on incident | IT security | OPEN |
| GAD-409 | Reliability | Document upload writes the file before the DB row — orphan files on crash. | Medium | Write DB row first / transactional outbox | Backend lead | OPEN |
| GAD-410 | Data | DDL↔ORM drift can pass tests but break Postgres. | Medium | CI schema-diff (GAD-211) | Backend lead | OPEN |
| GAD-411 | Correctness | Advisory business rules (GAD-110) mean the app may permit states the catalogue forbids. | Medium | Code-audit + tests (`product-brain/25`) | Backend lead | OPEN |
| GAD-412 | Supply chain | `xlsx` sourced from a SheetJS CDN tarball, not npm; dependency CVEs unaudited. | Low | Pin + verify; run `pip-audit` / `npm audit` | Backend + Frontend | OPEN |
| GAD-413 | Data | `overall_project_health` etc. are **cached** columns kept in sync by app code, not a trigger — can go stale on a missed write path. | Medium | Verify every write path updates the cache; consider a recompute job | Backend lead | OPEN |

---

## 8. Dependencies (`GAD-5xx`)

| GAD | Area | Dependency | Needed for | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| GAD-500 | Infra | Reverse proxy + TLS certificate in front of shared/prod. | OneLogin; secure transport | IT | OPEN |
| GAD-501 | IdP | OneLogin OIDC app per environment (Client ID/Secret/Issuer, redirect URIs, user/group assignment, email-claim consistency). | real authentication | OneLogin admin | OPEN |
| GAD-502 | Infra | Process manager (NSSM / Task Scheduler) + firewall rules on the app host. | reliable running service | IT | OPEN |
| GAD-503 | Oracle | A live BCT Oracle Application integration (resourcing, PM/employee lookup). | Resource Allocation auto-sync (FR-CHART-3) | Oracle team + Backend | OPEN |
| GAD-504 | M365 / ticketing | Live Microsoft 365 and ticketing-tool integrations. | document/calendar sync; Support metrics feed | IT + Backend | OPEN |
| GAD-505 | QA | Measurement baselines and confirmed formulas (`PendingPoints` #11/#27). | trustworthy KPIs, "Meeting Target %" | QA lead | OPEN |
| GAD-506 | AI | The external vLLM + parsing + Kafka pipeline running and reachable on-prem. | AI-assisted data entry | AI/infra team | OPEN |
| GAD-507 | Data | Seed data for `reporting_periods` (incl. `BASELINE`) and `data_integrity_checklist_items` in every environment. | baseline-context screens; the checklist | Backend + IT | OPEN |

---

## 9. `PendingPoints.txt` triage

`docs/PendingPoints.txt` (~50 lines) is the product owner's running backlog. Triaged:

| Bucket | Items (paraphrased) | Where tracked |
| --- | --- | --- |
| **Decided, likely done** | Executive Update builder; Action Tracker + dashboard; DE Assessment + dashboard; separate dashboards per login; Excel import + image paste; My Summary rename; Project Health dashboard with all registers. | `product-brain/01`, `04`, `08`, `09` |
| **Decided, not yet done** | Oracle ID mandatory to unlock right menu (#1); AI button enabled only if AI data (#2); remove Billing Type (#6) / Engagement Type (#12); add Critical + Product flags (#7); Geo Head defaulted in Delivery Team (#8); all-fields-mandatory on Send for Approval (#9); "After Approval all fields changeable except Project Type" (#13); rename Milestone → Payment Milestone (#14); RAIDO non-mandatory for approval, moved to Project Register (#15); **DE role to be developed; approval comes to DE; DE removed from PM charter; PM→Send, DE→Approve/Reject** (#16–18); Applicable Phase multi-select (#30); Project Status combo on Amend (#31); Alert removed / Finding has Alert; OneLogin; Oracle Projects. | GAD-311, GAD-315, GAD-316, GAD-317, GAD-401, GAD-503 |
| **Decided, needs QA input** | Consulting type + measurement (#10, done); Baseline + Formula in measurement — QA to provide (#11); Measurement calculation to be implemented (#27). | GAD-505, `product-brain/15` |
| **Pending decision** | RAID monthly-review dates; DE cadence; "data as of"; defaulter tracking at all levels (#25); weeks keyed to Monday (#9, likely done). | GAD-303, GAD-305, GAD-306, GAD-214 |

---

## 10. Note on the pack's own `ASSUMPTION:` / `TARGET:` markers

Every `product-brain/*.md` carries an **Assumptions** section with granular
`ASSUMPTION:` / `TARGET:` markers (A-OVW-*, A-MOD-*, A-BR-*, A-SVC-*, A-MET-*, …). The
substantive ones are consolidated above. The remainder are either (a) **ID-authority
notes** (this doc defines the `X-*` IDs — trivial), or (b) **"verify against code"** flags
that a single reconciliation pass (`document-generation-plan.md` §6) should clear. Treat the
per-doc sections as the granular backlog behind this register.
