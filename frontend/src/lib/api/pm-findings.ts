import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "./client";
import {
  FINDING_STATUS_OPTIONS,
  type DeFindingRow,
  type DeFindingsBucket,
  type DeFindingsKpis,
} from "./de-findings";

export { FINDING_STATUS_OPTIONS };
export type { DeFindingRow, DeFindingsBucket, DeFindingsKpis };

// The PM screen is scoped server-side to the caller's own projects, so it only
// exposes Project / Status filters (+ the KPI/attention `bucket`).
export type PmFindingsFilter = {
  projectId?: string;
  status?: string;
  bucket?: DeFindingsBucket;
};

function buildParams(p: PmFindingsFilter & { skip?: number; limit?: number }): string {
  const q = new URLSearchParams();
  if (p.projectId) q.set("project_id", p.projectId);
  if (p.status) q.set("status", p.status);
  if (p.bucket) q.set("bucket", p.bucket);
  if (p.skip !== undefined) q.set("skip", String(p.skip));
  if (p.limit !== undefined) q.set("limit", String(p.limit));
  return q.toString();
}

export function usePmFindings(params: PmFindingsFilter & { skip: number; limit: number }) {
  return useQuery({
    queryKey: ["pm-findings", params],
    queryFn: () => api.get<Page<DeFindingRow>>(`/pm-findings?${buildParams(params)}`),
  });
}

export function usePmFindingsKpis(params: Pick<PmFindingsFilter, "projectId">) {
  return useQuery({
    queryKey: ["pm-findings-kpis", params],
    queryFn: () => api.get<DeFindingsKpis>(`/pm-findings/kpis?${buildParams(params)}`),
  });
}

export function usePmFindingActionTaken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      api.put<DeFindingRow>(`/pm-findings/${id}/action-taken`, { remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-findings"] });
      queryClient.invalidateQueries({ queryKey: ["pm-findings-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-my-summary"] });
    },
  });
}
