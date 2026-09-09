import type { Metadata } from "next";

import { ReassignmentView } from "@/components/reassignment/reassignment-view";

export const metadata: Metadata = {
  title: "Reassign Owners | Project Governance Tool",
};

export default function ReassignmentPage() {
  return <ReassignmentView />;
}
