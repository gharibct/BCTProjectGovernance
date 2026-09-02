"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { NEW_PROJECT_SEGMENT, useNewProjectUi } from "@/stores/new-project-ui";

// Resets the Edit Project lock whenever the route's :projectId changes —
// unlocked for a fresh draft, locked for a project opened via Maintain
// Project or Amend Project (charter-form.tsx's `isAmendableStatus` overrides
// this back open while the project is Draft or Under Amendment, regardless of
// this flag) — so navigation alone, not a click handler, drives the reset. A
// layout effect avoids a one-frame flash of the previous project's lock state
// before paint. Shared by the /new-project and /amend-project layouts.
export function EditingSync() {
  const { projectId } = useParams<{ projectId: string }>();
  const setEditing = useNewProjectUi((state) => state.setEditing);

  React.useLayoutEffect(() => {
    setEditing(projectId === NEW_PROJECT_SEGMENT);
  }, [projectId, setEditing]);

  return null;
}
