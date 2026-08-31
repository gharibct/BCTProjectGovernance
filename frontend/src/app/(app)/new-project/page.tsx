import { redirect } from "next/navigation";

// The New Project flow opens on the mandatory Create Project screen (Project
// Name + at least one Oracle Project mapping) — there is no reporting hub
// for a project that is still being set up.
export default function NewProjectPage() {
  redirect("/new-project/new/create");
}
