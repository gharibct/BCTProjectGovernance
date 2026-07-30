import { create } from "zustand";

export const NEW_PROJECT_SECTIONS = [
  { key: "description", label: "Project Profile" },
  { key: "progress", label: "Scope & Schedule" },
  { key: "resources", label: "Resource Allocation" },
  { key: "health", label: "Health & Status" },
] as const;

export type NewProjectSection = (typeof NEW_PROJECT_SECTIONS)[number]["key"];

type NewProjectUiState = {
  section: NewProjectSection;
  setSection: (section: NewProjectSection) => void;
  projectCode: string;
  setProjectCode: (projectCode: string) => void;
  projectName: string;
  setProjectName: (projectName: string) => void;
};

// Copy of the charter-ui store scoped to the New Project screens, so section
// switching there stays independent of the original Project Charter.
// `projectCode` and `projectName` are entered on the Project Description tab
// and, once set, are what identifies the project everywhere else in this
// area (header, Schedule, etc.) instead of the generic "New Project"
// placeholder.
export const useNewProjectUi = create<NewProjectUiState>((set) => ({
  section: "description",
  setSection: (section) => set({ section }),
  projectCode: "",
  setProjectCode: (projectCode) => set({ projectCode }),
  projectName: "",
  setProjectName: (projectName) => set({ projectName }),
}));
