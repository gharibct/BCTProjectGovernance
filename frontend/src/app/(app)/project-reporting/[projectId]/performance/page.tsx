import type { Metadata } from "next";

import { ProjectPerformanceCalendarHub } from "@/components/project-reporting/project-performance-calendar-hub";

export const metadata: Metadata = {
  title: "Update Project Performance Report | Governance One",
};

export default function ReportProjectPerformancePage() {
  return <ProjectPerformanceCalendarHub />;
}
