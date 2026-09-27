import type { Metadata } from "next";

import { ProjectContextPage } from "@/components/project-context/project-context-page";

export const metadata: Metadata = {
  title: "Select Project | Governance One",
};

// /select-project/{menu entry id} — every project-level menu item lands here
// first; the segment says which screen to forward to once a project is chosen.
export default function SelectProjectPage() {
  return <ProjectContextPage />;
}
