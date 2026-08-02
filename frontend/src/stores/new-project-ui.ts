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
  status: string;
  setStatus: (status: string) => void;
  isCreated: boolean;
  setCreated: (isCreated: boolean) => void;
  isEditing: boolean;
  setEditing: (isEditing: boolean) => void;
};

// Copy of the charter-ui store scoped to the New Project screens, so section
// switching there stays independent of the original Project Charter.
// `projectCode` is system-generated (read-only in the UI — sample value
// until there's a backend sequence) and `projectName` is entered on the
// Project Profile tab; both identify the project everywhere else in this
// area (header, Schedule, etc.) instead of the generic "New Project"
// placeholder. `status` starts at Draft — Pending Approval / Approved come
// once an approval workflow exists.
export const useNewProjectUi = create<NewProjectUiState>((set) => ({
  section: "description",
  setSection: (section) => set({ section }),
  projectCode: "PRJ-2026-0054",
  setProjectCode: (projectCode) => set({ projectCode }),
  projectName: "",
  setProjectName: (projectName) => set({ projectName }),
  status: "Draft",
  setStatus: (status) => set({ status }),
  // Undrafted (isCreated: false) projects start editable so the PM can fill
  // in the Project Profile before the first "Create Project"; afterwards
  // editing is gated behind "Edit Project" until Send to Approval / Approve
  // lock it again.
  isCreated: false,
  setCreated: (isCreated) => set({ isCreated }),
  isEditing: true,
  setEditing: (isEditing) => set({ isEditing }),
}));
