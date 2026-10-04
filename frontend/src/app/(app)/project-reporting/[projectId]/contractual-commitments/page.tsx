import type { Metadata } from "next";

import { ActivityGate } from "@/components/forms/activity-gate";
import { CommitmentsTab } from "@/components/contractual-compliance/commitments-tab";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Contractual Commitments | Governance One",
};

export default function CommitmentsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader subheading="Contractual Commitments" />
      <div className="mt-8">
        <ActivityGate activity="COMMITMENTS" usePeriodParam>
          <CommitmentsTab />
        </ActivityGate>
      </div>
    </div>
  );
}
