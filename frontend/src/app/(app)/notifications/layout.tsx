// Own top-level route so the notification inbox gets its own full-width
// <main> flex child of (app)/layout.tsx — no right-hand nav rail.
export default function NotificationsLayout({
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
