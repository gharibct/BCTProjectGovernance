import type { Metadata } from "next";

import { DeProjectsList } from "@/components/de-projects/de-projects-list";

export const metadata: Metadata = {
  title: "Projects | Governance One",
};

export default function DeProjectsPage() {
  return <DeProjectsList />;
}
