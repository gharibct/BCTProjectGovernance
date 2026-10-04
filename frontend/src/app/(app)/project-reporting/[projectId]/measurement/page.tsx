import type { Metadata } from "next";

import { ActivityGate } from "@/components/forms/activity-gate";
import { MeasurementTabs } from "@/components/measurement/measurement-tabs";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Measurement | Governance One",
};

export default function MeasurementPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader subheading="Measurement" />
      <div className="mt-8">
        <ActivityGate activity="METRICS" usePeriodParam>
          <MeasurementTabs />
        </ActivityGate>
      </div>
    </div>
  );
}
