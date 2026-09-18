import type { Metadata } from "next";

import { GovernanceModuleView } from "@/components/de-approval/module-views/governance-module-view";
import { OracleMappingView } from "@/components/de-approval/module-views/oracle-mapping-view";

export const metadata: Metadata = {
  title: "Map Oracle Projects — Governance Review | Governance One",
};

export default function DeApprovalOracleMappingPage() {
  return (
    <GovernanceModuleView title="Map Oracle Projects">
      <OracleMappingView />
    </GovernanceModuleView>
  );
}
