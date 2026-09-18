import type { Metadata } from "next";

import { DeAssessmentQueue } from "@/components/de-assessment-workspace/de-assessment-queue";

export const metadata: Metadata = {
  title: "DE Assessment | Governance One",
};

export default function DeAssessmentQueuePage() {
  return <DeAssessmentQueue />;
}
