"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { ProjectHeader } from "@/components/shell/project-header";
import { OverviewSection } from "@/components/status-review/overview-section";
import { RagStatusSection } from "@/components/status-review/rag-status-section";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useStatusReports } from "@/lib/api/project-status";
import { currentPeriod } from "@/lib/period-utils";
import { SubmitReportAction } from "./submit-report-action";

// The Project Manager's read-first counterpart to /project-review — same
// OverviewSection/RagStatusSection the Account Manager reviews, fitted into
// the project-reporting shell (breadcrumb + nav rail) instead of the
// standalone project-review layout, with SubmitReportAction in place of
// ReviewActions.
function PeriodAwareBody({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();

  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId);

  // Reports are ordered by the period's start_date desc, so the first row is
  // the latest one. Falls back to the current month when neither the URL nor
  // any report has picked a period yet — same "no ?period= yet" fallback
  // StarterCards/Document Processing use — so this page isn't a dead end on a
  // PM's very first visit, before anything has ever been submitted.
  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? reports[0]?.period_id ?? currentPeriod(periods, "Monthly")?.id ?? null;
  const report = reports.find((r) => r.period_id === periodId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <ProjectHeader subheading="Project Dashboard" periodId={periodId} />

      {!periodId ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No reporting period available yet.
        </p>
      ) : (
        <>
          <OverviewSection scope="project" scopeId={projectId} periodId={periodId} />
          <RagStatusSection scope="project" scopeId={projectId} periodId={periodId} />
          <SubmitReportAction projectId={projectId} periodId={periodId} report={report} />
        </>
      )}
    </div>
  );
}

export function ProjectDashboardView() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    // useSearchParams (for the selected reporting period) requires a
    // Suspense boundary at prerender.
    <Suspense fallback={null}>
      <PeriodAwareBody projectId={projectId} />
    </Suspense>
  );
}
