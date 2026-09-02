import type { Metadata } from "next";

import { ContractualComplianceForm } from "@/components/new-project/contractual-compliance/contractual-compliance-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Contractual Compliance | Project Governance Tool",
};

export default function AmendProjectContractualCompliancePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Contractual Compliance" />
      <div className="mt-8">
        <ContractualComplianceForm />
      </div>
    </div>
  );
}
