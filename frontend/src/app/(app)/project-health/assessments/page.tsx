import type { Metadata } from "next";

import { ProjectHealthAssessments } from "@/components/dashboard/project-health-assessments";

export const metadata: Metadata = { title: "Assessments | Project Governance Tool" };

export default function AssessmentsPage() {
  return <ProjectHealthAssessments />;
}
