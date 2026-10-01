import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Supporting documents on a Project / Account status report (Record Project
// Status / Record Account Status). Many per report; shown read-only in the
// report previews and reviews.
export type ReportAttachmentScope = "project" | "account";

export type ReportAttachment = {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
};

const basePath = (scope: ReportAttachmentScope, ownerId: string, reportId: string) =>
  `/${scope === "project" ? "projects" : "accounts"}/${ownerId}/status-reports/${reportId}/attachments`;

const listKey = (scope: ReportAttachmentScope, reportId: string | null | undefined) => [
  "report-attachments",
  scope,
  reportId ?? null,
];

export function useReportAttachments(
  scope: ReportAttachmentScope,
  ownerId: string | null,
  reportId: string | null | undefined
) {
  return useQuery({
    queryKey: listKey(scope, reportId),
    queryFn: () => api.get<ReportAttachment[]>(basePath(scope, ownerId!, reportId!)),
    enabled: !!ownerId && !!reportId,
  });
}

export function useUploadReportAttachment(scope: ReportAttachmentScope, ownerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, file }: { reportId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.postForm<ReportAttachment>(basePath(scope, ownerId!, reportId), formData);
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: listKey(scope, variables.reportId) }),
  });
}

export function useDeleteReportAttachment(scope: ReportAttachmentScope, ownerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, attachmentId }: { reportId: string; attachmentId: string }) =>
      api.delete<void>(`${basePath(scope, ownerId!, reportId)}/${attachmentId}`),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: listKey(scope, variables.reportId) }),
  });
}

// Fetches the file as a Blob and opens it in a new tab (falls back to a
// download for types the browser can't render) — a plain <a href> can't attach
// the session/API-key headers this backend requires.
export async function openReportAttachment(
  scope: ReportAttachmentScope,
  ownerId: string,
  reportId: string,
  attachment: ReportAttachment
): Promise<void> {
  const blob = await api.getBlob(`${basePath(scope, ownerId, reportId)}/${attachment.id}`);
  const url = URL.createObjectURL(blob);
  const viewable = /\.(pdf|png|jpe?g|txt)$/i.test(attachment.file_name);
  if (viewable) {
    window.open(url, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.file_name;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
