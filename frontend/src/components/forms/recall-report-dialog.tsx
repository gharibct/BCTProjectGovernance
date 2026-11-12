"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Confirmation for recalling a report: remarks are mandatory. `onRecall`
// resolves on success (the dialog closes) or throws to show the error inline.
export function RecallReportDialog({
  open,
  onOpenChange,
  description,
  onRecall,
  action = "Recall",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  onRecall: (remarks: string) => Promise<unknown>;
  // Wording of the action: "Recall" (default) or "Revoke" (approval revoked by the reviewer).
  action?: "Recall" | "Revoke";
}) {
  // Remarks/error live in the body, which only mounts while the dialog is
  // open, so every open starts blank.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RecallBody
        onOpenChange={onOpenChange}
        description={description}
        onRecall={onRecall}
        action={action}
      />
    </Dialog>
  );
}

function RecallBody({
  onOpenChange,
  description,
  onRecall,
  action,
}: {
  onOpenChange: (open: boolean) => void;
  description: string;
  onRecall: (remarks: string) => Promise<unknown>;
  action: "Recall" | "Revoke";
}) {
  const revoke = action === "Revoke";
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const confirm = async () => {
    const trimmed = remarks.trim();
    if (!trimmed) {
      setError(`${action} remarks are required.`);
      return;
    }
    setPending(true);
    try {
      await onRecall(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action.toLowerCase()} the report.`,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{revoke ? "Revoke approval?" : "Recall report?"}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="recall-remarks"
          className="text-sm font-semibold text-slate-700"
        >
          {action} remarks <span className="text-red-600">*</span>
        </label>
        <Textarea
          id="recall-remarks"
          rows={4}
          placeholder={revoke ? "Why is the approval being revoked?" : "Why is this report being recalled?"}
          value={remarks}
          onChange={(e) => {
            setRemarks(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={confirm}
        >
          {pending ? <ButtonSpinner /> : null}
          {revoke ? "Revoke Approval" : "Recall Report"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
