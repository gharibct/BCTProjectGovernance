import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { ActionPriority } from "./actions";
import type { HealthRating } from "./projects";

// Account Head "My Summary" (design-reference/acchead-mysummary.jpg) — the
// ACCOUNT_MANAGER role's counterpart to pm-dashboard.ts's
// useMyDashboardSummary: the backend derives account_ids from the
// signed-in user's owned accounts (user_accounts), so there's no scope param
// to build here either.

export type ReportReviewQueueRow = {
  report_id: string;
  project_id: string;
  project_label: string;
  project_manager_name: string | null;
  period_label: string;
  health: HealthRating | null;
  submitted_at: string;
  href: string;
};

export type AccountPortfolioHealthRow = {
  account_id: string;
  account_name: string;
  active_projects_count: number;
  health_green: number;
  health_amber: number;
  health_red: number;
  status_label: string;
};

export type ReportingReadiness = {
  ready_count: number;
  total_count: number;
  approved_count: number;
  awaiting_review_count: number;
  not_submitted_count: number;
  rejected_count: number;
};

export type AccountHeadOpenActionRow = {
  id: string;
  title: string;
  entity_label: string;
  due_date: string;
  overdue: boolean;
  due_this_week: boolean;
  href: string;
  priority: ActionPriority;
};

export type AttentionItem = {
  title: string;
  subtitle: string;
  href: string;
};

export type AccountHeadDashboardSummary = {
  accounts_count: number;
  active_projects_count: number;
  health_green: number;
  health_amber: number;
  health_red: number;
  awaiting_review_count: number;
  high_critical_risks_count: number;
  open_actions_high: number;
  open_actions_medium: number;
  open_actions_low: number;
  report_review_queue: ReportReviewQueueRow[];
  account_portfolio_health: AccountPortfolioHealthRow[];
  attention_items: AttentionItem[];
  reporting_readiness: ReportingReadiness;
  open_actions: AccountHeadOpenActionRow[];
};

export function useAccountHeadDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-account-head-summary"],
    queryFn: () => api.get<AccountHeadDashboardSummary>("/dashboard/account-head-summary"),
  });
}
