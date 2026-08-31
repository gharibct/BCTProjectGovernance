// Dashed-border "nothing here yet" placeholder — the guard shown in place of
// a form/register when a prerequisite (project, period, submitted parent
// record, ...) isn't met yet. Was copy-pasted verbatim across ~35 files;
// this is the one canonical markup.
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}
