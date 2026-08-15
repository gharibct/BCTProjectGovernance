"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useAiSuggestions,
  useIgnoreAiSuggestion,
  useResolveAiSuggestions,
  type AiSuggestion,
} from "@/lib/api/ai-suggestions";

// Reusable across any screen: fetches pending AI suggestions for a
// project+screen and tracks, client-side, which fields the user has typed
// into directly since — those stop showing an indicator immediately
// (AI-Implementation.md §9), without waiting on the resolve-on-save
// round-trip that clears them for good server-side.
export function useAiReview(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  const { data: remoteSuggestions = [] } = useAiSuggestions(projectId, screen, periodId);
  const ignoreMutation = useIgnoreAiSuggestion(projectId, screen, periodId);
  const resolveMutation = useResolveAiSuggestions(projectId, screen, periodId);

  // Applied-but-unsaved suggestions must not survive leaving this screen —
  // otherwise navigating away and back (or reopening later) would show them
  // again even though nothing was saved. Clearing on unmount/identity change
  // covers both in-app navigation and a fresh reload/session.
  React.useEffect(() => {
    const key = ["ai-suggestions", projectId, screen, periodId];
    return () => {
      queryClient.removeQueries({ queryKey: key });
    };
  }, [queryClient, projectId, screen, periodId]);

  // TEMP (backend down / no project yet): suggestions loaded via
  // loadLocalSuggestions bypass the server entirely — used only while
  // there's no projectId to attach real ones to. Once a real project
  // exists, the server-backed `remoteSuggestions` above take over and this
  // is cleared out.
  const [localSuggestions, setLocalSuggestions] = React.useState<AiSuggestion[] | null>(null);
  const suggestions = projectId ? remoteSuggestions : (localSuggestions ?? []);

  const [editedFieldKeys, setEditedFieldKeys] = React.useState<Set<string>>(new Set());

  // Drop locally-edited state when switching to a different project/screen
  // record so a stale dismissal can't leak onto the next one.
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  const syncKey = projectId ? `${projectId}:${screen}:${periodId}` : null;
  if (syncKey !== syncedFor) {
    setSyncedFor(syncKey);
    if (editedFieldKeys.size > 0) setEditedFieldKeys(new Set());
  }

  const byField = new Map(suggestions.map((s) => [s.field_key, s] as const));
  const pendingFields = suggestions.filter((s) => !editedFieldKeys.has(s.field_key));

  const suggestionFor = (fieldKey: string): AiSuggestion | undefined =>
    editedFieldKeys.has(fieldKey) ? undefined : byField.get(fieldKey);

  const noteManualEdit = (fieldKey: string) => {
    if (byField.has(fieldKey)) {
      setEditedFieldKeys((prev) => {
        if (prev.has(fieldKey)) return prev;
        const next = new Set(prev);
        next.add(fieldKey);
        return next;
      });
    }
  };

  const ignoreField = (suggestion: AiSuggestion) => {
    if (!projectId) {
      setLocalSuggestions((prev) => (prev ?? []).filter((s) => s.id !== suggestion.id));
      return;
    }
    ignoreMutation.mutate(suggestion.id);
  };

  // What was in a field right before its suggestion got auto-applied (see
  // charter-form's auto-apply effect), so "Revert to Old Value" in the
  // badge popup has something to restore. A ref, not state — nothing here
  // needs to trigger a render on its own.
  const previousValues = React.useRef<Map<string, string | undefined>>(new Map());
  const notePreviousValue = (fieldKey: string, value: string | undefined) => {
    previousValues.current.set(fieldKey, value);
  };
  const previousValueFor = (fieldKey: string): string | undefined => previousValues.current.get(fieldKey);

  return {
    pendingFields,
    hasPending: pendingFields.length > 0,
    suggestionFor,
    noteManualEdit,
    ignoreField,
    resolveAll: () => {
      if (!projectId) {
        setLocalSuggestions([]);
        return Promise.resolve();
      }
      return resolveMutation.mutateAsync();
    },
    loadLocalSuggestions: (list: AiSuggestion[]) => setLocalSuggestions(list),
    notePreviousValue,
    previousValueFor,
  };
}
