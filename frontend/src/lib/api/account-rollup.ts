import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ProjectStatusCategory } from "./project-status";
import type { RegionalStatusItem } from "./regional-status";

export type RollupStatus = "Pending" | "Pulled" | "Ignored";

export type AccountRollupMetrics = {
  revenue: string | null;
  onsite_fte: string | null;
  offshore_fte: string | null;
  projects_count: number | null;
  contributing_project_count: number;
};

export type AccountRollupItem = {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  category: ProjectStatusCategory;
  description: string;
  account_rollup_status: RollupStatus;
  rolled_up_account_item_id: string | null;
};

export type AccountRollupResponse = {
  metrics: AccountRollupMetrics;
  items: AccountRollupItem[];
};

// Project -> Account rollup: pre-fills an Account Weekly report's Key
// Metrics from summing its projects' own Weekly reports for the same
// period, and surfaces those projects' status items so they can be pulled
// into (or dismissed from) the account's own register. Account-scope only.
export function useAccountRollup(accountId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["account-rollup", accountId, periodId],
    queryFn: () => api.get<AccountRollupResponse>(`/accounts/${accountId}/rollup?period_id=${periodId}`),
    enabled: !!accountId && !!periodId,
  });
}

function invalidateRollup(queryClient: ReturnType<typeof useQueryClient>, accountId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["account-rollup", accountId] });
}

export function usePullRollupItem(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectItemId: string) =>
      api.post<RegionalStatusItem>(`/accounts/${accountId}/rollup/pull`, { project_item_id: projectItemId }),
    onSuccess: (item) => {
      invalidateRollup(queryClient, accountId);
      queryClient.invalidateQueries({
        queryKey: ["regional-status-items", "account", accountId, item.period_id, item.category],
      });
    },
  });
}

// Items on one account's rollup panel come from several different
// projects, so the project id travels with each call rather than being
// fixed at the hook level.
export function useSetItemRollupStatus(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      itemId,
      status,
    }: {
      projectId: string;
      itemId: string;
      status: "Pending" | "Ignored";
    }) => api.patch(`/projects/${projectId}/status-items/${itemId}/rollup-status`, { status }),
    onSuccess: () => invalidateRollup(queryClient, accountId),
  });
}
