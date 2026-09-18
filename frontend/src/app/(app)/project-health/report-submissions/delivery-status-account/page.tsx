import type { Metadata } from "next";

import { ProjectHealthReportSubmissions } from "@/components/dashboard/project-health-report-submissions";

export const metadata: Metadata = {
  title: "Delivery Status (Account) — Submission Reporting | Governance One",
};

export default function DeliveryStatusAccountSubmissionsPage() {
  return <ProjectHealthReportSubmissions kpi="delivery-status-account" />;
}
