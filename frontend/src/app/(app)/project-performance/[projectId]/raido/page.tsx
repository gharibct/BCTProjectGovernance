import type { Metadata } from "next";

import { ProjectPerformanceModuleView } from "@/components/project-performance/project-performance-module-view";
import { RaidoView } from "@/components/de-approval/module-views/raido-view";

export const metadata: Metadata = {
  title: "RAIDO — Project Performance | Governance One",
};

export default function ProjectPerformanceRaidoPage() {
  return (
    <ProjectPerformanceModuleView title="RAIDO">
      <RaidoView />
    </ProjectPerformanceModuleView>
  );
}
