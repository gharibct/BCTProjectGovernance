import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Project currencies offered on the charter forms (USD is the base — no rate).
export const PROJECT_CURRENCIES = ["USD", "OMR", "AED", "SAR", "INR", "EUR"] as const;

export type ExchangeRate = {
  id: string;
  currency: string;
  // Decimal — serialized as a string to avoid float precision loss.
  rate_to_usd: string;
  updated_at: string;
};

export type ExchangeRatePayload = { currency: string; rate_to_usd: string };

export function useExchangeRates() {
  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: () => api.get<ExchangeRate[]>("/exchange-rates"),
  });
}

// Saving/removing a rate re-converts project revenue server-side, so project
// queries are refreshed too.
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
  };
}

export function useSaveExchangeRate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: ExchangeRatePayload) => api.put<ExchangeRate>("/exchange-rates", payload),
    onSuccess: invalidate,
  });
}

export function useDeleteExchangeRate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/exchange-rates/${id}`),
    onSuccess: invalidate,
  });
}
