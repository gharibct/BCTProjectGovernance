import type { Metadata } from "next";

import { CreateAccountPanel } from "@/components/admin/create-account-panel";

export const metadata: Metadata = {
  title: "Accounts | Project Governance Tool",
};

export default function AdminAccountsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
      <p className="mt-1 text-sm text-slate-500">Create and manage Accounts.</p>
      <div className="mt-8">
        <CreateAccountPanel />
      </div>
    </div>
  );
}
