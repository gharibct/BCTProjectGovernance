"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ClipboardCheck, HeartPulse, History } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, MandatoryBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import {
  CATEGORIES,
  HealthPicker,
  HealthPill,
  RATING_FROM_API,
  RATING_TO_API,
  type HealthRating as KebabHealth,
} from "@/components/project-charter/health-declaration";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole } from "@/stores/session";
import { useProject } from "@/lib/api/projects";
import { useAccounts, useUsers } from "@/lib/api/reference-data";
import { useLatestHealthDeclaration } from "@/lib/api/health-declarations";
import { canWriteDeAssessment, canAssessProject } from "@/lib/api/de-assessment-permissions";
import {
  useCreateDEAssessment,
  useDEAssessmentFindings,
  useDEAssessments,
  useUpdateDEAssessment,
  type DEAssessment,
} from "@/lib/api/de-assessment";
import { HealthDot } from "./shared";
import { FindingsDrawerTrigger } from "./findings-drawer/findings-drawer-trigger";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ContextItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
      <span className="mt-1 block text-sm font-medium text-slate-800">{children}</span>
    </div>
  );
}

function FindingStat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-4">
      <span className={cn("text-2xl font-bold", tone ?? "text-slate-900")}>{value}</span>
      <span className="mt-0.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
    </div>
  );
}

