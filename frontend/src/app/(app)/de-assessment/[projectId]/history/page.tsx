import type { Metadata } from "next";

import { DeAssessmentHistory } from "@/components/de-assessment-workspace/de-assessment-history";

export const metadata: Metadata = {
  title: "Assessment History | Governance One",
};

export default function DeAssessmentHistoryPage() {
  return <DeAssessmentHistory />;
}
