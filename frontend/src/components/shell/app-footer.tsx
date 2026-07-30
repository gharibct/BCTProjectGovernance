export function AppFooter() {
  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-8 text-sm text-slate-600">
      <div className="flex items-center gap-4">
        <span>© 2026 Project Governance Tool v0.1.0 — internal build</span>
        <div className="h-5 w-px bg-slate-200" />
        <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-700 uppercase">
          <span className="size-2 rounded-full bg-emerald-500" />
          All Systems Operational
        </span>
      </div>
      <div className="flex items-center gap-8 font-medium">
        <a href="#" className="hover:text-slate-900">
          API Access
        </a>
        <a href="#" className="hover:text-slate-900">
          SLA Documentation
        </a>
        <a href="#" className="hover:text-slate-900">
          Enterprise Support
        </a>
      </div>
    </footer>
  );
}
