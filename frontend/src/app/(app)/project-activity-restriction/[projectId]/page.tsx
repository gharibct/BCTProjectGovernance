import type { Metadata } from "next";

import { ProjectActivityRestrictionView } from "@/components/project-activity-restriction/project-activity-restriction-view";

export const metadata: Metadata = {
  title: "Project Activity Restriction | Governance One",
};

export default function ProjectActivityRestrictionPage() {
  return <ProjectActivityRestrictionView />;
}
