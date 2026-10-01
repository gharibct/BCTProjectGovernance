import type { Metadata } from "next";

import { BaselineGate } from "@/components/new-project/baseline-lock";
import { CommitmentsTab } from "@/components/new-project/contractual-compliance/commitments-tab";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Contractual Commitments | Governance One",
};

export default function NewProjectCommitmentsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Contractual Commitments" />
      <div className="mt-8">
        <BaselineGate>
          <CommitmentsTab />
        </BaselineGate>
      </div>
    </div>
  );
}
