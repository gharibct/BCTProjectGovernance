import { Suspense } from "react";
import type { Metadata } from "next";

import { HighRisks } from "@/components/dashboard/high-risks";

export const metadata: Metadata = { title: "Account RAG | Governance One" };

// Same screen as the standalone dashboard, hosted as a GovOne detail page
// (GovOne breadcrumb, back-links return here).
export default function Page() {
  return (
    // useSearchParams (filters restored from ?back=) requires a Suspense boundary.
    <Suspense fallback={null}>
      <HighRisks variant="delivery-health" govOne />
    </Suspense>
  );
}
