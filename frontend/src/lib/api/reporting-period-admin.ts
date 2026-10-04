import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ReportingPeriod } from "./reference-data";

export type AdminReportingPeriod = ReportingPeriod & { due_date: string | null };
export type GeneratePeriodsResult = { year: number; weekly_created: number; monthly_created: number };

export function useAdminReportingPeriods(year: number) {
  return useQuery({
    queryKey: ["admin-reporting-periods", year],
    queryFn: () => api.get<AdminReportingPeriod[]>(`/admin/reporting-periods?year=${year}`),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin-reporting-periods"] });
    queryClient.invalidateQueries({ queryKey: ["reporting-periods"] });
  };
}

export function useGenerateReportingPeriods() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (year: number) => api.post<GeneratePeriodsResult>("/admin/reporting-periods/generate", { year }),
    onSuccess: invalidate,
  });
}

export function useUpdatePeriodDueDate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, due_date }: { id: string; due_date: string }) =>
      api.put<AdminReportingPeriod>(`/admin/reporting-periods/${id}/due-date`, { due_date }),
    onSuccess: invalidate,
  });
}
