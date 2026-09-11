import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ProjectLifecycleStatus, ProjectStatus } from "./projects";

// DE Project Allocation (design-reference/de-approval) — assign a Delivery
// Excellence assessor to a non-Draft project, or reassign a different one at
// any time. `allocation` picks which slice the server returns: "unallocated"
// (no DE yet — the default work-to-do list), "allocated" (already have a DE,
// for reassignment), or "all". Allocation is optional (a project can be
// approved without a DE) and not period-scoped.

export type DeAllocationFilter = "unallocated" | "allocated" | "all";

export type DeAllocationRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  account_name: string | null;
  geo_name: string | null;
  region_name: string | null;
  project_type_name: string | null;
  // Ownership model — "Fully Owned" | "Co-Owned" | "Customer Driven".
  project_owned: string | null;
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

export function useDeAllocationList(allocation: DeAllocationFilter = "unallocated") {
  return useQuery({
    queryKey: ["de-allocation", allocation],
    queryFn: () =>
      api.get<DeAllocationRow[]>(`/de-allocation?allocation=${allocation}`),
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