function WorkspaceInner() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const router = useRouter();

  const role = useEffectiveRole();
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const { data: project } = useProject(projectId);
  const { data: accounts = [] } = useAccounts();
  const { data: users = [] } = useUsers();
  const { data: assessments = [] } = useDEAssessments(projectId);
  const { data: findings = [] } = useDEAssessmentFindings(projectId);
  const { data: health } = useLatestHealthDeclaration(projectId);

  const hasDeAllocated = !!project?.delivery_excellence_id;
  const canWrite = canAssessProject(role, hasDeAllocated);
  // A non-DE viewer (or a DE looking at a project with no DE allocated) still
  // sees the read-only workspace; only the write affordances are gated.
  const roleCanWrite = canWriteDeAssessment(role);

  // The assessment we're editing: the newest Draft (there is at most one open
  // draft at a time). Otherwise the form is a blank NEW assessment — every
  // Submit creates a new row, which is what lets a project be assessed more
  // than once in a month.
  const working: DEAssessment | null = assessments.find((a) => a.status === "Draft") ?? null;

  const submittedHistory = React.useMemo(
    () =>
      assessments
        .filter((a) => a.status === "Submitted")
        .sort((a, b) => (b.assessment_date ?? "").localeCompare(a.assessment_date ?? "")),
    [assessments]
  );
  const previous: DEAssessment | null = submittedHistory[0] ?? null;

  const readOnly = !canWrite;

  const accountName = accounts.find((a) => a.id === project?.account_id)?.name ?? "—";
  const pmName = users.find((u) => u.id === project?.project_manager_id)?.full_name ?? "—";

  // Form state, seeded from the working draft during render (the app's
  // "adjust state on prop change" idiom — see charter-form.tsx).
  const [syncedId, setSyncedId] = React.useState<string | null>("__init__");
  const [healthValue, setHealthValue] = React.useState<KebabHealth>("green");
  const [pciScore, setPciScore] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [assessmentDate, setAssessmentDate] = React.useState(today());
  const [errors, setErrors] = React.useState<{ pci?: string; remarks?: string }>({});

  const workingKey = working?.id ?? null;
  if (workingKey !== syncedId) {
    setSyncedId(workingKey);
    setHealthValue(working ? RATING_FROM_API[working.de_assessed_project_health] : "green");
    setPciScore(working?.pci_score ?? "");
    setRemarks(working?.remarks ?? "");
    setAssessmentDate(working?.assessment_date ?? today());
    setErrors({});
  }

  const createAssessment = useCreateDEAssessment(projectId);
  const updateAssessment = useUpdateDEAssessment(projectId);
  const busy = createAssessment.isPending || updateAssessment.isPending;

  const persist = (status: "Draft" | "Submitted") => {
    if (!projectId) return;
    if (status === "Submitted") {
      const nextErrors: typeof errors = {};
      if (!pciScore.trim()) nextErrors.pci = "PCI Score is required.";
      if (!remarks.trim()) nextErrors.remarks = "Assessment Remarks are required.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        showError("Complete the required fields before submitting.");
        return;
      }
    }
    setErrors({});

    const onSuccess = () => {
      showSuccess(status === "Draft" ? "Draft Saved" : "DE Assessment Submitted Successfully");
      if (status === "Submitted") router.push("/de-assessment");
    };
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to save the assessment.");

    if (working) {
      updateAssessment.mutate(
        {
          id: working.id,
          payload: {
            assessment_date: assessmentDate || undefined,
            de_assessed_project_health: RATING_TO_API[healthValue],
            pci_score: pciScore || undefined,
            remarks: remarks || undefined,
            status,
          },
        },
        { onSuccess, onError }
      );
    } else {
      createAssessment.mutate(
        {
          assessment_date: assessmentDate || undefined,
          de_assessed_project_health: RATING_TO_API[healthValue],
          pci_score: pciScore || undefined,
          remarks: remarks || undefined,
          status,
        },
        { onSuccess, onError }
      );
    }
  };

  if (!projectId) return <EmptyState>No project selected.</EmptyState>;

  const openCount = findings.filter((f) => f.status === "Open" || f.status === "In Progress").length;
  const overdueCount = findings.filter((f) => f.overdue).length;
  const awaitingCount = findings.filter((f) => f.status === "Awaiting Closure").length;
  const criticalCount = findings.filter(
    (f) => f.severity === "Critical" && f.status !== "Closed" && f.status !== "Cancelled"
  ).length;

  const subtitle = working
    ? "Editing Draft"
    : roleCanWrite && !hasDeAllocated
      ? "No Delivery Excellence resource allocated"
      : "New Assessment";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/de-assessment"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
          >
            <ArrowLeft className="size-4" />
            Back to Queue
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Project Assessment — {project?.project_name ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <FindingsDrawerTrigger
          projectId={projectId}
          projectName={project?.project_name ?? "Project"}
          findings={findings}
        />
      </div>

      {roleCanWrite && !hasDeAllocated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No Delivery Excellence resource is allocated to this project yet. A DE must be
          allocated (DE Allocation) before an assessment can be recorded.
        </div>
      ) : null}

      {/* Assessment Date — leads the workspace; every section below describes
          or supports the assessment being recorded on this date. */}
      <SectionCard icon={CalendarDays} title="Assessment Date">
        <Field label="Assessment Date" htmlFor="de-assessment-date" badge={<MandatoryBadge />}>
          <Input
            id="de-assessment-date"
            type="date"
            className="h-11 w-44"
            value={assessmentDate}
            disabled={readOnly}
            onChange={(e) => setAssessmentDate(e.target.value)}
          />
        </Field>
      </SectionCard>

      {/* Section 1 — Project Context Summary */}
      <SectionCard icon={ClipboardCheck} title="Project Context Summary">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          <ContextItem label="Project">{project?.project_name ?? "—"}</ContextItem>
          <ContextItem label="Account">{accountName}</ContextItem>
          <ContextItem label="PM">{pmName}</ContextItem>
          <ContextItem label="PM Health">
            <span className="inline-flex items-center gap-2">
              <HealthDot health={project?.delivery_declared_overall_health ?? null} />
              {project?.delivery_declared_overall_health ?? "—"}
            </span>
          </ContextItem>
          <ContextItem label="Previous DE Health">
            <span className="inline-flex items-center gap-2">
              <HealthDot health={previous?.de_assessed_project_health ?? null} />
              {previous?.de_assessed_project_health ?? "—"}
            </span>
          </ContextItem>
          <ContextItem label="Previous PCI">
            {previous?.pci_score ? `${previous.pci_score}%` : "—"}
          </ContextItem>
        </div>
      </SectionCard>

      {/* Section 2 — Project Health (read-only, from the PM's latest health declaration) */}
      <SectionCard icon={HeartPulse} title="Project Health">
        {health ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Overall
              </span>
              <span className="mt-1 block">
                <HealthPill rating={RATING_FROM_API[health.overall_rating]} />
              </span>
            </div>
            {CATEGORIES.map((category) => (
              <div key={category.key}>
                <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {category.name}
                </span>
                <span className="mt-1 block">
                  <HealthPill rating={RATING_FROM_API[health[category.ratingField]]} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No project health declared for this period yet.</p>
        )}
      </SectionCard>

      {/* Section 3 — DE Findings Summary */}
      <SectionCard icon={ClipboardCheck} title="DE Findings Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FindingStat value={openCount} label="Open" />
          <FindingStat value={overdueCount} label="Overdue" tone={overdueCount ? "text-red-600" : undefined} />
          <FindingStat
            value={awaitingCount}
            label="Awaiting Closure"
            tone={awaitingCount ? "text-amber-600" : undefined}
          />
          <FindingStat
            value={criticalCount}
            label="Critical"
            tone={criticalCount ? "text-red-700" : undefined}
          />
        </div>
      </SectionCard>

      {/* Section 4 — DE Rating Assessment */}
      <SectionCard icon={ClipboardCheck} title="DE Rating Assessment">
        <div className="flex flex-col gap-6">
          <Field label="DE Health" badge={<MandatoryBadge />}>
            {readOnly ? (
              <HealthPill rating={healthValue} />
            ) : (
              <HealthPicker value={healthValue} onChange={setHealthValue} />
            )}
          </Field>
          <Field
            label="PCI Score"
            htmlFor="de-pci-score"
            badge={<MandatoryBadge />}
            hint="Enter a value between 0 and 100."
            error={errors.pci}
          >
            <div className="relative w-36">
              <Input
                id="de-pci-score"
                type="number"
                min={0}
                max={100}
                className="h-11 pr-8"
                value={pciScore}
                disabled={readOnly}
                onChange={(e) => {
                  setPciScore(e.target.value);
                  if (errors.pci) setErrors((p) => ({ ...p, pci: undefined }));
                }}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
          </Field>
          <Field
            label="Assessment Remarks"
            htmlFor="de-remarks"
            badge={<MandatoryBadge />}
            hint="Provide comprehensive details supporting the DE Health rating."
            error={errors.remarks}
          >
            <Textarea
              id="de-remarks"
              rows={6}
              value={remarks}
              disabled={readOnly}
              placeholder="Detail the justification for the rating and key observations…"
              onChange={(e) => {
                setRemarks(e.target.value);
                if (errors.remarks) setErrors((p) => ({ ...p, remarks: undefined }));
              }}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Section 5 — Assessment History (the full grid lives at /history) */}
      <SectionCard icon={History} title="Assessment History">
        {submittedHistory.length === 0 ? (
          <p className="text-sm text-slate-400">No assessments submitted for this project yet.</p>
        ) : (
          <Link
            href={`/de-assessment/${projectId}/history`}
            className="text-sm font-semibold text-[#1a6fc4] hover:underline"
          >
            View all {submittedHistory.length} submitted assessment
            {submittedHistory.length === 1 ? "" : "s"} →
          </Link>
        )}
      </SectionCard>

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 -mx-10 flex items-center justify-between border-t border-slate-200 bg-white/90 px-10 py-4 backdrop-blur">
        <Button variant="ghost" onClick={() => router.push("/de-assessment")}>
          Cancel
        </Button>
        {readOnly ? (
          <p className="text-sm text-slate-400">
            {roleCanWrite && !hasDeAllocated
              ? "Allocate a DE to this project to record an assessment."
              : "You have read-only access."}
          </p>
        ) : (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => persist("Draft")} disabled={busy} className="gap-2">
              {busy ? <ButtonSpinner /> : null}
              Save Draft
            </Button>
            <Button
              onClick={() => persist("Submitted")}
              disabled={busy}
              className="gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
            >
              {busy ? <ButtonSpinner /> : null}
              Submit Assessment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DeAssessmentWorkspace() {
  return (
    <Suspense fallback={null}>
      <WorkspaceInner />
    </Suspense>
  );
}
