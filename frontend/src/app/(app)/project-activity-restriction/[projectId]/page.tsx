import type { Metadata } from "next";

import { ProjectActivityRestrictionView } from "@/components/project-activity-restriction/project-activity-restriction-view";

export const metadata: Metadata = {
  title: "Configure Project Activities | Governance One",
};

export default function ProjectActivityRestrictionPage() {
  return <ProjectActivityRestrictionView />;
}
