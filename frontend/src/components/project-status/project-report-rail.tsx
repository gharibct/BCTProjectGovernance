"use client";

import { useParams, useSearchParams } from "next/navigation";

import { ReportProgressRail } from "@/components/reporting/report-progress-rail";
import { useReportProgress } from "./report-progress";

// Project's Report Progress rail: 12 sections, shared by Project Status and
// Submit Report (the dashboard route).
export function ProjectReportRail({ mode }: { mode: "status" | "submit" }) {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const progress = useReportProgress(projectId ?? null, periodId);
  const base = `/project-reporting/${projectId}`;
  return (
    <ReportProgressRail
      progress={progress}
      mode={mode}
      statusPath={`${base}/project-status`}
      submitPath={`${base}/dashboard`}
    />
  );
}
