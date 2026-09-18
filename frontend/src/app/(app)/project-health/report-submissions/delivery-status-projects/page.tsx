import type { Metadata } from "next";

import { ProjectHealthReportSubmissions } from "@/components/dashboard/project-health-report-submissions";

export const metadata: Metadata = {
  title: "Delivery Status (Projects) — Submission Reporting | Governance One",
};

export default function DeliveryStatusProjectsSubmissionsPage() {
  return <ProjectHealthReportSubmissions kpi="delivery-status-projects" />;
}
