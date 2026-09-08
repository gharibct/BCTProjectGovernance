import type { Metadata } from "next";

import { DeProjectRequestsQueue } from "@/components/de-project-requests/de-project-requests-queue";

export const metadata: Metadata = {
  title: "Project Creation Approval | Project Governance Tool",
};

export default function DeProjectRequestsPage() {
  return <DeProjectRequestsQueue />;
}
