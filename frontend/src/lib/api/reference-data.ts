import { useQuery } from "@tanstack/react-query";

import { api, type Page } from "./client";

export type Organization = { id: string; code: string; name: string; is_active: boolean };
export type Geo = { id: string; code: string; name: string; is_active: boolean };
export type ProjectType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};
export type Account = { id: string; name: string; geo_id: string | null; is_active: boolean };

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

export function useProjectTypes() {
  return useQuery({
    queryKey: ["project-types"],
    queryFn: () => api.get<Page<ProjectType>>(`/project-types${REF_LIMIT}`),
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

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<Page<User>>(`/users${REF_LIMIT}`),
    select: (page) => page.items,
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
