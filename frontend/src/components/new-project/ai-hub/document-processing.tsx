"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { cn } from "@/lib/utils";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import {
  downloadDocument,
  useDeleteDocument,
  useProcessDocuments,
  useProjectDocuments,
  useUploadDocument,
  type ProjectDocument,
} from "@/lib/api/documents";

const TYPE_ICON: Record<string, typeof FileText> = {
  DOCX: FileText,
  PDF: FileText,
  XLSX: FileSpreadsheet,
  OTHER: File,
};

// AI output (View / eventual Excluded soft-delete) only ever exists once a
// document has actually been processed.
function hasAiOutput(status: ProjectDocument["ai_status"]): boolean {
  return status === "Processed" || status === "Excluded";
}

export function DocumentProcessing() {
  const projectId = useNewProjectId();
  const { data: documents = [] } = useProjectDocuments(projectId);
  const uploadDocument = useUploadDocument(projectId);
  const processDocuments = useProcessDocuments(projectId);
  const deleteDocument = useDeleteDocument(projectId);

  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const pendingCount = documents.filter((d) => d.ai_status === "Not Processed").length;

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !projectId) return;
    // Per-file upload feedback stays a toast — several files can be
    // uploaded at once, each failing independently, which doesn't fit the
    // single-banner-at-a-time model used for the page's important actions.
    Array.from(files).forEach((file) => {
      uploadDocument.mutate(
        { file, context: "create" },
        { onError: (err) => toast.error(err instanceof Error ? err.message : `Failed to upload ${file.name}.`) }
      );
    });
  };

  // Every pending document is processed together in one batch — there's no
  // per-row selection. This is the page's "Apply AI Changes"-equivalent
  // action, so success/failure go through the page banner.
  const processAll = () => {
    const ids = documents.filter((d) => d.ai_status === "Not Processed").map((d) => d.id);
    if (ids.length === 0) {
      showError("No documents pending processing.");
      return;
    }
    processDocuments.mutate(ids, {
      onSuccess: () => showSuccess(ids.length > 1 ? "Documents processed with AI" : "Document processed with AI"),
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to process documents."),
    });
  };

  const handleDownload = (doc: ProjectDocument) => {
    if (!projectId) return;
    downloadDocument(projectId, doc).catch((err) =>
      toast.error(err instanceof Error ? err.message : `Failed to download ${doc.file_name}.`)
    );
  };

  const viewAiOutput = (doc: ProjectDocument) => {
    toast.info(`Viewing the AI output for ${doc.file_name} isn't wired up yet.`);
  };

  const handleDelete = (doc: ProjectDocument) => {
    deleteDocument.mutate(doc.id, {
      onError: (err) => toast.error(err instanceof Error ? err.message : `Failed to delete ${doc.file_name}.`),
    });
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={UploadCloud} title="Upload Documents">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
            isDragging ? "border-[#1a6fc4] bg-blue-50" : "border-slate-300 bg-slate-50"
          )}
        >
          <UploadCloud className="size-8 text-slate-400" />
          <p className="text-sm text-slate-500">Drag & drop files here, or</p>
          <Button
            type="button"
            variant="outline"
            disabled={uploadDocument.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 gap-2 px-4 text-sm font-semibold"
          >
            {uploadDocument.isPending ? <ButtonSpinner /> : null}
            Browse Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={Sparkles}
        title="Uploaded Documents"
        aside={
          <Button
            onClick={processAll}
            disabled={pendingCount === 0 || processDocuments.isPending}
            className="h-9 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {processDocuments.isPending ? <ButtonSpinner /> : <Sparkles className="size-4" />}
            Process Documents with AI
          </Button>
        }
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">AI Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No documents uploaded yet.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const Icon = TYPE_ICON[doc.file_type] ?? File;
                  const canDelete = doc.ai_status === "Not Processed" || doc.ai_status === "Processed";
                  return (
                    <tr key={doc.id}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <Icon className="size-4 shrink-0 text-slate-400" />
                          {doc.file_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{doc.file_type}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={doc.ai_status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {hasAiOutput(doc.ai_status) ? (
                            <button
                              type="button"
                              onClick={() => viewAiOutput(doc)}
                              aria-label="View AI output"
                              title="View AI Output"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1a6fc4]"
                            >
                              <Eye className="size-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            aria-label="Download"
                            title="Download"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1a6fc4]"
                          >
                            <Download className="size-4" />
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(doc)}
                              aria-label="Delete"
                              title="Delete"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
