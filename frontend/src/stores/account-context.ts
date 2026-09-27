"use client";

import { createEntityContext } from "@/stores/entity-context";

// The account the user last worked on + recent accounts — drives the Account
// Context page (/select-account/...). See entity-context.ts.
const accountContext = createEntityContext("pg-account-context");
export const useAccountContextStore = accountContext.useStore;
export const useAccountContext = accountContext.useContext;
