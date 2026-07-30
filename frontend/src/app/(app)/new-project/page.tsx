import { redirect } from "next/navigation";

// The New Project flow opens directly on the Project Charter — there is no
// reporting hub for a project that is still being set up.
export default function NewProjectPage() {
  redirect("/new-project/project-charter");
}
