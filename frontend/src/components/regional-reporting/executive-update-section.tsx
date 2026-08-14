"use client";

import * as React from "react";

import { ExecutiveContentView } from "@/components/executive-content-builder/executive-content-view";
import { fetchExecutiveUpdateImage, useExecutiveUpdates } from "@/lib/api/executive-updates";

// Read-only display of the Geo Head's saved Executive Update for a period —
// same content the editable form at executive-update-view.tsx produces,
// shown wherever it needs reviewing (currently: the Geo Dashboard).
export function ExecutiveUpdateSection({ geoId, periodId }: { geoId: string; periodId: string }) {
  const { data: records = [] } = useExecutiveUpdates(geoId);
  const record = records.find((r) => r.period_id === periodId);

  const resolveImageUrl = React.useCallback(
    (imageUrl: string) => fetchExecutiveUpdateImage(geoId, imageUrl).then((blob) => URL.createObjectURL(blob)),
    [geoId]
  );

  if (!record || record.content.sections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
        No Executive Update submitted for this period yet.
      </p>
    );
  }

  return <ExecutiveContentView value={record.content} resolveImageUrl={resolveImageUrl} />;
}
