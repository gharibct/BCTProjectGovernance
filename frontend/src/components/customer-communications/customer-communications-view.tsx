"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { History, MessageSquare, Save } from "lucide-react";

import { ActionTrackerTrigger } from "@/components/action-tracker/action-tracker-trigger";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import { PageBanner } from "@/components/shell/page-banner";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  QBR_STATUSES,
  type QbrStatus,
  downloadCustomerCommunicationFile,
  openQbr,
  qbrDate,
  useSaveCustomerCommunication,
  summarizeCustomerCommunications,
  useCustomerCommunications,
} from "@/lib/api/customer-communications";
import { useAccounts } from "@/lib/api/reference-data";
import { formatDayMonYear } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/stores/session";
import { usePageBanner } from "@/stores/page-banner";

// Update Account QBR — reached from the Account Reporting hub's Add
// Communication button. An account has at most one open (Initiated /
// Scheduled) QBR: the form loads it and saves onto it (or creates one when
// there is none). Saving it as Conducted opens the next QBR, Initiated on the
// Next QBR Date, which the form then loads. The history sits below it. CXO / Delivery Excellence can read
// the history but not add to it (the backend enforces the same, along with the
// date rules checked here).

const ACCEPT = ".ppt,.pptx,.pdf";
const WRITER_ROLES = ["ACCOUNT_MANAGER", "GEO_HEAD", "ADMIN"];
// QBR History shows the last 12 months only, four records per page.
const HISTORY_PAGE_SIZE = 4;
// KPI bar quarters: the last two, the current one and the next one.
const KPI_QUARTER_OFFSETS = [-2, -1, 0, 1];
const QUARTER_TILE_STYLE = {
  past: { tile: "border-slate-200 bg-slate-50", tag: "Previous", count: "text-slate-700" },
  current: { tile: "border-[#1a6fc4] bg-[#E8F2FC] ring-1 ring-[#1a6fc4]/30", tag: "Current", count: "text-[#1a4a7a]" },
  next: { tile: "border-amber-200 bg-amber-50", tag: "Next", count: "text-amber-700" },
} as const;
const STATUS_BADGE: Record<QbrStatus, string> = {
  Initiated: "bg-slate-100 text-slate-700",
  Scheduled: "bg-amber-50 text-amber-700",
  Conducted: "bg-emerald-50 text-emerald-700",
};

function toISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function oneYearAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toISO(d);
}

function dayAfterISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + 1));
}

type FieldErrors = Partial<Record<"planned" | "status" | "actual" | "next" | "title" | "file", string>>;

