import { useMutation } from "@tanstack/react-query";

import { api } from "./client";

// One row of the Admin bulk Delivery Status upload — see POST /bulk/*-status-reports.
// The period is its code (e.g. 2026-W31, 2026-07) or label; each narrative
// category is a list of register items.
export type BulkStatusPayload = {
  period: string;
  revenue?: string;
  onsite_fte?: string;
  offshore_fte?: string;
  projects_count?: number;
  key_accomplishments: string[];
  upcoming_key_releases: string[];
  leadership_support_required: string[];
  key_risks_issues: string[];
};
export type BulkProjectStatusPayload = BulkStatusPayload & { project_code: string };
export type BulkAccountStatusPayload = BulkStatusPayload & { account_id: string };
export type BulkStatusReport = { id: string; status: string };

export function useBulkCreateProjectStatusReport() {
  return useMutation({
    mutationFn: (payload: BulkProjectStatusPayload) =>
      api.post<BulkStatusReport>("/bulk/project-status-reports", payload),
  });
}

export function useBulkCreateAccountStatusReport() {
  return useMutation({
    mutationFn: (payload: BulkAccountStatusPayload) =>
      api.post<BulkStatusReport>("/bulk/account-status-reports", payload),
  });
}
