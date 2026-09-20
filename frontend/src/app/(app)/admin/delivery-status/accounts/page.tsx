import type { Metadata } from "next";

import { BulkAccountStatusPanel } from "@/components/admin/bulk-delivery-status-panel";

export const metadata: Metadata = {
  title: "Bulk DSR - Accounts | Governance One",
};

export default function AdminBulkAccountStatusPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Bulk DSR - Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload Delivery Status reports in bulk. Each row is created as a Draft report for its period, with Key Metrics and status items.
        </p>
      </header>
      <BulkAccountStatusPanel />
    </div>
  );
}
