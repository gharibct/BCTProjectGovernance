import type { Metadata } from "next";

import { DeAllocationGrid } from "@/components/de-allocation/de-allocation-grid";

export const metadata: Metadata = {
  title: "DE Project Allocation | Governance One",
};

export default function DeAllocationPage() {
  return <DeAllocationGrid />;
}
