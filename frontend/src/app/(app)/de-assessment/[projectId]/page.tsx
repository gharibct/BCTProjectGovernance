import type { Metadata } from "next";

import { DeAssessmentWorkspace } from "@/components/de-assessment-workspace/de-assessment-workspace";

export const metadata: Metadata = {
  title: "Project Assessment | Project Governance Tool",
};

export default function DeAssessmentWorkspacePage() {
  return <DeAssessmentWorkspace />;
}
