import type { Metadata } from "next";

import { MeasurementTabs } from "@/components/measurement/measurement-tabs";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Measurement | Project Governance Tool",
};

export default function MeasurementPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <MeasurementTabs />
      </div>
    </div>
  );
}
