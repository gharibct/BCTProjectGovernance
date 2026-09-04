import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ProjectLifecycleStatus, ProjectStatus } from "./projects";

// DE Project Allocation (design-reference/de-approval) — assign a Delivery
// Excellence assessor to projects that are Pending Approval or Approved (Draft is
// excluded). Allocation is not period-scoped: any DE / Admin sees the whole pool.

export type DeAllocationRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  account_name: string | null;
  project_manager_name: string | null;
  project_status: ProjectStatus;
  lifecycle_status: ProjectLifecycleStatus | null;
  delivery_excellence_id: string | null;
  delivery_excellence_name: string | null;
  de_allocated_at: string | null;
  completion_pct: number;
  gaps_count: number;
};

export type DeAllocationAssignment = {
  project_id: string;
  delivery_excellence_id: string;
};

export function useDeAllocationList() {
  return useQuery({
    queryKey: ["de-allocation"],
    queryFn: () => api.get<DeAllocationRow[]>("/de-allocation"),
  });
}

export function useBulkAllocateDe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignments: DeAllocationAssignment[]) =>
      api.patch<DeAllocationRow[]>("/de-allocation/allocations", { assignments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["de-approval-queue"] });
    },
  });
}
