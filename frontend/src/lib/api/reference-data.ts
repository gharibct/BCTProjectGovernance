import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, type Page } from "./client";

export type Organization = { id: string; code: string; name: string; is_active: boolean };
export type Geo = { id: string; code: string; name: string; is_active: boolean };
export type Region = { id: string; geo_id: string; code: string; name: string; is_active: boolean };
export type ProjectType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};
export type Product = { id: string; code: string; name: string; is_active: boolean };
export type Account = {
  id: string;
  name: string;
  geo_id: string | null;
  description: string | null;
  is_active: boolean;
};

export type PeriodType = "Weekly" | "Monthly" | "Baseline";
export type ReportingPeriod = {
  id: string;
  period_type: PeriodType;
  code: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type Role = { id: string; code: string; name: string; description: string | null };
export type User = {
  id: string;
  ldap_username: string;
  full_name: string;
  email: string;
  role_id: string;
  is_active: boolean;
};

// Reference data lists are small and admin-maintained, so a generous
// pagination limit gets everything in one request rather than paging.
const REF_LIMIT = "?limit=200";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.get<Page<Organization>>(`/organizations${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export function useGeos() {
  return useQuery({
    queryKey: ["geos"],
    queryFn: () => api.get<Page<Geo>>(`/geos${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: () => api.get<Page<Region>>(`/regions${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export function useProjectTypes() {
  return useQuery({
    queryKey: ["project-types"],
    queryFn: () => api.get<Page<ProjectType>>(`/project-types${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Page<Product>>(`/products${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<Page<Account>>(`/accounts${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

// Loads the whole (200-capped) directory. Fine for small user counts; for the
// person pickers use useUserSearch / useUsersByIds instead — with 2000+
// employees this list is truncated and unsearchable.
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<Page<User>>(`/users${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export type UserSearchOpts = { roleCode?: string; activeOnly?: boolean };

// Server-side typeahead for the resource picker. Empty term => first 20
// alphabetical. Always enabled; `keepPreviousData` keeps the old list visible
// (no flicker) while a new term's request is in flight.
export function useUserSearch(term: string, opts: UserSearchOpts = {}) {
  const { roleCode, activeOnly = true } = opts;
  const q = term.trim();
  return useQuery({
    queryKey: ["users", "search", q, roleCode ?? null, activeOnly],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "20" });
      if (q) params.set("search", q);
      if (activeOnly) params.set("is_active", "true");
      if (roleCode) params.set("role_code", roleCode);
      return api.get<Page<User>>(`/users?${params.toString()}`);
    },
    select: (page) => page.items,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// Resolve exact users by id — labels for a picker's current value and for
// register/list columns that only carry owner ids. One query, keyed by the
// sorted unique id set. No is_active filter, so an already-selected but since
// deactivated user still resolves for display.
export function useUsersByIds(ids: readonly (string | null | undefined)[]) {
  const sorted = React.useMemo(
    () => [...new Set(ids.filter((v): v is string => !!v))].sort(),
    [ids],
  );
  return useQuery({
    queryKey: ["users", "by-ids", sorted],
    queryFn: () =>
      api.get<Page<User>>(`/users?ids=${encodeURIComponent(sorted.join(","))}`),
    select: (page) => page.items,
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useReportingPeriods() {
  return useQuery({
    queryKey: ["reporting-periods"],
    queryFn: () => api.get<Page<ReportingPeriod>>(`/reporting-periods${REF_LIMIT}`),
    select: (page) => page.items,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<Role[]>("/roles"),
  });
}
