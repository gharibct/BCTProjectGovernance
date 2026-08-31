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
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return null;
  }

  return <>{children}</>;
}
