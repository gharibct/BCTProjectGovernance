import { redirect } from "next/navigation";

// RAG Status is now part of the merged Delivery Status Report (Project Status
// page). Old links and bookmarks land there, keeping the selected period.
export default async function ProjectCharterSelfAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { projectId } = await params;
  const { period } = await searchParams;
  redirect(`/project-reporting/${projectId}/project-status${period ? `?period=${period}` : ""}`);
}
