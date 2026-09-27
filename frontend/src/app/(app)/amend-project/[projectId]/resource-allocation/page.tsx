import type { Metadata } from "next";

import { NewProjectHeader } from "@/components/new-project/new-project-header";
import { ResourceAllocationView } from "@/components/new-project/resource-allocation/resource-allocation-view";

export const metadata: Metadata = {
  title: "Amend Project — Resource Allocation | Governance One",
};

export default function AmendProjectResourceAllocationPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Resource Allocation" />
      <div className="mt-8">
        <ResourceAllocationView />
      </div>
    </div>
  );
}
