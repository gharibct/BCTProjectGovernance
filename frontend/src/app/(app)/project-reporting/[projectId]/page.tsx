import { redirect } from "next/navigation";

// The combined reporting hub is split into Report Delivery Status (weekly) and
// Report Project Performance (monthly). Old links and notifications that point
// at the bare project route land on the Delivery Status hub.
export default async function ProjectReportingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/project-reporting/${projectId}/delivery-calendar`);
}
