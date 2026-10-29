import type { Metadata } from "next";

import { ProjectPerformanceModuleView } from "@/components/project-performance/project-performance-module-view";
import { ContractualView } from "@/components/de-approval/module-views/contractual-view";

export const metadata: Metadata = {
  title: "Contractual Commitments — Project Performance | Governance One",
};

export default function ProjectPerformanceContractualCommitmentsPage() {
  return (
    <ProjectPerformanceModuleView title="Contractual Commitments">
      <ContractualView />
    </ProjectPerformanceModuleView>
  );
}
