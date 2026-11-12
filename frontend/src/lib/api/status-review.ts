import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { RoleCode } from "@/lib/api/auth";

import {
  useReviewStatusReport,
  useRevokeStatusReport,
  useStatusItems,
  useStatusReports,
  type ProjectStatusCategory,
  type ProjectStatusReport,
  type StatusReportReviewPayload,
} from "./project-status";
import {
  useRegionalStatusItems,
  useRegionalStatusReports,
  useReviewRegionalStatusReport,
  useRevokeAccountStatusReport,
  type RegionalScope,
  type RegionalStatusReport,
} from "./regional-status";
import { useHealthDeclarations, useHealthItems, type HealthCategory, type HealthDeclaration } from "./health-declarations";
import {
  useAccountHealthDeclarations,
  useAccountHealthItems,
  type AccountHealthDeclaration,
} from "./account-health-declarations";
import { useGeoHealthDeclarations, type GeoHealthDeclaration } from "./geo-health-declarations";

// Status Review (Project Review / Account Review / Geo Review): the single
// seam between the 3 underlying data-hook sets (project-status.ts,
// regional-status.ts x2, and the 3 health-declaration modules) so every
// status-review UI component reads/writes through one scope-agnostic API
// instead of branching on `scope` itself.

export type ReviewScope = "project" | "account" | "geo";

export type ReviewStatusReport = ProjectStatusReport | RegionalStatusReport;
export type ReviewHealthDeclaration = HealthDeclaration | AccountHealthDeclaration | GeoHealthDeclaration;

// Which role reviews which scope — Account Heads review projects, Geo Heads
// review accounts, CXO reviews geos (see frontend/src/lib/menu-config.ts).
export const REVIEWER_ROLE_BY_SCOPE: Record<ReviewScope, RoleCode> = {
  project: "ACCOUNT_MANAGER",
  account: "GEO_HEAD",
  geo: "CXO",
};

function regionalScope(scope: ReviewScope): RegionalScope {
  return scope === "geo" ? "geo" : "account";
}

// React Query hooks must be called unconditionally — every underlying hook
// below is called on every render, with the inactive scope's id passed as
// null so its query stays disabled, and only the active scope's result is
// returned.

export function useReviewStatusReports(scope: ReviewScope, scopeId: string | null) {
  const project = useStatusReports(scope === "project" ? scopeId : null);
  const regional = useRegionalStatusReports(regionalScope(scope), scope === "project" ? null : scopeId);
  return scope === "project" ? project : regional;
}

export function useReviewStatusItems(
  scope: ReviewScope,
  scopeId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  const project = useStatusItems(scope === "project" ? scopeId : null, periodId, category);
  const regional = useRegionalStatusItems(
    regionalScope(scope),
    scope === "project" ? null : scopeId,
    periodId,
    category
  );
  return scope === "project" ? project : regional;
}

// RAG Status notes for a category (see project-charter/health-items-tab.tsx
// / account-reporting/health-items-tab.tsx) — no Geo variant exists (no
// geo_health_items table), so "geo" scope stays disabled/empty, same as
// account-rollup.ts's Account -> Geo case not applying to RAG Status.
export function useReviewHealthItems(
  scope: ReviewScope,
  scopeId: string | null,
  periodId: string | null,
  category: HealthCategory
) {
  const project = useHealthItems(scope === "project" ? scopeId : null, periodId, category);
  const account = useAccountHealthItems(scope === "account" ? scopeId : null, periodId, category);
  return scope === "project" ? project : account;
}

export function useReviewHealthDeclaration(scope: ReviewScope, scopeId: string | null, periodId: string | null) {
  const project = useHealthDeclarations(scope === "project" ? scopeId : null);
  const account = useAccountHealthDeclarations(scope === "account" ? scopeId : null);
  const geo = useGeoHealthDeclarations(scope === "geo" ? scopeId : null);
  const query = scope === "project" ? project : scope === "account" ? account : geo;
  const declaration = query.data?.find((d) => d.period_id === periodId);
  return { ...query, data: declaration };
}

export function useReviewStatusReportMutation(scope: ReviewScope, scopeId: string | null) {
  const project = useReviewStatusReport(scope === "project" ? scopeId : null);
  const regional = useReviewRegionalStatusReport(regionalScope(scope), scope === "project" ? null : scopeId);
  return scope === "project" ? project : regional;
}

// Revoke an Approved report back to Draft (project: Delivery Manager / Geo Head; account: Geo Head).
export function useRevokeApprovalMutation(scope: ReviewScope, scopeId: string | null) {
  const project = useRevokeStatusReport(scope === "project" ? scopeId : null);
  const account = useRevokeAccountStatusReport(scope === "account" ? scopeId : null);
  return scope === "project" ? project : account;
}

export type { StatusReportReviewPayload };

// Append-only audit trail of a report's submit / recall / review / baseline
// events (backend: services/status_report_history.py).
export type StatusReportHistoryEntry = {
  id: string;
  event_type: "Submitted" | "Recalled" | "Revoked" | "Approved" | "Rejected" | "Baselined";
  from_status: string | null;
  to_status: string;
  comment: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
};

const HISTORY_PREFIX: Record<ReviewScope, string> = { project: "projects", account: "accounts", geo: "geos" };

export function useStatusReportHistory(
  scope: ReviewScope,
  scopeId: string | null,
  reportId: string | null,
  // Any value that changes when the report changes (status / updated_at), so the
  // trail refetches after a submit, recall or review.
  version?: string
) {
  return useQuery({
    queryKey: ["status-report-history", scope, scopeId, reportId, version],
    queryFn: () =>
      api.get<StatusReportHistoryEntry[]>(
        `/${HISTORY_PREFIX[scope]}/${scopeId}/status-reports/${reportId}/history`
      ),
    enabled: !!scopeId && !!reportId,
  });
}
