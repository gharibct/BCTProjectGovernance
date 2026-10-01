import type { Metadata } from "next";

import { MilestonesTab } from "@/components/contractual-compliance/milestones-tab";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Payment Milestones | Governance One",
};

export default function MilestonesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader subheading="Payment Milestones" />
      <div className="mt-8">
        <MilestonesTab />
      </div>
    </div>
  );
}
