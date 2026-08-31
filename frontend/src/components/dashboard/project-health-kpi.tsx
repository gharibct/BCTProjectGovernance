import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// Back-to-overview link for every drill-down list screen's header — the main
// /project-health dashboard links out to these screens via each Card's
// footer, but had no way back short of the browser's own back button.
export function BackToProjectHealth() {
  return (
    <Link
      href="/project-health"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4] hover:underline"
    >
      <ArrowLeft className="size-4" />
      Back to Project Health
    </Link>
  );
}

// Shared error panel for the drill-down list screens' fetch failures — same
// markup project-health-dashboard.tsx uses inline for its own summary fetch.
export function ErrorBlock({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-red-600">
        {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  );
}

// Shared KPI-card building blocks for the Project Health dashboard
// (project-health-dashboard.tsx) and its drill-down list screens
// (project-health-project-list.tsx etc.) — kept in one place so both stay
// visually consistent.

export function Card({
  title,
  icon: Icon,
  iconClassName,
  children,
  href,
  footerLabel,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  children: React.ReactNode;
  href?: string;
  footerLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-between rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Icon className={cn("size-4", iconClassName ?? "text-slate-400")} />
          {title}
        </h3>
        {children}
      </div>
      {href ? (
        <Link
          href={href}
          className="rounded-b-xl border-t border-slate-300 bg-slate-100 px-5 py-3 text-sm font-semibold text-[#1a6fc4] hover:bg-slate-200 hover:underline"
        >
          {footerLabel ?? `View ${title}`} →
        </Link>
      ) : null}
    </div>
  );
}

export function BigStat({
  value,
  label,
  valueClass,
}: {
  value: React.ReactNode;
  label: string;
  valueClass?: string;
}) {
  return (
    <div className="mb-3">
      <p className={cn("text-3xl font-bold text-slate-900", valueClass)}>{value}</p>
      <p className="text-xs tracking-wide text-slate-400 uppercase">{label}</p>
    </div>
  );
}

export function SubStat({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-semibold text-slate-900", valueClass)}>{value}</span>
    </div>
  );
}

export function formatNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : value;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const HEALTH_TONE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  "potential red": "bg-red-50 text-red-700 ring-red-200",
};

// RAG-value pill (Green/Amber/Red/Potential Red) — StatusBadge's TONE_MAP
// doesn't cover these values (it's tuned for severity/status words), so this
// is a small dedicated badge for the Overall Health / RAG rating columns.
export function HealthBadge({ value }: { value: string | null | undefined }) {
  if (!value?.trim()) return <span className="text-slate-300">—</span>;
  const tone = HEALTH_TONE[value.trim().toLowerCase()] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1", tone)}>
      {value}
    </span>
  );
}

// Simpler 4-up KPI tile for the drill-down list screens (proj-hel-*.png
// references) — a colored top border, label, and big number. No footer link
// since these screens are already the destination the main dashboard's Card
// links to.
export function StatTile({
  value,
  label,
  accentClassName,
}: {
  value: React.ReactNode;
  label: string;
  accentClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl border-t-4 border border-slate-200 bg-white p-4 shadow-sm", accentClassName ?? "border-t-[#1a6fc4]")}>
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
