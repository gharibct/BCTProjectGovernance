import type { Metadata } from "next";

import { MeasurementTabs } from "@/components/new-project/measurement/measurement-tabs";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Measurement | Project Governance Tool",
};

export default function NewProjectMeasurementPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Measurement" />
      <div className="mt-8">
        <MeasurementTabs />
      </div>
    </div>
  );
}
