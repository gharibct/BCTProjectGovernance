import type { Metadata } from "next";

import { OracleMappingForm } from "@/components/new-project/oracle-mapping/oracle-mapping-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Map Oracle Projects | Project Governance Tool",
};

export default function AmendProjectMapOracleProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Map Oracle Projects" />
      <div className="mt-8">
        <OracleMappingForm />
      </div>
    </div>
  );
}
