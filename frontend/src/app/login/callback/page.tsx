"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useMe } from "@/lib/api/auth";
import { ROLE_LANDING_ROUTE } from "@/lib/menu-config";
import { useSession } from "@/stores/session";

// Landing spot for the backend's OneLogin callback redirect
// (backend/app/api/v1/endpoints/auth.py's onelogin_callback). By the time the
// browser lands here, the session cookie is already set — this page just
// fetches /auth/me to hydrate the Zustand store, then routes to the role's
// landing page, mirroring login-form.tsx's no_password success path.
export default function LoginCallbackPage() {
  const router = useRouter();
  const setSessionUser = useSession((s) => s.signIn);
  const me = useMe(true);

  React.useEffect(() => {
    if (!me.data) return;
    setSessionUser(me.data);
    router.replace(ROLE_LANDING_ROUTE[me.data.role.code]);
  }, [me.data, router, setSessionUser]);

  const error = me.isError
    ? me.error instanceof ApiError && me.error.status === 403
      ? "OneLogin sign-in succeeded, but there's no Project Governance Tool account for that email. Contact your admin."
      : "Sign-in could not be completed. Try again."
    : null;

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#101f33] ring-1 ring-white/15">
          <ShieldCheck className="size-6 text-white" />
        </div>

        {error ? (
          <>
            <p className="mt-6 text-sm font-medium text-red-600">{error}</p>
            <a
              href="/login"
              className="mt-4 inline-block text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Completing sign-in…</p>
        )}
      </div>
    </div>
  );
}
