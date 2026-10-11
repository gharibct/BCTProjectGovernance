import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthMatrixRow } from "./dashboard";

// High Risks (CXO / Geo Head) — GET /dashboard/high-risks. Accounts that are not
// Green for a Weekly period, plus accounts that have not filed a report.

export type HighRiskStatus = "Red" | "Potential Red" | "Amber" | "Not Submitted";

export const HIGH_RISK_STATUSES: HighRiskStatus[] = ["Red", "Potential Red", "Amber", "Not Submitted"];

export type HighRiskAccountRow = HealthMatrixRow & {
  geo_id: string | null;
  geo_name: string | null;
  region_id: string | null;
  region_name: string | null;
  delivery_manager_name: string | null;
  risk_status: HighRiskStatus;
};

export type HighRiskKpis = {
  red: number;
  potential_red: number;
  amber: number;
  not_submitted: number;
};

export type HighRisksResponse = { kpis: HighRiskKpis; items: HighRiskAccountRow[] };

export type HighRisksParams = {
  periodId: string | null;
  geoId?: string;
  regionId?: string;
  accountId?: string;
  overall?: HighRiskStatus | "";
};

export function useHighRisks({ periodId, geoId, regionId, accountId, overall }: HighRisksParams) {
  const qs = new URLSearchParams();
  if (periodId) qs.set("period_id", periodId);
  if (geoId) qs.set("geo_id", geoId);
  if (regionId) qs.set("region_id", regionId);
  if (accountId) qs.set("account_id", accountId);
  if (overall) qs.set("overall", overall);
  return useQuery({
    queryKey: ["dashboard-high-risks", periodId, geoId ?? "", regionId ?? "", accountId ?? "", overall ?? ""],
    queryFn: () => api.get<HighRisksResponse>(`/dashboard/high-risks?${qs.toString()}`),
    enabled: !!periodId,
  });
}
