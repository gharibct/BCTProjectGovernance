import { AppFooter } from "@/components/shell/app-footer";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";

// Route groups supply their own <main> (and, for project screens, the
// right-hand ProjectNav) as direct flex children here.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <AppHeader />
      <div className="flex flex-1">
        <AppSidebar />
        {children}
      </div>
      <AppFooter />
    </div>
  );
}
