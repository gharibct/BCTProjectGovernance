"use client";

import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { EditableTextList } from "@/components/forms/editable-text-list";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateRegionalStatusItem,
  useDeleteRegionalStatusItem,
  useRegionalStatusItems,
  useUpdateRegionalStatusItem,
  type RegionalScope,
} from "@/lib/api/regional-status";
import type { ProjectStatusCategory } from "@/lib/api/project-status";
import { RollupSourcePanel, type RollupSourceItem } from "./rollup-source-panel";

// One line-item register per Account/Geo Status section, rendered as an
// EditableTextList — mirrors components/project-status/status-items-tab.tsx
// exactly, generalized by scope ("account" | "geo"). Each row is still its
// own {account|geo}_status_items DB row via the hooks below; this component
// only changed how the register is presented/edited, not how it's persisted.
//
// The rollup* props apply to both scopes (Project->Account for "account",
// Account->Geo for "geo") — status-tabs.tsx owns the two rollup
// queries/mutations (it already knows scope/periodId), normalizes whichever
// one is active into RollupSourceItem[], and passes it down so this
// component doesn't need to know which level's data it's showing.
export function StatusItemsTab({
  scope,
  scopeId,
  category,
  title,
  icon,
  rollupItems,
  onPullRollupItem,
  onIgnoreRollupItem,
  onUndoRollupItem,
  rollupBusy,
}: {
  scope: RegionalScope;
  scopeId: string;
  category: ProjectStatusCategory;
  title: string;
  icon: LucideIcon;
  rollupItems?: RollupSourceItem[];
  onPullRollupItem?: (item: RollupSourceItem) => void;
  onIgnoreRollupItem?: (item: RollupSourceItem) => void;
  onUndoRollupItem?: (item: RollupSourceItem) => void;
  rollupBusy?: boolean;
}) {
  const periodId = useSearchParams().get("period");
  const { data: items = [] } = useRegionalStatusItems(scope, scopeId, periodId, category);
  const createItem = useCreateRegionalStatusItem(scope, scopeId, periodId, category);
  const updateItem = useUpdateRegionalStatusItem(scope, scopeId, periodId, category);
  const deleteItem = useDeleteRegionalStatusItem(scope, scopeId, periodId, category);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  if (!periodId) {
    return (
      <EmptyState>No reporting period selected — pick a Weekly or Monthly report from the hub first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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

      {rollupItems ? (
        <RollupSourcePanel
          heading={scope === "account" ? "Rolled Up From Projects" : "Rolled Up From Accounts"}
          emptyLabel={
            scope === "account"
              ? "No project reports have contributed to this category yet for the selected period."
              : "No account reports have contributed to this category yet for the selected period."
          }
          category={category}
          items={rollupItems}
          onPull={onPullRollupItem!}
          onIgnore={onIgnoreRollupItem!}
          onUndo={onUndoRollupItem!}
          busy={!!rollupBusy}
        />
      ) : null}
    </div>
  );
}
