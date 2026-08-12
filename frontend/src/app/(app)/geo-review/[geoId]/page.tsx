import type { Metadata } from "next";

import { StatusReviewPage } from "@/components/status-review/status-review-page";

export const metadata: Metadata = {
  title: "Geo Review | Project Governance Tool",
};

export default function GeoReviewPage() {
  return <StatusReviewPage scope="geo" paramName="geoId" />;
}
