import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

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
