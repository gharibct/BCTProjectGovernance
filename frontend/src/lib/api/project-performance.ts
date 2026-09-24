import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type {
  AssumptionCardSummary,
  CommitmentsCardSummary,
  DependencyCardSummary,
  IssueCardSummary,
  MetricsComplianceSummary,
  OpportunityCardSummary,
  PaymentMilestonesCardSummary,
  RiskCardSummary,
} from "./project-health-dashboard";
import type { PageCompletionStatus } from "./reporting-attestation";

// The Project Performance Dashboard — Measurement/Commitments/Payment
// Milestones/RAIDO summaries for one project, scoped to one Monthly period,
// plus the monthly completion checklist. Backs both the PM's own monthly
// Project Performance and the Account Manager's read-only
// /project-performance/[projectId] view.
export type ProjectPerformanceDashboardSummary = {
  period_id: string;
  period_label: string;
  metrics: MetricsComplianceSummary;
  commitments: CommitmentsCardSummary;
  payment_milestones: PaymentMilestonesCardSummary;
  risks: RiskCardSummary;
  issues: IssueCardSummary;
  dependencies: DependencyCardSummary;
  assumptions: AssumptionCardSummary;
  opportunities: OpportunityCardSummary;
  completion: PageCompletionStatus[];
  all_complete: boolean;
};

export function useProjectPerformanceDashboard(projectId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["project-performance-dashboard", projectId, periodId],
    queryFn: () =>
      api.get<ProjectPerformanceDashboardSummary>(
        `/projects/${projectId}/performance-dashboard?period_id=${periodId}`,
      ),
    enabled: !!projectId && !!periodId,
  });
}
