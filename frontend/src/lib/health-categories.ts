import { DollarSign, HeartHandshake, Settings, ShieldCheck, Target, Users } from "lucide-react";

import type { HealthCategory } from "@/lib/api/health-declarations";

// The 6 RAG Status categories, in display order — shared by every screen
// that renders them as tabs (project-charter/health-declaration.tsx,
// account-reporting/rag-status-form.tsx, new-project/health-declaration.tsx)
// so the category list + icon lives in exactly one place, same role as
// status-categories.ts's STATUS_CATEGORIES.
export const HEALTH_CATEGORIES: {
  label: string;
  category: HealthCategory;
  icon: typeof Target;
}[] = [
  { label: "Core Delivery", category: "Core Delivery", icon: Target },
  { label: "People", category: "People", icon: Users },
  { label: "Operational", category: "Operational", icon: Settings },
  { label: "Customer", category: "Customer", icon: HeartHandshake },
  { label: "Financial", category: "Financial", icon: DollarSign },
  { label: "Compliance", category: "Compliance", icon: ShieldCheck },
];
