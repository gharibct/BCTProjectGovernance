import type { Metadata } from "next";

import { DocumentProcessing } from "@/components/new-project/ai-hub/document-processing";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — AI Document Processing | Project Governance Tool",
};

export default function NewProjectDocumentProcessingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="AI Document Processing" />
      <div className="mt-8">
        <DocumentProcessing />
      </div>
    </div>
  );
}
