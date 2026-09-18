import type { Metadata } from "next";
import Image from "next/image";
import { Eye, Zap, Users, ShieldCheck, TrendingUp, DollarSign, Sparkles } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

const VALUE_HIGHLIGHTS = [
  {
    icon: Eye,
    title: "Early visibility",
    description: "of concerns",
    iconClassName: "bg-cyan-400/10 text-cyan-400",
  },
  {
    icon: Zap,
    title: "Faster",
    description: "intervention",
    iconClassName: "bg-emerald-400/10 text-emerald-400",
  },
  {
    icon: Users,
    title: "Greater",
    description: "accountability",
    iconClassName: "bg-violet-400/10 text-violet-400",
  },
  {
    icon: ShieldCheck,
    title: "Consistent",
    description: "governance",
    iconClassName: "bg-teal-400/10 text-teal-400",
  },
  {
    icon: TrendingUp,
    title: "Improved project",
    description: "outcomes",
    iconClassName: "bg-green-400/10 text-green-400",
  },
  {
    icon: DollarSign,
    title: "Higher",
    description: "business value",
    iconClassName: "bg-blue-400/10 text-blue-400",
  },
] as const;

export const metadata: Metadata = {
  title: "Sign In | Governance One",
};

export default function LoginPage() {
  return (
    <div className="flex h-dvh flex-1">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-center overflow-y-auto bg-gradient-to-b from-[#101f33] to-[#0a1521] p-12 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:26px_26px]"
        />
        <div className="relative w-full">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Governance One" width={44} height={45} className="h-11 w-auto" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">
                Governance One
              </span>
              <span className="text-base font-semibold text-slate-300">
                Know Early. Act Early. Deliver Better.
              </span>
            </div>
          </div>

          <h1 className="mt-10 text-[42px] leading-[1.2] font-bold tracking-tight text-white">
            A unified platform for <span className="text-sky-300">Project Governance</span>
          </h1>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-300">
            <Sparkles className="size-4 text-sky-300" />
            <span className="italic">Powered by AI</span>
          </div>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
            Connecting People, processes and data to drive disciplined
            delivery and lasting business value.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {VALUE_HIGHLIGHTS.map(({ icon: Icon, title, description, iconClassName }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className={`inline-flex size-10 items-center justify-center rounded-lg ${iconClassName}`}>
                  <Icon className="size-5" />
                </div>
                <p className="mt-3 text-sm leading-snug font-semibold text-white">
                  {title}
                  <br />
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
