import { redirect } from "next/navigation";

// RAG Status is now part of the long Account Delivery Status Report (status
// page). Old links and bookmarks land there, keeping the selected period.
export default async function AccountRagStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { accountId } = await params;
  const { period } = await searchParams;
  redirect(`/account-reporting/${accountId}/status${period ? `?period=${period}` : ""}`);
}
