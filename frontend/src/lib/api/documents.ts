import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export type DocumentContext = "create" | "reporting";
export type DocumentAiStatus = "Not Processed" | "Processing" | "Processed" | "Excluded";

export type ProjectDocument = {
  id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  context: DocumentContext;
  period_id: string | null;
  ai_status: DocumentAiStatus;
  created_at: string;
  updated_at: string;
};

export function useProjectDocuments(projectId: string | null) {
  return useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => api.get<ProjectDocument[]>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  });
}

function invalidateDocuments(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
}

export function useUploadDocument(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      context,
      periodId,
    }: {
      file: File;
      context: DocumentContext;
      periodId?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("context", context);
      if (periodId) formData.append("period_id", periodId);
      return api.postForm<ProjectDocument>(`/projects/${projectId}/documents`, formData);
    },
    onSuccess: () => invalidateDocuments(queryClient, projectId),
  });
}

export function useProcessDocuments(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: string[]) =>
      api.post<ProjectDocument[]>(`/projects/${projectId}/documents/process`, {
        document_ids: documentIds,
      }),
    onSuccess: () => invalidateDocuments(queryClient, projectId),
  });
}

// Not Processed documents are hard-deleted server-side; Processed ones are
// soft-deleted to Excluded (kept for future reference) — the backend
// decides which, so the frontend always calls this one action.
export function useDeleteDocument(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      api.delete<ProjectDocument | undefined>(`/projects/${projectId}/documents/${documentId}`),
    onSuccess: () => invalidateDocuments(queryClient, projectId),
  });
}

// Fetches the file as a Blob and triggers the browser's native Save dialog
// via a synthetic anchor click — a plain <a href> can't attach the
// X-API-Key header every route on this backend requires.
export async function downloadDocument(projectId: string, doc: ProjectDocument): Promise<void> {
  const blob = await api.getBlob(`/projects/${projectId}/documents/${doc.id}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.file_name;
  link.click();
  URL.revokeObjectURL(url);
}
