import { Suspense } from "react";
import type { Metadata } from "next";

import { HighRisks } from "@/components/dashboard/high-risks";

export const metadata: Metadata = {
  title: "Project Health Dashboard | Governance One",
};

export default function ProjectHealthDashboardPage() {
  return (
    // useSearchParams (filters restored from ?back=) requires a Suspense boundary.
    <Suspense fallback={null}>
      <HighRisks variant="project-health" />
    </Suspense>
  );
}
