import type { Metadata } from "next";

import { GovernanceModuleView } from "@/components/de-approval/module-views/governance-module-view";
import { MeasurementView } from "@/components/de-approval/module-views/measurement-view";

export const metadata: Metadata = {
  title: "Measurement — Governance Review | Project Governance Tool",
};

export default function DeApprovalMeasurementPage() {
  return (
    <GovernanceModuleView title="Measurement">
      <MeasurementView />
    </GovernanceModuleView>
  );
}
