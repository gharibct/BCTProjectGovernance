"use client";

import { Bot, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { confidenceTier } from "@/components/ai/ai-field-badge";
import { usePageBanner } from "@/stores/page-banner";
import {
  useAiRowSuggestions,
  useApplyAiRowSuggestion,
  useIgnoreAiRowSuggestion,
  useSeedTestAiRowSuggestions,
  type AiRowSuggestion,
} from "@/lib/api/ai-row-suggestions";

// AI-Implementation.md §10: for grids, AI confidence applies to the whole
// row, not a field. These rows come from documents processed on the AI
// Hub's Document Processing screen (components/ai-hub/document-processing.tsx)
// — not a freeform guess — so the UI reads "from uploaded documents", not
// "suggested". Split in two: the trigger renders at the top of the screen
// as the workflow's entry point, and the review list stays near the
// register/entry form below it.
export function AiRowSuggestionsTrigger({
  projectId,
  screen,
  periodId,
  itemLabel,
}: {
  projectId: string;
  screen: string;
  periodId: string | null;
  itemLabel: string;
}) {
  const seedMutation = useSeedTestAiRowSuggestions(projectId, screen, periodId);

  const handleLoad = async () => {
    try {
      const rows = await seedMutation.mutateAsync();
      toast.success(
        `${rows.length} ${rows.length === 1 ? itemLabel.toLowerCase() : `${itemLabel.toLowerCase()}s`} found in your uploaded documents — review below.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check uploaded documents.");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Bot className="size-4 shrink-0 text-[#1a6fc4]" />
        Pull {itemLabel.toLowerCase()}s found in this project&apos;s uploaded documents.
      </p>
      <Button
        className="gap-2 bg-[#1a4a7a] text-white hover:bg-[#15406b]"
        disabled={seedMutation.isPending || !periodId}
        onClick={handleLoad}
      >
        {seedMutation.isPending ? <ButtonSpinner /> : <FlaskConical className="size-4" />}
        Apply AI Changes
      </Button>
    </div>
  );
}

// Apply calls the entity's own create mutation (`createMutation`, passed by
// the log component that already owns it, e.g. useCreateRisk) with the
// suggestion's values mapped through that entity's own payload rules
// (`buildPayload` — severity computation, Y/N -> boolean, etc., whatever the
// manual "Add" button already does) — the same write path manual entry
// uses, never a separate AI-only write. When the suggestion's match_key
// resolved to an existing real row (matched_entity_id set — see backend
// crud.ai_row_suggestions.upsert_batch), Apply instead calls the entity's
// own update mutation (`updateMutation`, e.g. useUpdateRisk) against that
// row, so a re-uploaded register refreshes existing entries instead of
// duplicating them. Screens with no business code to match against (no
// `updateMutation` passed, e.g. commitments/milestones) are always create.
export function AiRowSuggestionsPanel<TPayload>({
  projectId,
  screen,
  periodId,
  itemLabel,
  previewFields,
  buildPayload,
  createMutation,
  updateMutation,
}: {
  projectId: string;
  screen: string;
  periodId: string | null;
  itemLabel: string;
  previewFields: readonly { key: string; label: string }[];
  buildPayload: (values: Record<string, string>) => TPayload;
  createMutation: Pick<UseMutationResult<unknown, unknown, TPayload>, "mutateAsync">;
  updateMutation?: Pick<
    UseMutationResult<unknown, unknown, { id: string; payload: TPayload }>,
    "mutateAsync"
  >;
}) {
  const { data: suggestions = [] } = useAiRowSuggestions(projectId, screen, periodId);
  const ignoreMutation = useIgnoreAiRowSuggestion(projectId, screen, periodId);
  const applyMutation = useApplyAiRowSuggestion(projectId, screen, periodId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // The literal "Apply AI Changes" action per the notification spec — it
  // mutates a real register row (create/update), so success/failure go
  // through the page banner like every other Save/Add/Update action.
  const handleApply = async (suggestion: AiRowSuggestion) => {
    try {
      if (suggestion.matched_entity_id && updateMutation) {
        await updateMutation.mutateAsync({
          id: suggestion.matched_entity_id,
          payload: buildPayload(suggestion.values),
        });
      } else {
        await createMutation.mutateAsync(buildPayload(suggestion.values));
      }
      await applyMutation.mutateAsync(suggestion.id);
      showSuccess(
        suggestion.matched_entity_id && updateMutation
          ? `${itemLabel} updated from uploaded documents.`
          : `${itemLabel} added from uploaded documents.`
      );
    } catch (err) {
      showError(
        err instanceof Error ? err.message : `Failed to add ${itemLabel.toLowerCase()} from uploaded documents.`
      );
    }
  };

  const handleIgnore = (suggestion: AiRowSuggestion) => {
    ignoreMutation.mutate(suggestion.id);
  };

  return (
    <SectionCard icon={Bot} title={`AI-Identified ${itemLabel}s`}>
      {suggestions.length === 0 ? (
        <p className="text-sm text-slate-500">No {itemLabel.toLowerCase()}s found in uploaded documents yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion) => {
            const tier = confidenceTier(suggestion.confidence);
            const [titleField, ...restFields] = previewFields;
            const title = (titleField && suggestion.values[titleField.key]) || "Untitled";
            const isUpdate = Boolean(suggestion.matched_entity_id && updateMutation);
            return (
              <div
                key={suggestion.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-white",
                      tier.boxClass
                    )}
                  >
                    <Bot className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      {title}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          isUpdate ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {isUpdate ? "Update" : "New"}
                      </span>
                    </p>
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span>
                        <span className="font-semibold">Confidence:</span> {tier.label} (
                        {Math.round(suggestion.confidence * 100)}%)
                      </span>
                      {restFields.map((field) =>
                        suggestion.values[field.key] ? (
                          <span key={field.key}>
                            <span className="font-semibold">{field.label}:</span>{" "}
                            {suggestion.values[field.key]}
                          </span>
                        ) : null
                      )}
                    </dl>
                    {suggestion.evidence ? (
                      <p className="mt-2 text-xs text-slate-500 italic">&ldquo;{suggestion.evidence}&rdquo;</p>
                    ) : null}
                    {suggestion.source_document ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Source: {suggestion.source_document}
                        {suggestion.source_location ? ` — ${suggestion.source_location}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleIgnore(suggestion)}>
                    Ignore
                  </Button>
                  <Button size="sm" onClick={() => handleApply(suggestion)}>
                    Apply
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
