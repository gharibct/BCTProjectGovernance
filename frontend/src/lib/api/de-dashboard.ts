import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthRating } from "./projects";

// Delivery Excellence "My Summary" (design-reference/de-mysummary.jpg) — the
// DELIVERY_EXCELLENCE role's counterpart to pm-dashboard.ts's
// useMyDashboardSummary: the backend derives project scope from the
// signed-in user's Project.delivery_excellence_id assignments server-side. A DE
// assessment is independent of reporting periods, so there are no params — the
// summary is always for the current calendar month.

export type DEAssessmentWorkQueueRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  project_manager_name: string | null;
  account_name: string | null;
  geo_name: string | null;
  region_name: string | null;
  pm_health: HealthRating | null;
  de_health: HealthRating | null;
  pci_score: string | null;
  status: "Assessed" | "Draft" | "Due";
  assessments_this_month: number;
  last_assessment_date: string | null;
  assessed_by_name: string | null;
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
  period_id: string | null; // always null — a DE assessment has no reporting period
  period_label: string | null; // the current calendar month, e.g. "August 2026"
  assessments_due_count: number;
  pending_count: number;
  average_pci: number | null;
  completion: DEAssessmentCompletionSummary;
  red_amber_assessed_count: number;
  findings: DEFindingsSummary;
  work_queue: DEAssessmentWorkQueueRow[];
  attention_items: AttentionItem[];
};

export function useDeDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-de-summary"],
    queryFn: () => api.get<DEDashboardSummary>("/dashboard/de-summary"),
  });
}
