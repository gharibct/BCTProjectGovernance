import type { RoleCode } from "@/lib/api/auth";

// Where a filed Project / Account Delivery Status report opens from a dashboard
// grid, by the role of the person opening it. Roles that act on the report land
// on their action page instead of the read-only viewer:
//   - the submitter (PM for a project, Delivery Manager for an account) opens
//     their reporting dashboard (Recall);
//   - the approver (Delivery Manager / Geo Head for a project, Geo Head for an
//     account) opens the approval page (Approve / Reject). It also shows a report
//     once decided (Approved / Rejected) with its action bar locked; any other
//     status (Draft, Baselined, …) falls back to the viewer.
// Every other role keeps the viewer.
export function reportHref({
  scope,
  role,
  id,
  status,
  periodId,
  back,
}: {
  scope: "project" | "account";
  role: RoleCode | null | undefined;
  id: string;
  status: string | null | undefined;
  periodId: string;
  back: string;
}): string {
  const query = `?period=${periodId}&back=${encodeURIComponent(back)}`;
  const decidable = status === "Submitted" || status === "Approved" || status === "Rejected";
  if (scope === "project") {
    if (role === "PROJECT_MANAGER") return `/project-reporting/${id}/dashboard${query}`;
    if ((role === "ACCOUNT_MANAGER" || role === "GEO_HEAD") && decidable) return `/project-approval/${id}${query}`;
    return `/project-review/${id}${query}`;
  }
  if (role === "ACCOUNT_MANAGER") return `/account-reporting/${id}/dashboard${query}`;
  if (role === "GEO_HEAD" && decidable) return `/account-approval/${id}${query}`;
  return `/account-review/${id}${query}`;
}

// Leading breadcrumb items when a report was opened from a dashboard grid (`?back=<grid route>`):
// [GovOne Dashboard >] <that grid> — labels match the left-menu names. Null when `back` is not
// a known dashboard, so callers keep their own default root crumb.
const BACK_LABELS: [prefix: string, label: string][] = [
  ["/executive-risk", "Executive Risk Dashboard"],
  ["/high-risks", "High Risk Dashboard"],
  ["/delivery-health", "Account Health Dashboard"],
  ["/projects-health", "Project Health Dashboard"],
  ["/project-health/account-rag", "Account RAG"],
  ["/project-health/rag", "Project RAG"],
  ["/project-health/customer-project-reports", "Customer Project Status Reporting"],
  ["/project-health/", "Report Submissions"],
];

export function dashboardBackCrumbs(back: string | null | undefined): { label: string; href?: string }[] | null {
  if (!back) return null;
  const hit = BACK_LABELS.find(([prefix]) => back.startsWith(prefix));
  if (!hit) return null;
  const crumb = { label: hit[1], href: back };
  return back.startsWith("/project-health/") ? [{ label: "GovOne Dashboard", href: "/project-health" }, crumb] : [crumb];
}
