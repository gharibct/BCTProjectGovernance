"use client";

import { create } from "zustand";

export type BannerVariant = "success" | "error" | "warning";

export type BannerAction = { label: string; href?: string; onClick?: () => void };

type Banner = {
  variant: BannerVariant;
  message: string;
  action?: BannerAction;
  // Survives exactly one route change before clearing normally — needed for
  // flows that redirect immediately after a success message (e.g. Project
  // Creation), so the banner is visible on the destination page instead of
  // flashing away before the navigation completes. See
  // PageBannerNavigationListener for where this gets consumed.
  persistThroughNavigation?: boolean;
};

type PageBannerState = {
  banner: Banner | null;
  showSuccess: (message: string, opts?: { persistThroughNavigation?: boolean }) => void;
  showError: (message: string) => void;
  showWarning: (message: string, action?: BannerAction) => void;
  dismiss: () => void;
  consumeNavigationPersist: () => void;
};

// Success banners auto-dismiss after a short period; error/warning banners
// don't, so this timer only ever applies to the success case.
let successTimer: ReturnType<typeof setTimeout> | null = null;

function clearSuccessTimer() {
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
}

export const usePageBanner = create<PageBannerState>((set, get) => ({
  banner: null,
  showSuccess: (message, opts) => {
    clearSuccessTimer();
    set({ banner: { variant: "success", message, persistThroughNavigation: opts?.persistThroughNavigation } });
    successTimer = setTimeout(() => {
      // Only clear if this same success banner is still showing — a newer
      // banner set in the meantime should not be wiped out by a stale timer.
      if (get().banner?.message === message && get().banner?.variant === "success") {
        get().dismiss();
      }
    }, 5000);
  },
  showError: (message) => {
    clearSuccessTimer();
    set({ banner: { variant: "error", message } });
  },
  showWarning: (message, action) => {
    clearSuccessTimer();
    set({ banner: { variant: "warning", message, action } });
  },
  dismiss: () => {
    clearSuccessTimer();
    set({ banner: null });
  },
  consumeNavigationPersist: () =>
    set((state) => {
      if (!state.banner) return state;
      if (state.banner.persistThroughNavigation) {
        return { banner: { ...state.banner, persistThroughNavigation: false } };
      }
      clearSuccessTimer();
      return { banner: null };
    }),
}));
