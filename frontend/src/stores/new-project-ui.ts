"use client";

import { useParams } from "next/navigation";
import { create } from "zustand";

// The sentinel :projectId route segment for a draft that hasn't been
// Created yet (see app/(app)/new-project/page.tsx's redirect target and
// [projectId]/layout.tsx's EditingSync).
export const NEW_PROJECT_SEGMENT = "new";

// Which project is loaded into the New Project charter screens now lives
// entirely in the URL (`/new-project/[projectId]/...`) rather than client
// state, so Maintain Project / New Project links are plain navigations and
// the browser back/forward buttons, refresh, and bookmarks all agree with
// what's on screen.
export function useNewProjectId(): string | null {
  const params = useParams<{ projectId: string }>();
  return params.projectId && params.projectId !== NEW_PROJECT_SEGMENT ? params.projectId : null;
}

type NewProjectUiState = {
  // Whether the Project Profile / Scope & Schedule / Self Assessment tabs
  // (separate routes under the same :projectId) are unlocked for editing.
  // Kept in a small store rather than local state because it must survive
  // navigating between those tabs; [projectId]/layout.tsx resets it
  // whenever the route's :projectId changes.
  isEditing: boolean;
  setEditing: (isEditing: boolean) => void;
};

export const useNewProjectUi = create<NewProjectUiState>((set) => ({
  isEditing: true,
  setEditing: (isEditing) => set({ isEditing }),
}));
