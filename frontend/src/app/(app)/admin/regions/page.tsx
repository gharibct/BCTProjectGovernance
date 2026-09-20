import type { Metadata } from "next";

import { CreateRegionPanel } from "@/components/admin/create-region-panel";

export const metadata: Metadata = {
  title: "Regions | Governance One",
};

export default function AdminRegionsPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Regions</h1>
        <p className="mt-1 text-sm text-slate-500">Create and manage Regions within a Geo.</p>
      </header>
      <CreateRegionPanel />
    </div>
  );
}
