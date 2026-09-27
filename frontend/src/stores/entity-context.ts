"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useSession } from "@/stores/session";

// Shared engine behind the Project / Account Context pages: the entity the user
// last worked on, their last 10 accessed, and when each was last opened. Kept per
// user id so a shared browser never leaks one login's history into another's.
export const RECENT_LIMIT = 10;

export type UserContext = {
  current: string | null;
  /** Most recent first, at most RECENT_LIMIT. */
  recent: string[];
  /** entityId -> ISO timestamp of the last access. */
  lastAccessed: Record<string, string>;
};

const EMPTY: UserContext = { current: null, recent: [], lastAccessed: {} };

type State = {
  byUser: Record<string, UserContext>;
  touch: (userId: string, entityId: string) => void;
  clearRecent: (userId: string) => void;
};

export function createEntityContext(storageName: string) {
  const useStore = create<State>()(
    persist(
      (set) => ({
        byUser: {},
        touch: (userId, entityId) =>
          set((state) => {
            const prev = state.byUser[userId] ?? EMPTY;
            const recent = [entityId, ...prev.recent.filter((id) => id !== entityId)].slice(
              0,
              RECENT_LIMIT
            );
            return {
              byUser: {
                ...state.byUser,
                [userId]: {
                  current: entityId,
                  recent,
                  lastAccessed: { ...prev.lastAccessed, [entityId]: new Date().toISOString() },
                },
              },
            };
          }),
        // Recent list only — the current entity and last-accessed dates survive.
        clearRecent: (userId) =>
          set((state) => ({
            byUser: {
              ...state.byUser,
              [userId]: { ...(state.byUser[userId] ?? EMPTY), recent: [] },
            },
          })),
      }),
      { name: storageName }
    )
  );

  // The signed-in user's context (empty when signed out).
  function useContext(): UserContext & {
    touch: (entityId: string) => void;
    clearRecent: () => void;
  } {
    const userId = useSession((s) => s.user?.id);
    const ctx = useStore((s) => (userId ? s.byUser[userId] : undefined)) ?? EMPTY;
    const touchStore = useStore((s) => s.touch);
    const clearStore = useStore((s) => s.clearRecent);

    const touch = React.useCallback(
      (entityId: string) => {
        if (userId) touchStore(userId, entityId);
      },
      [userId, touchStore]
    );
    const clearRecent = React.useCallback(() => {
      if (userId) clearStore(userId);
    }, [userId, clearStore]);

    return { ...ctx, touch, clearRecent };
  }

  return { useStore, useContext };
}
