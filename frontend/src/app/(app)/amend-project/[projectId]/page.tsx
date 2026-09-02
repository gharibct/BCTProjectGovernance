"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

// Amend Project has no hub screen — normalise the bare URL to the first tab.
export default function AmendProjectIndexPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  React.useEffect(() => {
    router.replace(`/amend-project/${projectId}/project-charter`);
  }, [projectId, router]);

  return null;
}
