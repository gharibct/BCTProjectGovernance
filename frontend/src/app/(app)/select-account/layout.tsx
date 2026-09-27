// Own top-level route so the Account Context page gets a full-width <main>
// (no right-hand account nav — there is no account yet).
export default function SelectAccountLayout({
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
