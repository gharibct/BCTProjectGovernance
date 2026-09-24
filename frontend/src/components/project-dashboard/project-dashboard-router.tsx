"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { useReportingPeriods } from "@/lib/api/reference-data";
import { useStatusReports } from "@/lib/api/project-status";
import { currentPeriod } from "@/lib/period-utils";
import { useProjectDefaultPeriodId } from "@/lib/use-default-period";
import { ProjectDashboardView } from "./project-dashboard-view";
import { ProjectPerformanceDashboardView } from "./project-performance-dashboard-view";

// The Project Delivery Status route is shared by Weekly (Delivery Status Reporting)
// and Monthly (Project Performance Report) — same URL, ?period= picks which.
// Renders the Weekly RAG/Overview/Open-Alerts dashboard for a Weekly period,
// or the Monthly Project Performance Dashboard otherwise — mirrors each
// view's own "no ?period= yet" fallback (defaults to the current Monthly
// period) so a first-time visit still lands somewhere useful.
function PeriodTypeRouter({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId);

  const defaultPeriodId = useProjectDefaultPeriodId(projectId, "weekly");
  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? defaultPeriodId ?? reports[0]?.period_id ?? currentPeriod(periods, "Monthly")?.id ?? null;
  const period = periods.find((p) => p.id === periodId);

  if (period?.period_type === "Weekly") return <ProjectDashboardView />;
  return <ProjectPerformanceDashboardView />;
}

export function ProjectDashboardRouter() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    // useSearchParams (for the selected reporting period) requires a
    // Suspense boundary at prerender.
    <Suspense fallback={null}>
      <PeriodTypeRouter projectId={projectId} />
    </Suspense>
  );
}
