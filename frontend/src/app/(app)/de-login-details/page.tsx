import type { Metadata } from "next";

import { LoginDetailsView } from "@/components/de-login-details/login-details-view";

export const metadata: Metadata = {
  title: "User Login Details | Governance One",
};

export default function DeLoginDetailsPage() {
  return <LoginDetailsView />;
}
