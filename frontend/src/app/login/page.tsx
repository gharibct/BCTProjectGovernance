import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In | Project Governance Tool",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-1">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-center overflow-hidden bg-gradient-to-b from-[#101f33] to-[#0a1521] p-16 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:26px_26px]"
        />
        <div className="relative max-w-xl">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <ShieldCheck className="size-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">
              Project Governance Tool
            </span>
          </div>

          <h1 className="mt-14 text-5xl leading-[1.15] font-bold tracking-tight text-white">
            Enterprise access, simplified and secure.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-400">
            Manage infrastructure, track compliance, and secure your project
            governance across all corporate environments.
          </p>

          <hr className="mt-14 border-white/10" />

          <div className="mt-10 flex gap-28">
            <div>
              <p className="text-xl font-semibold text-white">ISO 27001</p>
              <p className="mt-1 text-sm text-slate-500">Security Certified</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">SOC2 Type II</p>
              <p className="mt-1 text-sm text-slate-500">Compliance Verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
