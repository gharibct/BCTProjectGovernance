"use client";

import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useEffectiveRole, useSession } from "@/stores/session";
import type { ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";

// The dashboards' Geo / Region / Account / Period filters, shared by the GovOne
// Dashboard, every Project Health drill-down and the High Risk family
// (Executive Risk / High Risk / Delivery Health / Project Health), so a
// selection carries into the inside pages and is still there on coming back.
// Kept for the browser session (sessionStorage) and keyed per user + Work-as
// role, so one login's selection never leaks into another.
//
// `extras` are a screen's own filters (the selected KPI bucket, Delivery /
// Project Manager), kept per screen because their meaning differs.
export type ScreenFilters = { overall: string; managerId: string };

type State = {
  byScope: Record<string, ProjectHealthDashboardFilters>;
  extras: Record<string, ScreenFilters>;
  set: (scope: string, filters: ProjectHealthDashboardFilters) => void;
  setExtras: (key: string, extras: ScreenFilters) => void;
};

const EMPTY: ProjectHealthDashboardFilters = {};
const NO_EXTRAS: ScreenFilters = { overall: "", managerId: "" };

const useStore = create<State>()(
  persist(
    (set) => ({
      byScope: {},
      extras: {},
      set: (scope, filters) => set((state) => ({ byScope: { ...state.byScope, [scope]: filters } })),
      setExtras: (key, extras) => set((state) => ({ extras: { ...state.extras, [key]: extras } })),
    }),
    { name: "pg-project-health-filters", storage: createJSONStorage(() => sessionStorage) }
  )
);

type Updater = ProjectHealthDashboardFilters | ((prev: ProjectHealthDashboardFilters) => ProjectHealthDashboardFilters);

function useScope(): string {
  const userId = useSession((s) => s.user?.id ?? "");
  const role = useEffectiveRole() ?? "";
  return `${userId}:${role}`;
}

// Drop-in for `useState<ProjectHealthDashboardFilters>({})`.
export function useProjectHealthFilters(): [ProjectHealthDashboardFilters, (next: Updater) => void] {
  const scope = useScope();
  const filters = useStore((s) => s.byScope[scope]) ?? EMPTY;
  const setScope = useStore((s) => s.set);

  const setFilters = React.useCallback(
    (next: Updater) => {
      const prev = useStore.getState().byScope[scope] ?? EMPTY;
      setScope(scope, typeof next === "function" ? next(prev) : next);
    },
    [scope, setScope]
  );
  return [filters, setFilters];
}

// Status (Overall RAG / bucket) + manager filters of one screen, by screen key.
export function useScreenFilters(screen: string) {
  const key = `${useScope()}:${screen}`;
  const extras = useStore((s) => s.extras[key]) ?? NO_EXTRAS;
  const setExtras = useStore((s) => s.setExtras);

  const setOverall = React.useCallback(
    (overall: string) => setExtras(key, { ...(useStore.getState().extras[key] ?? NO_EXTRAS), overall }),
    [key, setExtras]
  );
  const setManagerId = React.useCallback(
    (managerId: string) => setExtras(key, { ...(useStore.getState().extras[key] ?? NO_EXTRAS), managerId }),
    [key, setExtras]
  );
  const reset = React.useCallback(() => setExtras(key, NO_EXTRAS), [key, setExtras]);

  return { overall: extras.overall, managerId: extras.managerId, setOverall, setManagerId, reset };
}
