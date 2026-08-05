import type { Metadata } from "next";

import { SelfAssessmentForm } from "@/components/new-project/charter-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Self Assessment | Project Governance Tool",
};

export default function NewProjectSelfAssessmentPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Self Assessment" />
      <div className="mt-8">
        <SelfAssessmentForm />
      </div>
    </div>
  );
}
