# 20 — Non-Functional Requirements

**Document type:** Product-Brain Specification
**Product:** ProjectGovernance (working title)
**Status:** Draft — generated 2026-08-30, pending review
**Depends on:** product-brain/13, product-brain/18, product-brain/19
**Feeds:** product-brain/24, product-brain/25

> **Purpose of this document.** The measurable engineering targets. ProjectGovernance has
> **no measured NFR baseline** — every quantitative value below is a `TARGET: … — baseline
> {date}`, a plausible figure to design and test against until the running system is
> baselined and BCT PMO confirms the SLAs. `NFR-<CATEGORY>-<NN>` IDs are defined here.
> NFR-1…7 map to BRS §5.

---

## 1. How to read an NFR

| Field | Meaning |
| --- | --- |
| **NFR ID** | `NFR-<CATEGORY>-<NN>` |
| **Requirement** | The measurable statement |
| **Target** | `TARGET:` assumed value — replace with a baselined / SLA value |
| **Measurement** | How the metric is obtained |
| **Verified by** | The `product-brain/25` activity that proves it |

`TARGET` values with `— baseline {date}` are placeholders. `FIXED` requirements (residency,
retention, desktop-first) are policy, not tunable numbers.

---

## 2. Load model (`ASSUMPTION` — no measured basis)

| Dimension | `TARGET` |
| --- | --- |
| Named users (BCT PMO + delivery + exec chain) | ~500 |
| Peak concurrent active users | ~75 |
| Projects in the portfolio | ~800 |
| Accounts / Geos | ~120 / ~5 |
| Weekly status reports written per week | ~800 |
| Largest dashboard aggregation (Project Health grid, unfiltered) | ~800 project rows × 14 grids |
| API writes/sec (peak) | ~5 |
| API reads/sec (peak) | ~40 |
| Document uploads/day | ~50 |

These drive the numbers in §3. All `— baseline 2026-Q4`.

---

## 3. Requirements by category

### Performance (`NFR-PERF-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-PERF-10 | Interactive API read (single record / small list) responds quickly | `TARGET:` p95 ≤ 500 ms — baseline 2026-Q4 | API access log timing | API-contract perf tests |
| NFR-PERF-20 | Write (create/update a report, RAID item, measurement) | `TARGET:` p95 ≤ 800 ms | as above | as above |
| NFR-PERF-30 | Per-project dashboard (`/dashboard/summary`) | `TARGET:` p95 ≤ 1.5 s | timed load at the load-model volume | perf test with seeded portfolio |
| NFR-PERF-40 | Portfolio Project Health grid (one of 14, filtered) | `TARGET:` p95 ≤ 2.5 s for a page of 50 | `SVC-DASHBOARD-AGGREGATION` timing (`services/dashboard.py` — the heaviest path) | perf test |
| NFR-PERF-50 | Rollup computation (account or geo, one period) | `TARGET:` ≤ 1 s | service timing | golden-fixture + perf test |
| NFR-PERF-60 | First contentful paint of an authenticated page | `TARGET:` ≤ 2 s on the BCT LAN | browser trace | E2E (Playwright) trace |

### Availability (`NFR-AVAIL-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-AVAIL-10 | Service availability during BCT business hours | `TARGET:` ≥ 99.5% (business hours, single-instance) — baseline 2026-Q4 | uptime monitor on the reverse proxy | ops monitoring |
| NFR-AVAIL-20 | Planned maintenance window | `TARGET:` ≤ 2 h/month, outside business hours | change log | ops |
| NFR-AVAIL-30 | No single-user action can take the service down | `FIXED` (design) | error-rate monitor | load / soak test |

