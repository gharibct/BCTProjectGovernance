import type { Metadata } from "next";

import { ReassignmentView } from "@/components/reassignment/reassignment-view";

export const metadata: Metadata = {
  title: "Reassign Owners | Governance One",
};

export default function ReassignmentPage() {
  return <ReassignmentView />;
}
