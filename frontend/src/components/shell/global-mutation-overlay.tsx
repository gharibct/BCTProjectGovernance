"use client";

import { useIsMutating } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Blocks the whole screen while any save/add/delete is in flight — every
// mutation in this app goes through useMutation, so useIsMutating() catches
// all of them with no per-button wiring. Deliberately not useIsFetching():
// that also counts routine background useQuery refetches (staleTime,
// navigation prefetches), which isn't "saving" and would pop this up far too
// often. The existing page banner / toast in each mutation's onSuccess/
// onError still fires right after this disappears.
export function GlobalMutationOverlay() {
  const mutating = useIsMutating();
  if (!mutating) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
      <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-4 shadow-lg">
        <Loader2 className="size-5 animate-spin text-[#1a6fc4]" />
        <span className="text-sm font-semibold text-slate-700">Saving…</span>
      </div>
    </div>
  );
}
