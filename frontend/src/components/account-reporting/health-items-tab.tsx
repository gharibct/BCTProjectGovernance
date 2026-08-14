"use client";

import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import { EditableTextList } from "@/components/forms/editable-text-list";
import { usePageBanner } from "@/stores/page-banner";
import {
  useAccountHealthItems,
  useCreateAccountHealthItem,
  useDeleteAccountHealthItem,
  useUpdateAccountHealthItem,
  type HealthCategory,
} from "@/lib/api/account-health-declarations";
import { RollupSourcePanel, type RollupSourceItem } from "@/components/regional-reporting/rollup-source-panel";

// Account-level equivalent of project-charter/health-items-tab.tsx — one
// line-item register per RAG Status category, plus (unlike the project
// screen) a rollup panel below it so an Account Manager can pull a
// project's own RAG notes for this category/period into the account's
// register. Mirrors regional-reporting/status-items-tab.tsx's rollup
// wiring, account-only (no geo generalization — RAG Status has no
// Account -> Geo rollup).
export function AccountHealthItemsTab({
  accountId,
  category,
  title,
  icon,
  rollupItems,
  onPullRollupItem,
  onIgnoreRollupItem,
  onUndoRollupItem,
  rollupBusy,
}: {
  accountId: string;
  category: HealthCategory;
  title: string;
  icon: LucideIcon;
  rollupItems?: RollupSourceItem[];
  onPullRollupItem?: (item: RollupSourceItem) => void;
  onIgnoreRollupItem?: (item: RollupSourceItem) => void;
  onUndoRollupItem?: (item: RollupSourceItem) => void;
  rollupBusy?: boolean;
}) {
  const periodId = useSearchParams().get("period");
  const { data: items = [] } = useAccountHealthItems(accountId, periodId, category);
  const createItem = useCreateAccountHealthItem(accountId, periodId, category);
  const updateItem = useUpdateAccountHealthItem(accountId, periodId, category);
  const deleteItem = useDeleteAccountHealthItem(accountId, periodId, category);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  if (!periodId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No reporting period selected.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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

      {rollupItems ? (
        <RollupSourcePanel
          heading="Rolled Up From Projects"
          emptyLabel="No project RAG notes have contributed to this category yet for the selected period."
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
