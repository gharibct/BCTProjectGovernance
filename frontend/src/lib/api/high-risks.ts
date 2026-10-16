import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthMatrixRow } from "./dashboard";

// High Risks (CXO / Geo Head) — GET /dashboard/high-risks. Accounts that are not
// Green for a Weekly period, plus accounts that have not filed a report.

export type HighRiskStatus = "Red" | "Potential Red" | "Amber" | "Green" | "Not Submitted";

export const HIGH_RISK_STATUSES: HighRiskStatus[] = ["Red", "Potential Red", "Amber", "Not Submitted"];

// Delivery Health Dashboard: the High Risk statuses plus Green accounts.
export const DELIVERY_HEALTH_STATUSES: HighRiskStatus[] = ["Red", "Potential Red", "Amber", "Green", "Not Submitted"];

export type HighRiskAccountRow = HealthMatrixRow & {
  geo_id: string | null;
  geo_name: string | null;
  region_id: string | null;
  region_name: string | null;
  delivery_manager_id: string | null;
  delivery_manager_name: string | null;
  // Project Health Dashboard rows only (entity_* is then the project).
  project_code?: string | null;
  project_name?: string;
  project_manager_id?: string | null;
  project_manager_name?: string | null;
  risk_status: HighRiskStatus;
};

export type HighRiskKpis = {
  red: number;
  potential_red: number;
  amber: number;
  not_submitted: number;
  green: number;
};

export type DeliveryManagerOption = { id: string; name: string };

export type HighRisksResponse = {
  kpis: HighRiskKpis;
  items: HighRiskAccountRow[];
  delivery_managers: DeliveryManagerOption[];
  // Project Health Dashboard only.
  project_managers?: DeliveryManagerOption[];
};

export type HighRisksParams = {
  periodId: string | null;
  geoId?: string;
  regionId?: string;
  accountId?: string;
  overall?: HighRiskStatus | "";
  deliveryManagerId?: string;
  projectManagerId?: string;
};

// `endpoint` picks the High Risks grid (default) or the Delivery Health grid
// (adds Green accounts, a Delivery Manager filter, and Delivery Manager access).
export function useHighRisks(
  { periodId, geoId, regionId, accountId, overall, deliveryManagerId, projectManagerId }: HighRisksParams,
  endpoint: "high-risks" | "delivery-health" | "project-health-grid" = "high-risks"
) {
  const qs = new URLSearchParams();
  if (periodId) qs.set("period_id", periodId);
  if (geoId) qs.set("geo_id", geoId);
  if (regionId) qs.set("region_id", regionId);
  if (accountId) qs.set("account_id", accountId);
  if (overall) qs.set("overall", overall);
  if (deliveryManagerId) qs.set("delivery_manager_id", deliveryManagerId);
  if (projectManagerId) qs.set("project_manager_id", projectManagerId);
  return useQuery({
    queryKey: ["dashboard-" + endpoint, periodId, geoId ?? "", regionId ?? "", accountId ?? "", overall ?? "", deliveryManagerId ?? "", projectManagerId ?? ""],
    queryFn: () => api.get<HighRisksResponse>(`/dashboard/${endpoint}?${qs.toString()}`),
    enabled: !!periodId,
  });
}
