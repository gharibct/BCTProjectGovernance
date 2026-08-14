"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ExecutiveContentBuilder } from "@/components/executive-content-builder/executive-content-builder";
import { createSection, type ExecutiveUpdate } from "@/components/executive-content-builder/types";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { currentPeriod } from "@/lib/period-utils";
import {
  fetchExecutiveUpdateImage,
  useCreateExecutiveUpdate,
  useExecutiveUpdates,
  useUpdateExecutiveUpdate,
  useUploadExecutiveUpdateImage,
} from "@/lib/api/executive-updates";
import { RegionalHeader } from "./regional-header";

function defaultExecutiveUpdate(): ExecutiveUpdate {
  return {
    sections: ["Delivery", "People", "Financials", "Operations"].map((title, index) =>
      createSection(title, index + 1)
    ),
  };
}

// Sample screen for the Geo Head's Executive Update — the free-form
// narrative CXO needs (Delivery/People/Financials/Operations), replacing the
// account→geo rollup model at the top of the reporting chain. Save-only for
// now (see lib/api/executive-updates.ts) — no submit/review workflow yet.
export function ExecutiveUpdateView() {
  const { geoId } = useParams<{ geoId: string }>();
  const searchParams = useSearchParams();
  const user = useSession((s) => s.user);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const { data: periods = [] } = useReportingPeriods();
  const { data: records = [] } = useExecutiveUpdates(geoId ?? null);
  const createUpdate = useCreateExecutiveUpdate(geoId ?? null);
  const updateUpdate = useUpdateExecutiveUpdate(geoId ?? null);
  const uploadImage = useUploadExecutiveUpdateImage(geoId ?? null);

  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? records[0]?.period_id ?? currentPeriod(periods, "Monthly")?.id ?? null;
  const existing = records.find((r) => r.period_id === periodId);

  // Sync local edit state from the server record once per distinct record
  // (or once per period, if there's none yet) — same "sync once, then let
  // local edits win" pattern useMeasurementForm/project-status-tabs use, so
  // typing here doesn't get clobbered by a background refetch.
  const [update, setUpdate] = React.useState<ExecutiveUpdate>(defaultExecutiveUpdate);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  const key = existing ? existing.id : `blank:${periodId}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    setUpdate(existing ? existing.content : defaultExecutiveUpdate());
  }

  const isSaving = createUpdate.isPending || updateUpdate.isPending;

  const handleSave = () => {
    const onSuccess = () => showSuccess("Executive Update Saved");
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to save Executive Update.");

    if (existing) {
      updateUpdate.mutate({ id: existing.id, payload: { content: update } }, { onSuccess, onError });
    } else if (periodId) {
      createUpdate.mutate({ period_id: periodId, content: update, created_by: user?.id }, { onSuccess, onError });
    }
  };

  const onUploadImage = async (file: File): Promise<string> => {
    const result = await uploadImage.mutateAsync(file);
    return result.path;
  };

  const resolveImageUrl = React.useCallback(
    async (imageUrl: string): Promise<string> => {
      const blob = await fetchExecutiveUpdateImage(geoId, imageUrl);
      return URL.createObjectURL(blob);
    },
    [geoId]
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <RegionalHeader scope="geo" paramName="geoId" subheading="Executive Update" periodId={periodId} />

      <ExecutiveContentBuilder
        value={update}
        onChange={setUpdate}
        onUploadImage={onUploadImage}
        resolveImageUrl={resolveImageUrl}
      />

      <div className="flex justify-end">
        <Button className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]" disabled={!periodId || isSaving} onClick={handleSave}>
          {isSaving ? <ButtonSpinner /> : <Send className="size-4" />}
          Save Draft
        </Button>
      </div>
    </div>
  );
}
