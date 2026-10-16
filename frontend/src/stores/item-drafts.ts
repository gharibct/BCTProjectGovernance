"use client";

import { create } from "zustand";

// Text typed into an item register's "add" / "edit" box but not yet added or
// saved, keyed per register (EditableTextList reports it). The page-level Save
// buttons read this to refuse saving while such text is left behind — see
// lib/unsaved-items.ts.
type ItemDraftState = {
  drafts: Record<string, string>;
  setDraft: (id: string, label: string | null) => void;
};

export const useItemDrafts = create<ItemDraftState>((set) => ({
  drafts: {},
  setDraft: (id, label) =>
    set((state) => {
      if (label === null) {
        if (!(id in state.drafts)) return state;
        const rest = { ...state.drafts };
        delete rest[id];
        return { drafts: rest };
      }
      return state.drafts[id] === label ? state : { drafts: { ...state.drafts, [id]: label } };
    }),
}));
