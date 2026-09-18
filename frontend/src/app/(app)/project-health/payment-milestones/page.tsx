import type { Metadata } from "next";

import { ProjectHealthPaymentMilestones } from "@/components/dashboard/project-health-payment-milestones";

export const metadata: Metadata = { title: "Payment Milestones | Governance One" };

export default function PaymentMilestonesPage() {
  return <ProjectHealthPaymentMilestones />;
}
