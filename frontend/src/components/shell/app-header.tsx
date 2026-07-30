import { Bell, LayoutGrid, Menu } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-slate-800 hover:bg-slate-100"
        >
          <Menu className="size-6" />
        </button>
        <div className="flex items-center gap-3">
          <LayoutGrid className="size-7 text-[#1a4a7a]" />
          <span className="text-xl font-bold tracking-tight text-[#1a4a7a]">
            Project Governance
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <Bell className="size-5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">
            Hari G · Project Manager
          </span>
          <div className="flex size-9 items-center justify-center rounded-full bg-[#1a6fc4] text-sm font-semibold text-white">
            HG
          </div>
        </div>
      </div>
    </header>
  );
}
