"use client";

import { useParams, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { EditableTextList } from "@/components/forms/editable-text-list";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateStatusItem,
  useDeleteStatusItem,
  useStatusItems,
  useUpdateStatusItem,
  type ProjectStatusCategory,
} from "@/lib/api/project-status";

// One line-item register per Project Status section, rendered as an
// EditableTextList (design-reference/EditableTextList.jpg) — each row is
// still its own project_status_items DB row via the hooks below; this
// component only changed how the register is presented/edited, not how
// it's persisted.
export function StatusItemsTab({
  category,
  title,
  icon,
}: {
  category: ProjectStatusCategory;
  title: string;
  icon: LucideIcon;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { data: items = [] } = useStatusItems(projectId ?? null, periodId, category);
  const createItem = useCreateStatusItem(projectId ?? null, periodId, category);
  const updateItem = useUpdateStatusItem(projectId ?? null, periodId, category);
  const deleteItem = useDeleteStatusItem(projectId ?? null, periodId, category);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  if (!projectId) {
    return (
      <EmptyState>No project selected.</EmptyState>
    );
  }

  if (!periodId) {
    return (
      <EmptyState>No reporting period selected — pick a Weekly or Monthly report from the Reporting Hub first.</EmptyState>
    );
  }

  return (
    <SectionCard icon={icon} title={title} aside={<AutoBadge label={`${items.length} logged`} />}>
      <EditableTextList
        items={items.map((item) => ({ id: item.id, text: item.description }))}
        addLabel={`Add ${title} Item`}
        emptyLabel="Nothing logged yet."
        onAdd={(text) =>
          createItem.mutate(
            { period_id: periodId, category, description: text },
            {
              onSuccess: () => showSuccess(`${title} Item Added Successfully`),
              onError: (err) => showError(err instanceof Error ? err.message : "Failed to add item."),
            }
          )
        }
        onUpdate={(id, text) =>
          updateItem.mutate(
            { id, payload: { description: text } },
            {
              onSuccess: () => showSuccess(`${title} Item Updated Successfully`),
              onError: (err) => showError(err instanceof Error ? err.message : "Failed to update item."),
            }
          )
        }
        onDelete={(id) =>
          deleteItem.mutate(id, {
            onSuccess: () => showSuccess(`${title} Item Deleted Successfully`),
            onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete item."),
          })
        }
      />
    </SectionCard>
  );
}
