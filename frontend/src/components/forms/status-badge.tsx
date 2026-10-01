import { cn } from "@/lib/utils";

// Keyword → tone lookup for RAIDO severity/priority/status values and
// Contractual Compliance Met/Not Met / payment status — shared so every
// register/table across the app colors the same word the same way.
const TONE_MAP: Record<string, string> = {
  critical: "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  "very high": "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  major: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  minor: "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  low: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  "very low": "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",

  open: "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  new: "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  assigned: "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  "in progress": "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  "awaiting closure": "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  identified: "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  "not started": "bg-slate-100 text-slate-600 ring-slate-200",
  "not submitted": "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  "auto generated": "bg-violet-50 text-violet-700 ring-violet-200",
  "draft - saved": "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  baselined: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  "not processed": "bg-slate-100 text-slate-600 ring-slate-200",
  processing: "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  processed: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  excluded: "bg-slate-100 text-slate-500 ring-slate-200",
  ongoing: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  hold: "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  "open only for billing": "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  "pending approval": "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  "under amendment": "bg-violet-50 text-violet-700 ring-violet-200",
  "awaiting review": "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  "in review": "bg-[#E8F2FC] text-[#205889] ring-[#205889]/20",
  returned: "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  monitoring: "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  "yet to be paid": "bg-[#FFF4D6] text-[#8A6100] ring-[#8A6100]/20",
  blocked: "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  "not met": "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  breached: "bg-red-100 text-red-800 ring-red-300",
  invalid: "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  "delayed payment": "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  resolved: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  completed: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  implemented: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  approved: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  rejected: "bg-[#FDECEC] text-[#B42318] ring-[#B42318]/20",
  submitted: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  validated: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  met: "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
  "paid on time": "bg-[#E7F8F1] text-[#087A5B] ring-[#087A5B]/20",
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
