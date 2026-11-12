"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import { HealthPill, RATING_FROM_API } from "@/components/project-charter/health-declaration";
import { canWriteDeAssessment } from "@/lib/api/de-assessment-permissions";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  useBulkCopyAssessments,
  type BulkCopyResult,
  type BulkCopyRow,
  type BulkCopyScope,
} from "@/lib/api/de-bulk-copy";
import { ASSESSMENT_WINDOW_DAYS, latestWeeklyPeriods } from "@/lib/period-utils";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole, useSession } from "@/stores/session";

// Bulk copy of the previous assessment into a selected Weekly period. An
// assessment stays valid for 35 days, so the latest Submitted one of each
// project / account is carried forward unchanged (same assessment date). Rows
// dated more than 35 days before the period end date are not copied and are
// listed with the reason. Project Quality Audits are ignored. Two tabs
// (Projects / Accounts), each with a Copied and a Not-copied grid.

const TABS: { key: BulkCopyScope; label: string }[] = [
  { key: "projects", label: "Project Assessments" },
  { key: "accounts", label: "Account Assessments" },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function ResultGrid({
  title,
  rows,
  scope,
  failed,
  tone,
}: {
  title: string;
  rows: BulkCopyRow[];
  scope: BulkCopyScope;
  failed?: boolean;
  tone: string;
}) {
  const isProject = scope === "projects";
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", tone)}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">{failed ? "Nothing here." : "Nothing was copied."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                <th className="px-5 py-3">{isProject ? "Project" : "Account"}</th>
                {isProject ? <th className="px-3 py-3">Account</th> : null}
                <th className="px-3 py-3">DE</th>
                <th className="px-3 py-3">Assessment Date</th>
                <th className="px-3 py-3">DE Health</th>
                {isProject ? <th className="px-3 py-3 text-right">PCI Score</th> : null}
                {failed ? <th className="px-3 py-3">Reason</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.entity_id}
                  className="border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB]"
                >
                  <td className="px-5 py-2.5 font-semibold text-slate-900">{r.entity_name}</td>
                  {isProject ? <td className="px-3 py-2.5 text-slate-600">{r.account_name ?? "—"}</td> : null}
                  <td className="px-3 py-2.5 text-slate-600">{r.delivery_excellence_name ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDate(r.assessment_date)}</td>
                  <td className="px-3 py-2.5">
                    {r.de_health ? <HealthPill rating={RATING_FROM_API[r.de_health]} /> : "—"}
                  </td>
                  {isProject ? (
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {r.pci_score ? `${r.pci_score}%` : "—"}
                    </td>
                  ) : null}
                  {failed ? <td className="px-3 py-2.5 text-red-700">{r.reason}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CopyTab({ scope, deUserId }: { scope: BulkCopyScope; deUserId: string | null }) {
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const { data: allPeriods = [] } = useReportingPeriods();
  const periods = React.useMemo(() => latestWeeklyPeriods(allPeriods), [allPeriods]);
  const [periodChoice, setPeriodChoice] = React.useState("");
  const periodId = periodChoice || periods[0]?.id || "";
  const [result, setResult] = React.useState<BulkCopyResult | null>(null);
  const copy = useBulkCopyAssessments(scope);

  const run = () => {
    if (!periodId) return;
    copy.mutate(
      { period_id: periodId, de_user_id: deUserId },
      {
        onSuccess: (res) => {
          setResult(res);
          showSuccess(
            `${res.copied.length} assessment${res.copied.length === 1 ? "" : "s"} copied to ${res.period_label}` +
              (res.failed.length ? `; ${res.failed.length} not copied` : "") +
              (res.skipped.length ? `; ${res.skipped.length} already assessed (exceptions)` : "") +
              ".",
          );
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Bulk copy failed."),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Period</span>
          <NativeSelect
            className="h-11 w-60"
            value={periodId}
            onChange={(e) => {
              setPeriodChoice(e.target.value);
              setResult(null);
            }}
          >
            {periods.length === 0 ? <option value="">No periods</option> : null}
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          onClick={run}
          disabled={copy.isPending || !periodId}
          className="h-11 gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
        >
          {copy.isPending ? <ButtonSpinner /> : null}
          Copy Previous Assessments
        </Button>
        <p className="max-w-xl text-sm text-slate-500">
          Copies the latest submitted assessment of each {scope === "projects" ? "project" : "account"} into the
          selected period, keeping its assessment date. An assessment dated more than {ASSESSMENT_WINDOW_DAYS} days
          before the period end date is not copied.
          {scope === "projects" ? " Quality Audits are ignored." : ""}
        </p>
      </div>

      {result ? (
        <>
          <p className="text-sm text-slate-500">
            {result.period_label} ends {formatDate(result.period_end_date)} — assessments dated on or after{" "}
            <span className="font-semibold text-slate-700">{formatDate(result.earliest_assessment_date)}</span> can be
            copied.
          </p>
          <ResultGrid
            title="Copied Successfully"
            rows={result.copied}
            scope={scope}
            tone="bg-emerald-100 text-emerald-700"
          />
          <ResultGrid
            title={`Not Copied (${ASSESSMENT_WINDOW_DAYS}-day rule or other)`}
            rows={result.failed}
            scope={scope}
            failed
            tone="bg-red-100 text-red-700"
          />
          <ResultGrid
            title="Exceptions — Already Assessed for this Period"
            rows={result.skipped}
            scope={scope}
            failed
            tone="bg-amber-100 text-amber-700"
          />
        </>
      ) : null}
    </div>
  );
}

export function DeBulkCopy() {
  const role = useEffectiveRole();
  const user = useSession((s) => s.user);
  const canWrite = canWriteDeAssessment(role);
  const [tab, setTab] = React.useState<BulkCopyScope>("projects");
  // DE filter in the header: a DE starts on their own work; anyone can switch to
  // another DE or clear it for all DEs.
  const [deUserId, setDeUserId] = React.useState<string | null>(
    role === "DELIVERY_EXCELLENCE" ? (user?.id ?? null) : null,
  );

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageBreadcrumb items={[{ label: "Delivery Excellence" }, { label: "Bulk Copy Assessments" }]} />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Bulk Copy Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">Carry the previous assessment forward into a selected period</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">DE</span>
          <div className="w-60">
            <ResourcePicker
              value={deUserId}
              onChange={setDeUserId}
              roleCode="DELIVERY_EXCELLENCE"
              placeholder="All DEs"
              initialLabel={deUserId && deUserId === user?.id ? user.full_name : undefined}
            />
          </div>
          {deUserId ? (
            <button
              type="button"
              onClick={() => setDeUserId(null)}
              className="text-sm font-semibold text-[#1a6fc4] hover:underline"
            >
              All DEs
            </button>
          ) : null}
        </div>
      </div>

      {!canWrite ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Only Delivery Excellence users can copy assessments.
        </p>
      ) : (
        <>
          <div role="tablist" className="flex gap-2 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors",
                  tab === t.key
                    ? "border-[#1a4a7a] text-[#1a4a7a]"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CopyTab key={tab} scope={tab} deUserId={deUserId} />
        </>
      )}
    </div>
  );
}
