"use client";

import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { ButtonSpinner, Field, MandatoryBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import {
  HealthPicker,
  RATING_TO_API,
  type HealthRating as UiHealthRating,
} from "../health-declaration";
import { useCreateDEAssessment, type DEAssessmentPayload } from "@/lib/api/de-assessment";

import { FindingsRegisterTab } from "./findings-register-tab";

// Findings are their own register (register grid + "New Finding" entry form),
// matching the Contractual Compliance tab pattern — each row saves
// immediately, no separate "save the tab" step. Findings are a project-level
// register, independent of any assessment.
export function DeAssessmentForm() {
  const projectId = useNewProjectId();
  const createAssessment = useCreateDEAssessment(projectId);

  const [health, setHealth] = React.useState<UiHealthRating>("green");
  const [pciScore, setPciScore] = React.useState("");
  const [pciScoreError, setPciScoreError] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const submitHeader = () => {
    if (!projectId) return;
    if (!pciScore.trim()) {
      const message = "PCI Score is required.";
      setPciScoreError(message);
      showError(message);
      return;
    }
    setPciScoreError(null);
    const payload: DEAssessmentPayload = {
      de_assessed_project_health: RATING_TO_API[health],
      pci_score: pciScore,
    };
    createAssessment.mutate(payload, {
      onSuccess: () => showSuccess("DE Assessment Submitted Successfully"),
      onError: (err) =>
        showError(err instanceof Error ? err.message : "Failed to submit DE assessment."),
    });
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div>
      <SectionCard icon={ShieldCheck} title="DE Assessment">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <Field label="DE Assessed Project Health" badge={<MandatoryBadge />}>
            <HealthPicker value={health} onChange={setHealth} />
          </Field>
          <Field
            label="PCI Score"
            htmlFor="pci-score"
            badge={<MandatoryBadge />}
            error={pciScoreError ?? undefined}
          >
            <Input
              id="pci-score"
              type="number"
              min={0}
              placeholder="0.00"
              className="h-11 w-36"
              value={pciScore}
              onChange={(e) => {
                setPciScore(e.target.value);
                if (pciScoreError) setPciScoreError(null);
              }}
            />
          </Field>
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={createAssessment.isPending}
            onClick={submitHeader}
          >
            {createAssessment.isPending ? <ButtonSpinner /> : null}
            Submit Assessment
          </Button>
        </div>
      </SectionCard>

      <div className="mt-8">
        <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-[#1a4a7a]">
          Findings Register
        </h2>
        <div className="mt-8">
          <FindingsRegisterTab projectId={projectId} />
        </div>
      </div>

      <p className="mt-10 flex items-center gap-2 text-sm text-slate-500">
        <Lock className="size-4" />
        One assessment per cycle — Findings are logged against the latest
        assessment, row by row.
      </p>
    </div>
  );
}
