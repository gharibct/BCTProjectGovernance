import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// Explanatory text for the Project Profile "Project Owned" field's info
// tooltip. Served read-only from GET /project-owned-reference (backend
// app/data/project_owned_reference.yaml). Uses the default React Query
// caching (refetch on mount/focus) so an edit to the yaml shows up on the
// next navigation rather than only after a hard refresh.

export type ProjectOwnedReferenceEntry = {
  description: string;
};

// Keyed by the ProjectOwned enum value ("Fully Owned", "Co-Owned", "Customer Driven").
export type ProjectOwnedReferenceResponse = Record<string, ProjectOwnedReferenceEntry>;

export function useProjectOwnedReference() {
  return useQuery({
    queryKey: ["project-owned-reference"],
    queryFn: () => api.get<ProjectOwnedReferenceResponse>("/project-owned-reference"),
  });
}
