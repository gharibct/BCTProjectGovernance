import type { Metadata } from "next";

import { ProjectHealthCustomerProjectReports } from "@/components/dashboard/project-health-customer-project-reports";

export const metadata: Metadata = { title: "Customer Project Status Reporting | Governance One" };

export default function ProjectHealthCustomerProjectReportsPage() {
  return <ProjectHealthCustomerProjectReports />;
}
