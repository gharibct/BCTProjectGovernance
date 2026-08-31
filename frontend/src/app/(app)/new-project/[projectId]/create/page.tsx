import type { Metadata } from "next";

import { ProjectCreationForm } from "@/components/new-project/project-creation-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Create | Project Governance Tool",
};

export default function NewProjectCreatePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Create Project" />
      <div className="mt-8">
        <ProjectCreationForm />
      </div>
    </div>
  );
}
