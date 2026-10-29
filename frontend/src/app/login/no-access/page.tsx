import type { Metadata } from "next";
import Image from "next/image";
import { CircleCheck, LockKeyhole } from "lucide-react";

export const metadata: Metadata = {
  title: "Access Required | Governance One",
};

// Landing spot for the backend's Entra callback when the Microsoft sign-in
// succeeded but the account isn't provisioned (or is inactive) in Governance
// One (backend/app/api/v1/endpoints/auth.py's entra_callback).
export default function NoAccessPage() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <Image src="/logo.png" alt="" width={32} height={33} className="h-8 w-auto" />
          <span className="text-lg font-bold text-slate-900">Governance One</span>
        </div>

        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
          <LockKeyhole className="size-7 text-amber-600" />
        </div>

        <h1 className="mt-5 text-xl font-semibold text-slate-900">
          You don&apos;t have access yet
        </h1>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-emerald-700">
          <CircleCheck className="size-4" />
          Your Microsoft sign-in was successful
        </p>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Your account hasn&apos;t been set up for Governance One. Please contact the{" "}
          <span className="font-medium text-slate-900">Delivery Excellence team</span> to
          request access, then sign in again.
        </p>

        <a
          href="/login"
          className="mt-7 inline-flex h-10 items-center justify-center rounded-md bg-[#101f33] px-5 text-sm font-medium text-white hover:bg-[#16304f]"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
