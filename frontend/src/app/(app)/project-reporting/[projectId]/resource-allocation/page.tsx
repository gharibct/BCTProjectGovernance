import type { Metadata } from "next";

import { ResourceAllocationForm } from "@/components/project-charter/charter-form";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Resource Allocation | Project Governance Tool",
};

export default function ResourceAllocationPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader subheading="Resource Allocation" />
      <div className="mt-8">
        <ResourceAllocationForm />
      </div>
    </div>
  );
}