### Scalability & Concurrency (`NFR-SCALE-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-SCALE-10 | Concurrent active users without degradation | `TARGET:` 75 (see §2) — baseline 2026-Q4 | load test | perf test |
| NFR-SCALE-20 | Portfolio size the dashboards remain within `NFR-PERF-40` | `TARGET:` 800 projects / 120 accounts | seeded perf test | perf test |
| NFR-SCALE-30 | Code-generation contention (`id_sequences` `FOR UPDATE`) does not serialise unrelated creates | `FIXED` — the lock is per `(entity_code, year)` row | concurrency test | `TS-CONC-*` (`product-brain/25`) |
| NFR-SCALE-40 | Horizontal scale path | `TARGET:` the API tier is stateless (JWT session) and can run behind a load balancer; not yet exercised | design review | — |

### Security (`NFR-SEC-*`) — see `product-brain/19` for the model

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-SEC-10 | Authentication is credential-verified (not identifier-only) | `FIXED` for pilot/prod — `AUTH_TYPE=onelogin` | config audit | release gate |
| NFR-SEC-20 | All traffic over TLS in shared/prod | `TARGET:` TLS 1.2+ at the reverse proxy — baseline at go-live | scan | security test |
| NFR-SEC-30 | Session lifetime | `TARGET:` ≤ 8 h, no sliding renewal (current `SESSION_TTL_MINUTES=480`) | config | security test |
| NFR-SEC-40 | Login rate limiting | `TARGET:` ≤ 5 failed attempts / 5 min / identifier then backoff — **not implemented** | config | security test |
| NFR-SEC-50 | RBAC + Account/Geo scope enforced server-side on every route | `FIXED` (BRS NFR-3) | `test_authorization.py` + route sweep | `product-brain/25` §11 |
| NFR-SEC-60 | MFA | `TARGET:` mandatory for `ADMIN` / `CXO`; configurable elsewhere — **decision open** (BRS §8 Open Item 1) | IdP config | release gate |
| NFR-SEC-70 | Secrets are environment-supplied, no insecure fallback in shared/prod | `FIXED` — remove the `"change-me-*"` defaults for non-local | config audit | release gate |
| NFR-SEC-80 | Stored user content (rich text) is sanitised | `FIXED` — no stored-XSS | security test | VAPT |

### Reliability (`NFR-REL-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-REL-10 | A request either commits fully or not at all | `FIXED` — `get_db()` commit-on-success / rollback-on-exception | transaction test | integration test |
| NFR-REL-20 | Document upload does not leave orphan files on failure | `TARGET:` 0 orphans — **currently a known risk** (file written before the DB row) | fault-injection test | integration test |
| NFR-REL-30 | Rollup / worst-wins / metric formulas are deterministic for a given input | `FIXED` | golden-fixture equality | `product-brain/25` §7 |

### Maintainability (`NFR-MAINT-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-MAINT-10 | Schema changes are applied through a versioned migration tool | `TARGET:` adopt Alembic — **not present today** (`product-brain/11` §7) | repo audit | — |
| NFR-MAINT-20 | DDL scripts and ORM models describe the same schema | `TARGET:` 0 drift — **currently divergent** (tests use `Base.metadata`) | schema diff | CI check |
| NFR-MAINT-30 | Value sets are enforced, not just conventional | `TARGET:` add DB CHECK constraints or keep a single Pydantic enum source with a lint | grep | CI check |
| NFR-MAINT-40 | Test coverage of business rules and workflow transitions | `TARGET:` every `BR-*` and every `product-brain/06` transition has ≥ 1 test | coverage map | `product-brain/26` |

### Observability (`NFR-OBS-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-OBS-10 | Structured application logs with a request/correlation id | `TARGET:` JSON logs, 100% of requests — **not implemented** | log sample | ops |
| NFR-OBS-20 | Business audit covers every consequential action | `TARGET:` 100% of approvals/rejections/health changes/admin changes — **partial today** (BRS FR-AUTH-4) | audit-coverage map | `product-brain/25` |
| NFR-OBS-30 | Basic service metrics (latency, error rate, throughput) | `TARGET:` scraped and dashboarded — **not implemented** | metrics endpoint | ops |
| NFR-OBS-40 | Per-dashboard-tile "data as of" freshness indicator | `TARGET:` shown on every tile — **proposed, not built** (BRS §8 Open Item 6) | UI check | E2E |

