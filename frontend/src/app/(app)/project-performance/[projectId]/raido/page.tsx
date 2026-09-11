import type { Metadata } from "next";

import { ProjectPerformanceModuleView } from "@/components/project-performance/project-performance-module-view";
import { RaidoView } from "@/components/de-approval/module-views/raido-view";

export const metadata: Metadata = {
  title: "RAIDO — Project Performance | Project Governance Tool",
};

export default function ProjectPerformanceRaidoPage() {
  return (
    <ProjectPerformanceModuleView title="RAIDO">
      <RaidoView />
    </ProjectPerformanceModuleView>
  );
}
