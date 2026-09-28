"use client";

import { useParams } from "next/navigation";

// The sentinel :projectId route segment for a draft that hasn't been
// Created yet (see app/(app)/new-project/page.tsx's redirect target and
// ProjectRouteGuard).
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
