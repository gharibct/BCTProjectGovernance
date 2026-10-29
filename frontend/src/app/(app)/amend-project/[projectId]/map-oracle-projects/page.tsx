import type { Metadata } from "next";

import { OracleMappingForm } from "@/components/new-project/oracle-mapping/oracle-mapping-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Link Contract Documents | Governance One",
};

export default function AmendProjectMapOracleProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Link Contract Documents" />
      <div className="mt-8">
        <OracleMappingForm />
      </div>
    </div>
  );
}
