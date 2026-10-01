import { redirect } from "next/navigation";

// Contractual Compliance was split into Contractual Commitments and
// Milestones — keep old links/bookmarks working.
export default async function LegacyContractualCompliancePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/amend-project/${projectId}/contractual-commitments`);
}
