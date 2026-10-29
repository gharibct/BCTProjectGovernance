import type { Metadata } from "next";

import { ProjectHealthCustomerAccountReports } from "@/components/dashboard/project-health-customer-account-reports";

export const metadata: Metadata = { title: "Account QBR Reporting | Governance One" };

export default function ProjectHealthCustomerAccountReportsPage() {
  return <ProjectHealthCustomerAccountReports />;
}
