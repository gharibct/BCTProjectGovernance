import { PageBanner } from "@/components/shell/page-banner";

// Admin screens (/admin/*) share the standalone-screen shell used by
// de-projects, de-findings, etc.: gradient <main>, page banner, then the page.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      <div className="mx-auto max-w-[1400px]">
        <PageBanner />
      </div>
      {children}
    </main>
  );
}
