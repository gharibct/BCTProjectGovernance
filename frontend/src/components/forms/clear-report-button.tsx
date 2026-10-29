"use client";

import { Eraser } from "lucide-react";

import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";

// Page-level "Clear Report" action, shown next to "Copy from latest report" on
// the Project / Account Delivery Status reports. The caller owns the confirm
// dialog state and does the clear; this only renders the button + busy state.
export function ClearReportButton({ onClick, busy, disabled }: { onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="h-11 gap-2 px-4 text-sm font-semibold"
      disabled={busy || disabled}
      onClick={onClick}
    >
      {busy ? <ButtonSpinner /> : <Eraser className="size-4" />}
      Clear Report
    </Button>
  );
}

export function ClearReportDialog({
  open,
  onOpenChange,
  onConfirm,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Report-specific sentence about what else is wiped (e.g. customer communication). */
  extra?: string;
}) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Clear this report?"
      message={`This removes everything entered in this report — key metrics, ${extra ? `${extra}, ` : ""}status items, RAG items and RAG ratings. Attachments are kept. This cannot be undone.`}
      confirmLabel="Yes, clear it"
      cancelLabel="Keep my report"
      onConfirm={onConfirm}
    />
  );
}
