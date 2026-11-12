import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// DE Account Allocation — assign a Delivery Excellence auditor to an active
// account (account-level DE audit), or reassign / clear it at any time.
// `allocation` picks the slice the server returns: "unallocated" (no DE yet —
// the default work-to-do list), "allocated" (for reassignment / clearing) or
// "all". Independent of the project-level DE allocation.

export type DeAccountAllocationFilter = "unallocated" | "allocated" | "all";

export type DeAccountAllocationRow = {
  account_id: string;
  account_name: string;
  geo_name: string | null;
  region_name: string | null;
  critical_flag: string;
  account_head_name: string | null;
  project_count: number;
  delivery_excellence_id: string | null;
  delivery_excellence_name: string | null;
  de_allocated_at: string | null;
};

export type DeAccountAssignment = {
  account_id: string;
  // null clears the allocation.
  delivery_excellence_id: string | null;
};

export function useDeAccountAllocationList(allocation: DeAccountAllocationFilter = "unallocated") {
  return useQuery({
    queryKey: ["de-account-allocation", allocation],
    queryFn: () =>
      api.get<DeAccountAllocationRow[]>(`/de-account-allocation?allocation=${allocation}`),
  });
}

export function useBulkAllocateDeAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignments: DeAccountAssignment[]) =>
      api.patch<DeAccountAllocationRow[]>("/de-account-allocation/allocations", { assignments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-account-allocation"] });
      // Newly allocated accounts must show up on the Account Assessment queue.
      queryClient.invalidateQueries({ queryKey: ["de-account-audit-queue"] });
    },
  });
}
