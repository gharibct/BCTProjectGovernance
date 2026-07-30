import { create } from "zustand";

export const CHARTER_SECTIONS = [
  { key: "description", label: "Project Description" },
  { key: "progress", label: "Progress" },
  { key: "resources", label: "Resource Allocation" },
  { key: "health", label: "Health & Status" },
] as const;

export type CharterSection = (typeof CHARTER_SECTIONS)[number]["key"];

type CharterUiState = {
  section: CharterSection;
  setSection: (section: CharterSection) => void;
};

// Shared between the right-side project navigation (shell) and the charter
// form content — the nav switches which charter section is rendered.
export const useCharterUi = create<CharterUiState>((set) => ({
  section: "description",
  setSection: (section) => set({ section }),
}));
