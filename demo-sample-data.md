# Project Governance — Demo Sample Data

Fictional data for a management walkthrough. Covers three project types (Development, Support, Professional Staffing) under one Account and Geo, with a RAIDO register per project and Delivery Status Reporting rolled up from Project → Account → Geo, matching the app's actual reporting hierarchy.

**Reporting period:** August 2026 (Aug 1 – Aug 31, 2026), status **Approved**
**Geo:** North America | **Account:** Northbridge Financial Services

---

## Project 1 — Development
**"Customer Onboarding Portal Revamp"**

| Field | Value |
|---|---|
| Project Type | Development |
| Engagement Type | Implementation |
| Project Manager | Meera Krishnan |
| Delivery Excellence (DE) | Arjun Nair |
| Start Date | 2026-03-02 |
| Planned End Date | 2027-01-15 |
| Onsite / Offshore FTE | 2.0 / 8.5 |

### RAIDO Register

| Type | Code | Title | Owner | Priority/Severity | Status | Target Date | Summary |
|---|---|---|---|---|---|---|---|
| Risk | RISK-2026-014 | Third-party KYC API may not scale for peak onboarding volumes | Arjun Nair | High / High | Mitigating | 2026-10-15 | Load tests show the vendor's sandbox throttles at 40 req/s, below projected peak of 65 req/s. Mitigation: negotiate a dedicated rate-limit tier with the vendor; contingency is an async queue-and-retry pattern. |
| Assumption | ASM-2026-009 | Client will provide finalized UI brand guidelines by Sprint 6 | Meera Krishnan | Impact: Medium | Validated | 2026-08-20 | Assumed at kickoff to keep the design system on schedule; client legal signed off on the brand kit on 2026-08-18. |
| Issue | ISSUE-2026-021 | Document upload service intermittently drops files > 8MB | Priya Subramaniam | High | In Progress | 2026-09-25 | Root cause traced to a proxy timeout on the ingestion gateway; fix is a chunked-upload rework, currently in code review. |
| Dependency | DEP-2026-011 | SSO integration blocked on client's Azure AD tenant config | Meera Krishnan | Critical | Open | 2026-09-30 | Client's IT team must whitelist the app registration before UAT can start; escalated to client PMO on 2026-09-10. |
| Opportunity | OPP-2026-005 | Reusable document-upload component could be productized for two other accounts | Arjun Nair | Benefit: Medium | Under Evaluation | 2026-11-01 | Component built for this engagement has no client-specific logic; estimated 3-week reuse effort saves ~6 weeks on two upcoming builds. |

### Project Status Reporting — August 2026
**Key metrics:** Revenue $186,000 | Onsite FTE 2.0 | Offshore FTE 8.5 | Open Alerts: 1

- **Key Accomplishments**
  - Completed UAT sign-off for the applicant dashboard and document-upload modules.
  - Brand-compliant UI kit finalized and adopted across all in-flight sprints.
  - Reduced average page load time from 3.1s to 1.4s after the CDN migration.
- **Upcoming Key Releases / Milestones / Actions**
  - SIT for the KYC integration module — target 2026-09-28.
  - Sprint 9 demo to client steering committee — 2026-10-02.
  - Performance re-test of the KYC API once vendor rate-limit tier is confirmed.
- **Leadership Support / Attention Required**
  - Need Account Head to escalate the Azure AD tenant blocker (DEP-2026-011) — client PMO has been unresponsive for 5 business days.
- **Key Risks / Issues**
  - KYC API scaling risk (RISK-2026-014) could push go-live by 2–3 weeks if unresolved by mid-October.
  - Large-file upload defect (ISSUE-2026-021) is affecting 4% of onboarding attempts in the current pilot cohort.

---

## Project 2 — Support
**"Core Banking Application Support (L2/L3)"**

| Field | Value |
|---|---|
| Project Type | Support |
| Engagement Type | Support |
| Project Manager | Rohit Malhotra |
| Delivery Excellence (DE) | Arjun Nair |
| Start Date | 2024-04-01 |
| Planned End Date | Ongoing (annual renewal) |
| Onsite / Offshore FTE | 1.0 / 6.0 |

