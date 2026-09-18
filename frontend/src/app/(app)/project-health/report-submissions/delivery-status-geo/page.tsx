import type { Metadata } from "next";

import { ProjectHealthReportSubmissions } from "@/components/dashboard/project-health-report-submissions";

export const metadata: Metadata = {
  title: "Delivery Status (Geo) — Submission Reporting | Governance One",
};

export default function DeliveryStatusGeoSubmissionsPage() {
  return <ProjectHealthReportSubmissions kpi="delivery-status-geo" />;
}
