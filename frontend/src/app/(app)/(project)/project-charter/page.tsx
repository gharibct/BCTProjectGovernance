import type { Metadata } from "next";

import { CharterForm } from "@/components/project-charter/charter-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project Charter | Project Governance Tool",
};

export default function ProjectCharterPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <CharterForm />
      </div>
    </div>
  );
}
