import type { Metadata } from "next";

import { ProjectProfileForm } from "@/components/new-project/charter-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Project Profile | Project Governance Tool",
};

export default function AmendProjectCharterPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Project Profile" />
      <div className="mt-8">
        <ProjectProfileForm />
      </div>
    </div>
  );
}
