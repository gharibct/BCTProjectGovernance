import type { Metadata } from "next";

import { ProjectHealthActions } from "@/components/dashboard/project-health-actions";

export const metadata: Metadata = { title: "Actions | Governance One" };

export default function ActionsPage() {
  return <ProjectHealthActions />;
}
