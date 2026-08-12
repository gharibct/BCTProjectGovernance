import type { Metadata } from "next";

import { StatusPage } from "@/components/regional-reporting/status-page";

export const metadata: Metadata = {
  title: "Account Status Report | Project Governance Tool",
};

export default function AccountStatusReportPage() {
  return <StatusPage scope="account" paramName="accountId" />;
}
