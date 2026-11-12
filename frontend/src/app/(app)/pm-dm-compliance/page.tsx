import type { Metadata } from "next";

import { PmDmCompliance } from "@/components/dashboard/pm-dm-compliance";

export const metadata: Metadata = {
  title: "PM / DM Compliance | Governance One",
};

export default function PmDmCompliancePage() {
  return <PmDmCompliance />;
}
