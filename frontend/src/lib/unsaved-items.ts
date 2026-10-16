import { useItemDrafts } from "@/stores/item-drafts";

// Page-level Save guard: returns an error message when any item register still
// has text that was typed but never added (or an edit never saved), else null.
// Callers show it with showError and stop the save.
export function unsavedItemsMessage(): string | null {
  const labels = [...new Set(Object.values(useItemDrafts.getState().drafts))];
  if (labels.length === 0) return null;
  return `${labels.join(", ")}: item should be added or removed.`;
}
