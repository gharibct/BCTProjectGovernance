# 25 — Test & Regression Strategy

**Document type:** Product-Brain Specification
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/05, product-brain/06, product-brain/13, product-brain/15, product-brain/17, product-brain/20, product-brain/24
**Feeds:** product-brain/26

> **Purpose of this document.** How ProjectGovernance is verified and how regressions are
> prevented. There are no reused stored procedures to golden-master (the sample pack's
> centrepiece); the equivalent here is **golden-fixture regression of the pure domain
> services** — worst-wins health, period metric sums, pull/ignore/undo,
> `compute_overall_project_health`, and every `measurement_metrics` formula. `TS-<AREA>-<NN>`
> IDs are defined here and threaded into `product-brain/26`.

---

## 1. Objectives & the "no unintended change" principle

| Objective | How met |
| --- | --- |
| The **aggregation math is stable** | Golden-fixture tests capture the current output of `SVC-HEALTH-ROLLUP`, `SVC-*-ROLLUP`, and `SVC-MEASUREMENT-METRICS` for a representative input corpus; a diff on re-run is a failure until a human classifies it as intended (§7). |
| Rules and workflows still fire | Business-rule (`BR-*`) and workflow/status (`product-brain/06`) regression suites (§5–6). |
| The API enforces authz on every route | RBAC contract tests keyed to `product-brain/07`, anchored on `test_authorization.py` (§11). |
| New capability works | Functional / API / E2E / integration tests on the new layers (§3–4, §10). |
| The business accepts it | UAT per role, per module (§12). |
| It stays correct over time | The whole suite is CI-gated and re-run every build; a diff is a failure until explained. |

**Principle:** *a change in a rollup / metric output between builds is a defect until a
human records it as intended.* Silence is not acceptance.

---

## 2. Test pyramid & ownership

```
                    ┌──────────────┐
                    │     UAT      │  business users, per role + per module gate
                    ├──────────────┤
                    │  E2E / UI    │  Playwright — key journeys, status×role gates, a11y
                    ├──────────────┤
                    │ API contract │  every endpoint × role × status; error-code mapping
                    │  + workflow  │  every 06 transition; every BR-*
                    ├──────────────┤
                    │  service     │  golden-fixture: worst-wins, rollup sums, pull/ignore,
                    │  regression  │  metric formulas, governance completeness
                    ├──────────────┤
                    │    unit      │  helpers, schema validation, code generator
                    └──────────────┘
```

| Layer | Framework | Owner |
| --- | --- | --- |
| Unit / service / API | `pytest` + `pytest-asyncio` (`backend/tests/`, ASGI transport in `conftest.py`; SQLite) | Backend |
| E2E / UI | Playwright (`frontend`, `test:e2e`) | Frontend + QA |
| Security / RBAC | `pytest` (`test_authorization.py`) + VAPT (`vapt-prompt.txt`) | Backend + Security |
| UAT | manual, scripted | PMO + role SMEs |

### 2.1 Existing `backend/tests/` inventory → area

| Test module | Area | `TS-*` area |
| --- | --- | --- |
| `test_authorization.py` | `require_*` scope factories — **the RBAC anchor** | TS-RBAC |
| `test_projects.py`, `test_project_activity.py` | Charter, `touch_project_on_write` | TS-PROJ |
| `test_project_status.py` | status report + items + review | TS-STATUS |
| `test_raid.py` | 5 registers | TS-RAID |
| `test_health.py`, `test_health_declarations.py` | health decl + items + worst-wins | TS-HEALTH |
| `test_measurement.py`, `test_metric_target.py` | measurement + targets | TS-MEAS |
| `test_contractual.py` | commitments/milestones + actuals | TS-CONTRACT |
| `test_de_assessment.py`, `test_de_allocation.py`, `test_de_approval.py`, `test_governance_completeness.py` | DE modules | TS-DEA / TS-DEAP |
| `test_rollups.py` | project→account→geo rollup | TS-ROLLUP |
| `test_work_context.py` | act-as gating | TS-RBAC |
| `test_actions.py` | Action Tracker lifecycle | TS-ACTION |
| `test_data_integrity.py` | freshness rollup | TS-DI |
| `test_ai_suggestions.py` | field + row suggestions | TS-AI |
| `test_executive_updates.py` | exec update builder | TS-EXEC |
| `test_dashboard.py` | dashboard aggregation | TS-DASH |
| `test_reference_data.py`, `test_users.py`, `test_integrations.py`, `test_audit.py` | platform | TS-REF / TS-USER / TS-INTG / TS-AUDIT |
| `test_master_data_import.py`, `test_master_data_template.py` | Excel CLI | TS-REF |

The suite is broad; the gaps are **coverage depth** (every `BR-*`, every transition) and
**golden fixtures** (§7).

---

## 3. Functional testing

Per module, exercise every `FC-*` capability (`product-brain/04`) through its API and UI:
create / read / update / delete, the happy path of `product-brain/02`'s processes, and the
alternate flows. `TS-<MOD>-<NN>` per capability. Owner: Backend (API), QA (UI).

