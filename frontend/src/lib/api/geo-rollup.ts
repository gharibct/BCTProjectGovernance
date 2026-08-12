import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ProjectStatusCategory } from "./project-status";
import type { RollupStatus } from "./account-rollup";
import type { RegionalStatusItem } from "./regional-status";

export type GeoRollupMetrics = {
  revenue: string | null;
  onsite_fte: string | null;
  offshore_fte: string | null;
  projects_count: number | null;
  contributing_account_count: number;
};

export type GeoRollupItem = {
  id: string;
  account_id: string;
  account_name: string;
  category: ProjectStatusCategory;
  description: string;
  account_rollup_status: RollupStatus;
  rolled_up_geo_item_id: string | null;
};

export type GeoRollupResponse = {
  metrics: GeoRollupMetrics;
  items: GeoRollupItem[];
};

// Account -> Geo rollup: pre-fills a Geo Weekly report's Key Metrics from
// summing its accounts' own Weekly reports for the same period, and
// surfaces those accounts' status items so they can be pulled into (or
// dismissed from) the geo's own register. Mirrors account-rollup.ts one
// level up. Geo-scope only.
export function useGeoRollup(geoId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["geo-rollup", geoId, periodId],
    queryFn: () => api.get<GeoRollupResponse>(`/geos/${geoId}/rollup?period_id=${periodId}`),
    enabled: !!geoId && !!periodId,
  });
}

function invalidateRollup(queryClient: ReturnType<typeof useQueryClient>, geoId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["geo-rollup", geoId] });
}

export function usePullGeoRollupItem(geoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountItemId: string) =>
      api.post<RegionalStatusItem>(`/geos/${geoId}/rollup/pull`, { account_item_id: accountItemId }),
    onSuccess: (item) => {
      invalidateRollup(queryClient, geoId);
      queryClient.invalidateQueries({
        queryKey: ["regional-status-items", "geo", geoId, item.period_id, item.category],
      });
    },
  });
}

// Items on one geo's rollup panel come from several different accounts, so
// the account id travels with each call rather than being fixed at the hook
// level.
export function useSetAccountItemRollupStatus(geoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      itemId,
      status,
    }: {
      accountId: string;
      itemId: string;
      status: "Pending" | "Ignored";
    }) => api.patch(`/accounts/${accountId}/status-items/${itemId}/rollup-status`, { status }),
    onSuccess: () => invalidateRollup(queryClient, geoId),
  });
}
