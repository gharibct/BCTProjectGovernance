import type { Metadata } from "next";

import { GovernanceModuleView } from "@/components/de-approval/module-views/governance-module-view";
import { ScopeScheduleView } from "@/components/de-approval/module-views/scope-schedule-view";

export const metadata: Metadata = {
  title: "Scope & Schedule — Governance Review | Project Governance Tool",
};

export default function DeApprovalScopeSchedulePage() {
  return (
    <GovernanceModuleView title="Scope & Schedule">
      <ScopeScheduleView />
    </GovernanceModuleView>
  );
}