---

## 4. API contract testing (endpoint × role × status)

For every `API-*` (`product-brain/17`):

- **Shape:** request/response schema, status codes, the `{detail}` error shape,
  pagination envelope.
- **Role matrix:** call as each of the 8 roles (+ act-as contexts) → expect `200` or `403`
  per `product-brain/07`. `TS-RBAC-*`.
- **Status preconditions:** call in each entity status → expect success or `400`/`409`
  per `product-brain/06` (e.g. review a `Draft` report → `400`; pull a non-`Pending` item
  → `409`). `TS-WF-*`.
- **Scope:** call in-scope vs out-of-scope account/geo → `200` vs `403`. `TS-RBAC-*`.

---

## 5. Workflow / status regression

One test per transition row in `product-brain/06` §2–19: from-state + action + actor →
to-state, plus the illegal transitions (rejected). `TS-WF-<ENTITY>-<NN>`. Anchors:

| Anchor | Assertion |
| --- | --- |
| TS-WF-PROJ-10 | `Pending Approval` + DE `Approve` → `Approved` **and** `de_review_status = Approved`; `Draft` cannot skip to `Approved` by any route |
| TS-WF-STATUS-10 | `Submitted` → review; `Draft` → review = `400` |
| TS-WF-DEAP-10 | first per-module verdict moves `de_review_status` null → `In Review` |
| TS-WF-ACTION-10 | `close` only from `COMPLETED`; `cancel` only from `OPEN`/`IN_PROGRESS`; assignee can always transition |
| TS-WF-ROLLUP-10 | `Pending` → `Pulled` creates the parent item; Undo deletes it |

---

## 6. Business-rule regression (keyed to `BR-*`)

Every `BR-*` in `product-brain/05` gets ≥ 1 test tagged with its ID. Priority: all
`Blocking` and `High` rules first. Anchors:

| `TS-BR-*` | Rule | Assertion |
| --- | --- | --- |
| TS-BR-HEALTH-10 | BR-HEALTH-010 | one `Red` category ⇒ project overall `Red` |
| TS-BR-ROLLUP-10 | BR-ROLLUP-010 | second Pull of a `Pulled` item → `409` |
| TS-BR-REVIEW-10 | BR-REVIEW-020 | the project's PM gets `403` reviewing that project's report |
| TS-BR-PROJ-10 | BR-PROJ-060 | `Draft` → `Pending Approval` only when sent |
| TS-BR-DEA-10 | BR-DEA-020 | health ≠ Green with no alert → nudge / block *(currently Advisory — test asserts current behaviour + is marked `xfail` for the target)* |
| TS-BR-AI-10 | BR-AI-010 | applying a suggestion writes nothing to a business table until the user saves/creates |
| TS-BR-SEC-10 | BR-SEC-020 | request with no / invalid `pg_session` → `401` |

**Advisory rules** (`product-brain/05` §26) get a test that asserts *today's* behaviour plus
an `xfail`/`skip` marked with the `GAD` id, so the day the rule is enforced the test flips.

---

## 7. Rollup & aggregation regression (golden fixtures) — the centrepiece

The pure / near-pure services are deterministic per input:

| Service | Fixture approach | `TS-*` |
| --- | --- | --- |
| `SVC-HEALTH-ROLLUP` (`compute_overall_rating`, `compute_overall_project_health`) | a table of `(inputs → expected)` rows covering every ordering, empty input, all-`None` | TS-ROLLUP-GM-10 |
| `SVC-ACCOUNT-ROLLUP` / `SVC-GEO-ROLLUP` (`_sum`, `compute_*_rollup`) | seed a canned account/geo with N child reports (some with `None` metrics) for a period → assert the summed `metrics` and the `items` list | TS-ROLLUP-GM-20 |
| `pull_rollup_item` / `pull_health_rollup_item` | seed a `Pending` item → Pull → assert parent created + source `Pulled` + link; Pull again → `RollupItemAlreadyHandledError`; Undo → parent gone, source `Pending` | TS-ROLLUP-GM-30 |
| `SVC-GOVERNANCE-COMPLETENESS` | seed projects at each completeness level → assert `completion_pct` (over the 4 mandatory) and `gaps_count` (over all 6) | TS-DEAP-GM-10 |
| `SVC-MEASUREMENT-METRICS` (all 7 `compute_*`) | one fixture row per type with a full input dict and the expected metric dict, **plus** a row with missing inputs asserting `None` (not `0`) | TS-MEAS-GM-* (§8) |
| `SVC-DATA-INTEGRITY-ROLLUP` (`_is_updated`, `is_critical_gap`) | `(last_updated, cadence) → expected` table once the windows are ratified (GAD-312) | TS-DI-GM-10 |

**Rule:** the expected values are checked in as a **golden file**; regenerating it requires
a reviewer's sign-off. A diff on CI is a red build.

