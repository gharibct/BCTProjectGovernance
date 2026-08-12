import type { Metadata } from "next";

import { CreateUserPanel } from "@/components/admin/create-user-panel";

export const metadata: Metadata = {
  title: "Users & Roles | Project Governance Tool",
};

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">Users & Roles</h1>
      <p className="mt-1 text-sm text-slate-500">
        Create users and assign the Accounts/Geos they can see.
      </p>
      <div className="mt-8">
        <CreateUserPanel />
      </div>
    </div>
  );
}
