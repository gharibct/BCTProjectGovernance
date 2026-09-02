import * as React from "react";

import { EditingSync } from "@/components/new-project/editing-sync";
import { NewProjectNav } from "@/components/new-project/new-project-nav";

export default function NewProjectScreensLayout({
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
