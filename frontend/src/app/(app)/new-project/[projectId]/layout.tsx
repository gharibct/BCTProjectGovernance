"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { NewProjectNav } from "@/components/new-project/new-project-nav";
import { NEW_PROJECT_SEGMENT, useNewProjectUi } from "@/stores/new-project-ui";

// Resets the Edit Project lock whenever the route's :projectId changes —
// unlocked for a fresh draft, locked for a project opened via Maintain
// Project (charter-form.tsx's `isDraftStatus` overrides this back open for
// as long as the project itself is still in Draft status, regardless of this
// flag) — so navigation alone, not a click handler, drives the reset. A
// layout effect avoids a one-frame flash of the previous project's lock
// state before paint.
function EditingSync() {
  const { projectId } = useParams<{ projectId: string }>();
  const setEditing = useNewProjectUi((state) => state.setEditing);

  React.useLayoutEffect(() => {
    setEditing(projectId === NEW_PROJECT_SEGMENT);
  }, [projectId, setEditing]);

  return null;
}

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
