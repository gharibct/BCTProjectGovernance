import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Project Performance Report's 8 monthly-reviewable sections — Measurement,
// Contractual Compliance's 2 tabs, and each of the 5 RAIDO logs. A section is
// complete for a Monthly period if data was saved that month, or the PM
// explicitly attested "Reviewed and No Changes" here (see
// backend/app/services/monthly_completion.py).
export type ReportPageType =
  | "MEASUREMENT"
  | "COMMITMENTS"
  | "PAYMENT_MILESTONES"
  | "RISK"
  | "ISSUE"
  | "DEPENDENCY"
  | "ASSUMPTION"
  | "OPPORTUNITY";

export const REPORT_PAGE_TYPE_LABEL: Record<ReportPageType, string> = {
  MEASUREMENT: "Measurement",
  COMMITMENTS: "Commitments",
  PAYMENT_MILESTONES: "Payment Milestones",
  RISK: "Risk",
  ISSUE: "Issue",
  DEPENDENCY: "Dependency",
  ASSUMPTION: "Assumption",
  OPPORTUNITY: "Opportunity",
};

export type PageCompletionReason = "data_saved" | "reviewed_no_changes" | "outstanding";

export type PageCompletionStatus = {
  page_type: ReportPageType;
  complete: boolean;
  reason: PageCompletionReason;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export function useMonthlyCompletion(projectId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["monthly-completion", projectId, periodId],
    queryFn: () =>
      api.get<PageCompletionStatus[]>(`/projects/${projectId}/monthly-completion?period_id=${periodId}`),
    enabled: !!projectId && !!periodId,
  });
}

export function useCreateMonthlyAttestation(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { period_id: string; page_type: ReportPageType }) =>
      api.post(`/projects/${projectId}/monthly-attestations`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["monthly-completion", projectId, variables.period_id] });
      queryClient.invalidateQueries({
        queryKey: ["project-performance-dashboard", projectId, variables.period_id],
      });
    },
  });
}
