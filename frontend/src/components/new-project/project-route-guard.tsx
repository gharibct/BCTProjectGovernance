"use client";

import * as React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { NEW_PROJECT_SEGMENT } from "@/stores/new-project-ui";
import { projectScreenRoot, useProject, type ProjectScreenRoot } from "@/lib/api/projects";

// Keeps a project on the screen family that owns its current status, whichever URL
// it was opened from (bookmark, notification link, back button). The picker already
// only lists eligible projects; this covers direct navigation.
//
//   Draft                                  -> /new-project  (Project Setup)
//   Pending Approval, no amendment         -> /new-project  (read-only)
//   Approved / Under Amendment             -> /amend-project
//   Pending Approval from an amendment     -> /amend-project (read-only)
//
// Whether a screen may be *edited* is separate — see useBaselineEditable.

// Sub-paths (after /{family}/{projectId}/) that exist in each family.
const SUBPATHS: Record<ProjectScreenRoot, readonly string[]> = {
  "new-project": [
    "ai-hub/document-processing",
    "contractual-compliance",
    "create",
    "de-assessment",
    "map-oracle-projects",
    "measurement",
    "project-charter",
    "project-charter/schedule",
    "project-charter/self-assessment",
    "project-status",
    "raido",
    "resource-allocation",
    "send-to-approval",
  ],
  "amend-project": [
    "ai-hub/document-processing",
    "contractual-compliance",
    "initiate-amend",
    "map-oracle-projects",
    "measurement",
    "project-charter",
    "project-charter/schedule",
    "raido",
    "resource-allocation",
    "send-to-approval",
  ],
};

// The equivalent screen in the other family, or that family's first screen when
// there is no equivalent.
function equivalentSubpath(subpath: string, to: ProjectScreenRoot): string {
  if (to === "new-project" && subpath === "initiate-amend") return "send-to-approval";
  return SUBPATHS[to].includes(subpath) ? subpath : "project-charter";
}

export function redirectTarget(
  pathname: string,
  projectId: string,
  from: ProjectScreenRoot,
  to: ProjectScreenRoot,
): string {
  const prefix = `/${from}/${projectId}`;
  const subpath = pathname.startsWith(prefix) ? pathname.slice(prefix.length).replace(/^\/+|\/+$/g, "") : "";
  return `/${to}/${projectId}/${equivalentSubpath(subpath, to)}`;
}

export function ProjectRouteGuard({
  family,
  children,
}: {
  family: ProjectScreenRoot;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { projectId } = useParams<{ projectId: string }>();
  // "new" is the not-yet-created draft: nothing to redirect on.
  const id = projectId && projectId !== NEW_PROJECT_SEGMENT ? projectId : null;
  const { data: project } = useProject(id);

  const owner = project ? projectScreenRoot(project) : null;
  const target = id && owner && owner !== family ? redirectTarget(pathname, id, family, owner) : null;

  React.useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  // Render nothing while the redirect is in flight rather than flashing the wrong
  // screen family.
  if (target) return null;
  return <>{children}</>;
}
