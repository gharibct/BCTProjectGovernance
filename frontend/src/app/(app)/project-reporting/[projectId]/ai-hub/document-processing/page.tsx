import type { Metadata } from "next";

import { DocumentProcessing } from "@/components/ai-hub/document-processing";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "AI Document Processing | Project Governance Tool",
};

export default function DocumentProcessingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader />
      <div className="mt-8">
        <DocumentProcessing />
      </div>
    </div>
  );
}
