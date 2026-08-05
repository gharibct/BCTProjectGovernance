import type { Metadata } from "next";

import { StatusForm } from "@/components/project-status/status-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project Status | Project Governance Tool",
};

export default function ProjectStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <StatusForm />
      </div>
    </div>
  );
}
