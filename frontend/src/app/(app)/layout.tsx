import { AppFooter } from "@/components/shell/app-footer";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AuthGuard } from "@/components/shell/auth-guard";

// AuthGuard is client-only and renders null until the persisted session
// hydrates, so static prerendering of anything under this layout just
// produces an empty shell — there's no real page to prerender. Forcing
// dynamic rendering also sidesteps an intermittent Turbopack build bug
// ("Expected workStore to be initialized" during parallel static-worker
// page-data collection) that otherwise randomly fails prod builds on one
// of these routes.
export const dynamic = "force-dynamic";

// Route groups supply their own <main> (and, for project screens, the
// right-hand ProjectNav) as direct flex children here.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-dvh flex-1 flex-col">
        <AppHeader />
        <div className="flex flex-1">
          <AppSidebar />
          {children}
        </div>
        <AppFooter />
      </div>
    </AuthGuard>
  );
}
