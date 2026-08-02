import { cn } from "@/lib/utils";

// Keyword → tone lookup for RAIDO severity/priority/status values and
// Contractual Compliance Met/Not Met / payment status — shared so every
// register/table across the app colors the same word the same way.
const TONE_MAP: Record<string, string> = {
  critical: "bg-red-50 text-red-700 ring-red-200",
  "very high": "bg-red-50 text-red-700 ring-red-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  major: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  minor: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "very low": "bg-emerald-50 text-emerald-700 ring-emerald-200",

  open: "bg-blue-50 text-[#1a6fc4] ring-blue-200",
  new: "bg-blue-50 text-[#1a6fc4] ring-blue-200",
  assigned: "bg-blue-50 text-[#1a6fc4] ring-blue-200",
  "in progress": "bg-blue-50 text-[#1a6fc4] ring-blue-200",
  identified: "bg-blue-50 text-[#1a6fc4] ring-blue-200",
  "not started": "bg-slate-100 text-slate-600 ring-slate-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  "pending approval": "bg-amber-50 text-amber-700 ring-amber-200",
  monitoring: "bg-amber-50 text-amber-700 ring-amber-200",
  "yet to be paid": "bg-amber-50 text-amber-700 ring-amber-200",
  blocked: "bg-red-50 text-red-700 ring-red-200",
  "not met": "bg-red-50 text-red-700 ring-red-200",
  invalid: "bg-red-50 text-red-700 ring-red-200",
  "delayed payment": "bg-red-50 text-red-700 ring-red-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  implemented: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  validated: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  met: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "paid on time": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({
  value,
  size = "sm",
}: {
  value: string;
  size?: "sm" | "lg";
}) {
  if (!value?.trim()) return <span className="text-slate-300">—</span>;
  const tone = TONE_MAP[value.trim().toLowerCase()] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold whitespace-nowrap ring-1",
        size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs",
        tone
      )}
    >
      {value}
    </span>
  );
}
