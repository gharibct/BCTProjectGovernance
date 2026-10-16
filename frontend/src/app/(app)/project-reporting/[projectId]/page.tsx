import { redirect } from "next/navigation";

// The combined reporting hub is split into Update Project Status Report (weekly) and
// Update Project Performance Report (monthly). Old links and notifications that point
// at the bare project route land on the Delivery Status hub.
export default async function ProjectReportingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/project-reporting/${projectId}/delivery-calendar`);
}
