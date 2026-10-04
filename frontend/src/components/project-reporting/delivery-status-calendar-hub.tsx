"use client";

import { useParams } from "next/navigation";

import { QueryErrorState } from "@/components/shared/query-error-state";
import { DeliveryCalendarView } from "@/components/reporting/delivery-calendar-view";
import { useProject } from "@/lib/api/projects";
import { useReportingActivityForYear, useStatusReports } from "@/lib/api/project-status";

// Alternative landing page for Report Delivery Status (weekly) — the original
// hub is components/project-reporting/reporting-hub.tsx. The report form itself
// (project-status page) is unchanged.
export function DeliveryStatusCalendarHub() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectQuery = useProject(projectId ?? null);
  const { data: project } = projectQuery;
  const { data: reports = [] } = useStatusReports(projectId ?? null);

  const thisYear = new Date().getFullYear();
  const current = useReportingActivityForYear(projectId ?? null, thisYear);
  const previous = useReportingActivityForYear(projectId ?? null, thisYear - 1);
  const weeklyItems = [...(previous.data?.weekly.items ?? []), ...(current.data?.weekly.items ?? [])];

  if (projectQuery.isError) {
    return <QueryErrorState error={projectQuery.error} onRetry={() => projectQuery.refetch()} />;
  }

  return (
    <DeliveryCalendarView
      title={project?.project_code ? `${project.project_code} - Report Delivery Status` : "Report Delivery Status"}
      subtitle={project?.project_name}
      weeklyItems={weeklyItems}
      reports={reports}
      hrefForPeriod={(periodId) => `/project-reporting/${projectId}/project-status?period=${periodId}`}
      scopeStart={project?.tool_effective_date ?? project?.actual_start_date ?? project?.planned_start_date ?? null}
      scopeEnd={project?.actual_end_date ?? project?.planned_end_date ?? null}
    />
  );
}
