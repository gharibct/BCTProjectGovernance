"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/stores/session";

// No user in the session store (nothing signed in yet, or the persisted
// localStorage session was cleared) bounces to /login instead of rendering
// the app shell. See stores/session.ts.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useSession((s) => s.user);
  // useSession.persist is undefined during SSR (zustand omits it server-side)
  // — hasHydrated() itself is just a synchronous flag read once we're on the
  // client, so it's safe inside useState's lazy initializer as long as we
  // don't touch `.persist` before we know we're client-side.
  const [hydrated, setHydrated] = React.useState(() =>
    typeof window === "undefined" ? false : useSession.persist.hasHydrated()
  );

  React.useEffect(() => {
    return useSession.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  React.useEffect(() => {
    // Read the store directly instead of trusting the `user` from this
    // render's closure: the persist middleware finishes writing the
    // rehydrated user into the store a tick before it flips hasHydrated()
    // (and fires onFinishHydration) — so the render that first sees
    // hydrated=true can still be holding a stale (pre-rehydration) `user`
    // from an earlier render. Redirecting off that stale read logged in
    // users straight back out to /login right after a hard reload (or any
    // fresh mount of AuthGuard, e.g. the "Work as" switch's first visit to
    // a not-yet-loaded route) even though their session was still valid.
    if (hydrated && !useSession.getState().user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return null;
  }

  return <>{children}</>;
}
