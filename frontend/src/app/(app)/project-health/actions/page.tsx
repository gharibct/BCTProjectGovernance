import type { Metadata } from "next";

import { ProjectHealthActions } from "@/components/dashboard/project-health-actions";

export const metadata: Metadata = { title: "Actions | Project Governance Tool" };

export default function ActionsPage() {
  return <ProjectHealthActions />;
}