### RAIDO Register

| Type | Code | Title | Owner | Priority/Severity | Status | Target Date | Summary |
|---|---|---|---|---|---|---|---|
| Risk | RISK-2026-016 | Key SME attrition risk on the core ledger module | Rohit Malhotra | Medium / High | Monitoring | 2026-12-01 | Only one engineer holds deep knowledge of the legacy COBOL settlement batch; mitigation is a knowledge-transfer plan and shadow rotation starting September. |
| Assumption | ASM-2026-012 | Client's DR environment refresh schedule stays quarterly | Rohit Malhotra | Impact: Low | Validated | 2026-07-01 | Confirmed with client infra team during the Q3 governance call. |
| Issue | ISSUE-2026-024 | Recurring P2 incidents on nightly batch reconciliation | Sandeep Rao | Medium | In Progress | 2026-09-22 | 3 recurrences in August tied to a stale currency-rate cache; permanent fix scheduled for the September patch window. |
| Dependency | DEP-2026-013 | Patch deployment depends on client's change-freeze calendar | Rohit Malhotra | Medium | Open | 2026-10-05 | Client enforces a change freeze in the last week of each quarter; September patch must land before 2026-09-24. |
| Opportunity | OPP-2026-007 | Automate the manual EOD reconciliation checklist | Sandeep Rao | Benefit: High | Proposed | 2026-11-15 | Scripting the 12-step manual checklist could cut nightly ops effort by ~2 hours/day; business case being drafted for client approval. |

### Project Status Reporting — August 2026
**Key metrics:** Revenue $94,500 | Onsite FTE 1.0 | Offshore FTE 6.0 | Open Alerts: 1

- **Key Accomplishments**
  - SLA adherence held at 99.2% for the fourth consecutive month.
  - Closed 47 of 51 tickets raised in August within SLA; zero P1 incidents.
  - Delivered the Q3 knowledge-transfer session for the ledger module to two backup engineers.
- **Upcoming Key Releases / Milestones / Actions**
  - September patch window (currency-rate cache fix) — target 2026-09-20, before the client's change freeze.
  - Kick off automation business case for EOD reconciliation (OPP-2026-007).
- **Leadership Support / Attention Required**
  - Requesting Account Head support to formally propose the reconciliation-automation opportunity to the client sponsor.
- **Key Risks / Issues**
  - SME attrition risk (RISK-2026-016) remains open; KT plan in motion but coverage is still single-threaded.
  - Batch reconciliation issue (ISSUE-2026-024) has recurred three times — needs to close out before quarter-end freeze.

---

## Project 3 — Professional Staffing
**"Data Engineering Staff Augmentation"**

| Field | Value |
|---|---|
| Project Type | Professional Staffing |
| Engagement Type | Staff Augmentation |
| Project Manager | Kavya Iyer |
| Delivery Excellence (DE) | Arjun Nair |
| Start Date | 2025-11-01 |
| Planned End Date | 2027-03-31 |
| Onsite / Offshore FTE | 0 / 5.0 |

### RAIDO Register

| Type | Code | Title | Owner | Priority/Severity | Status | Target Date | Summary |
|---|---|---|---|---|---|---|---|
| Risk | RISK-2026-018 | Backfill risk if client extends the engagement beyond March 2027 | Kavya Iyer | Medium / Medium | Monitoring | 2027-01-15 | Two of five staffed engineers have competing offers; mitigation is a retention conversation ahead of the renewal decision. |
| Assumption | ASM-2026-015 | Client continues to provide sandbox Snowflake access for all staffed engineers | Kavya Iyer | Impact: Medium | Validated | 2026-08-05 | Confirmed in the monthly staffing governance call; access renewed through Q4 2026. |
| Issue | ISSUE-2026-027 | One staffed resource under-performing against client's expectations | Kavya Iyer | Medium | In Progress | 2026-09-18 | Client raised concerns in the August review; performance improvement plan agreed with the resource and client manager. |
| Dependency | DEP-2026-016 | Additional headcount request depends on client's FY27 budget approval | Kavya Iyer | Medium | Open | 2026-10-30 | Client has requested 2 additional data engineers pending internal budget sign-off, expected end of October. |
| Opportunity | OPP-2026-009 | Convert staffing engagement into a managed data-platform pod | Arjun Nair | Benefit: High | Under Evaluation | 2026-12-01 | Client has hinted at consolidating staffing into an outcome-based pod model; potential to grow account revenue ~30%. |

