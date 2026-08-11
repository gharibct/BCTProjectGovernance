"use client";

import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { buildLocalTestAiSuggestions, useSeedTestAiSuggestions } from "@/lib/api/ai-suggestions";
import type { useAiReview } from "./use-ai-review";

// Testing-only: no real extraction pipeline exists yet (AI-Implementation.md
// §1-§2 aren't built). With a real, created project this seeds suggestions
// server-side (persisted, survives reload). Without one (no backend /
// project not created yet) it falls back to a canned set built entirely
// client-side — no network call. Either way, values load straight into
// their fields via the screen's useAiFieldBinding auto-apply effect; this
// button just triggers the load and reports how many came in.
export function LoadAiSuggestionsButton({
  projectId,
  screen,
  periodId,
  ai,
}: {
  projectId: string | null;
  screen: string;
  periodId: string | null;
  ai: ReturnType<typeof useAiReview>;
}) {
  const seedTestAiSuggestions = useSeedTestAiSuggestions(projectId, screen, periodId);

  const handleClick = async () => {
    if (!projectId) {
      const suggestions = buildLocalTestAiSuggestions(screen);
      ai.loadLocalSuggestions(suggestions);
      toast.success(
        `${suggestions.length} AI ${suggestions.length === 1 ? "suggestion is" : "suggestions are"} ready for review below.`
      );
      return;
    }
    try {
      const suggestions = await seedTestAiSuggestions.mutateAsync();
      toast.success(
        `${suggestions.length} AI ${suggestions.length === 1 ? "suggestion is" : "suggestions are"} ready for review below.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load test AI suggestions.");
    }
  };

  return (
    <div className="mb-4 flex justify-end">
      <Button
        className="gap-2 bg-[#1a4a7a] text-white hover:bg-[#15406b]"
        disabled={seedTestAiSuggestions.isPending}
        onClick={handleClick}
      >
        {seedTestAiSuggestions.isPending ? <ButtonSpinner /> : <FlaskConical className="size-4" />}
        Apply AI Results
      </Button>
    </div>
  );
}
