import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Account Reporting — AI Document Processing | Project Governance Tool",
};

// Placeholder — AI Document Processing for Account Reporting is a real
// feature deferred for a future pass (its own document storage/upload
// pipeline, mirroring the project-scoped version at
// project-reporting/[projectId]/ai-hub/document-processing). This route
// exists now so the AccountNav item is genuinely reachable.
export default function AccountAiDocumentProcessingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Document Processing</h1>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center">
        <Sparkles className="size-8 text-slate-400" />
        <p className="text-sm font-semibold text-slate-600">Coming soon</p>
        <p className="max-w-md text-sm text-slate-500">
          Account-level document upload and AI processing isn&apos;t built yet — this screen is a placeholder.
        </p>
      </div>
    </div>
  );
}
