import type { Metadata } from "next";

import { GovernanceModuleView } from "@/components/de-approval/module-views/governance-module-view";
import { ProjectProfileView } from "@/components/de-approval/module-views/project-profile-view";

export const metadata: Metadata = {
  title: "Project Profile — Governance Review | Project Governance Tool",
};

export default function DeApprovalProjectProfilePage() {
  return (
    <GovernanceModuleView title="Project Profile">
      <ProjectProfileView />
    </GovernanceModuleView>
  );
}
