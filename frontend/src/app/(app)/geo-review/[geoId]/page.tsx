import type { Metadata } from "next";

import { StatusReviewPage } from "@/components/status-review/status-review-page";

export const metadata: Metadata = {
  title: "Geo Review | Governance One",
};

export default function GeoReviewPage() {
  return <StatusReviewPage scope="geo" paramName="geoId" />;
}
