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
  // useSession.persist only exists client-side (zustand omits it during SSR),
  // so it can't be touched in the initial render — only inside an effect,
  // which never runs on the server.
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(useSession.persist.hasHydrated());
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
