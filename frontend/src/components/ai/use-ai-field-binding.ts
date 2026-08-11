"use client";

import * as React from "react";

import { useAiReview } from "./use-ai-review";
import type { AiSuggestion } from "@/lib/api/ai-suggestions";

// The shape `Field`'s `ai` prop (form-primitives.tsx) expects: a suggestion
// plus its revert handler, or undefined when the field has no active one.
export type FieldAi<T> = <K extends keyof T>(
  key: K
) => { suggestion: AiSuggestion; onRevert: () => void } | undefined;

// Wires a form's `values`/`set` pair into AI-Implementation.md's suggestion
// review: pending suggestions auto-apply into their fields as they arrive
// (the effect below), and `fieldAi(key)` gives each Field its `ai` prop
// (badge + Revert to Old Value), while `setAndClear(key)` is the onChange
// wrapper that hides a field's badge the moment the user types over it.
// Shared by every screen that fits the simple "one field = one suggestion"
// shape (Project Profile, Scope & Schedule) — screens with a materially
// different shape (grids, custom controls not routed through Field, e.g.
// Self Assessment's HealthPicker) don't fit this and need their own wiring.
export function useAiFieldBinding<T>(
  projectId: string | null,
  screen: string,
  periodId: string | null,
  values: T,
  set: <K extends keyof T>(key: K) => (value: T[K]) => void
) {
  const ai = useAiReview(projectId, screen, periodId);

  // Keyed by field_key -> the `id:value` signature last pushed into
  // `values`, so: (a) a field is only auto-filled once per distinct
  // suggestion value — it won't fight a manual edit, since an edited field
  // drops out of `ai.pendingFields` entirely (see use-ai-review's
  // editedFieldKeys); and (b) a fresh extraction for the same field (same
  // row, new value) still gets pushed in, since its signature changes.
  // Right before overwriting, it stashes whatever was there via
  // `ai.notePreviousValue` so the popup's "Revert to Old Value" has
  // something to restore.
  const appliedSignatures = React.useRef<Map<string, string>>(new Map());
  React.useEffect(() => {
    for (const suggestion of ai.pendingFields) {
      const signature = `${suggestion.id}:${suggestion.value ?? ""}`;
      if (appliedSignatures.current.get(suggestion.field_key) !== signature) {
        appliedSignatures.current.set(suggestion.field_key, signature);
        ai.notePreviousValue(
          suggestion.field_key,
          values[suggestion.field_key as keyof T] as string | undefined
        );
        set(suggestion.field_key as keyof T)(suggestion.value as T[keyof T]);
      }
    }
  }, [ai, set, values]);

  function setAndClear<K extends keyof T>(key: K) {
    return (value: T[K]) => {
      set(key)(value);
      ai.noteManualEdit(key as string);
    };
  }

  function fieldAi<K extends keyof T>(key: K) {
    const suggestion = ai.suggestionFor(key as string);
    if (!suggestion) return undefined;
    return {
      suggestion,
      onRevert: () => {
        set(key)(ai.previousValueFor(key as string) as T[K]);
        ai.noteManualEdit(key as string);
      },
    };
  }

  return { ai, fieldAi, setAndClear };
}
