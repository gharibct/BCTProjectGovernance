import type { Metadata } from "next";

import { BaselineGate } from "@/components/new-project/baseline-lock";
import { MilestonesTab } from "@/components/new-project/contractual-compliance/milestones-tab";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Payment Milestones | Governance One",
};

export default function NewProjectMilestonesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Payment Milestones" />
      <div className="mt-8">
        <BaselineGate>
          <MilestonesTab />
        </BaselineGate>
      </div>
    </div>
  );
}
