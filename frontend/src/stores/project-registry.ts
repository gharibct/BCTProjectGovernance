import { create } from "zustand";

export type ProjectRecord = {
  code: string;
  name: string;
};

type ProjectRegistryState = {
  projects: ProjectRecord[];
  addProject: (project: ProjectRecord) => void;
  isRegistered: (code: string) => boolean;
};

// In-memory registry of created projects — until there's a backend, this is
// what "Maintain Project" reads to know which projects can be reopened.
// Seeded with the existing sample project.
const SAMPLE_PROJECTS: ProjectRecord[] = [
  { code: "PRJ-2026-0042", name: "Core Banking Modernization" },
];

export const useProjectRegistry = create<ProjectRegistryState>((set, get) => ({
  projects: SAMPLE_PROJECTS,
  addProject: (project) =>
    set((state) => ({
      projects: state.projects.some((p) => p.code === project.code)
        ? state.projects.map((p) => (p.code === project.code ? project : p))
        : [...state.projects, project],
    })),
  isRegistered: (code) => get().projects.some((p) => p.code === code),
}));
