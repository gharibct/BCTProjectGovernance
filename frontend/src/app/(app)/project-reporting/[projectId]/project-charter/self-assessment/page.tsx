import type { Metadata } from "next";

import { SelfAssessmentForm } from "@/components/project-charter/charter-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project Charter — RAG Status | Project Governance Tool",
};

export default function ProjectCharterSelfAssessmentPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <SelfAssessmentForm />
      </div>
    </div>
  );
}
