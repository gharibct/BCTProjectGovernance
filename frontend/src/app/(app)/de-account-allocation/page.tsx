import type { Metadata } from "next";

import { DeAccountAllocationGrid } from "@/components/de-account-allocation/de-account-allocation-grid";

export const metadata: Metadata = {
  title: "DE Account Allocation | Governance One",
};

export default function DeAccountAllocationPage() {
  return <DeAccountAllocationGrid />;
}
