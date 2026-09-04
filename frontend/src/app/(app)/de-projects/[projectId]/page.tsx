import type { Metadata } from "next";

import { DeProjectDetail } from "@/components/de-projects/de-project-detail";

export const metadata: Metadata = {
  title: "Project Details | Project Governance Tool",
};

export default function DeProjectDetailPage() {
  return <DeProjectDetail />;
}
