import type { Metadata } from "next";

import { CustomerCommunicationsView } from "@/components/customer-communications/customer-communications-view";

export const metadata: Metadata = {
  title: "Record Account Presentation | Governance One",
};

export default function AccountCustomerCommunicationsPage() {
  return <CustomerCommunicationsView />;
}
