"use client";

import { useParams } from "next/navigation";

import { QueryErrorState } from "@/components/shared/query-error-state";
import { DeliveryCalendarView } from "@/components/reporting/delivery-calendar-view";
import { useProject } from "@/lib/api/projects";
import { useReportingActivityForYear, useStatusReports } from "@/lib/api/project-status";

// Landing page for Report Project Performance (monthly) — same calendar-style
// layout as Report Delivery Status, fed by the monthly reporting periods. A
// date opens the monthly Project Performance dashboard for that period.
export function ProjectPerformanceCalendarHub() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectQuery = useProject(projectId ?? null);
  const { data: project } = projectQuery;
  const { data: reports = [] } = useStatusReports(projectId ?? null);

  const thisYear = new Date().getFullYear();
  const current = useReportingActivityForYear(projectId ?? null, thisYear);
  const previous = useReportingActivityForYear(projectId ?? null, thisYear - 1);
  const monthlyItems = [...(previous.data?.monthly.items ?? []), ...(current.data?.monthly.items ?? [])];

  if (projectQuery.isError) {
    return <QueryErrorState error={projectQuery.error} onRetry={() => projectQuery.refetch()} />;
  }

  return (
    <DeliveryCalendarView
      title={project?.project_code ? `${project.project_code} - Report Project Performance` : "Report Project Performance"}
      subtitle={project?.project_name}
      weeklyItems={monthlyItems}
      reports={reports}
      fixedYear
      hrefForPeriod={(periodId) => `/project-reporting/${projectId}/dashboard?period=${periodId}`}
      scopeStart={project?.tool_effective_date ?? project?.actual_start_date ?? project?.planned_start_date ?? null}
      scopeEnd={project?.actual_end_date ?? project?.planned_end_date ?? null}
      restrictedFrom={current.data?.monthly_restricted_from ?? previous.data?.monthly_restricted_from ?? null}
    />
  );
}
