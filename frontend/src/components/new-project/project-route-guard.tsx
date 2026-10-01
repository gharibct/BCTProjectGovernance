"use client";

import * as React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { NEW_PROJECT_SEGMENT } from "@/stores/new-project-ui";
import { ROLE_LANDING_ROUTE, ROLE_MENUS } from "@/lib/menu-config";
import { useEffectiveRole } from "@/stores/session";
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
    "contractual-commitments",
    "create",
    "de-assessment",
    "map-oracle-projects",
    "measurement",
    "milestones",
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
    "contractual-commitments",
    "initiate-amend",
    "map-oracle-projects",
    "measurement",
    "milestones",
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

  // Creating a project (the "new" draft) is limited to roles whose menu offers
  // "Create Project" — same source as the sidebar entry. The API rejects the
  // POST anyway; this stops the form opening from a pasted URL.
  const role = useEffectiveRole();
  const canCreate = !!role && ROLE_MENUS[role].includes("new-project");
  const blocked = family === "new-project" && !id && !canCreate;

  const owner = project ? projectScreenRoot(project) : null;
  const target = id && owner && owner !== family ? redirectTarget(pathname, id, family, owner) : null;

  React.useEffect(() => {
    if (blocked) router.replace(role ? ROLE_LANDING_ROUTE[role] : "/");
    else if (target) router.replace(target);
  }, [blocked, role, target, router]);

  // Render nothing while the redirect is in flight rather than flashing the wrong
  // screen family.
  if (blocked || target) return null;
  return <>{children}</>;
}
