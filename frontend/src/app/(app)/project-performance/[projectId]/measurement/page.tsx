import type { Metadata } from "next";

import { ProjectPerformanceModuleView } from "@/components/project-performance/project-performance-module-view";
import { MeasurementView } from "@/components/de-approval/module-views/measurement-view";

export const metadata: Metadata = {
  title: "Measurement — Project Performance | Governance One",
};

export default function ProjectPerformanceMeasurementPage() {
  return (
    <ProjectPerformanceModuleView title="Measurement">
      <MeasurementView />
    </ProjectPerformanceModuleView>
  );
}
