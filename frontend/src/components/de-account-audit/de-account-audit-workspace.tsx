"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  Copy,
  FilePlus2,
  HeartPulse,
  History,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  ButtonSpinner,
  Field,
  MandatoryBadge,
  SectionCard,
} from "@/components/forms/form-primitives";
import { CopyFromLatestButton } from "@/components/forms/copy-from-latest-button";
import { EmptyState } from "@/components/forms/empty-state";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import {
  CATEGORIES,
  HealthPicker,
  HealthPill,
  RATING_FROM_API,
  RATING_TO_API,
  type HealthRating as KebabHealth,
} from "@/components/project-charter/health-declaration";
import { HealthDot } from "@/components/de-assessment-workspace/shared";
import type { HealthRating } from "@/lib/api/projects";
import { canWriteDeAssessment } from "@/lib/api/de-assessment-permissions";
import {
  formatGeoRegion,
  useProjectHealthRag,
} from "@/lib/api/project-health-lists";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useAccountHealthDeclarations } from "@/lib/api/account-health-declarations";
import { useRegionalStatusReports } from "@/lib/api/regional-status";
import { isReportFrozen } from "@/lib/api/project-status";
import {
  ASSESSMENT_WINDOW_DAYS,
  addDays,
  latestWeeklyPeriods,
} from "@/lib/period-utils";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole } from "@/stores/session";
import {
  useCreateDeAccountAudit,
  useDeAccountAuditQueue,
  useDeAccountAudits,
  useDeAccountFindings,
  useUpdateDeAccountAudit,
} from "@/lib/api/de-account-audit";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function ContextItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
        {label}
      </span>
      <span className="mt-1 block text-sm font-medium text-slate-800">
        {children}
      </span>
    </div>
  );
}

function FindingStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-4">
      <span className={cn("text-2xl font-bold", tone ?? "text-slate-900")}>
        {value}
      </span>
      <span className="mt-0.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
        {label}
      </span>
    </div>
  );
}

