import type { Metadata } from "next";

import { CreateUserPanel } from "@/components/admin/create-user-panel";

export const metadata: Metadata = {
  title: "Users & Roles | Governance One",
};

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">Users & Roles</h1>
      <p className="mt-1 text-sm text-slate-500">
        Create users and assign their role. Account Manager / Geo Head mapping is
        done on the Accounts and Geos screens.
      </p>
      <div className="mt-8">
        <CreateUserPanel />
      </div>
    </div>
  );
}
