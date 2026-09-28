import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, type Page } from "./client";

// Project Setup / Amend Project → Resource Allocation. A read-only view of the
// Oracle man-month allocations of the project's mapped Oracle projects (the
// oracle_* tables filled by scripts/import_man_month.py). Decimals arrive as
// JSON strings.

export type ResourceAllocationSummary = {
  // Distinct resources whose allocation overlaps the current calendar month.
  resources_allocated_this_month: number;
  // Man-months allocated across every loaded month up to today.
  man_months_consumed: string;
};

// One resource on the project; an employee can hold several allocation
// periods, so the dates span them (end is null when any period is open-ended).
export type ResourceAllocationRow = {
  employee_id: string;
  employee_name: string | null;
  employee_code: string;
  location: string | null;
  // Oracle project numbers (of the project's mapped ones) the resource is allocated to.
  oracle_project_ids: string[];
  allocation_start_date: string | null;
  allocation_end_date: string | null;
  total_man_months: string;
};

export type ResourceAllocationMonth = {
  month: string; // "Aug-26"
  month_start: string;
  man_month: string;
};

export type ResourceAllocationPeriod = {
  allocation_start_date: string;
  allocation_end_date: string | null;
  percentage_allocation: string | null;
};

export type ResourceAllocationDetail = {
  employee_id: string;
  employee_name: string | null;
  employee_code: string;
  location: string | null;
  periods: ResourceAllocationPeriod[];
  months: ResourceAllocationMonth[];
  total_man_months: string;
};

export function useResourceAllocationSummary(projectId: string | null) {
  return useQuery({
    queryKey: ["resource-allocation-summary", projectId],
    queryFn: () => api.get<ResourceAllocationSummary>(`/projects/${projectId}/resource-allocation/summary`),
    enabled: Boolean(projectId),
  });
}

export function useResourceAllocations(
  projectId: string | null,
  params: { search: string; skip: number; limit: number }
) {
  const query = new URLSearchParams({ skip: String(params.skip), limit: String(params.limit) });
  if (params.search.trim()) query.set("search", params.search.trim());
  return useQuery({
    queryKey: ["resource-allocations", projectId, params],
    queryFn: () => api.get<Page<ResourceAllocationRow>>(`/projects/${projectId}/resource-allocation?${query}`),
    enabled: Boolean(projectId),
    // Keep the current page on screen while the next page / search result loads.
    placeholderData: keepPreviousData,
  });
}

export function useResourceAllocationDetail(projectId: string | null, employeeId: string | null) {
  return useQuery({
    queryKey: ["resource-allocation-detail", projectId, employeeId],
    queryFn: () =>
      api.get<ResourceAllocationDetail>(`/projects/${projectId}/resource-allocation/${employeeId}/months`),
    enabled: Boolean(projectId && employeeId),
  });
}
