import { Suspense } from "react";
import type { Metadata } from "next";

import { HighRisks } from "@/components/dashboard/high-risks";

export const metadata: Metadata = {
  title: "High Risk Dashboard | Governance One",
};

export default function HighRisksPage() {
  return (
    // useSearchParams (filters restored from ?back=) requires a Suspense boundary.
    <Suspense fallback={null}>
      <HighRisks />
    </Suspense>
  );
}
