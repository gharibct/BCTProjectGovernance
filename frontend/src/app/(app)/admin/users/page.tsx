import type { Metadata } from "next";

import { CreateUserPanel } from "@/components/admin/create-user-panel";

export const metadata: Metadata = {
  title: "Users & Roles | Governance One",
};

export default function AdminUsersPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Users & Roles</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create users and assign their role. Account Manager / Geo Head mapping is
          done on the Accounts and Geos screens.
        </p>
      </header>
      <CreateUserPanel />
    </div>
  );
}
