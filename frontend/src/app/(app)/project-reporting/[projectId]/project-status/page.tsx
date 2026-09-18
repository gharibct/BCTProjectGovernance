import type { Metadata } from "next";

import { ProjectStatusTabs } from "@/components/project-status/project-status-tabs";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project Status | Governance One",
};

export default function ProjectStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader dynamicSubheading />
      <div className="mt-8">
        <ProjectStatusTabs />
      </div>
    </div>
  );
}
