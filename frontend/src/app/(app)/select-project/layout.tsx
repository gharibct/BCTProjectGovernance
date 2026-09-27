// Own top-level route so the Project Context page gets a full-width <main>
// (no right-hand project nav — there is no project yet).
export default function SelectProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      {children}
    </main>
  );
}
