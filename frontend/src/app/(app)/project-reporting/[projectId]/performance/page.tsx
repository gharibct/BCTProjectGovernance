import type { Metadata } from "next";

import { ProjectPerformanceCalendarHub } from "@/components/project-reporting/project-performance-calendar-hub";

export const metadata: Metadata = {
  title: "Report Project Performance | Governance One",
};

export default function ReportProjectPerformancePage() {
  return <ProjectPerformanceCalendarHub />;
}
