import type { Metadata } from "next";

import { StatusForm } from "@/components/project-status/status-form";
import { StatusHeader } from "@/components/project-status/status-header";

export const metadata: Metadata = {
  title: "Project Status | Project Governance Tool",
};

export default function ProjectStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <StatusHeader />
      <div className="mt-8">
        <StatusForm />
      </div>
    </div>
  );
}
