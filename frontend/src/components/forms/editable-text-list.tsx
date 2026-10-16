"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useItemDrafts } from "@/stores/item-drafts";

export type EditableTextListItem = { id: string; text: string };

export type EditableTextListProps = {
  items: EditableTextListItem[];
  onAdd: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  addLabel?: string;
  emptyLabel?: string;
  // Show the add input from the start instead of behind a "+ Add …" button,
  // so adding an item is one step (type, press Enter or Add).
  addOpenByDefault?: boolean;
  // Name shown in the page-level "item should be added or removed" error when
  // text is left in this register's box on Save.
  draftLabel?: string;
};

const rowClass = "flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-800";
const inputClass =
  "h-8 w-full rounded-md border border-[#5B9BE6] bg-[#F7FAFF] px-2.5 text-sm text-[#000000] outline-none placeholder:text-[#718096] hover:border-[#4F91D1] hover:bg-[#F3F8FE] focus:border-[#2F80ED] focus:bg-white focus:ring-2 focus:ring-blue-200";
const iconButtonClass = "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1a6fc4]";
const deleteButtonClass = "rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600";

// Reusable "one text value per row" register — see
// design-reference/EditableTextList.jpg. `items` is the single source of
// truth (an array, not a joined string); onAdd/onUpdate/onDelete are
// fire-and-forget callbacks the caller wires to its own per-row mutations
// (same contract as RegisterTable + EntryFields elsewhere in this app,
// just invoked inline instead of via a separate bottom form). Each item
// stays its own row wherever the caller persists it (a DB table today —
// could become a grid tomorrow without this component's contract changing).
export function EditableTextList({
  items,
  onAdd,
  onUpdate,
  onDelete,
  disabled = false,
  addLabel = "Add item",
  emptyLabel = "Nothing added yet.",
  addOpenByDefault = false,
  draftLabel = "An item",
}: EditableTextListProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [addDraft, setAddDraft] = React.useState("");
  const addInputRef = React.useRef<HTMLInputElement>(null);
  const adding = isAdding || addOpenByDefault;

  // Report left-behind text (typed but not added, or an edit not saved) so the
  // page's Save can refuse it.
  const draftId = React.useId();
  const setDraft = useItemDrafts((s) => s.setDraft);
  const editedItem = items.find((i) => i.id === editingId);
  const hasDraft = addDraft.trim() !== "" || (!!editedItem && editDraft.trim() !== editedItem.text);
  React.useEffect(() => {
    setDraft(draftId, hasDraft ? draftLabel : null);
  }, [draftId, draftLabel, hasDraft, setDraft]);
  React.useEffect(() => () => setDraft(draftId, null), [draftId, setDraft]);

  const startEdit = (item: EditableTextListItem) => {
    setEditingId(item.id);
    setEditDraft(item.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const commitEdit = () => {
    const trimmed = editDraft.trim();
    const item = items.find((i) => i.id === editingId);
    if (editingId && item && trimmed && trimmed !== item.text) {
      onUpdate(editingId, trimmed);
    }
    cancelEdit();
  };

  // An item is only added by clicking Add or pressing Enter — leaving the
  // textbox (blur) never saves anything.
  const commitAdd = () => {
    const trimmed = addDraft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setAddDraft("");
    // Stay in add mode so Enter can be pressed repeatedly to keep
    // logging items without re-clicking "+ Add item".
    requestAnimationFrame(() => addInputRef.current?.focus());
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {items.length === 0 && (!isAdding || addOpenByDefault) ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className={cn(rowClass, editingId === item.id && "bg-blue-50")}>
              {editingId === item.id ? (
                <>
                  <input
                    autoFocus
                    className={inputClass}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="h-8 shrink-0 rounded-md bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
                  >
                    Save
                  </button>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate">{item.text}</span>
              )}

              {!disabled && editingId !== item.id ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label="Edit item"
                    className={iconButtonClass}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete item"
                    className={deleteButtonClass}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!disabled ? (
        <div className={cn(rowClass, "border-t border-slate-200 bg-slate-50")}>
          {adding ? (
            <>
              <input
                ref={addInputRef}
                autoFocus={!addOpenByDefault}
                className={inputClass}
                value={addDraft}
                placeholder="Type an item, then click Add…"
                onChange={(e) => setAddDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitAdd();
                  } else if (e.key === "Escape") {
                    setIsAdding(false);
                    setAddDraft("");
                  }
                }}
              />
              {/* Same effect as pressing Enter — commits and stays open for
                  the next item. */}
              <button
                type="button"
                onClick={commitAdd}
                className="h-8 shrink-0 rounded-md bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                Add
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4] hover:underline"
            >
              <Plus className="size-4" />
              {addLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
