import type { Metadata } from "next";

import { ProjectHealthMetrics } from "@/components/dashboard/project-health-metrics";

export const metadata: Metadata = { title: "Metrics | Governance One" };

export default function MetricsPage() {
  return <ProjectHealthMetrics />;
}
