import type { Metadata } from "next";

import { ProjectPerformanceModuleView } from "@/components/project-performance/project-performance-module-view";
import { ContractualView } from "@/components/de-approval/module-views/contractual-view";

export const metadata: Metadata = {
  title: "Payment Milestones — Project Performance | Governance One",
};

export default function ProjectPerformanceMilestonesPage() {
  return (
    <ProjectPerformanceModuleView title="Payment Milestones">
      <ContractualView />
    </ProjectPerformanceModuleView>
  );
}
