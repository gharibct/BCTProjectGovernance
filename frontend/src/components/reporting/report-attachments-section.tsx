"use client";

import * as React from "react";
import { Paperclip, Trash2, X } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { usePageBanner } from "@/stores/page-banner";
import {
  ATTACHMENT_ACCEPT,
  formatFileSize,
  openReportAttachment,
  useDeleteReportAttachment,
  useReportAttachments,
  type ReportAttachment,
  type ReportAttachmentScope,
} from "@/lib/api/report-attachments";

type Target = { scope: ReportAttachmentScope; ownerId: string; reportId: string | null | undefined };

function ViewButton({ target, attachment }: { target: Target; attachment: ReportAttachment }) {
  const showError = usePageBanner((s) => s.showError);
  return (
    <button
      type="button"
      onClick={() =>
        openReportAttachment(target.scope, target.ownerId, target.reportId!, attachment).catch((err) =>
          showError(err instanceof Error ? err.message : "Failed to open the file.")
        )
      }
      className="font-semibold text-[#1a6fc4] hover:underline"
    >
      View
    </button>
  );
}

// Record Project Status / Record Account Status: attach supporting documents.
// Files picked before the report exists are held in `pending` and uploaded by
// the page's Save Report (see uploadPendingAttachments).
export function ReportAttachmentsSection({
  scope,
  ownerId,
  reportId,
  frozen,
  pending,
  onPendingChange,
}: Target & {
  frozen: boolean;
  pending: File[];
  onPendingChange: (files: File[]) => void;
}) {
  const target = { scope, ownerId, reportId };
  const { data: attachments = [] } = useReportAttachments(scope, ownerId, reportId);
  const deleteAttachment = useDeleteReportAttachment(scope, ownerId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length > 0) onPendingChange([...pending, ...picked]);
  };

  const remove = (attachment: ReportAttachment) =>
    deleteAttachment.mutate(
      { reportId: reportId!, attachmentId: attachment.id },
      {
        onSuccess: () => showSuccess("Attachment Removed Successfully"),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to remove the attachment."),
      }
    );

  return (
    <SectionCard
      icon={Paperclip}
      title="Attachments"
      aside={
        frozen ? null : (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={addFiles}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-2 px-4 text-sm font-semibold"
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip className="size-4" />
              Add Attachment
            </Button>
          </>
        )
      }
    >
      {attachments.length === 0 && pending.length === 0 ? (
        <p className="text-sm text-slate-500">
          {frozen ? "No attachments." : "No attachments yet. Supporting documents added here appear in the report."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 text-sm text-slate-700">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <Paperclip className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
              <span className="text-xs text-slate-400">{formatFileSize(a.file_size)}</span>
              <ViewButton target={target} attachment={a} />
              {frozen ? null : (
                <button
                  type="button"
                  aria-label={`Remove ${a.file_name}`}
                  disabled={deleteAttachment.isPending}
                  onClick={() => remove(a)}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
          {pending.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-3 py-2.5">
              <Paperclip className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Uploads on Save Report
              </span>
              <button
                type="button"
                aria-label={`Discard ${file.name}`}
                onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-600"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// Read-only list shown in the report preview / review: filename + View.
export function ReportAttachmentsView({ scope, ownerId, reportId }: Target) {
  const { data: attachments = [] } = useReportAttachments(scope, ownerId, reportId);
  const target = { scope, ownerId, reportId };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Paperclip className="size-5 text-[#1a6fc4]" />
        Attachments
      </h2>
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        {attachments.length === 0 ? (
          <span className="text-slate-500">No attachments</span>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {attachments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
                <span className="text-xs text-slate-400">{formatFileSize(a.file_size)}</span>
                <span className="text-slate-300">|</span>
                <ViewButton target={target} attachment={a} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
