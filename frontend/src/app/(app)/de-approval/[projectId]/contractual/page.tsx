import type { Metadata } from "next";

import { GovernanceModuleView } from "@/components/de-approval/module-views/governance-module-view";
import { ContractualView } from "@/components/de-approval/module-views/contractual-view";

export const metadata: Metadata = {
  title: "Contractual Compliance — Governance Review | Project Governance Tool",
};

export default function DeApprovalContractualPage() {
  return (
    <GovernanceModuleView title="Contractual Compliance">
      <ContractualView />
    </GovernanceModuleView>
  );
}
