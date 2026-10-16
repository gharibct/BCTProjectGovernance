import { redirect } from "next/navigation";

// Executive Update moved to Update Leadership Status Report.
export default async function GeoExecutiveUpdateRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ geoId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { geoId } = await params;
  const { period } = await searchParams;
  redirect(`/leadership-reporting/${geoId}/executive-update${period ? `?period=${period}` : ""}`);
}
