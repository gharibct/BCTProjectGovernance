import type { Metadata } from "next";

import { CharterForm } from "@/components/new-project/charter-form";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Project Charter | Project Governance Tool",
};

export default function NewProjectCharterPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader />
      <div className="mt-8">
        <CharterForm />
      </div>
    </div>
  );
}
