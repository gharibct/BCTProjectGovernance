import type { Metadata } from "next";

import { ReportingHub } from "@/components/project-reporting/reporting-hub";

export const metadata: Metadata = {
  title: "Report Project | Governance One",
};

export default function ProjectReportingPage() {
  return <ReportingHub />;
}
