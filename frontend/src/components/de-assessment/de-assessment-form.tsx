"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, MandatoryBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAiFieldBinding } from "@/components/ai/use-ai-field-binding";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import {
  HealthPicker,
  RATING_FROM_API,
  RATING_TO_API,
  type HealthRating as Health,
} from "@/components/project-charter/health-declaration";
import {
  useCreateDEAssessment,
  useLatestDEAssessment,
  type DEAssessmentPayload,
} from "@/lib/api/de-assessment";

import { AlertRegisterTab } from "./alert-register-tab";
import { FindingsRegisterTab } from "./findings-register-tab";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Alert and Findings are each their own register (register grid + "New
// <Item>" entry form), matching the Contractual Compliance / RAIDO register
// pattern used across Project Reporting — each row saves immediately
// against the latest assessment, no separate "save the tab" step.
const TABS = [
  { label: "Alert Register", content: AlertRegisterTab },
  { label: "Findings Register", content: FindingsRegisterTab },
] as const;

type DeAssessmentAiValues = {
  de_assessed_project_health: string;
  pci_score: string;
};

function DeAssessmentFormInner() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const periodId = useSearchParams().get("period");
  const { data: latest } = useLatestDEAssessment(projectId);
  const createAssessment = useCreateDEAssessment(projectId);

  const [assessmentDate] = React.useState(today);
  const [health, setHealth] = React.useState<Health>("green");
  const [pciScore, setPciScore] = React.useState("");
  const [pciScoreError, setPciScoreError] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);
  const showWarning = usePageBanner((state) => state.showWarning);
  const dismiss = usePageBanner((state) => state.dismiss);

  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>("Alert Register");
  const Active = TABS.find((t) => t.label === tab)!.content;

  // Flagship "warning" banner: a real, pre-existing condition (previously a
  // static box buried inside the Alert Register tab, invisible while
  // Findings was active) — now visible below the page header regardless of
  // which tab is selected, and clears itself once an alert is raised.
  const needsAlertWarning =
    !!latest && latest.de_assessed_project_health !== "Green" && latest.alerts.length === 0;
  const warningShownRef = React.useRef(false);
  React.useEffect(() => {
    if (needsAlertWarning && latest) {
      showWarning(
        `This assessment is rated ${latest.de_assessed_project_health} — raise at least one alert below.`,
        { label: "Review Alerts", onClick: () => setTab("Alert Register") }
      );
      warningShownRef.current = true;
    } else if (warningShownRef.current) {
      dismiss();
      warningShownRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAlertWarning]);

  const aiValues: DeAssessmentAiValues = {
    de_assessed_project_health: RATING_TO_API[health],
    pci_score: pciScore,
  };
  function setAiValue<K extends keyof DeAssessmentAiValues>(fieldKey: K) {
    return (value: DeAssessmentAiValues[K]) => {
      if (fieldKey === "de_assessed_project_health") {
        setHealth(RATING_FROM_API[value as keyof typeof RATING_FROM_API]);
      } else {
        setPciScore(value);
      }
    };
  }
  const { ai, fieldAi, setAndClear } = useAiFieldBinding(
    projectId,
    "de_assessment_profile",
    periodId,
    aiValues,
    setAiValue
  );

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
      assessment_date: assessmentDate || undefined,
      de_assessed_project_health: RATING_TO_API[health],
      pci_score: pciScore,
    };
    createAssessment.mutate(payload, {
      onSuccess: () => {
        ai.resolveAll();
        showSuccess("DE Assessment Submitted Successfully");
      },
      onError: (err) =>
        showError(err instanceof Error ? err.message : "Failed to submit DE assessment."),
    });
  };

  if (!projectId) {
    return (
      <EmptyState>No project selected.</EmptyState>
    );
  }

  return (
    <div>
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="de_assessment_profile"
        periodId={periodId}
        ai={ai}
      />
      <SectionCard icon={ShieldCheck} title="DE Assessment">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <Field
            label="DE Assessed Project Health"
            badge={<MandatoryBadge />}
            ai={fieldAi("de_assessed_project_health")}
          >
            <HealthPicker
              value={health}
              onChange={(value) => setAndClear("de_assessed_project_health")(RATING_TO_API[value])}
            />
          </Field>
          <Field
            label="PCI Score"
            htmlFor="pci-score"
            badge={<MandatoryBadge />}
            ai={fieldAi("pci_score")}
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
                setAndClear("pci_score")(e.target.value);
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
        <div role="tablist" className="flex gap-8 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={tab === t.label}
              onClick={() => setTab(t.label)}
              className={cn(
                "-mb-px border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
                tab === t.label
                  ? "border-[#1a4a7a] text-[#1a4a7a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          <Active projectId={projectId} periodId={periodId} assessment={latest} />
        </div>
      </div>

      <p className="mt-10 flex items-center gap-2 text-sm text-slate-500">
        <Lock className="size-4" />
        One assessment per cycle — Alerts and Findings are logged against the
        latest assessment, row by row.
      </p>
    </div>
  );
}

export function DeAssessmentForm() {
  return (
    <Suspense fallback={null}>
      <DeAssessmentFormInner />
    </Suspense>
  );
}
