import type { Metadata } from "next";

import { DeAssessmentForm } from "@/components/de-assessment/de-assessment-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "DE Assessment | Project Governance Tool",
};

export default function DeAssessmentPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader hidePeriod />
      <div className="mt-8">
        <DeAssessmentForm />
      </div>
    </div>
  );
}
