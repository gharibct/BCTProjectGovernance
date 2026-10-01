import { Menu } from "lucide-react";

// Full-bleed "<Something> Progress" header at the top of a right-hand menu
// (Report Progress, Project Setup Progress, ...): title, "N of M sections completed"
// and a progress bar, in the left sidebar's colour with white text. The -mx-4
// cancels the aside's px-4 so the band runs edge to edge.
export function ProgressHeader({ title, completed, total }: { title: string; completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="-mx-4 bg-[#174F7E] px-4 py-3">
      <p className="flex items-center gap-2.5 text-lg font-bold text-white">
        <Menu className="size-5 shrink-0 text-white" aria-hidden="true" />
        {title}
      </p>
      <p className="mt-2 text-sm text-white">
        {completed} of {total} sections completed
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
