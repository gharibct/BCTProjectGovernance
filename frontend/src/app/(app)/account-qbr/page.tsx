import type { Metadata } from "next";

import { ProjectHealthCustomerAccountReports } from "@/components/dashboard/project-health-customer-account-reports";

export const metadata: Metadata = { title: "Account QBR Dashboard | Governance One" };

export default function AccountQbrDashboardPage() {
  return <ProjectHealthCustomerAccountReports standalone />;
}
