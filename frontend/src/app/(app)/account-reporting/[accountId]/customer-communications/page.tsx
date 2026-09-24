import type { Metadata } from "next";

import { CustomerCommunicationsView } from "@/components/customer-communications/customer-communications-view";

export const metadata: Metadata = {
  title: "Customer Communications (Account) | Governance One",
};

export default function AccountCustomerCommunicationsPage() {
  return <CustomerCommunicationsView />;
}
