"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, MandatoryBadge, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HealthPicker,
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

export function DeAssessmentForm() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const { data: latest } = useLatestDEAssessment(projectId);
  const createAssessment = useCreateDEAssessment(projectId);

  const [assessmentDate, setAssessmentDate] = React.useState(today);
  const [health, setHealth] = React.useState<Health>("green");
  const [pciScore, setPciScore] = React.useState("");

  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>("Alert Register");
  const Active = TABS.find((t) => t.label === tab)!.content;

  const submitHeader = () => {
    if (!projectId || !pciScore.trim()) return;
    const payload: DEAssessmentPayload = {
      assessment_date: assessmentDate,
      de_assessed_project_health: RATING_TO_API[health],
      pci_score: pciScore,
    };
    createAssessment.mutate(payload, {
      onSuccess: () => toast.success("DE Assessment Submitted Successfully"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to submit DE assessment."),
    });
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No project selected.
      </p>
    );
  }

  return (
    <div>
      <SectionCard
        icon={ShieldCheck}
        title="DE Assessment"
        aside={
          <Field label="Assessment Date" htmlFor="assessment-date">
            <Input
              id="assessment-date"
              type="date"
              className="h-10 w-44"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
            />
          </Field>
        }
      >
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <Field label="DE Assessed Project Health" badge={<MandatoryBadge />}>
            <HealthPicker value={health} onChange={setHealth} />
          </Field>
          <Field label="PCI Score" htmlFor="pci-score" badge={<MandatoryBadge />}>
            <Input
              id="pci-score"
              type="number"
              min={0}
              placeholder="0.00"
              className="h-11 w-36"
              value={pciScore}
              onChange={(e) => setPciScore(e.target.value)}
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
          <Active projectId={projectId} assessment={latest} />
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
