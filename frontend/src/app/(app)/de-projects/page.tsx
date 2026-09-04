import type { Metadata } from "next";

import { DeProjectsList } from "@/components/de-projects/de-projects-list";

export const metadata: Metadata = {
  title: "Projects | Project Governance Tool",
};

export default function DeProjectsPage() {
  return <DeProjectsList />;
}
