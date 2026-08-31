"use client";

import { useParams, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { EditableTextList } from "@/components/forms/editable-text-list";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateHealthItem,
  useDeleteHealthItem,
  useHealthItems,
  useUpdateHealthItem,
  type HealthCategory,
} from "@/lib/api/health-declarations";

// One line-item register per RAG Status category, rendered as an
// EditableTextList — mirrors project-status/status-items-tab.tsx exactly,
// backed by the health-items endpoints instead. Shared verbatim between the
// ongoing Project Charter RAG Status screen and the New Project wizard's
// self-assessment step (both are under a /…/[projectId]/… route, so
// useParams resolves projectId the same way in either).
export function HealthItemsTab({
  category,
  title,
  icon,
}: {
  category: HealthCategory;
  title: string;
  icon: LucideIcon;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { data: items = [] } = useHealthItems(projectId ?? null, periodId, category);
  const createItem = useCreateHealthItem(projectId ?? null, periodId, category);
  const updateItem = useUpdateHealthItem(projectId ?? null, periodId, category);
  const deleteItem = useDeleteHealthItem(projectId ?? null, periodId, category);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  if (!projectId) {
    return (
      <EmptyState>No project selected.</EmptyState>
    );
  }

  if (!periodId) {
    return (
      <EmptyState>No reporting period selected.</EmptyState>
    );
  }

  return (
    <SectionCard icon={icon} title={title} aside={<AutoBadge label={`${items.length} logged`} />}>
      <EditableTextList
        items={items.map((item) => ({ id: item.id, text: item.description }))}
        addLabel={`Add ${title} Note`}
        emptyLabel="Nothing logged yet."
        onAdd={(text) =>
          createItem.mutate(
            { period_id: periodId, category, description: text },
            {
              onSuccess: () => showSuccess(`${title} Note Added Successfully`),
              onError: (err) => showError(err instanceof Error ? err.message : "Failed to add note."),
            }
          )
        }
        onUpdate={(id, text) =>
          updateItem.mutate(
            { id, payload: { description: text } },
            {
              onSuccess: () => showSuccess(`${title} Note Updated Successfully`),
              onError: (err) => showError(err instanceof Error ? err.message : "Failed to update note."),
            }
          )
        }
        onDelete={(id) =>
          deleteItem.mutate(id, {
            onSuccess: () => showSuccess(`${title} Note Deleted Successfully`),
            onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete note."),
          })
        }
      />
    </SectionCard>
  );
}
