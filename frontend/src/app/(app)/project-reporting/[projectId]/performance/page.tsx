import type { Metadata } from "next";

import { ReportingHub } from "@/components/project-reporting/reporting-hub";

export const metadata: Metadata = {
  title: "Report Project Performance | Governance One",
};

export default function ReportProjectPerformancePage() {
  return <ReportingHub kind="performance" />;
}
