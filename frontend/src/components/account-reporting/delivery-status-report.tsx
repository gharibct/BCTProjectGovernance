"use client";

import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import * as React from "react";
import { Lock, TrendingUp } from "lucide-react";

import { LOCK_BAR_CLASS } from "@/components/new-project/baseline-lock";
import { cn } from "@/lib/utils";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { CopyFromLatestButton } from "@/components/forms/copy-from-latest-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBanner } from "@/stores/page-banner";
import { useAccounts } from "@/lib/api/reference-data";
import { useCopyAccountItemsFromLatest } from "@/lib/api/regional-status";
import { useUploadReportAttachment } from "@/lib/api/report-attachments";
import { ReportAttachmentsSection } from "@/components/reporting/report-attachments-section";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { SECTION_IDS, statusSectionId } from "@/components/reporting/report-progress";
import { StatusItemsTab } from "@/components/regional-reporting/status-items-tab";
import { useRegionalStatusForm } from "@/components/regional-reporting/use-regional-status-form";
import { AccountHealthSections, useAccountHealthDeclarationForm } from "./rag-status-form";

// The Account Delivery Status Report as one long page: Overview, the four
// status registers and the six RAG categories stacked top to bottom, with a
// single Save Report at the bottom. The right-hand Report Progress rail
// (account-report-rail.tsx) jumps between the sections.
function AccountDeliveryStatusReportInner({ accountId }: { accountId: string }) {
  const {
    periodId,
    frozen,
    metrics,
    setMetric,
    rollupItems,
    handlePull,
    handleIgnore,
    handleUndo,
    rollupBusy,
    isSaving,
    existing,
    saveDetails,
  } = useRegionalStatusForm("account", accountId);
  const health = useAccountHealthDeclarationForm();
  const uploadAttachment = useUploadReportAttachment("account", accountId);
  const [pendingAttachments, setPendingAttachments] = React.useState<File[]>([]);
  const { data: accounts } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // "Copy from latest report": status + RAG registers are copied on the server;
  // the six ratings are only pre-filled here and persist with Save Report.
  const copyItems = useCopyAccountItemsFromLatest(accountId);
  const copyFromLatest = async () => {
    if (!periodId) return;
    try {
      const result = await copyItems.mutateAsync(periodId);
      const ratingsCopied = health.copyRatingsFromLatest();
      if (result.copied === 0 && !ratingsCopied) {
        showError("Nothing to copy — there is no earlier report, or these sections already have content.");
        return;
      }
      showSuccess(
        ratingsCopied
          ? "Copied from the latest report. RAG ratings are pre-filled — review them and Save Report."
          : "Copied from the latest report."
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to copy from the latest report.");
    }
  };

  // One Save Report for the whole page: report metrics first, then the six RAG
  // ratings. Line items in the registers already saved per row as edited.
  const saveReport = async () => {
    const reportId = await saveDetails({ silent: true });
    if (!reportId) return;
    // Attachments picked on this page are uploaded once the report exists;
    // any that fail stay queued so Save Report can retry them.
    if (pendingAttachments.length > 0) {
      const failed: File[] = [];
      for (const file of pendingAttachments) {
        try {
          await uploadAttachment.mutateAsync({ reportId, file });
        } catch {
          failed.push(file);
        }
      }
      setPendingAttachments(failed);
      if (failed.length > 0) {
        showError(`Could not upload: ${failed.map((f) => f.name).join(", ")}.`);
        return;
      }
    }
    try {
      await health.saveRatings();
      showSuccess("Report Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save RAG status.");
    }
  };
  const isBusy = isSaving || health.isSubmitting || uploadAttachment.isPending;

  return (
    <div className="flex flex-col gap-8">
      {periodId && !frozen ? (
        <div className="flex justify-end">
          <CopyFromLatestButton onClick={copyFromLatest} busy={copyItems.isPending} />
        </div>
      ) : null}
      {periodId ? (
        <section id={SECTION_IDS.metrics} className="scroll-mt-6">
          <SectionCard icon={TrendingUp} title="Overview">
            <Field label="Account Details" className="mb-6">
              <p className="text-sm whitespace-pre-wrap text-slate-700">
                {account?.description || "—"}
              </p>
            </Field>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
              <Field label="Revenue (USD)" htmlFor="revenue">
                <Input
                  id="revenue"
                  type="number"
                  className="h-11"
                  value={metrics.revenue}
                  onChange={setMetric("revenue")}
                  disabled={frozen}
                />
              </Field>
              <Field label="Onsite FTE" htmlFor="onsite_fte">
                <Input
                  id="onsite_fte"
                  type="number"
                  className="h-11"
                  value={metrics.onsite_fte}
                  onChange={setMetric("onsite_fte")}
                  disabled={frozen}
                />
              </Field>
              <Field label="Offshore FTE" htmlFor="offshore_fte">
                <Input
                  id="offshore_fte"
                  type="number"
                  className="h-11"
                  value={metrics.offshore_fte}
                  onChange={setMetric("offshore_fte")}
                  disabled={frozen}
                />
              </Field>
              <Field label="Projects Count" htmlFor="projects_count">
                <Input
                  id="projects_count"
                  type="number"
                  className="h-11"
                  value={metrics.projects_count}
                  onChange={setMetric("projects_count")}
                  disabled={frozen}
                />
              </Field>
            </div>
          </SectionCard>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No reporting period selected.
        </p>
      )}

      {TABS.map((t) => (
        <section key={t.label} id={statusSectionId(t.label)} className="scroll-mt-6">
          <StatusItemsTab
            scope="account"
            scopeId={accountId}
            category={t.category}
            title={t.label}
            icon={t.icon}
            frozen={frozen}
            rollupItems={rollupItems}
            onPullRollupItem={handlePull}
            onIgnoreRollupItem={handleIgnore}
            onUndoRollupItem={handleUndo}
            rollupBusy={rollupBusy}
          />
        </section>
      ))}

      <AccountHealthSections form={health} />

      {periodId ? (
        <section id={SECTION_IDS.attachments} className="scroll-mt-6">
          <ReportAttachmentsSection
            scope="account"
            ownerId={accountId}
            reportId={existing?.id}
            frozen={frozen}
            pending={pendingAttachments}
            onPendingChange={setPendingAttachments}
          />
        </section>
      ) : null}

      {periodId ? (
        <StickyActionBar
          className={frozen ? cn("z-40", LOCK_BAR_CLASS) : undefined}
          secondary={
            frozen ? (
              <p role="status" className="flex items-center gap-2 text-sm text-amber-800">
                <Lock className="size-4 shrink-0" />
                This report has been submitted and is now read-only.
              </p>
            ) : undefined
          }
        >
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isBusy || frozen}
            onClick={saveReport}
          >
            {isBusy ? <ButtonSpinner /> : null}
            Save Report
          </Button>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

export function AccountDeliveryStatusReport({ accountId }: { accountId: string }) {
  // Both hooks read ?period= (useSearchParams), which requires a Suspense
  // boundary at prerender.
  return (
    <React.Suspense fallback={null}>
      <AccountDeliveryStatusReportInner accountId={accountId} />
    </React.Suspense>
  );
}
