import type { Metadata } from "next";

import { AccountRagStatusForm } from "@/components/account-reporting/rag-status-form";

export const metadata: Metadata = {
  title: "Account Reporting — RAG Status | Project Governance Tool",
};

export default function AccountRagStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">RAG Status</h1>
      <div className="mt-8">
        <AccountRagStatusForm />
      </div>
    </div>
  );
}
