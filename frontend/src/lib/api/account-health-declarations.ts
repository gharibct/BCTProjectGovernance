import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

// Account RAG Status — account-level equivalent of health-declarations.ts,
// deliberately its own file (not folded into the generic regional-status.ts
// scope="account"|"geo" scaffolding) since this feature is account-only.
export type HealthRating = "Red" | "Potential Red" | "Amber" | "Green";

export type AccountHealthDeclaration = {
  id: string;
  account_id: string;
  period_id: string;
  core_delivery_rating: HealthRating;
  core_delivery_description: string | null;
  people_rating: HealthRating;
  people_description: string | null;
  operational_rating: HealthRating;
  operational_description: string | null;
  customer_rating: HealthRating;
  customer_description: string | null;
  financial_rating: HealthRating;
  financial_description: string | null;
  compliance_rating: HealthRating;
  compliance_description: string | null;
  overall_rating: HealthRating;
  declared_by: string | null;
  created_at: string;
};

export type AccountHealthDeclarationPayload = {
  period_id: string;
  core_delivery_rating: HealthRating;
  core_delivery_description?: string;
  people_rating: HealthRating;
  people_description?: string;
  operational_rating: HealthRating;
  operational_description?: string;
  customer_rating: HealthRating;
  customer_description?: string;
  financial_rating: HealthRating;
  financial_description?: string;
  compliance_rating: HealthRating;
  compliance_description?: string;
};

export type AccountHealthDeclarationUpdatePayload = Omit<AccountHealthDeclarationPayload, "period_id">;

// One declaration per reporting period — "latest" 404s until the first one
// is created, which is a normal state (not an error), so it's swallowed to
// undefined.
export function useLatestAccountHealthDeclaration(accountId: string | null) {
  return useQuery({
    queryKey: ["account-health-declaration-latest", accountId],
    queryFn: async () => {
      try {
        return await api.get<AccountHealthDeclaration>(`/accounts/${accountId}/health-declarations/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!accountId,
  });
}

// Full history for an account — used to look up whether a declaration
// already exists for a given period (so the form can PUT instead of
// re-POSTing into the account_id+period_id unique constraint).
export function useAccountHealthDeclarations(accountId: string | null) {
  return useQuery({
    queryKey: ["account-health-declarations", accountId],
    queryFn: () => api.get<AccountHealthDeclaration[]>(`/accounts/${accountId}/health-declarations`),
    enabled: !!accountId,
  });
}

function invalidateAccountHealthDeclarations(queryClient: ReturnType<typeof useQueryClient>, accountId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["account-health-declaration-latest", accountId] });
  queryClient.invalidateQueries({ queryKey: ["account-health-declarations", accountId] });
}

export function useCreateAccountHealthDeclaration(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountHealthDeclarationPayload) =>
      api.post<AccountHealthDeclaration>(`/accounts/${accountId}/health-declarations`, payload),
    onSuccess: () => invalidateAccountHealthDeclarations(queryClient, accountId),
  });
}

export function useUpdateAccountHealthDeclaration(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AccountHealthDeclarationUpdatePayload }) =>
      api.put<AccountHealthDeclaration>(`/accounts/${accountId}/health-declarations/${id}`, payload),
    onSuccess: () => invalidateAccountHealthDeclarations(queryClient, accountId),
  });
}

// --- RAG Status grids (account-level equivalent of health-declarations.ts's
// item hooks — see backend/app/api/v1/endpoints/account_health_declarations.py's
// items_router). Deliberately its own hooks here (not folded into
// regional-status.ts's scope="account"|"geo" scaffolding), same reasoning as
// the declaration hooks above: this feature is account-only. ---

export type HealthCategory = "Core Delivery" | "People" | "Operational" | "Customer" | "Financial" | "Compliance";

export type AccountHealthItem = {
  id: string;
  account_id: string;
  period_id: string;
  category: HealthCategory;
  description: string;
  created_at: string;
  updated_at: string;
};

export type AccountHealthItemPayload = {
  period_id: string;
  category: HealthCategory;
  description: string;
};

export type AccountHealthItemUpdatePayload = { description: string };

function accountHealthItemsQuery(accountId: string, periodId: string, category: HealthCategory): string {
  return `/accounts/${accountId}/health-items?period_id=${periodId}&category=${encodeURIComponent(category)}`;
}

export function useAccountHealthItems(accountId: string | null, periodId: string | null, category: HealthCategory) {
  return useQuery({
    queryKey: ["account-health-items", accountId, periodId, category],
    queryFn: () => api.get<AccountHealthItem[]>(accountHealthItemsQuery(accountId!, periodId!, category)),
    enabled: !!accountId && !!periodId,
  });
}

function invalidateAccountHealthItems(
  queryClient: ReturnType<typeof useQueryClient>,
  accountId: string | null,
  periodId: string | null,
  category: HealthCategory
) {
  queryClient.invalidateQueries({ queryKey: ["account-health-items", accountId, periodId, category] });
}

export function useCreateAccountHealthItem(
  accountId: string | null,
  periodId: string | null,
  category: HealthCategory
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountHealthItemPayload) =>
      api.post<AccountHealthItem>(`/accounts/${accountId}/health-items`, payload),
    onSuccess: () => invalidateAccountHealthItems(queryClient, accountId, periodId, category),
  });
}

export function useUpdateAccountHealthItem(
  accountId: string | null,
  periodId: string | null,
  category: HealthCategory
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AccountHealthItemUpdatePayload }) =>
      api.put<AccountHealthItem>(`/accounts/${accountId}/health-items/${id}`, payload),
    onSuccess: () => invalidateAccountHealthItems(queryClient, accountId, periodId, category),
  });
}

export function useDeleteAccountHealthItem(
  accountId: string | null,
  periodId: string | null,
  category: HealthCategory
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${accountId}/health-items/${id}`),
    onSuccess: () => invalidateAccountHealthItems(queryClient, accountId, periodId, category),
  });
}
