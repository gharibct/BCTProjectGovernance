import type { Metadata } from "next";

import { RegionalReportingHub } from "@/components/reporting/regional-reporting-hub";

export const metadata: Metadata = {
  title: "Account Reporting | Governance One",
};

export default function AccountReportingPage() {
  return <RegionalReportingHub scope="account" />;
}
