import type { Metadata } from "next";

import { ProjectHealthReportSubmissions } from "@/components/dashboard/project-health-report-submissions";

export const metadata: Metadata = {
  title: "Metrics (Projects) — Submission Reporting | Governance One",
};

export default function MetricsProjectsSubmissionsPage() {
  return <ProjectHealthReportSubmissions kpi="metrics-projects" />;
}
