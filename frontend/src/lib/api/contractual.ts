import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type CommitmentFrequency =
  | "One Time"
  | "Weekly"
  | "Fortnight"
  | "Monthly"
  | "Quarterly"
  | "Half Yearly"
  | "Phase Wise";

export type ContractualCommitment = {
  id: string;
  project_id: string;
  frequency: CommitmentFrequency;
  commitment_name: string;
  formula: string | null;
  target: string | null;
  penalty_applicable: boolean;
  penalty_value: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractualCommitmentPayload = {
  frequency: CommitmentFrequency;
  commitment_name: string;
  formula?: string;
  target?: string;
  penalty_applicable?: boolean;
  penalty_value?: string;
};

export function useCommitments(projectId: string | null) {
  return useQuery({
    queryKey: ["contractual-commitments", projectId],
    queryFn: () => api.get<ContractualCommitment[]>(`/projects/${projectId}/contractual-commitments`),
    enabled: !!projectId,
  });
}

export function useCreateCommitment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContractualCommitmentPayload) =>
      api.post<ContractualCommitment>(`/projects/${projectId}/contractual-commitments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractual-commitments", projectId] });
    },
  });
}

export function useUpdateCommitment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ContractualCommitmentPayload }) =>
      api.put<ContractualCommitment>(`/projects/${projectId}/contractual-commitments/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractual-commitments", projectId] });
    },
  });
}

export function useDeleteCommitment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/contractual-commitments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractual-commitments", projectId] });
    },
  });
}

export type MilestonePayment = {
  id: string;
  project_id: string;
  milestone_name: string;
  milestone_description: string | null;
  expected_date_of_payment: string | null;
  expected_payment_value: string | null;
  created_at: string;
  updated_at: string;
};

export type MilestonePaymentPayload = {
  milestone_name: string;
  milestone_description?: string;
  expected_date_of_payment?: string;
  expected_payment_value?: string;
};

export function useMilestonePayments(projectId: string | null) {
  return useQuery({
    queryKey: ["milestone-payments", projectId],
    queryFn: () => api.get<MilestonePayment[]>(`/projects/${projectId}/milestone-payments`),
    enabled: !!projectId,
  });
}

export function useCreateMilestonePayment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MilestonePaymentPayload) =>
      api.post<MilestonePayment>(`/projects/${projectId}/milestone-payments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-payments", projectId] });
    },
  });
}

export function useUpdateMilestonePayment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MilestonePaymentPayload }) =>
      api.put<MilestonePayment>(`/projects/${projectId}/milestone-payments/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-payments", projectId] });
    },
  });
}

export function useDeleteMilestonePayment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/milestone-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestone-payments", projectId] });
    },
  });
}

// --- Actuals (recorded during monthly Project Reporting) ---

export type MetStatus = "Met" | "Not Met" | "Breached";

export type MilestonePaymentStatus = "Paid On Time" | "Delayed Payment" | "Yet To Be Paid";

export type ContractualCommitmentActual = {
  id: string;
  commitment_id: string;
  period_date: string;
  actual_value: string | null;
  met_status: MetStatus | null;
  recorded_by: string | null;
  created_at: string;
};

export type ContractualCommitmentActualPayload = {
  period_date: string;
  actual_value?: string;
  met_status?: MetStatus;
};

export type MilestonePaymentActual = {
  id: string;
  milestone_id: string;
  actual_date_of_payment: string | null;
  actual_payment_value: string | null;
  status: MilestonePaymentStatus | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

export type MilestonePaymentActualPayload = {
  actual_date_of_payment?: string;
  actual_payment_value?: string;
  status?: MilestonePaymentStatus;
  remarks?: string;
};

const commitmentActualsKey = (projectId: string | null, commitmentId: string) =>
  ["contractual-commitment-actuals", projectId, commitmentId] as const;

const milestoneActualKey = (projectId: string | null, milestoneId: string) =>
  ["milestone-payment-actual", projectId, milestoneId] as const;

export function useCreateCommitmentActual(projectId: string | null, commitmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContractualCommitmentActualPayload) =>
      api.post<ContractualCommitmentActual>(
        `/projects/${projectId}/contractual-commitments/${commitmentId}/actuals`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commitmentActualsKey(projectId, commitmentId) });
    },
  });
}

export function useUpsertMilestoneActual(projectId: string | null, milestoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MilestonePaymentActualPayload) =>
      api.put<MilestonePaymentActual>(
        `/projects/${projectId}/milestone-payments/${milestoneId}/actual`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milestoneActualKey(projectId, milestoneId) });
    },
  });
}

// Latest recorded actual per commitment id — one list query each (the set of
// commitments per project is small), reduced to the most recent by period_date.
export function useLatestCommitmentActuals(projectId: string | null, commitmentIds: string[]) {
  const results = useQueries({
    queries: commitmentIds.map((id) => ({
      queryKey: commitmentActualsKey(projectId, id),
      queryFn: () =>
        api.get<ContractualCommitmentActual[]>(
          `/projects/${projectId}/contractual-commitments/${id}/actuals`,
        ),
      enabled: !!projectId,
    })),
  });
  const byId: Record<string, ContractualCommitmentActual | null> = {};
  commitmentIds.forEach((id, i) => {
    const rows = results[i]?.data ?? [];
    byId[id] =
      rows.length === 0
        ? null
        : [...rows].sort((a, b) => b.period_date.localeCompare(a.period_date))[0];
  });
  return byId;
}

// The single payment actual per milestone (milestone_id is unique server-side);
// a 404 means "not recorded yet".
export function useMilestoneActuals(projectId: string | null, milestoneIds: string[]) {
  const results = useQueries({
    queries: milestoneIds.map((id) => ({
      queryKey: milestoneActualKey(projectId, id),
      queryFn: async () => {
        try {
          return await api.get<MilestonePaymentActual>(
            `/projects/${projectId}/milestone-payments/${id}/actual`,
          );
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }
      },
      enabled: !!projectId,
    })),
  });
  const byId: Record<string, MilestonePaymentActual | null> = {};
  milestoneIds.forEach((id, i) => {
    byId[id] = results[i]?.data ?? null;
  });
  return byId;
}