export function CustomerCommunicationsView() {
  const { accountId } = useParams<{ accountId: string }>();
  const role = useEffectiveRole();
  const canAdd = !!role && WRITER_ROLES.includes(role);

  const { data: accounts = [] } = useAccounts();
  const account = accounts.find((a) => a.id === accountId);
  const accountName = account?.name;
  const listQuery = useCustomerCommunications(accountId ?? null);
  const { data: communications = [] } = listQuery;
  const summary = React.useMemo(
    () => summarizeCustomerCommunications(communications, KPI_QUARTER_OFFSETS),
    [communications]
  );
  const [historySkip, setHistorySkip] = React.useState(0);
  const history = React.useMemo(() => {
    const since = oneYearAgoISO();
    return communications
      .filter((c) => qbrDate(c) >= since)
      .sort((a, b) => qbrDate(b).localeCompare(qbrDate(a)));
  }, [communications]);
  const historyPage = history.slice(historySkip, historySkip + HISTORY_PAGE_SIZE);
  const open = React.useMemo(() => openQbr(communications), [communications]);
  const save = useSaveCustomerCommunication(accountId ?? null);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [plannedDate, setPlannedDate] = React.useState("");
  const [actualDate, setActualDate] = React.useState("");
  const [qbrStatus, setQbrStatus] = React.useState<QbrStatus | "">("");
  const [nextQbrDate, setNextQbrDate] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  // Remounts the file input to clear it after a successful save.
  const [fileInputKey, setFileInputKey] = React.useState(0);

  // Load the open QBR into the form — on launch, and again once saving one as
  // Conducted has opened the next. Conducted-only fields start empty.
  const loadedId = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (listQuery.isLoading) return;
    const id = open?.id ?? null;
    if (loadedId.current === id) return;
    loadedId.current = id;
    setPlannedDate(open?.planned_date ?? "");
    setQbrStatus(open?.status ?? "");
    setRemarks(open?.remarks ?? "");
    setActualDate("");
    setTitle("");
    setNextQbrDate("");
    setFile(null);
    setFileInputKey((k) => k + 1);
    setErrors({});
  }, [open, listQuery.isLoading]);

  const today = toISO(new Date());
  const conducted = qbrStatus === "Conducted";

  const onStatusChange = (value: QbrStatus | "") => {
    setQbrStatus(value);
    // Actual date, title, presentation and Next QBR Date only apply once this
    // QBR has been Conducted.
    if (value !== "Conducted") {
      setActualDate("");
      setTitle("");
      setNextQbrDate("");
      setFile(null);
      setFileInputKey((k) => k + 1);
    }
  };

  const submit = async () => {
    const next: FieldErrors = {};
    if (!plannedDate) next.planned = "Planned / Scheduled QBR Date is required.";
    if (!qbrStatus) next.status = "QBR Status is required.";
    if (conducted) {
      if (!actualDate) next.actual = "Actual QBR Date is required when the QBR is Conducted.";
      else if (actualDate > today) next.actual = "Actual QBR Date cannot be in the future.";
      if (!title.trim()) next.title = "Title is required when the QBR is Conducted.";
      if (!nextQbrDate) next.next = "Next QBR Date is required when the QBR is Conducted.";
      else if (actualDate && nextQbrDate <= actualDate) next.next = "Next QBR Date must be after the Actual QBR Date.";
      if (!file) next.file = "Upload the presentation.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !qbrStatus) {
      showError("Complete the mandatory fields.");
      return;
    }
    try {
      await save.mutateAsync({
        id: open?.id,
        plannedDate,
        actualDate: conducted ? actualDate : "",
        status: qbrStatus,
        nextQbrDate: conducted ? nextQbrDate : "",
        title: conducted ? title.trim() : "",
        remarks: remarks.trim(),
        file: conducted ? file : null,
      });
      if (conducted) {
        // The list refetch loads the newly Initiated QBR into the form.
        showSuccess(`QBR Updated Successfully. Next QBR Initiated for ${formatDayMonYear(nextQbrDate)}.`);
      } else {
        // The same QBR stays open, so the form keeps its values.
        setFile(null);
        setFileInputKey((k) => k + 1);
        showSuccess("QBR Updated Successfully");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update the QBR.");
    }
  };

  if (listQuery.isError) {
    return <QueryErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />;
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div>
        <PageBreadcrumb
          items={[
            { label: "Reporting Summary", href: `/account-reporting/${accountId}/summary` },
            { label: "Update Account QBR" },
          ]}
        />
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Update Account QBR</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {accountName ? <p className="max-w-3xl text-slate-500">{accountName}</p> : null}
            {account?.critical_flag === "Yes" ? (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                Critical Account · Quarterly QBR Mandatory
              </span>
            ) : null}
          </div>
          {/* Account-level actions (e.g. QBR follow-ups), the same list as on Update Account Status Report. */}
          {accountId ? <ActionTrackerTrigger level="ACCOUNT" id={accountId} name={accountName ?? ""} /> : null}
        </div>
      </div>

      <PageBanner />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">QBRs Conducted</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{summary.counts.total}</div>
        </div>
        {summary.counts.quarters.map((q) => {
          const style = QUARTER_TILE_STYLE[q.period];
          return (
            <div key={q.label} className={cn("rounded-xl border p-4 text-center shadow-sm", style.tile)}>
              <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">{q.label}</div>
              <div className="text-[11px] font-semibold text-slate-400">{style.tag} Quarter</div>
              <div className={cn("mt-1 text-3xl font-bold", style.count)}>{q.count}</div>
              <div className="text-[11px] text-slate-500">
                {q.period === "past"
                  ? "conducted"
                  : q.period === "current"
                    ? `${q.conducted} conducted · ${q.planned} planned`
                    : "planned"}
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">Last Conducted</div>
          <div className="mt-2 text-base font-bold text-slate-900">{summary.last?.date ?? "—"}</div>
          {summary.last ? <div className="truncate text-xs text-slate-500">{summary.last.title}</div> : null}
        </div>
      </div>

      {canAdd ? (
        <SectionCard icon={MessageSquare} title="Update QBR">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <Field label="Planned / Scheduled QBR Date" htmlFor="qbr_planned" required error={errors.planned}>
              <Input
                id="qbr_planned"
                type="date"
                className="h-11"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </Field>
            <Field label="QBR Status" htmlFor="qbr_status" required error={errors.status}>
              <NativeSelect
                id="qbr_status"
                value={qbrStatus}
                onChange={(e) => onStatusChange(e.target.value as QbrStatus | "")}
              >
                <option value="">Select status</option>
                {QBR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Actual QBR Date"
              htmlFor="qbr_actual"
              required={conducted}
              hint={conducted ? "Cannot be a future date." : "Enabled once the QBR Status is Conducted."}
              error={errors.actual}
            >
              <Input
                id="qbr_actual"
                type="date"
                className="h-11"
                disabled={!conducted}
                max={today}
                value={actualDate}
                onChange={(e) => setActualDate(e.target.value)}
              />
            </Field>
            <Field
              label="Next QBR Date"
              htmlFor="qbr_next"
              required={conducted}
              hint={conducted ? "Must be after the Actual QBR Date." : "Enabled once the QBR Status is Conducted."}
              error={errors.next}
            >
              <Input
                id="qbr_next"
                type="date"
                className="h-11"
                disabled={!conducted}
                min={actualDate ? dayAfterISO(actualDate) : undefined}
                value={nextQbrDate}
                onChange={(e) => setNextQbrDate(e.target.value)}
              />
            </Field>
            <Field
              label="Meeting / Presentation Title"
              htmlFor="qbr_title"
              required={conducted}
              hint={conducted ? undefined : "Enabled once the QBR Status is Conducted."}
              error={errors.title}
            >
              <Input
                id="qbr_title"
                className="h-11"
                disabled={!conducted}
                placeholder="e.g. Q3 Account Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field
              label="Presentation"
              htmlFor="qbr_file"
              required={conducted}
              hint={conducted ? undefined : "Enabled once the QBR Status is Conducted."}
              error={errors.file}
            >
              <input
                key={fileInputKey}
                id="qbr_file"
                type="file"
                accept={ACCEPT}
                disabled={!conducted}
                className="block w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="Remarks" htmlFor="qbr_remarks">
              <Textarea
                id="qbr_remarks"
                className="min-h-11"
                rows={2}
                placeholder="Optional — short context"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
              disabled={save.isPending}
              onClick={submit}
            >
              {save.isPending ? <ButtonSpinner /> : <Save className="size-4" />}
              Update QBR
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <History className="size-5 text-[#1a6fc4]" />
          QBR History
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#D6E9F8]">
              <tr className="text-xs tracking-wide text-[#205889] uppercase">
                <th className="px-6 py-3 font-bold">Planned / Scheduled Date</th>
                <th className="px-3 py-3 font-bold">Actual Date</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-3 py-3 font-bold">Next QBR Date</th>
                <th className="px-3 py-3 font-bold">Meeting / Presentation Title</th>
                <th className="px-3 py-3 font-bold">Presentation</th>
                <th className="px-6 py-3 font-bold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-center text-slate-400">
                    No QBRs recorded in the last year.
                  </td>
                </tr>
              ) : (
                historyPage.map((c) => (
                  <tr key={c.id} className="border-t border-[#E4E9EE] bg-white transition-colors even:bg-[#F8FAFB] hover:bg-[#EDF3F7]">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{formatDayMonYear(c.planned_date)}</td>
                    <td className="px-3 py-3.5 text-slate-700">{c.actual_date ? formatDayMonYear(c.actual_date) : "—"}</td>
                    <td className="px-3 py-3.5">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_BADGE[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-700">
                      {c.next_qbr_date ? formatDayMonYear(c.next_qbr_date) : "—"}
                    </td>
                    <td className="px-3 py-3.5 text-slate-700">{c.title || "—"}</td>
                    <td className="px-3 py-3.5">
                      {c.file_name ? (
                        <button
                          type="button"
                          title={c.file_name}
                          onClick={() =>
                            downloadCustomerCommunicationFile(accountId, c).catch((err) =>
                              showError(err instanceof Error ? err.message : "Failed to open the file.")
                            )
                          }
                          className="font-semibold text-[#1a6fc4] hover:underline"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">{c.remarks || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {history.length > HISTORY_PAGE_SIZE ? (
            <PaginationBar
              skip={historySkip}
              limit={HISTORY_PAGE_SIZE}
              total={history.length}
              onPageChange={setHistorySkip}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
