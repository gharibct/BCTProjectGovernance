"use client";

import { Copy } from "lucide-react";

import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";

// Page-level "Copy from latest report" action shared by the Project Status,
// Account Status and Project Performance reports. The caller does the copy and
// reports the outcome; this only renders the button + busy state.
// Asked before "Copy from latest report" when this report already has saved
// content — confirming replaces everything with the latest report's values.
export function ReplaceFromLatestDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Replace with your latest report?"
      message="This report already has saved information. Copying from your latest report will replace everything you've entered here — key metrics, status items, RAG items and RAG ratings. Any changes you made by hand will be lost."
      confirmLabel="Yes, replace it"
      cancelLabel="Keep my changes"
      onConfirm={onConfirm}
    />
  );
}

export function CopyFromLatestButton({
  onClick,
  busy,
  disabled,
  label = "Copy from latest report",
  description = "Prefill this report from your most recent earlier report. Sections that already have content are left as they are.",
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  description?: string;
}) {
  return (
    <span className="group/tip relative inline-flex">
      <Button
        type="button"
        variant="secondary"
        className="h-11 gap-2 px-4 text-sm font-semibold"
        disabled={busy || disabled}
        onClick={onClick}
        aria-describedby="copy-from-latest-tip"
      >
        {busy ? <ButtonSpinner /> : <Copy className="size-4" />}
        {label}
      </Button>
      <span
        id="copy-from-latest-tip"
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-0 z-50 mt-2 w-64 rounded-md bg-slate-900 px-3 py-2 text-xs leading-relaxed font-normal whitespace-normal text-white opacity-0 shadow-lg transition-opacity group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}
