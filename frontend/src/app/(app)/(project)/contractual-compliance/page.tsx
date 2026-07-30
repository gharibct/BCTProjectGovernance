import type { Metadata } from "next";

import { ContractualComplianceForm } from "@/components/contractual-compliance/contractual-compliance-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Contractual Compliance | Project Governance Tool",
};

export default function ContractualCompliancePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <ContractualComplianceForm />
      </div>
    </div>
  );
}
