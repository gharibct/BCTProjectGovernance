import * as React from "react";

import { useProjects, type Project } from "@/lib/api/projects";
import { useAccounts, useGeos, type Account, type Geo } from "@/lib/api/reference-data";
import { useSession } from "@/stores/session";

// The signed-in user's "patch" — which Geos / Accounts / Projects they may
// see or act on — independent of the top-bar Work Context (a Geo Head
// "acting as PM" is still bounded by their own geo(s); see effectiveRole
// elsewhere for menu/level selection, which is a separate concern from this
// data scope). Shared by AppSidebar's nav lists and the standalone Actions
// page (see actions-view.tsx) so the two don't drift.
//
// Admin sees everything. CDO sees every Geo already (there's no per-CDO geo
// allocation); Account/Project have no CDO-specific allocation either, so
// CDO is widened to see every Account/Project too, the same way Admin is.
export function usePatchScope() {
  const user = useSession((s) => s.user);
  const realRole = user?.role.code;
  const isAdmin = realRole === "ADMIN";
  const isCdo = realRole === "CDO";
  const seesAllAccountsAndProjects = isAdmin || isCdo;

  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();

  const patchGeoIds = React.useMemo(
    () => new Set(realRole === "GEO_HEAD" ? (user?.geo_ids ?? []) : []),
    [realRole, user]
  );

  const patchAccountIds = React.useMemo<Set<string> | null>(() => {
    if (seesAllAccountsAndProjects) return null; // null = every account
    if (realRole === "GEO_HEAD")
      return new Set(accounts.filter((a) => a.geo_id && patchGeoIds.has(a.geo_id)).map((a) => a.id));
    return new Set(user?.account_ids ?? []);
  }, [seesAllAccountsAndProjects, realRole, user, accounts, patchGeoIds]);

  const patchProjects: Project[] = React.useMemo(() => {
    if (seesAllAccountsAndProjects) return projects;
    // A PM only sees the projects allocated to them. The server enforces
    // the same scope on GET /projects.
    if (realRole === "PROJECT_MANAGER") return projects.filter((p) => p.project_manager_id === user?.id);
    return projects.filter(
      (p) =>
        (!!p.account_id && !!patchAccountIds && patchAccountIds.has(p.account_id)) ||
        (!!p.geo_id && patchGeoIds.has(p.geo_id))
    );
  }, [projects, seesAllAccountsAndProjects, realRole, user, patchAccountIds, patchGeoIds]);

  const inPatchAccounts = (id: string | null | undefined) =>
    !id ? false : patchAccountIds === null || patchAccountIds.has(id);

  const reportingAccounts: Account[] = seesAllAccountsAndProjects
    ? accounts
    : accounts.filter((a) => inPatchAccounts(a.id));
  const reportingGeos: Geo[] = isAdmin || isCdo ? geos : geos.filter((g) => patchGeoIds.has(g.id));

  return {
    realRole,
    isAdmin,
    patchGeoIds,
    patchAccountIds,
    patchProjects,
    reportingAccounts,
    reportingGeos,
  };
}
