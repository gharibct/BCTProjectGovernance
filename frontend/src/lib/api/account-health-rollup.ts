import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { AccountHealthItem, HealthCategory } from "./account-health-declarations";

export type RollupStatus = "Pending" | "Pulled" | "Ignored";

export type AccountHealthRollupItem = {
  id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  category: HealthCategory;
  description: string;
  account_rollup_status: RollupStatus;
  rolled_up_account_item_id: string | null;
};

export type AccountHealthRollupResponse = {
  items: AccountHealthRollupItem[];
};

// Project -> Account rollup for RAG Status notes: surfaces the account's
// projects' own health items so they can be pulled into (or dismissed from)
// the account's own register. Mirrors account-rollup.ts, minus Key Metrics
// (RAG Status has no numeric fields to sum).
export function useAccountHealthRollup(accountId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["account-health-rollup", accountId, periodId],
    queryFn: () => api.get<AccountHealthRollupResponse>(`/accounts/${accountId}/health-rollup?period_id=${periodId}`),
    enabled: !!accountId && !!periodId,
  });
}

function invalidateHealthRollup(queryClient: ReturnType<typeof useQueryClient>, accountId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["account-health-rollup", accountId] });
}

export function usePullHealthRollupItem(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectItemId: string) =>
      api.post<AccountHealthItem>(`/accounts/${accountId}/health-rollup/pull`, { project_item_id: projectItemId }),
    onSuccess: (item) => {
      invalidateHealthRollup(queryClient, accountId);
      queryClient.invalidateQueries({
        queryKey: ["account-health-items", accountId, item.period_id, item.category],
      });
    },
  });
}

// Items on one account's rollup panel come from several different
// projects, so the project id travels with each call rather than being
// fixed at the hook level.
export function useSetHealthItemRollupStatus(accountId: string | null) {
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
    }) => api.patch(`/projects/${projectId}/health-items/${itemId}/rollup-status`, { status }),
    onSuccess: () => invalidateHealthRollup(queryClient, accountId),
  });
}