### Browser support & Accessibility (`NFR-BROWSER-*`, `NFR-A11Y-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-BROWSER-10 | Supported browsers | `TARGET:` current + previous major of Chrome and Edge (BCT standard); Firefox best-effort | manual matrix | E2E on the matrix |
| NFR-BROWSER-20 | Primary form factor | `FIXED` — desktop, data-entry-heavy (BRS NFR-6); tablet/mobile "should work", not a design target | responsive check | manual |
| NFR-A11Y-10 | Accessibility baseline | `TARGET:` WCAG 2.1 AA for keyboard nav, labels, and non-colour-alone status meaning (RAG has text + colour) | axe scan + manual | `product-brain/21` §13 |

### Backup / Recovery (`NFR-BR-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-BR-10 | Database backup cadence | `TARGET:` daily full + WAL/PITR — baseline at go-live; the in-app trigger is logged only and unverified | ops runbook | restore drill |
| NFR-BR-20 | Recovery Point Objective | `TARGET:` ≤ 24 h (daily) or ≤ 15 min (with PITR) | restore drill | ops |
| NFR-BR-30 | Recovery Time Objective | `TARGET:` ≤ 4 h | restore drill | ops |
| NFR-BR-40 | Document/image files are backed up alongside the DB | `TARGET:` same schedule — **local FS, no object storage** (`product-brain/18` §5) | ops runbook | restore drill |

### Data Retention & Residency (`NFR-RET-*`, `NFR-RES-*`)

| ID | Requirement | Target | Measurement | Verified by |
| --- | --- | --- | --- | --- |
| NFR-RET-10 | Historical records are retained, never overwritten | `FIXED` (BRS NFR-5) — status reports, health declarations, DE assessments, review dates accumulate | schema review (dated rows, no in-place overwrite) | data-model test |
| NFR-RET-20 | Retention / archival / purge policy | `TARGET:` **to be defined** — none exists in code or DDL (`product-brain/10` A-ENT-002) | policy doc | — |
| NFR-RES-10 | On-premises hosting only | `FIXED` (BRS NFR-1) — no public cloud | deployment audit | release gate |
| NFR-RES-20 | No project / RAID / contractual data leaves the BCT network | `FIXED` (BRS NFR-2) — OneLogin exchanges auth assertions only; AI is a local vLLM | data-flow review | release gate |
| NFR-RES-30 | Every screen and record is scoped by role and Account/Geo; no out-of-scope data by default | `FIXED` (BRS NFR-3) | route sweep | `product-brain/25` §11 |

---

## 4. Summary of unbaselined / not-yet-met items (→ `product-brain/23` / `24`)

- **Nothing is baselined** — all `TARGET:` values await a run against a seeded portfolio.
- **Not implemented:** login rate limiting (NFR-SEC-40), structured logging (NFR-OBS-10),
  service metrics (NFR-OBS-30), "data as of" indicator (NFR-OBS-40), migration tool
  (NFR-MAINT-10), object storage / file backup (NFR-BR-40), retention policy (NFR-RET-20).
- **Known risk today:** orphan files on upload failure (NFR-REL-20); DDL↔ORM drift
  (NFR-MAINT-20); TLS not enforced (NFR-SEC-20).

---

## 5. Assumptions

| ID | Assumption |
| --- | --- |
| A-NFR-001 | `ASSUMPTION:` The load model (§2) is invented — real user/project counts must come from BCT PMO. |
| A-NFR-002 | `ASSUMPTION:` Every performance number is a design target with no measured basis; a perf test against a seeded portfolio is the first step (`product-brain/25`). |
| A-NFR-003 | `ASSUMPTION:` Browser matrix (Chrome/Edge current+previous) reflects a typical BCT SOE; confirm with IT. |
| A-NFR-004 | `ASSUMPTION:` `NFR-SEC-*` numeric targets align with the risks in `product-brain/19`; the pilot gate in `product-brain/24` enforces the `FIXED` ones. |
