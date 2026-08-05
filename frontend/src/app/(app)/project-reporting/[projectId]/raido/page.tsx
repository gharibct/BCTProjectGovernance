import type { Metadata } from "next";

import { RaidoTabs } from "@/components/raido/raido-tabs";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Project RAIDO Register | Project Governance Tool",
};

export default function RaidoPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <RaidoTabs />
      </div>
    </div>
  );
}