---

## 8. Measurement-formula tests

For each of the 7 types (`product-brain/15`), a `TS-MEAS-<TYPE>-<NN>` per computed metric:

- a "full inputs" case asserting the exact formula result (e.g. `effort_variation_pct =
  (actual − planned)/planned × 100`);
- a "missing denominator / zero" case asserting `None`;
- the permanently-`None` metrics (Dev CPI, Support SLA compliance, …) asserted `None` and
  tagged `GAD-209`;
- the Staffing trailing-average (`TS-MEAS-STF-30`) with < 4 and ≥ 4 prior periods.

---

## 9. AI apply / ignore tests

`TS-AI-*`: a field suggestion applied then the form saved → `resolved` + the value in the
business row (written by the save, not the AI); a row suggestion applied → a real RAID row
via the normal create endpoint + suggestion `applied` + `matched_entity_id`; ignore →
`ignored`; edit an AI value → indicator gone; document `Not Processed → Processing →
Processed`.

---

## 10. E2E (Playwright) key journeys

`TS-E2E-*`, one per `product-brain/02` process, run as the relevant role:

1. Onboard → charter → send for approval → DE approve → `Approved` (BP-01).
2. Weekly status: create → items → submit → Account Manager approve (BP-02 + BP-05).
3. Monthly review: measurement + contractual + RAIDO (BP-03).
4. DE monthly assessment + alert-when-not-Green (BP-04).
5. Rollup: PM item → AM pull → AM submit → GH approve → GH submit → CXO approve (BP-05).
6. Worst-wins visible end to end: a `Red` project turns its account and geo `Red` (BP-06).
7. Executive Update: build + paste image + paste Excel range (BP-07).
8. Action lifecycle by the assignee (BP-08).
9. AI-assisted charter fill: upload → process → apply → save (BP-10).

Plus status×role×permission UI gates (an action disabled with a reason for the wrong
role/status) and an `axe` accessibility pass per screen family.

Absorb `docs/e2e-test-flow.csv` — its rows become concrete `TS-E2E-*` scenarios.

---

## 11. Security / RBAC tests

- `test_authorization.py` extended to cover **every** `require_*` factory × every role ×
  in/out of scope, and **every route** declares one (the `a6c607e` sweep, GAD-202).
- `TS-SEC-*`: no-session → `401`; wrong `X-API-Key` → `401`; `documents.py` list/download
  cross-project access (GAD-406); Executive Update XSS payload round-trip (GAD-407);
  login has rate limiting (GAD-405, currently `xfail`); default-secret start-up refusal
  (GAD-403, `xfail`).
- A scheduled VAPT per `vapt-prompt.txt` — its findings feed `product-brain/23` §7.

---

## 12. UAT per role

Scripted UAT scenarios per role (`PROJECT_MANAGER`, `ACCOUNT_MANAGER`, `GEO_HEAD`, `CXO`,
`DELIVERY_EXCELLENCE`, `PMO`, `TEAM_MEMBER`, `ADMIN`) covering that role's screens and
actions from `product-brain/07` / `08`, run on seeded multi-account/multi-geo data. Sign-off
is a pilot-gate input (`product-brain/24` §3).

---

## 13. Per-module gates

A module is "green" for release when **all** of:

1. every `BR-<MOD>-*` (`product-brain/05`) has a passing test;
2. every `product-brain/06` transition for the module's entities has a passing test;
3. every `API-<MOD>-*` passes the contract matrix (§4);
4. its golden fixtures (if any) match;
5. its E2E journey passes;
6. UAT sign-off for the module.

`product-brain/24` W-workstreams reference these gates.

---

## 14. Coverage rule (feeds `product-brain/26`)

Every `BR-*`, every `product-brain/06` transition, every `SCR-*` action, every `API-*`
endpoint, and every `NFR-*` must appear in **at least one** `TS-*` in the traceability
matrix (`product-brain/26`). A blank is a coverage defect; CI should fail on an untested
`BR-*` or an unmapped `API-*` once the matrix is generated.

---

## 15. Assumptions

| ID | Assumption |
| --- | --- |
| A-TS-001 | `ASSUMPTION:` `TS-*` IDs are defined here; `product-brain/26` threads them across the layers. |
| A-TS-002 | `ASSUMPTION:` The existing `backend/tests/` modules test happy paths and some edges; a coverage audit against `05`/`06` is needed to size the gap. |
| A-TS-003 | `ASSUMPTION:` `conftest.py` runs the suite on SQLite; golden fixtures for the rollup services must also run against Postgres in CI to catch dialect differences (`product-brain/11` §7). |
| A-TS-004 | `ASSUMPTION:` `docs/e2e-test-flow.csv` contains reusable scenarios; it was not parsed row-by-row for this pack. |
| A-TS-005 | `ASSUMPTION:` Performance tests (`product-brain/20` `NFR-PERF-*`) run against a seeded ~800-project portfolio; no such fixture exists yet. |
