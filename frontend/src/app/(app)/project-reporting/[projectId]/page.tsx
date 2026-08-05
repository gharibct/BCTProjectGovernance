import type { Metadata } from "next";

import { ReportingHub } from "@/components/project-reporting/reporting-hub";

export const metadata: Metadata = {
  title: "Project Reporting | Project Governance Tool",
};

export default function ProjectReportingPage() {
  return <ReportingHub />;
}
