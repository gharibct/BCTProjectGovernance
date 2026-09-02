"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { HealthRating } from "@/lib/api/projects";

// Small read-only building blocks shared by the DE Assessment queue and
// workspace (design-reference/de-assessments). Kept local to this feature so
// the existing dashboard components stay untouched.

export const HEALTH_DOT_CLASS: Record<HealthRating, string> = {
  Red: "bg-red-600",
  "Potential Red": "bg-orange-500",
  Amber: "bg-amber-500",
  Green: "bg-emerald-500",
};

export function HealthDot({ health }: { health: HealthRating | null }) {
  if (!health) return <span className="text-sm text-slate-400">—</span>;
  return (
    <span
      title={health}
      className={cn("inline-block size-2.5 rounded-full", HEALTH_DOT_CLASS[health])}
    />
  );
}

const TOP_ACCENT_CLASS: Record<string, string> = {
  emerald: "border-t-2 border-t-emerald-400",
  sky: "border-t-2 border-t-sky-400",
  red: "border-t-2 border-t-red-400",
  "emerald-strong": "border-t-2 border-t-emerald-700",
};

export function StatCard({
  label,
  value,
  hint,
  accent,
  topAccent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "red";
  topAccent?: "emerald" | "sky" | "red" | "emerald-strong";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm",
        topAccent && TOP_ACCENT_CLASS[topAccent],
        accent === "red" && "border-red-200 bg-red-50"
      )}
    >
      <div
        className={cn(
          "text-xs font-bold tracking-wide uppercase",
          accent === "red" ? "text-red-700" : "text-slate-500"
        )}
      >
        {label}
      </div>
      <div className={cn("mt-1 text-3xl font-bold", accent === "red" ? "text-red-700" : "text-slate-900")}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-sm text-slate-400">{hint}</div> : null}
    </div>
  );
}
