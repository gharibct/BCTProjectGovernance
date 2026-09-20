import type { Metadata } from "next";

import { CreateAccountPanel } from "@/components/admin/create-account-panel";

export const metadata: Metadata = {
  title: "Accounts | Governance One",
};

export default function AdminAccountsPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">Create and manage Accounts.</p>
      </header>
      <CreateAccountPanel />
    </div>
  );
}
