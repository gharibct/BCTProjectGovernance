import type { Metadata } from "next";

import { AccountRagStatusForm } from "@/components/account-reporting/rag-status-form";
import { RegionalHeader } from "@/components/regional-reporting/regional-header";

export const metadata: Metadata = {
  title: "Account Reporting — RAG Status | Project Governance Tool",
};

export default function AccountRagStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <RegionalHeader scope="account" paramName="accountId" subheading="RAG Status" />
      <div className="mt-8">
        <AccountRagStatusForm />
      </div>
    </div>
  );
}
