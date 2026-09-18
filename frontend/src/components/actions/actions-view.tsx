"use client";

import { Suspense, useState, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";
import { Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActionListView } from "@/components/action-tracker/action-list-view";
import { ActionDetailView } from "@/components/action-tracker/action-detail-view";
import { ActionCreateView } from "@/components/action-tracker/action-create-view";
import { actionLevelsForRole, canCreateAction } from "@/lib/api/action-permissions";
import { useActions, useActionsBulk, type ActionLevel } from "@/lib/api/actions";
import type { Account, Geo } from "@/lib/api/reference-data";
import type { Project } from "@/lib/api/projects";
import { usePatchScope } from "@/hooks/use-patch-scope";
import { useEffectiveRole } from "@/stores/session";

type ValueOption = { id: string; name: string };

type Drawer = { mode: "detail"; actionId: string; entityId: string } | { mode: "create" } | null;

// Sentinel `id` for "view every entity at this Level combined" (see
// ActionsPageBody's Geo/Account/Project combos) — distinct from `ALL` below,
// which means "no filter" on a combo that's acting as a filter, not a target.
const ALL_TARGET = "__ALL__";

// Just the entity's own name — the Geo name at Level=Geo, the Account name
// at Level=Account, the Project name at Level=Project. Used for the
// per-row scope bubble (ActionListView's `scopeLabel`), where the full
// ancestry would be too long.
function leafName(level: ActionLevel, entityId: string, geos: Geo[], accounts: Account[], projects: Project[]): string {
  if (level === "GEO") return geos.find((g) => g.id === entityId)?.name ?? "—";
  if (level === "ACCOUNT") return accounts.find((a) => a.id === entityId)?.name ?? "—";
  const project = projects.find((p) => p.id === entityId);
  return project ? project.project_name || project.project_code : "—";
}

// "Geo — Account — Project" for whichever entity is actually open in the
// drawer — every ancestor down to `level`, e.g. just the Geo name for a
// Geo-level action, or all three for a Project-level one. Looked up from
// the same patch-scoped lists the combos are built from, since the entity
// being viewed is necessarily already in scope.
function entityBreadcrumb(
  level: ActionLevel,
  entityId: string,
  geos: Geo[],
  accounts: Account[],
  projects: Project[]
): string {
  const geoName = (geoId: string | null) => geos.find((g) => g.id === geoId)?.name ?? "—";
  if (level === "GEO") return leafName(level, entityId, geos, accounts, projects);
  if (level === "ACCOUNT") {
    const account = accounts.find((a) => a.id === entityId);
    return account ? `${geoName(account.geo_id)} — ${account.name}` : "—";
  }
  const project = projects.find((p) => p.id === entityId);
  if (!project) return "—";
  const account = accounts.find((a) => a.id === project.account_id);
  return `${geoName(project.geo_id)} — ${account?.name ?? "—"} — ${project.project_name || project.project_code}`;
}

// The list is always the page content; "New Action" and opening an existing
// action pop out as a right-side drawer on top of it (same Sheet UI as
// ActionTrackerTrigger/ActionTrackerDrawer elsewhere in the app) instead of
// replacing the list in place. The parent mounts this with `key={level:id}`
// (see ActionsPageBody below), so switching the Level/Value combo remounts
// it fresh with the drawer closed instead of carrying over a stale
// selection.
function ActionsForEntity({
  level,
  id,
  name,
  allIds,
  reportingGeos,
  reportingAccounts,
  patchProjects,
}: {
  level: ActionLevel;
  id: string; // a real entity id, or the ALL_TARGET sentinel
  name: string;
  allIds: string[]; // every entity id in scope — only read when id === ALL_TARGET
  reportingGeos: Geo[];
  reportingAccounts: Account[];
  patchProjects: Project[];
}) {
  const effectiveRole = useEffectiveRole();
  const isAll = id === ALL_TARGET;
  // "New Action" needs one concrete entity to file against — the create
  // form locks Level/Value to whatever it's handed (see
  // action-create-view.tsx) and has no picker of its own, so there's no
  // valid target to create against while viewing the "All" aggregate.
  const canCreate = !isAll && canCreateAction(level, effectiveRole);

  const single = useActions(level, isAll ? null : id);
  const bulk = useActionsBulk(level, isAll ? allIds : []);
  const { data: actions = [], isLoading } = isAll ? bulk : single;

  const [drawer, setDrawer] = useState<Drawer>(null);

  const detailEntityId = drawer?.mode === "detail" ? drawer.entityId : id;
  const headerTitle =
    drawer?.mode === "create"
      ? "New Action"
      : `Actions — ${entityBreadcrumb(level, detailEntityId, reportingGeos, reportingAccounts, patchProjects)}`;

  return (
    <>
      <ActionListView
        actions={actions}
        isLoading={isLoading}
        canCreate={canCreate}
        scopeLabel={(action) => leafName(level, action.level_value, reportingGeos, reportingAccounts, patchProjects)}
        onSelect={(actionId) => {
          // In "All" mode every row can belong to a different entity — read
          // its own level_value rather than assuming the outer `id` (which
          // here is just the ALL_TARGET sentinel, not a real entity).
          const entityId = isAll ? (actions.find((a) => a.id === actionId)?.level_value ?? id) : id;
          setDrawer({ mode: "detail", actionId, entityId });
        }}
        onCreate={() => setDrawer({ mode: "create" })}
      />
      <Sheet open={drawer !== null} onOpenChange={(open) => !open && setDrawer(null)}>
        <SheetContent className="gap-0 p-0">
          <SheetHeader>
            <SheetTitle>{headerTitle}</SheetTitle>
            <SheetDescription className="sr-only">Screen-level action tracker.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {drawer?.mode === "detail" ? (
              <ActionDetailView
                level={level}
                id={drawer.entityId}
                actionId={drawer.actionId}
                onBack={() => setDrawer(null)}
              />
            ) : drawer?.mode === "create" ? (
              <ActionCreateView level={level} id={id} name={name} onDone={() => setDrawer(null)} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

const LEVEL_OPTION_LABEL: Record<ActionLevel, string> = { GEO: "Geo", ACCOUNT: "Account", PROJECT: "Project" };

const ALL = ""; // sentinel select value for the "All" (no filter) option, on a combo acting as a filter

function ActionsPageBody() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { patchProjects, reportingAccounts, reportingGeos } = usePatchScope();
  // Which Levels to offer follows the effective (Work Context) role, same as
  // menu visibility — e.g. Admin acting as CDO gets all three levels, not
  // Admin's own (empty) level list. Which entities populate each Level's
  // Geo/Account/Project options still follows the real role's data patch
  // (usePatchScope), exactly like every other Work-Context-aware screen.
  const effectiveRole = useEffectiveRole();
  const levels = actionLevelsForRole(effectiveRole);

  const urlLevel = searchParams.get("level") as ActionLevel | null;
  const level = urlLevel && levels.includes(urlLevel) ? urlLevel : (levels[0] ?? null);

  // Which combos to even show follows the role's own browsable levels
  // (LEVELS_BY_ROLE in action-permissions.ts), not the currently selected
  // Level — a Project Manager only ever has "PROJECT", so they get just the
  // Project combo; an Account Manager has "ACCOUNT"+"PROJECT", so Geo never
  // applies to them at all; Geo Head/CDO have all three. This mirrors the
  // sidebar's own per-role scoping (usePatchScope), it just also decides
  // combo visibility here.
  const showGeo = levels.includes("GEO");
  const showAccount = levels.includes("ACCOUNT");

  // Geo and Account act as cascading filters on whichever combo sits below
  // them in the Geo > Account > Project hierarchy — Geo filters Account and
  // Project; Account (only meaningful once Level=PROJECT) further filters
  // Project. Read from the URL only when the current level actually uses
  // them as filters (and the role even has that combo), so a stale param
  // from a different level/role is ignored rather than silently narrowing
  // the wrong list.
  const urlGeoFilter = showGeo && (level === "ACCOUNT" || level === "PROJECT") ? (searchParams.get("geoId") ?? ALL) : ALL;
  const geoFilterId = reportingGeos.some((g) => g.id === urlGeoFilter) ? urlGeoFilter : ALL;

  const accountsInGeo = geoFilterId ? reportingAccounts.filter((a) => a.geo_id === geoFilterId) : reportingAccounts;

  const urlAccountFilter = showAccount && level === "PROJECT" ? (searchParams.get("accountId") ?? ALL) : ALL;
  const accountFilterId = accountsInGeo.some((a) => a.id === urlAccountFilter) ? urlAccountFilter : ALL;

  const projectsInScope = patchProjects.filter(
    (p) => (!geoFilterId || p.geo_id === geoFilterId) && (!accountFilterId || p.account_id === accountFilterId)
  );

  // The combo matching the selected Level is the target being viewed (its
  // value becomes `id`); Geo/Account options above are filters, already
  // narrowed to `geoFilterId`/`accountFilterId` above. Each also offers
  // ALL_TARGET ("All") to view every one of them combined instead of
  // picking a single entity — and that IS the default: landing on the page,
  // switching Level, or changing a filter above it lands on "All" rather
  // than an arbitrary first entity (which, with many Projects/Accounts in
  // scope, easily landed on one with zero actions and looked broken).
  const urlId = searchParams.get("id");
  const realTargetOptions: ValueOption[] =
    level === "GEO"
      ? reportingGeos.map((g) => ({ id: g.id, name: g.name }))
      : level === "ACCOUNT"
        ? accountsInGeo.map((a) => ({ id: a.id, name: a.name }))
        : level === "PROJECT"
          ? projectsInScope.map((p) => ({ id: p.id, name: p.project_name || p.project_code }))
          : [];
  const targetOptions: ValueOption[] = [{ id: ALL_TARGET, name: "All" }, ...realTargetOptions];
  const defaultId = realTargetOptions.length > 0 ? ALL_TARGET : null;
  const id = urlId && targetOptions.some((o) => o.id === urlId) ? urlId : defaultId;
  const selectedName = id === ALL_TARGET ? "All" : (realTargetOptions.find((o) => o.id === id)?.name ?? "—");

  const setParams = (next: { level: ActionLevel; geoId?: string; accountId?: string; id: string | null }) => {
    const params = new URLSearchParams();
    params.set("level", next.level);
    if (next.geoId) params.set("geoId", next.geoId);
    if (next.accountId) params.set("accountId", next.accountId);
    if (next.id) params.set("id", next.id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Switching Level resets Geo/Account back to "All" and lands the new
  // level's target on "All" too, rather than trying to carry the old
  // selection over as a filter or guessing at a specific first entity.
  const onLevelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextLevel = e.target.value as ActionLevel;
    const hasOptions =
      nextLevel === "GEO" ? reportingGeos.length > 0 : nextLevel === "ACCOUNT" ? reportingAccounts.length > 0 : patchProjects.length > 0;
    setParams({ level: nextLevel, id: hasOptions ? ALL_TARGET : null });
  };

  // Geo combo: the target itself at Level=Geo, otherwise a filter that
  // re-scopes Account/Project and resets whatever combo sits below it back
  // to "All" (its own default) rather than an arbitrary first entity.
  const onGeoChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextGeoId = e.target.value;
    if (level === "GEO") {
      setParams({ level: "GEO", id: nextGeoId });
    } else if (level === "ACCOUNT") {
      const accountsInNextGeo = nextGeoId ? reportingAccounts.filter((a) => a.geo_id === nextGeoId) : reportingAccounts;
      setParams({ level: "ACCOUNT", geoId: nextGeoId, id: accountsInNextGeo.length > 0 ? ALL_TARGET : null });
    } else if (level === "PROJECT") {
      const projectsInNextGeo = patchProjects.filter((p) => !nextGeoId || p.geo_id === nextGeoId);
      setParams({ level: "PROJECT", geoId: nextGeoId, id: projectsInNextGeo.length > 0 ? ALL_TARGET : null });
    }
  };

  // Account combo: the target at Level=Account (filtered by Geo above it),
  // a filter at Level=Project, disabled/"All" at Level=Geo.
  const onAccountChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextAccountId = e.target.value;
    if (level === "ACCOUNT") {
      setParams({ level: "ACCOUNT", geoId: geoFilterId, id: nextAccountId });
    } else if (level === "PROJECT") {
      const projectsInNextScope = patchProjects.filter(
        (p) => (!geoFilterId || p.geo_id === geoFilterId) && (!nextAccountId || p.account_id === nextAccountId)
      );
      setParams({
        level: "PROJECT",
        geoId: geoFilterId,
        accountId: nextAccountId,
        id: projectsInNextScope.length > 0 ? ALL_TARGET : null,
      });
    }
  };

  // Project combo: only ever the target, at Level=Project.
  const onProjectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setParams({ level: "PROJECT", geoId: geoFilterId, accountId: accountFilterId, id: e.target.value });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a Geo, Account or Project to view and raise actions against it.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Level" htmlFor="actions-level" badge={<MandatoryBadge />}>
            <NativeSelect
              id="actions-level"
              value={level ?? ""}
              onChange={onLevelChange}
              disabled={levels.length === 0}
            >
              {levels.length === 0 ? <option value="">None available</option> : null}
              {levels.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_OPTION_LABEL[l]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {showGeo ? (
            <Field label="Geo" htmlFor="actions-geo" badge={level === "GEO" ? <MandatoryBadge /> : undefined}>
              <NativeSelect
                id="actions-geo"
                value={level === "GEO" ? (id ?? "") : geoFilterId}
                onChange={onGeoChange}
                disabled={!level || reportingGeos.length === 0}
              >
                <option value={level === "GEO" ? ALL_TARGET : ALL}>All</option>
                {reportingGeos.length === 0 ? <option value="">None available</option> : null}
                {reportingGeos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}

          {showAccount ? (
            <Field label="Account" htmlFor="actions-account" badge={level === "ACCOUNT" ? <MandatoryBadge /> : undefined}>
              <NativeSelect
                id="actions-account"
                value={level === "GEO" ? ALL : level === "ACCOUNT" ? (id ?? "") : accountFilterId}
                onChange={onAccountChange}
                disabled={level === "GEO" || !level}
              >
                <option value={level === "ACCOUNT" ? ALL_TARGET : ALL}>All</option>
                {level !== "GEO" && accountsInGeo.length === 0 ? <option value="">None available</option> : null}
                {level !== "GEO"
                  ? accountsInGeo.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))
                  : null}
              </NativeSelect>
            </Field>
          ) : null}

          <Field label="Project" htmlFor="actions-project" badge={level === "PROJECT" ? <MandatoryBadge /> : undefined}>
            <NativeSelect
              id="actions-project"
              value={level === "PROJECT" ? (id ?? "") : ALL}
              onChange={onProjectChange}
              disabled={level !== "PROJECT"}
            >
              <option value={level === "PROJECT" ? ALL_TARGET : ALL}>All</option>
              {level === "PROJECT" && projectsInScope.length === 0 ? <option value="">None available</option> : null}
              {level === "PROJECT"
                ? projectsInScope.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name || p.project_code}
                    </option>
                  ))
                : null}
            </NativeSelect>
          </Field>
        </div>
      </div>

      {!level || !id ? (
        <EmptyState>No {level ? LEVEL_OPTION_LABEL[level].toLowerCase() : "entity"} available yet.</EmptyState>
      ) : (
        <ActionsForEntity
          key={`${level}:${id}`}
          level={level}
          id={id}
          name={selectedName}
          allIds={realTargetOptions.map((o) => o.id)}
          reportingGeos={reportingGeos}
          reportingAccounts={reportingAccounts}
          patchProjects={patchProjects}
        />
      )}
    </div>
  );
}

export function ActionsView() {
  return (
    // useSearchParams (for the selected Level/Value) requires a Suspense
    // boundary at prerender.
    <Suspense fallback={null}>
      <ActionsPageBody />
    </Suspense>
  );
}
