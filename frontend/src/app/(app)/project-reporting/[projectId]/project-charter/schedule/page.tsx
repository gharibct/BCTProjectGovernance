import type { Metadata } from "next";

import { ScopeScheduleForm } from "@/components/project-charter/charter-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project Charter — Scope and Schedule | Project Governance Tool",
};

export default function ProjectCharterSchedulePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader subheading="Scope and Schedule" />
      <div className="mt-8">
        <ScopeScheduleForm />
      </div>
    </div>
  );
}