// Account Assessment workspace — the account-level twin of the Project
// Assessment workspace: same sections and controls, minus the project-only
// data (period, DE score, PM health). A Draft is continued in place; a
// Submitted assessment is immutable and every Submit adds a new row.
export function DeAccountAuditWorkspace() {
  const router = useRouter();
  const { accountId } = useParams<{ accountId: string }>();
  const roleCanWrite = canWriteDeAssessment(useEffectiveRole());
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const { data: queue, isLoading: queueLoading } = useDeAccountAuditQueue();
  const account = queue?.rows.find((r) => r.account_id === accountId);
  const { data: allPeriods = [] } = useReportingPeriods();
  const { data: declarations = [] } = useAccountHealthDeclarations(
    accountId ?? null,
  );
  const { data: statusReports = [] } = useRegionalStatusReports(
    "account",
    accountId ?? null,
  );
  const { data: audits = [], isLoading: auditsLoading } =
    useDeAccountAudits(accountId);
  const findingsPage = useDeAccountFindings({
    accountId,
    status: "Active",
    skip: 0,
    limit: 100,
  });
  const findings = React.useMemo(
    () => findingsPage.data?.items ?? [],
    [findingsPage.data],
  );

  const create = useCreateDeAccountAudit(accountId);
  const update = useUpdateDeAccountAudit(accountId);
  const busy = create.isPending || update.isPending;

  const hasDeAllocated = !!account;
  const canWrite = roleCanWrite && hasDeAllocated;
  const readOnly = !canWrite;

  const working = audits.find((a) => a.status === "Draft") ?? null;
  const submittedHistory = React.useMemo(
    () =>
      audits
        .filter((a) => a.status === "Submitted")
        .sort((a, b) => (b.audit_date ?? "").localeCompare(a.audit_date ?? "")),
    [audits],
  );
  const previous = submittedHistory[0] ?? null;
  // Read-only viewers see the latest submitted assessment; writers see their draft / a blank form.
  const displaySource = readOnly ? previous : working;

  const [syncedId, setSyncedId] = React.useState<string | null>("__init__");
  const [healthValue, setHealthValue] = React.useState<KebabHealth>("green");
  const [remarks, setRemarks] = React.useState("");
  const [assessmentDate, setAssessmentDate] = React.useState(today());
  const [periodChoice, setPeriodChoice] = React.useState("");
  const [covered, setCovered] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<{
    remarks?: string;
    date?: string;
    period?: string;
  }>({});

  // Entry gate (writers without a draft in progress): pick the period, then either copy the
  // previous assessment (whole screen read-only) or conduct a fresh one (blank, editable).
  const [mode, setMode] = React.useState<"copy" | "fresh" | null>(null);
  const [gatePeriodId, setGatePeriodId] = React.useState("");
  const [gateChoice, setGateChoice] = React.useState<"copy" | "fresh" | "">("");
  const [gateError, setGateError] = React.useState<string | null>(null);

  const displaySourceKey = displaySource?.id ?? null;
  if (displaySourceKey !== syncedId) {
    setSyncedId(displaySourceKey);
    setHealthValue(
      displaySource?.de_assessed_health
        ? RATING_FROM_API[displaySource.de_assessed_health]
        : "green",
    );
    setRemarks(displaySource?.remarks ?? "");
    setAssessmentDate(displaySource?.audit_date ?? today());
    setPeriodChoice(displaySource?.period_id ?? "");
    setCovered(displaySource?.covered_project_ids ?? []);
    setErrors({});
  }

  // Period: the last 10 Weekly periods, current (in-progress) one included,
  // newest first; a period already saved on the assessment stays selectable.
  const periodOptions = React.useMemo(() => {
    const recent = latestWeeklyPeriods(allPeriods);
    const saved = displaySource?.period_id;
    const savedPeriod =
      saved && !recent.some((p) => p.id === saved)
        ? allPeriods.find((p) => p.id === saved)
        : undefined;
    return savedPeriod ? [...recent, savedPeriod] : recent;
  }, [allPeriods, displaySource?.period_id]);
  const periodId =
    periodChoice ||
    (readOnly || mode === null ? "" : (periodOptions[0]?.id ?? ""));

  // The assessment follows the period's end date and must be completed within
  // 35 days of it.
  const selectedPeriod = allPeriods.find((p) => p.id === periodId);
  const minDate = selectedPeriod
    ? addDays(selectedPeriod.end_date, -ASSESSMENT_WINDOW_DAYS)
    : undefined;

  // The delivery team's declared health FOR THE SELECTED PERIOD, and only once
  // that period's account status report has been filed (Submitted / Approved).
  // A draft or missing report shows as not declared, never as a default rating.
  const periodReport = statusReports.find((r) => r.period_id === periodId);
  const health =
    periodReport && isReportFrozen(periodReport.status)
      ? (declarations.find((d) => d.period_id === periodId) ?? null)
      : null;

  const { data: projectRagPage, isLoading: projectRagLoading } =
    useProjectHealthRag({
      accountId,
      periodId: periodId || undefined,
      skip: 0,
      limit: 100,
    });
  const projectRag = projectRagPage?.items ?? [];

  const needsGate = !readOnly && !working && mode === null;
  const copyLocked = mode === "copy"; // copied assessment: the whole screen is read-only
  const fieldsLocked = readOnly || copyLocked;
  const previousPeriodLabel = previous?.period_id
    ? allPeriods.find((p) => p.id === previous.period_id)?.label
    : undefined;

  // Copy is offered only for a period AFTER the previous assessment's period, and only while the
  // previous assessment's date is within 35 days of that period's end date (so roughly the next
  // 4-5 weekly periods). Otherwise the DE conducts a fresh assessment.
  const gatePeriod = allPeriods.find((p) => p.id === gatePeriodId);
  const previousPeriod = previous?.period_id ? allPeriods.find((p) => p.id === previous.period_id) : undefined;
  const copyBlockedReason = !gatePeriod
    ? null // nothing selected yet: both options stay disabled without a message
    : !previous
      ? "No previous assessment exists for this account."
      : previousPeriod && gatePeriod.end_date <= previousPeriod.end_date
        ? `Copy is only available for periods after the previous assessment (${previousPeriod.label}).`
        : previous.audit_date && previous.audit_date < addDays(gatePeriod.end_date, -ASSESSMENT_WINDOW_DAYS)
          ? `The previous assessment (${formatDate(previous.audit_date)}) is more than ${ASSESSMENT_WINDOW_DAYS} days older than this period's end date. Conduct a fresh assessment.`
          : null;
  const copyDisabled = !gatePeriod || !previous || !!copyBlockedReason;

  // Assessed / not assessed marker shown in the period combo.
  const assessedPeriodIds = new Set(submittedHistory.map((a) => a.period_id).filter(Boolean));
  const periodStatus = (id: string) => (assessedPeriodIds.has(id) ? "Assessed" : "Not assessed");

  const continueFromGate = () => {
    if (!gatePeriodId) {
      setGateError("Select a period.");
      return;
    }
    if (!gateChoice) {
      setGateError(
        "Choose whether to copy the previous period or conduct a fresh assessment.",
      );
      return;
    }
    if (gateChoice === "copy" && copyDisabled) {
      setGateError(
        copyBlockedReason ?? "No previous assessment exists for this account.",
      );
      return;
    }
    setGateError(null);
    setErrors({});
    setPeriodChoice(gatePeriodId);
    if (gateChoice === "copy" && previous) {
      setHealthValue(
        previous.de_assessed_health
          ? RATING_FROM_API[previous.de_assessed_health]
          : "green",
      );
      setRemarks(previous.remarks ?? "");
      setAssessmentDate(previous.audit_date ?? "");
      setCovered(previous.covered_project_ids ?? []);
    } else {
      setHealthValue("green");
      setRemarks("");
      setAssessmentDate("");
      setCovered([]);
    }
    setMode(gateChoice);
  };

  const backToGate = () => {
    setGatePeriodId(periodId);
    setGateChoice("");
    setGateError(null);
    setMode(null);
  };

  // Fresh assessment: prefill from the latest Submitted assessment — health, remarks and the
  // covered projects. The date and period stay — they belong to this assessment.
  const copyFromPrevious = () => {
    if (!previous) return;
    if (previous.de_assessed_health)
      setHealthValue(RATING_FROM_API[previous.de_assessed_health]);
    setRemarks(previous.remarks ?? "");
    setCovered(previous.covered_project_ids ?? []);
    setErrors({});
    showSuccess(
      `Copied from the previous assessment${previous.audit_date ? ` (${formatDate(previous.audit_date)})` : ""}. Review and update before submitting.`,
    );
  };

  const persist = (status: "Draft" | "Submitted") => {
    const next: typeof errors = {};
    // The date window applies to drafts as well as submissions.
    if (assessmentDate && minDate && assessmentDate < minDate)
      next.date = `Assessment date cannot be more than ${ASSESSMENT_WINDOW_DAYS} days before the period end date (earliest ${formatDate(minDate)}).`;
    if (status === "Submitted") {
      if (!assessmentDate) next.date = "Assessment date is required.";
      if (!periodId) next.period = "Period is required.";
      if (!remarks.trim()) next.remarks = "Assessment Remarks are required.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showError(
        status === "Submitted"
          ? "Complete the required fields before submitting."
          : "Correct the assessment date before saving.",
      );
      return;
    }
    setErrors({});
    const payload = {
      audit_date: assessmentDate || null,
      de_assessed_health: RATING_TO_API[healthValue],
      remarks: remarks.trim() || null,
      period_id: periodId || null,
      covered_project_ids: covered,
      status,
    };
    const done = {
      onSuccess: () => {
        showSuccess(
          status === "Draft"
            ? "Draft Saved"
            : "Account Assessment Submitted Successfully",
        );
        if (status === "Submitted") router.push("/de-account-audit");
      },
      onError: (err: unknown) =>
        showError(
          err instanceof Error ? err.message : "Failed to save the assessment.",
        ),
    };
    if (working) update.mutate({ id: working.id, payload }, done);
    else create.mutate(payload, done);
  };

  if (queueLoading || auditsLoading)
    return <p className="text-slate-400">Loading…</p>;
  if (!accountId) return <EmptyState>No account selected.</EmptyState>;

  const openCount = findings.filter(
    (f) => f.status === "Open" || f.status === "In Progress",
  ).length;
  const overdueCount = findings.filter((f) => f.overdue).length;
  const awaitingCount = findings.filter(
    (f) => f.status === "Awaiting Closure",
  ).length;
  const alertOpenCount = findings.filter(
    (f) => f.classification === "Alert",
  ).length;

  const subtitle = roleCanWrite
    ? working
      ? "Editing Draft"
      : !hasDeAllocated
        ? "No Delivery Excellence resource allocated"
        : "New Assessment"
    : previous
      ? "Last Submitted Assessment"
      : "No Assessment Recorded Yet";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageBreadcrumb
            items={[
              { label: "Account Assessments", href: "/de-account-audit" },
              { label: "Account Assessment" },
            ]}
          />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Account Assessment — {account?.account_name ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Link
          href={`/de-account-findings?account=${accountId}`}
          className="text-sm font-semibold text-[#1a6fc4] hover:underline"
        >
          Manage findings →
        </Link>
      </div>

      {roleCanWrite && !hasDeAllocated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No Delivery Excellence resource is allocated to this account yet. A DE
          must be allocated (Assign DE – Accounts) before an assessment can be
          recorded.
        </div>
      ) : null}

      {needsGate ? (
        <SectionCard icon={CalendarDays} title="Start Assessment">
          <div className="flex max-w-3xl flex-col gap-6">
            <Field
              label="Period"
              htmlFor="acct-gate-period"
              badge={<MandatoryBadge />}
            >
              <NativeSelect
                id="acct-gate-period"
                className="h-11 w-56"
                value={gatePeriodId}
                onChange={(e) => {
                  setGatePeriodId(e.target.value);
                  setGateChoice(""); // eligibility depends on the period, so re-pick
                  setGateError(null);
                }}
              >
                <option value="" disabled>
                  Select a period
                </option>
                {periodOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {periodStatus(p.id)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "copy",
                    icon: Copy,
                    title: "Copy previous period",
                    text: previous
                      ? `Start from the assessment of ${previous.audit_date ? formatDate(previous.audit_date) : "the previous period"}${previousPeriodLabel ? ` (${previousPeriodLabel})` : ""}. The date and all details are filled in and the screen is read-only.`
                      : "No previous assessment exists for this account.",
                    disabled: copyDisabled,
                  },
                  {
                    key: "fresh",
                    icon: FilePlus2,
                    title: "Conduct fresh assessment",
                    text: "Start with a blank assessment date and enter every detail yourself.",
                    disabled: !gatePeriod,
                  },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    setGateChoice(o.key);
                    setGateError(null);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-colors",
                    gateChoice === o.key
                      ? "border-[#1a6fc4] bg-blue-50"
                      : "border-slate-200 bg-white hover:border-[#5B9BE6]",
                    o.disabled &&
                      "cursor-not-allowed opacity-50 hover:border-slate-200",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <o.icon className="size-4 text-[#1a6fc4]" />
                    {o.title}
                  </span>
                  <span className="text-xs text-slate-600">{o.text}</span>
                </button>
              ))}
            </div>
            {copyBlockedReason ? (
              <p className="text-xs text-amber-700">{copyBlockedReason}</p>
            ) : null}
            {gateError ? (
              <p role="alert" className="text-xs font-medium text-red-600">
                {gateError}
              </p>
            ) : null}
            <div>
              <Button
                onClick={continueFromGate}
                className="h-11 gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
              >
                Continue
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <>
          {copyLocked ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-[#15406b]"
            >
              <span className="flex items-center gap-2">
                <Copy className="size-4 shrink-0" />
                Copied from the previous period
                {previous?.audit_date
                  ? ` — assessment of ${formatDate(previous.audit_date)}`
                  : ""}
                {previousPeriodLabel ? ` (${previousPeriodLabel})` : ""}. This
                screen is read-only.
              </span>
              <button
                type="button"
                onClick={backToGate}
                className="font-semibold text-[#1a6fc4] hover:underline"
              >
                Change selection
              </button>
            </div>
          ) : null}

          <SectionCard icon={CalendarDays} title="Assessment Date & Period">
            <div className="flex flex-wrap items-start gap-6">
              <Field
                label="Assessment Date"
                htmlFor="acct-assessment-date"
                badge={<MandatoryBadge />}
                error={errors.date}
              >
                <Input
                  id="acct-assessment-date"
                  type="date"
                  className="h-11 w-44"
                  min={minDate}
                  value={assessmentDate}
                  disabled={fieldsLocked}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                />
              </Field>
              <Field
                label="Period"
                htmlFor="acct-assessment-period"
                badge={<MandatoryBadge />}
                error={errors.period}
              >
                <NativeSelect
                  id="acct-assessment-period"
                  className="h-11 w-56"
                  value={periodId}
                  disabled={fieldsLocked}
                  onChange={(e) => {
                    setPeriodChoice(e.target.value);
                    if (errors.period)
                      setErrors((p) => ({ ...p, period: undefined }));
                  }}
                >
                  <option value="" disabled>
                    {readOnly ? "-" : "Select a period"}
                  </option>
                  {periodOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {periodStatus(p.id)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {!fieldsLocked && previous ? (
                <div className="self-end">
                  <CopyFromLatestButton
                    onClick={copyFromPrevious}
                    disabled={busy}
                    label="Copy from previous period"
                    description="Prefill this assessment from the account's latest submitted assessment: health rating, remarks and covered projects. Date and period are not copied."
                  />
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon={ClipboardCheck} title="Account Context Summary">
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              <ContextItem label="Account">
                {account?.account_name ?? "—"}
              </ContextItem>
              <ContextItem label="Geo - Region">
                {account
                  ? formatGeoRegion(account.geo_name, account.region_name)
                  : "—"}
              </ContextItem>
              <ContextItem label="Account Head">
                {account?.account_head_name ?? "—"}
              </ContextItem>
              <ContextItem label="DE Auditor">
                {account?.delivery_excellence_name ?? "—"}
              </ContextItem>
              <ContextItem label="Account Health">
                <span className="inline-flex items-center gap-2">
                  <HealthDot health={health?.overall_rating ?? null} />
                  {health?.overall_rating ?? "—"}
                </span>
              </ContextItem>
              <ContextItem label="Previous DE Health">
                <span className="inline-flex items-center gap-2">
                  <HealthDot health={previous?.de_assessed_health ?? null} />
                  {previous?.de_assessed_health ?? "—"}
                </span>
              </ContextItem>
              <ContextItem label="Last Assessed">
                {previous?.audit_date ? formatDate(previous.audit_date) : "—"}
              </ContextItem>
            </div>
          </SectionCard>

          {/* Account Health - read-only, from the delivery team's latest RAG Status declaration */}
          <SectionCard icon={HeartPulse} title="Account Health">
            {health ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                <div>
                  <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Overall
                  </span>
                  <span className="mt-1 block">
                    <HealthPill
                      rating={RATING_FROM_API[health.overall_rating]}
                    />
                  </span>
                </div>
                {CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      {category.name}
                    </span>
                    <span className="mt-1 block">
                      <HealthPill
                        rating={RATING_FROM_API[health[category.ratingField]]}
                      />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No account health submitted for the selected period yet.
              </p>
            )}
          </SectionCard>

          {/* Project Health - read-only, each project's RAG for the selected period */}
          <SectionCard icon={HeartPulse} title="Project Health">
            {projectRag.length === 0 ? (
              <p className="text-sm text-slate-400">
                {projectRagLoading
                  ? "Loading…"
                  : "No project health submitted for the selected period yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      <th className="py-2 pr-4">Covered in Review</th>
                      <th className="py-2 pr-4">Project</th>
                      <th className="px-4 py-2">Overall</th>
                      <th className="px-4 py-2">Core Delivery</th>
                      <th className="px-4 py-2">People</th>
                      <th className="px-4 py-2">Operational</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Financial</th>
                      <th className="px-4 py-2">Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectRag.map((r) => (
                      <tr
                        key={r.project_id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label={`Covered in review: ${r.project_name}`}
                              className="h-4 w-4 accent-[#1a4a7a]"
                              checked={covered.includes(r.project_id)}
                              disabled={fieldsLocked}
                              onChange={(e) =>
                                setCovered((c) =>
                                  e.target.checked
                                    ? [...c, r.project_id]
                                    : c.filter((id) => id !== r.project_id),
                                )
                              }
                            />
                            <span className="text-xs font-medium text-slate-600">
                              {covered.includes(r.project_id)
                                ? "Reviewed"
                                : "Not reviewed"}
                            </span>
                          </label>
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {r.project_code} — {r.project_name}
                        </td>
                        {[
                          r.overall_rating,
                          r.core_delivery_rating,
                          r.people_rating,
                          r.operational_rating,
                          r.customer_rating,
                          r.financial_rating,
                          r.compliance_rating,
                        ].map((rating, i) => (
                          <td key={i} className="px-4 py-3">
                            {rating ? (
                              <HealthPill
                                rating={RATING_FROM_API[rating as HealthRating]}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={ClipboardCheck} title="DE Findings Summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FindingStat value={openCount} label="Open" />
              <FindingStat
                value={overdueCount}
                label="Overdue"
                tone={overdueCount ? "text-red-600" : undefined}
              />
              <FindingStat
                value={awaitingCount}
                label="Awaiting Closure"
                tone={awaitingCount ? "text-amber-600" : undefined}
              />
              <FindingStat
                value={alertOpenCount}
                label="Open Alerts"
                tone={alertOpenCount ? "text-red-700" : undefined}
              />
            </div>
          </SectionCard>

          <SectionCard icon={ClipboardCheck} title="DE Rating Assessment">
            <div className="flex flex-col gap-6">
              <Field label="DE Health" badge={<MandatoryBadge />}>
                {fieldsLocked ? (
                  <HealthPill rating={healthValue} />
                ) : (
                  <HealthPicker value={healthValue} onChange={setHealthValue} />
                )}
              </Field>
              <Field
                label="Assessment Remarks"
                htmlFor="acct-remarks"
                badge={<MandatoryBadge />}
                hint="Provide comprehensive details supporting the DE Health rating."
                error={errors.remarks}
              >
                <Textarea
                  id="acct-remarks"
                  rows={6}
                  value={remarks}
                  disabled={fieldsLocked}
                  placeholder="Detail the justification for the rating and key observations…"
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    if (errors.remarks)
                      setErrors((p) => ({ ...p, remarks: undefined }));
                  }}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard icon={History} title="Assessment History">
            {submittedHistory.length === 0 ? (
              <p className="text-sm text-slate-400">
                No assessments submitted for this account yet.
              </p>
            ) : (
              <Link
                href={`/de-account-audit/${accountId}/history`}
                className="text-sm font-semibold text-[#1a6fc4] hover:underline"
              >
                View all {submittedHistory.length} submitted assessment
                {submittedHistory.length === 1 ? "" : "s"} →
              </Link>
            )}
          </SectionCard>

          <div className="sticky bottom-0 -mx-10 flex items-center justify-end border-t border-slate-200 bg-white/90 px-10 py-4 backdrop-blur">
            {readOnly ? (
              <p className="text-sm text-slate-400">
                {roleCanWrite && !hasDeAllocated
                  ? "Allocate a DE to this account to record an assessment."
                  : "You have read-only access."}
              </p>
            ) : (
              <div className="flex gap-3">
                {copyLocked ? null : (
                  <Button
                    onClick={() => persist("Draft")}
                    disabled={busy}
                    className="gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
                  >
                    {busy ? <ButtonSpinner /> : null}
                    Save Draft
                  </Button>
                )}
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
        </>
      )}
    </div>
  );
}
