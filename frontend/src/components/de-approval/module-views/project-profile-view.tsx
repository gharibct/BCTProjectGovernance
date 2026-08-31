"use client";

import { ProjectProfileForm } from "@/components/project-charter/charter-form";

// Reuses the already-read-only Project Profile charter form (every control is
// hard-disabled, no submit). It reads the projectId from the route params
// itself, which /de-approval/[projectId]/project-profile provides.
export function ProjectProfileView() {
  return <ProjectProfileForm />;
}
