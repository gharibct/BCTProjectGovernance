import * as React from "react";

import { EditingSync } from "@/components/new-project/editing-sync";
import { NewProjectNav } from "@/components/new-project/new-project-nav";

// Amend Project reuses the New Project setup screens and rail (see
// new-project-nav.tsx — under this route prefix the "Approval" group becomes
// "Amend & Approve": Initiate Amend + Send To Approve) for an already-approved
// project. Editability is status-driven: the charter is locked until the
// amendment is initiated (status → Under Amendment).
export default function AmendProjectScreensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <EditingSync />
      <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
        {children}
      </main>
      <NewProjectNav />
    </>
  );
}
