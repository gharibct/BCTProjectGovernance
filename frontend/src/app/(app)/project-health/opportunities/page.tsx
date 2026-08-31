import type { Metadata } from "next";

import { ProjectHealthOpportunities } from "@/components/dashboard/project-health-opportunities";

export const metadata: Metadata = { title: "Opportunities | Project Governance Tool" };

export default function OpportunitiesPage() {
  return <ProjectHealthOpportunities />;
}
