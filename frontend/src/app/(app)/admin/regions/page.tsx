import type { Metadata } from "next";

import { CreateRegionPanel } from "@/components/admin/create-region-panel";

export const metadata: Metadata = {
  title: "Regions | Governance One",
};

export default function AdminRegionsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">Regions</h1>
      <p className="mt-1 text-sm text-slate-500">Create and manage Regions within a Geo.</p>
      <div className="mt-8">
        <CreateRegionPanel />
      </div>
    </div>
  );
}
