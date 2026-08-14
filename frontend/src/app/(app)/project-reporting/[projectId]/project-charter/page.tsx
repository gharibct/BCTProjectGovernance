import type { Metadata } from "next";

import { ProjectProfileForm } from "@/components/project-charter/charter-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project Charter — Project Profile | Project Governance Tool",
};

export default function ProjectCharterPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader subheading="Project Profile" />
      <div className="mt-8">
        <ProjectProfileForm />
      </div>
    </div>
  );
}