### Project Status Reporting — August 2026
**Key metrics:** Revenue $61,200 | Onsite FTE 0 | Offshore FTE 5.0 | Open Alerts: 0

- **Key Accomplishments**
  - All 5 staffed positions remained fully billed through August with zero unplanned bench days.
  - Client extended one engineer's assignment by 6 months based on strong Q2 performance reviews.
  - Completed the annual staffing governance review with no compliance findings.
- **Upcoming Key Releases / Milestones / Actions**
  - Close out the performance improvement plan for the flagged resource (ISSUE-2026-027) — checkpoint 2026-09-18.
  - Present the managed-pod proposal (OPP-2026-009) to the client sponsor in October.
- **Leadership Support / Attention Required**
  - None this period.
- **Key Risks / Issues**
  - Retention risk on two engineers (RISK-2026-018) could affect delivery continuity if the client renews for FY27.
  - Headcount expansion (DEP-2026-016) is pending client budget approval — may slip the planned October ramp-up.

---

## Account-Level Delivery Status Reporting
**Account:** Northbridge Financial Services | **Geo:** North America | **Period:** August 2026 | **Status:** Approved

**Key metrics (rolled up across 3 projects):** Revenue $341,700 | Onsite FTE 3.0 | Offshore FTE 19.5 | Projects: 3 | Open Alerts: 2

- **Key Accomplishments**
  - Portfolio-wide SLA/UAT health remained green; no P1 incidents across any engagement in August.
  - Onboarding Portal (Development) cleared UAT; Core Banking Support (Support) held 99.2% SLA for the 4th straight month.
  - Staffing pod fully billed with zero bench days, reinforcing the case for the proposed managed-pod expansion.
- **Upcoming Key Releases / Milestones / Actions**
  - KYC SIT and client steering demo (Development) — late Sept / early Oct.
  - September patch window ahead of client's quarterly change freeze (Support) — by 2026-09-24.
  - Managed-pod proposal walkthrough with client sponsor (Staffing) — October.
- **Leadership Support / Attention Required**
  - Escalate the stalled Azure AD tenant dependency blocking Onboarding Portal UAT — client PMO unresponsive 5+ business days.
  - Sponsor-level backing requested to pitch the reconciliation-automation and managed-pod opportunities as a combined account growth story.
- **Key Risks / Issues**
  - Two open Alerts on the account: KYC API scaling risk (Development) and SME attrition risk (Support).
  - Aggregate delivery risk is Medium — concentrated in one blocked dependency and one single-threaded skill risk, both being actively mitigated.

---

## Geo-Level Delivery Status Reporting
**Geo:** North America | **Period:** August 2026 | **Status:** Approved

**Key metrics (rolled up across all accounts in Geo, shown here for Northbridge's contribution):** Revenue $341,700 | Onsite FTE 3.0 | Offshore FTE 19.5 | Projects: 3 | Open Alerts: 2

- **Key Accomplishments**
  - Northbridge account delivered a clean month across all three engagement types with no SLA breaches.
  - Two productization opportunities identified this month (reusable upload component, EOD reconciliation automation) — candidates for cross-account reuse playbooks.
  - Staff augmentation retention held steady despite competing external offers on two resources.
- **Upcoming Key Releases / Milestones / Actions**
  - Track Northbridge's September patch window against the region's change-freeze calendar.
  - Review the managed-pod conversion proposal at the next Geo governance sync.
- **Leadership Support / Attention Required**
  - Geo Head visibility requested on the Azure AD escalation — pattern of slow client IT response has appeared on two other Geo accounts this quarter.
- **Key Risks / Issues**
  - No Critical or region-wide risks this period; residual risk is contained at the account level (2 open Alerts, both actively mitigated).
