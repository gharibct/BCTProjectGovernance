import type { RoleCode } from "@/lib/api/auth";

import {
  useReviewStatusReport,
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
  type RegionalScope,
  type RegionalStatusReport,
} from "./regional-status";
import { useHealthDeclarations, type HealthDeclaration } from "./health-declarations";
import { useAccountHealthDeclarations, type AccountHealthDeclaration } from "./account-health-declarations";
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

export type { StatusReportReviewPayload };
