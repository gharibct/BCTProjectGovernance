"use client";

import * as React from "react";
import { Download, Presentation } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ProjectStatusReport } from "@/lib/api/project-status";

// Customer Communication on Project Status — was this period's status report
// shared with the customer? Date Shared and the Presentation / Status Report
// upload only apply (and are mandatory) when the answer is Yes. Form state is
// owned by ProjectStatusTabs and persisted by its "Save Details". The backend
// also has an optional Remarks field; it's deliberately not shown for now.

export const CUSTOMER_REPORT_ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx";

export type CustomerCommunicationState = {
  shared: "" | "Yes" | "No";
  date: string;
  // A file picked but not yet uploaded — uploaded after the report is saved.
  file: File | null;
};

export const BLANK_CUSTOMER_COMMUNICATION: CustomerCommunicationState = {
  shared: "",
  date: "",
  file: null,
};

export function customerCommunicationFromReport(report: ProjectStatusReport): CustomerCommunicationState {
  return {
    shared: report.customer_report_shared === null ? "" : report.customer_report_shared ? "Yes" : "No",
    date: report.customer_report_date ?? "",
    file: null,
  };
}

export type CustomerCommunicationErrors = Partial<Record<"shared" | "date" | "file", string>>;

export function validateCustomerCommunication(
  value: CustomerCommunicationState,
  hasUploadedFile: boolean
): CustomerCommunicationErrors {
  const errors: CustomerCommunicationErrors = {};
  if (!value.shared) errors.shared = "Select Yes or No.";
  if (value.shared === "Yes") {
    if (!value.date) errors.date = "Date Shared is required.";
    if (!value.file && !hasUploadedFile) errors.file = "Upload the Presentation / Status Report.";
  }
  return errors;
}

export function CustomerCommunicationSection({
  value,
  onChange,
  errors,
  uploadedFileName,
  onDownload,
  disabled,
}: {
  value: CustomerCommunicationState;
  onChange: (next: CustomerCommunicationState) => void;
  errors: CustomerCommunicationErrors;
  // Name of the file already stored on the saved report, if any.
  uploadedFileName: string | null;
  onDownload: () => void;
  disabled: boolean;
}) {
  const shared = value.shared === "Yes";

  return (
    <SectionCard icon={Presentation} title="Customer Communication">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
        <Field label="Status Report Shared?" htmlFor="customer_report_shared" required error={errors.shared}>
          <NativeSelect
            id="customer_report_shared"
            className="h-11"
            value={value.shared}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, shared: e.target.value as CustomerCommunicationState["shared"] })}
          >
            <option value="">Select…</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </NativeSelect>
        </Field>

        {shared ? (
          <Field label="Date Shared" htmlFor="customer_report_date" required error={errors.date}>
            <Input
              id="customer_report_date"
              type="date"
              className="h-11"
              value={value.date}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
            />
          </Field>
        ) : null}

        {shared ? (
          <Field label="Presentation / Status Report" htmlFor="customer_report_file" required error={errors.file}>
            <div className="flex flex-col gap-2">
              {!disabled ? (
                <input
                  id="customer_report_file"
                  type="file"
                  accept={CUSTOMER_REPORT_ACCEPT}
                  className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                  onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
                />
              ) : null}
              {value.file ? (
                <span className="text-xs text-slate-500">{value.file.name} — will be uploaded on Save Details.</span>
              ) : uploadedFileName ? (
                <button
                  type="button"
                  onClick={onDownload}
                  className="flex w-fit items-center gap-1.5 text-sm font-semibold text-[#1a6fc4] hover:underline"
                >
                  <Download className="size-4" />
                  {uploadedFileName}
                </button>
              ) : disabled ? (
                <span className="text-sm text-slate-400">—</span>
              ) : null}
            </div>
          </Field>
        ) : null}
      </div>
    </SectionCard>
  );
}
