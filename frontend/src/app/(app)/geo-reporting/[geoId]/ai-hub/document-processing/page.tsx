import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { RegionalHeader } from "@/components/regional-reporting/regional-header";

export const metadata: Metadata = {
  title: "Geo Reporting — Document Processing | Project Governance Tool",
};

// Placeholder — AI Document Processing for Geo Reporting is a real feature
// deferred for a future pass (its own document storage/upload pipeline,
// mirroring the project-scoped version at
// project-reporting/[projectId]/ai-hub/document-processing and the
// account-scoped one at account-reporting/[accountId]/ai-hub/document-processing).
// This route exists now so the GeoNav item is genuinely reachable.
export default function GeoAiDocumentProcessingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <RegionalHeader scope="geo" paramName="geoId" subheading="Document Processing" />
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center">
        <Sparkles className="size-8 text-slate-400" />
        <p className="text-sm font-semibold text-slate-600">Coming soon</p>
        <p className="max-w-md text-sm text-slate-500">
          Geo-level document upload and AI processing isn&apos;t built yet — this screen is a placeholder.
        </p>
      </div>
    </div>
  );
}
