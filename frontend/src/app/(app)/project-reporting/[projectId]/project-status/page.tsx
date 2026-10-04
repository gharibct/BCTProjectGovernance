import type { Metadata } from "next";

import { ActivityGate } from "@/components/forms/activity-gate";
import { DeliveryStatusReport } from "@/components/project-status/delivery-status-report";
import { ProjectHeader } from "@/components/shell/project-header";

export const metadata: Metadata = {
  title: "Delivery Status Report | Governance One",
};

export default function ProjectStatusPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ProjectHeader dynamicSubheading showActionTracker />
      <div className="mt-8">
        <ActivityGate activity="DELIVERY_STATUS" usePeriodParam>
          <DeliveryStatusReport />
        </ActivityGate>
      </div>
    </div>
  );
}
