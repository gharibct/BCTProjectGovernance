import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { ActionPriority } from "./actions";
import type { HealthMatrixRow } from "./dashboard";

// Project Manager "My Summary" (design-reference/pm-mysummary.jpg) — a
// separate, session-scoped endpoint from useDashboardSummary: the backend
// derives project_manager_id from the signed-in user, so there's no scope
// param to build here, unlike DashboardScope.

export type RaidoSummary = {
  open_risks: number;
  high_critical_risks: number;
  open_issues: number;
  dependencies: number;
};

export type ReportsDueSummary = {
  due_count: number;
  overdue_count: number;
};

export type AttentionItem = {
  title: string;
  subtitle: string;
  href: string;
};

export type MyOpenActionRow = {
  id: string;
  title: string;
  project_id: string;
  project_label: string;
  due_date: string;
  overdue: boolean;
  due_this_week: boolean;
  priority: ActionPriority;
};

// Overall + the 6 category ratings (HealthMatrixRow) plus this page's own
// Report Status column.
export type MyProjectHealthRow = HealthMatrixRow & {
  report_status: string;
};

export type MyDashboardSummary = {
  my_projects_count: number;
  projects_requiring_attention: number;
  health_green: number;
  health_amber: number;
  health_potential_red: number;
  health_red: number;
  reports_due: ReportsDueSummary;
  open_actions_count: number;
  open_actions_overdue_count: number;
  open_actions_high: number;
  open_actions_medium: number;
  open_actions_low: number;
  open_findings_count: number;
  attention_items: AttentionItem[];
  raido: RaidoSummary;
  project_health: MyProjectHealthRow[];
  open_actions: MyOpenActionRow[];
};

export function useMyDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-my-summary"],
    queryFn: () => api.get<MyDashboardSummary>("/dashboard/my-summary"),
  });
}
