"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, History, MessageSquare, Plus } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { PageBanner } from "@/components/shell/page-banner";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadCustomerCommunicationFile,
  useCreateCustomerCommunication,
  useCustomerCommunications,
} from "@/lib/api/customer-communications";
import { useAccounts } from "@/lib/api/reference-data";
import { formatDayMonYear } from "@/lib/format-date";
import { useEffectiveRole } from "@/stores/session";
import { usePageBanner } from "@/stores/page-banner";

// Customer Communications (Account) — reached from the Account Reporting hub's
// Add Communication button. Record a meeting / presentation shared with the
// customer, and see the history below it. CDO / Delivery Excellence can read
// the history but not add to it (the backend enforces the same).

const ACCEPT = ".ppt,.pptx,.pdf";
const WRITER_ROLES = ["ACCOUNT_MANAGER", "GEO_HEAD", "ADMIN"];

type FieldErrors = Partial<Record<"date" | "title" | "file", string>>;

export function CustomerCommunicationsView() {
  const { accountId } = useParams<{ accountId: string }>();
  const role = useEffectiveRole();
  const canAdd = !!role && WRITER_ROLES.includes(role);

  const { data: accounts = [] } = useAccounts();
  const accountName = accounts.find((a) => a.id === accountId)?.name;
  const listQuery = useCustomerCommunications(accountId ?? null);
  const { data: communications = [] } = listQuery;
  const create = useCreateCustomerCommunication(accountId ?? null);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [date, setDate] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  // Remounts the file input to clear it after a successful save.
  const [fileInputKey, setFileInputKey] = React.useState(0);

  const submit = async () => {
    const next: FieldErrors = {};
    if (!date) next.date = "Reporting Date is required.";
    if (!title.trim()) next.title = "Title is required.";
    if (!file) next.file = "Upload the presentation.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !file) {
      showError("Complete the mandatory fields.");
      return;
    }
    try {
      await create.mutateAsync({ reportingDate: date, title: title.trim(), remarks: remarks.trim(), file });
      setDate("");
      setTitle("");
      setRemarks("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      showSuccess("Communication Added Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add the communication.");
    }
  };

  if (listQuery.isError) {
    return <QueryErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Link
          href={`/account-reporting/${accountId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Reporting Summary
        </Link>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Customer Communications (Account)</h1>
        {accountName ? <p className="mt-2 max-w-3xl text-slate-500">{accountName}</p> : null}
      </div>

      <PageBanner />

      {canAdd ? (
        <SectionCard icon={MessageSquare} title="Add Communication">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <Field label="Reporting Date" htmlFor="cc_date" required error={errors.date}>
              <Input
                id="cc_date"
                type="date"
                className="h-11"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Meeting / Presentation Title" htmlFor="cc_title" required error={errors.title}>
              <Input
                id="cc_title"
                className="h-11"
                placeholder="e.g. Q3 Account Review, Monthly Service Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Presentation" htmlFor="cc_file" required error={errors.file}>
              <input
                key={fileInputKey}
                id="cc_file"
                type="file"
                accept={ACCEPT}
                className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="Remarks" htmlFor="cc_remarks">
              <Textarea
                id="cc_remarks"
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
              disabled={create.isPending}
              onClick={submit}
            >
              {create.isPending ? <ButtonSpinner /> : <Plus className="size-4" />}
              Add Communication
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <History className="size-5 text-[#1a6fc4]" />
          Communication History
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-6 py-3 font-bold">Reporting Date</th>
                <th className="px-3 py-3 font-bold">Meeting / Presentation Title</th>
                <th className="px-3 py-3 font-bold">Presentation</th>
                <th className="px-6 py-3 font-bold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {communications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                    No communications recorded yet.
                  </td>
                </tr>
              ) : (
                communications.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{formatDayMonYear(c.reporting_date)}</td>
                    <td className="px-3 py-3.5 text-slate-700">{c.title}</td>
                    <td className="px-3 py-3.5">
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
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">{c.remarks || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
