import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ReportStatus } from "./project-status";
import type { ExecutiveUpdate } from "@/components/executive-content-builder/types";

// Geo Head's Executive Update for CXO — same list/create/edit shape as
// lib/api/regional-status.ts's Geo Status Report hooks, minus review (no
// submit/review workflow yet). `content` round-trips the
// ExecutiveContentBuilder JSON shape as-is.

export type ExecutiveUpdateRecord = {
  id: string;
  geo_id: string;
  period_id: string;
  status: ReportStatus;
  content: ExecutiveUpdate;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutiveUpdateCreatePayload = {
  period_id: string;
  content: ExecutiveUpdate;
  created_by?: string;
};

export type ExecutiveUpdateUpdatePayload = {
  content: ExecutiveUpdate;
};

function basePath(geoId: string): string {
  return `/geos/${geoId}/executive-updates`;
}

export function useExecutiveUpdates(geoId: string | null) {
  return useQuery({
    queryKey: ["executive-updates", geoId],
    queryFn: () => api.get<ExecutiveUpdateRecord[]>(basePath(geoId!)),
    enabled: !!geoId,
  });
}

function invalidateExecutiveUpdates(queryClient: ReturnType<typeof useQueryClient>, geoId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["executive-updates", geoId] });
}

export function useCreateExecutiveUpdate(geoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExecutiveUpdateCreatePayload) =>
      api.post<ExecutiveUpdateRecord>(basePath(geoId!), payload),
    onSuccess: () => invalidateExecutiveUpdates(queryClient, geoId),
  });
}

export function useUpdateExecutiveUpdate(geoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExecutiveUpdateUpdatePayload }) =>
      api.put<ExecutiveUpdateRecord>(`${basePath(geoId!)}/${id}`, payload),
    onSuccess: () => invalidateExecutiveUpdates(queryClient, geoId),
  });
}

export type UploadedExecutiveUpdateImage = { path: string };

// Uploads immediately on file pick (not deferred to Save) — returns the
// backend-relative storage path, stored in the block's `imageUrl` instead of
// a local blob: URL. Rendering that path back requires fetchExecutiveUpdateImage
// below, since every route on this backend requires the X-API-Key header a
// plain <img src> can't attach (same limitation lib/api/documents.ts already
// has for downloads).
export function useUploadExecutiveUpdateImage(geoId: string | null) {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.postForm<UploadedExecutiveUpdateImage>(`${basePath(geoId!)}/images`, formData);
    },
  });
}

// `path` is the backend-relative storage path returned by the upload above
// (e.g. "executive_updates/<geoId>/<uuid>.png"), not a full URL — the
// filename segment is everything after the last "/".
export async function fetchExecutiveUpdateImage(geoId: string, path: string): Promise<Blob> {
  const filename = path.split("/").pop();
  return api.getBlob(`${basePath(geoId)}/images/${filename}`);
}
