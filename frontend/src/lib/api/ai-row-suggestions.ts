import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Row-level counterpart to lib/api/ai-suggestions.ts, for RAID grids
// (AI-Implementation.md §10) — a suggestion here is a whole candidate
// Risk/Issue/Dependency/Assumption/Opportunity row, not one field's value.
// `screen` is the RAID entity's prefix ("risks", "issues", "dependencies",
// "assumptions", "opportunities"). `values` keys match that entity's Create
// payload field names, same convention lib/api/ai-suggestions.ts's
// field_key uses for ProjectPayload/HealthDeclarationCreate.
export type AiRowSuggestionStatus = "pending" | "ignored" | "applied";

export type AiRowSuggestion = {
  id: string;
  project_id: string;
  screen: string;
  period_id: string;
  values: Record<string, string>;
  // Business-code identifier read from the source document (e.g. an
  // existing risk_code), and the real row it resolved to, if any — see
  // backend crud.ai_row_suggestions.upsert_batch. matched_entity_id set
  // means Apply should update that row instead of creating a new one.
  match_key: string | null;
  matched_entity_id: string | null;
  confidence: number;
  source_document: string | null;
  source_location: string | null;
  evidence: string | null;
  status: AiRowSuggestionStatus;
  created_at: string;
};

// Session-scoped by design, same as lib/api/ai-suggestions.ts's
// useAiSuggestions: `enabled: false` means this never auto-fetches on mount,
// no matter what's still `pending` server-side from an old, abandoned
// session that clicked "Apply AI Changes" and never acted on every row. The
// only writers of this query's cache are the mutations below (seed/ignore/
// apply) — a fresh mount always starts clean until the user explicitly
// clicks "Apply AI Changes" again this visit.
export function useAiRowSuggestions(projectId: string | null, screen: string, periodId: string | null) {
  return useQuery({
    queryKey: ["ai-row-suggestions", projectId, screen, periodId],
    queryFn: () =>
      api.get<AiRowSuggestion[]>(
        `/projects/${projectId}/ai-row-suggestions?screen=${encodeURIComponent(screen)}&period_id=${encodeURIComponent(periodId!)}`
      ),
    enabled: false,
  });
}

export function useIgnoreAiRowSuggestion(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) =>
      api.post<AiRowSuggestion>(`/projects/${projectId}/ai-row-suggestions/${suggestionId}/ignore`),
    onSuccess: (_data, suggestionId) => {
      queryClient.setQueryData<AiRowSuggestion[]>(["ai-row-suggestions", projectId, screen, periodId], (old) =>
        (old ?? []).filter((s) => s.id !== suggestionId)
      );
    },
  });
}

// Called right after the frontend creates (or updates, when matched_entity_id
// is set) the real row from a suggestion's values via that entity's own
// create/update endpoint (the same ones manual entry uses) — this only marks
// the suggestion consumed, it doesn't write to the entity itself.
export function useApplyAiRowSuggestion(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) =>
      api.post<AiRowSuggestion>(`/projects/${projectId}/ai-row-suggestions/${suggestionId}/apply`),
    onSuccess: (_data, suggestionId) => {
      queryClient.setQueryData<AiRowSuggestion[]>(["ai-row-suggestions", projectId, screen, periodId], (old) =>
        (old ?? []).filter((s) => s.id !== suggestionId)
      );
    },
  });
}

// Testing-only: no real extraction pipeline exists yet. The response is the
// fresh pending batch for this screen+period (seed-test-data replaces, not
// upserts), so it's written straight into the query cache — one round-trip.
export function useSeedTestAiRowSuggestions(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<AiRowSuggestion[]>(
        `/projects/${projectId}/ai-row-suggestions/seed-test-data?screen=${encodeURIComponent(screen)}&period_id=${encodeURIComponent(periodId!)}`
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-row-suggestions", projectId, screen, periodId], data);
    },
  });
}
