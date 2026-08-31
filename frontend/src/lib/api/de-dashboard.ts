import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthRating } from "./projects";

// Delivery Excellence "My Summary" (design-reference/de-mysummary.jpg) — the
// DELIVERY_EXCELLENCE role's counterpart to pm-dashboard.ts's
// useMyDashboardSummary: the backend derives project scope from the
// signed-in user's Project.delivery_excellence_id assignments server-side,
// so the only param here is the Assessment Period selector.

export type DEAssessmentWorkQueueRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  project_manager_name: string | null;
  account_name: string | null;
  geo_name: string | null;
  pm_health: HealthRating | null;
  de_health: HealthRating | null;
  pci_score: string | null;
  status: "Not Started" | "Draft" | "Submitted";
  open_findings_count: number;
  prev_de_health: HealthRating | null;
  prev_pci_score: string | null;
  href: string;
};

export type DEAssessmentCompletionSummary = {
  completed_count: number;
  total_count: number;
};

export type FindingClassificationBreakdownRow = {
  classification: string;
  count: number;
};

export type DEFindingsSummary = {
  open_count: number;
  overdue_count: number;
  new_this_period_count: number;
  closed_this_period_count: number;
  by_classification: FindingClassificationBreakdownRow[];
};

export type AttentionItem = {
  title: string;
  subtitle: string;
  href: string;
};

export type DEDashboardSummary = {
  period_id: string | null;
  period_label: string | null;
  assessments_due_count: number;
  pending_count: number;
  average_pci: number | null;
  completion: DEAssessmentCompletionSummary;
  red_amber_assessed_count: number;
  findings: DEFindingsSummary;
  work_queue: DEAssessmentWorkQueueRow[];
  attention_items: AttentionItem[];
};

export function useDeDashboardSummary(periodId: string | null) {
  return useQuery({
    queryKey: ["dashboard-de-summary", periodId],
    queryFn: () =>
      api.get<DEDashboardSummary>(periodId ? `/dashboard/de-summary?period_id=${periodId}` : "/dashboard/de-summary"),
  });
}
