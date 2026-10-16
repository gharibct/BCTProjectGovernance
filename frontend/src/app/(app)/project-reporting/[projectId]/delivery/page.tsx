import type { Metadata } from "next";

import { ReportingHub } from "@/components/project-reporting/reporting-hub";

export const metadata: Metadata = {
  title: "Update Project Status Report | Governance One",
};

export default function ReportDeliveryStatusPage() {
  return <ReportingHub kind="delivery" />;
}
