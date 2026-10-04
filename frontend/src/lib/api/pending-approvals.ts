import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// Submitted (awaiting-decision) Project / Account Delivery Status reports for
// the caller's scope — feeds the Approve ... Delivery Status worklist screens.
export type PendingApprovalRow = {
  entity_id: string;
  entity_code: string | null;
  entity_name: string;
  report_id: string;
  period_id: string;
  period_label: string;
  period_type: string;
};

export type PendingApprovalScope = "projects" | "accounts";

export function usePendingApprovals(scope: PendingApprovalScope) {
  return useQuery({
    queryKey: ["pending-approvals", scope],
    queryFn: () => api.get<PendingApprovalRow[]>(`/pending-approvals/${scope}`),
  });
}
