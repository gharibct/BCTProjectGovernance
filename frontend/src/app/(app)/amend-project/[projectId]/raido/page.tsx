import type { Metadata } from "next";

import { RaidoTabs } from "@/components/new-project/raido/raido-tabs";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Project RAIDO Register | Project Governance Tool",
};

export default function AmendProjectRaidoPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Project RAIDO Register" />
      <div className="mt-8">
        <RaidoTabs />
      </div>
    </div>
  );
}
