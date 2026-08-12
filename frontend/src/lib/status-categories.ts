import { AlertTriangle, Rocket, Trophy, Users } from "lucide-react";

import type { ProjectStatusCategory } from "@/lib/api/project-status";

// The 4 ProjectStatusCategory values, in display order — shared by
// project-status/project-status-tabs.tsx, regional-reporting/status-tabs.tsx,
// and status-review/overview-section.tsx so the category list + icon lives
// in exactly one place.
export const STATUS_CATEGORIES: {
  label: string;
  category: ProjectStatusCategory;
  icon: typeof Trophy;
}[] = [
  { label: "Key Accomplishments", category: "Key Accomplishments", icon: Trophy },
  {
    label: "Upcoming Releases",
    category: "Upcoming Key Releases / Milestones / Actions",
    icon: Rocket,
  },
  {
    label: "Leadership Support",
    category: "Leadership Support / Attention Required",
    icon: Users,
  },
  { label: "Key Risks / Issues", category: "Key Risks / Issues", icon: AlertTriangle },
];
