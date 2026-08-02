import { create } from "zustand";

type NewProjectUiState = {
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
  resetDraft: () => void;
};

// Sample sequence for the "system-generated" project code — increments each
// time a fresh draft is started so successive new projects don't collide
// with a just-opened (Maintain Project) code. Placeholder until there's a
// backend sequence.
let nextDraftSeq = 55;

// Copy of the charter-ui store scoped to the New Project screens (which are
// split across their own routes — /new-project/project-charter,
// .../schedule, .../self-assessment — so the section currently in view
// comes from the URL, not this store).
// `projectCode` is system-generated (read-only in the UI — sample value
// until there's a backend sequence) and `projectName` is entered on the
// Project Profile page; both identify the project everywhere else in this
// area (header, Schedule, etc.) instead of the generic "New Project"
// placeholder. `status` starts at Draft — Pending Approval / Approved come
// once an approval workflow exists.
export const useNewProjectUi = create<NewProjectUiState>((set) => ({
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
  // Clears whatever project (draft or reopened via Maintain Project) is
  // currently loaded so "New Project" always starts a blank charter instead
  // of continuing to show — and highlight — the last-opened one.
  resetDraft: () =>
    set({
      projectCode: `PRJ-2026-${String(nextDraftSeq++).padStart(4, "0")}`,
      projectName: "",
      status: "Draft",
      isCreated: false,
      isEditing: true,
    }),
}));
