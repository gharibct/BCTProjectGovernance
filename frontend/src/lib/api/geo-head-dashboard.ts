import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { ActionPriority } from "./actions";
import type { HealthRating } from "./projects";

// Geo Head "My Summary" (design-reference/geohead-mysummary.jpg) — the Geo
// Head role's counterpart to account-head-dashboard.ts's
// useAccountHeadDashboardSummary: the backend derives owned geo_ids from the
// signed-in user's user_geos, so the only param here is the optional
// single-geo narrowing the page's geo selector applies.

export type AccountReviewQueueRow = {
  account_id: string;
  account_name: string;
  account_head_name: string | null;
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
  health_potential_red: number;
  health_red: number;
  status_label: string;
};

export type GeoAttentionItem = {
  category: string;
  title: string;
  subtitle: string;
  href: string;
};

export type ReportingReadiness = {
  ready_count: number;
  total_count: number;
  approved_count: number;
  awaiting_review_count: number;
  not_submitted_count: number;
  rejected_count: number;
};

export type GeoExecutiveUpdateSummary = {
  status: string;
  description: string;
  href: string;
};

export type GeoHeadOpenActionRow = {
  id: string;
  title: string;
  entity_label: string;
  due_date: string;
  overdue: boolean;
  due_this_week: boolean;
  href: string;
  priority: ActionPriority;
};

export type GeoHeadDashboardSummary = {
  accounts_count: number;
  projects_count: number;
  geo_health: HealthRating | null;
  awaiting_review_count: number;
  geo_report_due: boolean;
  open_actions_count: number;
  account_review_queue: AccountReviewQueueRow[];
  account_portfolio_health: AccountPortfolioHealthRow[];
  critical_attention: GeoAttentionItem[];
  reporting_readiness: ReportingReadiness;
  executive_update: GeoExecutiveUpdateSummary | null;
  open_actions: GeoHeadOpenActionRow[];
};

export function useGeoHeadDashboardSummary(geoId: string | null) {
  return useQuery({
    queryKey: ["dashboard-geo-head-summary", geoId],
    queryFn: () =>
      api.get<GeoHeadDashboardSummary>(
        geoId ? `/dashboard/geo-head-summary?geo_id=${geoId}` : "/dashboard/geo-head-summary"
      ),
  });
}
