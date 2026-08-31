import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// PMO "My Summary" (design-reference/pmo-mysummary.jpg) — org-wide, unlike
// every other role's "My Summary" hook in this directory: no owned geo/
// account/project_manager_id to scope by, since a PMO user oversees the
// whole portfolio. No PMO login exists yet — the backend endpoint is real
// (see services/dashboard.py's pmo_governance_compliance_matrix), just not
// reachable until a PMO role/session is wired up.

export type GovernanceStatus = "Compliant" | "Minor Gap" | "Major Gap";

export type PmoReportingComplianceSummary = {
  on_time_count: number;
  late_count: number;
  missing_count: number;
  rework_count: number;
};

export type GovernanceExceptionRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  account_name: string | null;
  exception: string;
  age_days: number;
  href: string;
};

export type GovernanceComplianceRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  reporting_status: GovernanceStatus;
  measurement_status: GovernanceStatus;
  contractual_status: GovernanceStatus;
  raido_status: GovernanceStatus;
  assessment_status: GovernanceStatus;
  overall_status: GovernanceStatus;
  href: string;
};

export type PmoDashboardSummary = {
  active_projects_count: number;
  governance_compliance_pct: number;
  reports_overdue_count: number;
  assessments_overdue_count: number;
  high_critical_risks_count: number;
  overdue_actions_count: number;
  reporting_compliance: PmoReportingComplianceSummary;
  governance_exceptions: GovernanceExceptionRow[];
  governance_compliance: GovernanceComplianceRow[];
};

export function usePmoDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-pmo-summary"],
    queryFn: () => api.get<PmoDashboardSummary>("/dashboard/pmo-summary"),
  });
}
