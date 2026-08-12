import type { Metadata } from "next";

import { HubPage } from "@/components/regional-reporting/hub-page";

export const metadata: Metadata = {
  title: "Account Reporting | Project Governance Tool",
};

export default function AccountReportingPage() {
  return <HubPage scope="account" paramName="accountId" />;
}
