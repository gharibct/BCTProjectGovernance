import type { Metadata } from "next";

import { BulkProjectImportPanel } from "@/components/admin/bulk-project-import-panel";

export const metadata: Metadata = {
  title: "Bulk Projects | Governance One",
};

export default function AdminBulkProjectsPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Bulk Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import many projects at once. Each row is created as a Draft project with its Oracle Project mapped.
        </p>
      </header>
      <BulkProjectImportPanel />
    </div>
  );
}
