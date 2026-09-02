import type { Metadata } from "next";

import { ScopeScheduleForm } from "@/components/new-project/charter-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Scope & Schedule | Project Governance Tool",
};

export default function AmendProjectSchedulePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Scope & Schedule" />
      <div className="mt-8">
        <ScopeScheduleForm />
      </div>
    </div>
  );
}
