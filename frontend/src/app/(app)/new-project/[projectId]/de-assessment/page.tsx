import type { Metadata } from "next";

import { DeAssessmentForm } from "@/components/new-project/de-assessment/de-assessment-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — DE Assessment | Governance One",
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
