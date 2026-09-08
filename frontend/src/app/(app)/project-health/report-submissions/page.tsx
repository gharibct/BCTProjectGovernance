import type { Metadata } from "next";

import { ProjectHealthReportSubmissions } from "@/components/dashboard/project-health-report-submissions";

export const metadata: Metadata = { title: "Report Submissions | Project Governance Tool" };

export default function ReportSubmissionsPage() {
  return <ProjectHealthReportSubmissions />;
}
