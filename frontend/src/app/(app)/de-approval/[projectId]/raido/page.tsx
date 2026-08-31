import type { Metadata } from "next";

import { GovernanceModuleView } from "@/components/de-approval/module-views/governance-module-view";
import { RaidoView } from "@/components/de-approval/module-views/raido-view";

export const metadata: Metadata = {
  title: "RAIDO Register — Governance Review | Project Governance Tool",
};

export default function DeApprovalRaidoPage() {
  return (
    <GovernanceModuleView title="RAIDO Register">
      <RaidoView />
    </GovernanceModuleView>
  );
}
