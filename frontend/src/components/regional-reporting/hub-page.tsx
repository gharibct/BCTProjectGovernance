"use client";

import { useParams } from "next/navigation";

import { ReportingHub } from "./reporting-hub";
import type { RegionalScope } from "@/lib/api/regional-status";

// Thin client wrapper so the route's page.tsx can stay a server component
// (and keep its `metadata` export) while still reading the dynamic route
// param — matches the pattern elsewhere in this app of a server page.tsx
// delegating to a dedicated client component.
export function HubPage({ scope, paramName }: { scope: RegionalScope; paramName: string }) {
  const params = useParams<Record<string, string>>();
  const scopeId = params[paramName] ?? "";
  return <ReportingHub scope={scope} scopeId={scopeId} />;
}
