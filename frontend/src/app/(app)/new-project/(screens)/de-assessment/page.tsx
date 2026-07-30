import type { Metadata } from "next";

import { DeAssessmentForm } from "@/components/new-project/de-assessment-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — DE Assessment | Project Governance Tool",
};

export default function NewProjectDeAssessmentPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="DE Assessment" />
      <div className="mt-8">
        <DeAssessmentForm />
      </div>
    </div>
  );
}
