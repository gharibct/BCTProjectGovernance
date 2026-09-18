import type { Metadata } from "next";

import { CreateGeoPanel } from "@/components/admin/create-geo-panel";

export const metadata: Metadata = {
  title: "Geos | Governance One",
};

export default function AdminGeosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">Geos</h1>
      <p className="mt-1 text-sm text-slate-500">Create and manage Geos.</p>
      <div className="mt-8">
        <CreateGeoPanel />
      </div>
    </div>
  );
}
