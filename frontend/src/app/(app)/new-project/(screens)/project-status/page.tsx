import type { Metadata } from "next";

import { NewProjectHeader } from "@/components/new-project/new-project-header";
import { StatusForm } from "@/components/new-project/status-form";

export const metadata: Metadata = {
  title: "New Project — Project Status | Project Governance Tool",
};

export default function NewProjectStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Project Status" />
      <div className="mt-8">
        <StatusForm />
      </div>
    </div>
  );
}
