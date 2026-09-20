import type { Metadata } from "next";

import { CreateGeoPanel } from "@/components/admin/create-geo-panel";

export const metadata: Metadata = {
  title: "Geos | Governance One",
};

export default function AdminGeosPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Geos</h1>
        <p className="mt-1 text-sm text-slate-500">Create and manage Geos.</p>
      </header>
      <CreateGeoPanel />
    </div>
  );
}
