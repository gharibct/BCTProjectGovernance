"use client";

import { Suspense, useState, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";
import { Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { ActionListView } from "@/components/action-tracker/action-list-view";
import { ActionDetailView } from "@/components/action-tracker/action-detail-view";
import { ActionCreateView } from "@/components/action-tracker/action-create-view";
import { actionLevelsForRole, canCreateAction } from "@/lib/api/action-permissions";
import type { ActionLevel } from "@/lib/api/actions";
import { usePatchScope } from "@/hooks/use-patch-scope";
import { useEffectiveRole } from "@/stores/session";

type ValueOption = { id: string; name: string };

type View = { mode: "list" } | { mode: "detail"; actionId: string } | { mode: "create" };

// Three views (list/detail/create) for one Level+Value entity, exactly
// mirroring ActionTrackerDrawer's state machine (see action-tracker-drawer.tsx)
// but as plain page content instead of Sheet content — ActionListView/
// ActionDetailView/ActionCreateView are plain, prop-driven panels with no
// Sheet coupling, so they drop in here unchanged. The parent mounts this
// with `key={level:id}` (see ActionsPageBody below), so switching the
// Level/Value combo remounts it fresh at "list" instead of carrying over
// stale view/selectedId state — the same class of bug fixed for the drawer,
// avoided here for free by remounting rather than an open/close effect.
function ActionsForEntity({ level, id, name }: { level: ActionLevel; id: string; name: string }) {
  const effectiveRole = useEffectiveRole();
  const canCreate = canCreateAction(level, effectiveRole);
  const [view, setView] = useState<View>({ mode: "list" });

  return view.mode === "list" ? (
    <ActionListView
      level={level}
      id={id}
      canCreate={canCreate}
      onSelect={(actionId) => setView({ mode: "detail", actionId })}
      onCreate={() => setView({ mode: "create" })}
    />
  ) : view.mode === "detail" ? (
    <ActionDetailView level={level} id={id} actionId={view.actionId} onBack={() => setView({ mode: "list" })} />
  ) : (
    <ActionCreateView level={level} id={id} name={name} onDone={() => setView({ mode: "list" })} />
  );
}

const LEVEL_OPTION_LABEL: Record<ActionLevel, string> = { GEO: "Geo", ACCOUNT: "Account", PROJECT: "Project" };

function ActionsPageBody() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { patchProjects, reportingAccounts, reportingGeos } = usePatchScope();
  // Which Levels to offer follows the effective (Work Context) role, same as
  // menu visibility — e.g. Admin acting as CDO gets all three levels, not
  // Admin's own (empty) level list. Which entities populate each Level's
  // Value options still follows the real role's data patch (usePatchScope),
  // exactly like every other Work-Context-aware screen in the app.
  const effectiveRole = useEffectiveRole();
  const levels = actionLevelsForRole(effectiveRole);

  const optionsForLevel = (l: ActionLevel): ValueOption[] =>
    l === "GEO"
      ? reportingGeos.map((g) => ({ id: g.id, name: g.name }))
      : l === "ACCOUNT"
        ? reportingAccounts.map((a) => ({ id: a.id, name: a.name }))
        : patchProjects.map((p) => ({ id: p.id, name: p.project_name || p.project_code }));

  const urlLevel = searchParams.get("level") as ActionLevel | null;
  const level = urlLevel && levels.includes(urlLevel) ? urlLevel : (levels[0] ?? null);
  const currentOptions = level ? optionsForLevel(level) : [];

  const urlId = searchParams.get("id");
  const id = urlId && currentOptions.some((o) => o.id === urlId) ? urlId : (currentOptions[0]?.id ?? null);
  const selectedName = currentOptions.find((o) => o.id === id)?.name ?? "—";

  const setParams = (nextLevel: ActionLevel, nextId: string | null) => {
    const params = new URLSearchParams();
    params.set("level", nextLevel);
    if (nextId) params.set("id", nextId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const onLevelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextLevel = e.target.value as ActionLevel;
    setParams(nextLevel, optionsForLevel(nextLevel)[0]?.id ?? null);
  };

  const onValueChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (level) setParams(level, e.target.value);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a Geo, Account or Project to view and raise actions against it.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
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
          <Field
            label={level ? LEVEL_OPTION_LABEL[level] : "Entity"}
            htmlFor="actions-value"
            badge={<MandatoryBadge />}
          >
            <NativeSelect id="actions-value" value={id ?? ""} onChange={onValueChange} disabled={!level}>
              {currentOptions.length === 0 ? <option value="">None available</option> : null}
              {currentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>

      {!level || !id ? (
        <EmptyState>No {level ? LEVEL_OPTION_LABEL[level].toLowerCase() : "entity"} available yet.</EmptyState>
      ) : (
        <ActionsForEntity key={`${level}:${id}`} level={level} id={id} name={selectedName} />
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
