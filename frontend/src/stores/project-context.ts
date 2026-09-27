"use client";

import { createEntityContext } from "@/stores/entity-context";

// The project the user last worked on + recent projects — drives the Project
// Context page (/select-project/...). See entity-context.ts.
export { RECENT_LIMIT } from "@/stores/entity-context";

const projectContext = createEntityContext("pg-project-context");
export const useProjectContextStore = projectContext.useStore;
export const useProjectContext = projectContext.useContext;
