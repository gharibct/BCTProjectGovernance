import type { Metadata } from "next";

import { ProjectPerformanceModuleView } from "@/components/project-performance/project-performance-module-view";
import { ContractualView } from "@/components/de-approval/module-views/contractual-view";

export const metadata: Metadata = {
  title: "Contractual Compliance — Project Performance | Project Governance Tool",
};

export default function ProjectPerformanceContractualCompliancePage() {
  return (
    <ProjectPerformanceModuleView title="Contractual Compliance">
      <ContractualView />
    </ProjectPerformanceModuleView>
  );
}
