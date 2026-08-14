"use client";

import { useParams } from "next/navigation";

import { RegionalHeader } from "./regional-header";
import { StatusTabs } from "./status-tabs";
import type { RegionalScope } from "@/lib/api/regional-status";

export function StatusPage({ scope, paramName }: { scope: RegionalScope; paramName: string }) {
  const params = useParams<Record<string, string>>();
  const scopeId = params[paramName] ?? "";
  return (
    <div className="mx-auto max-w-6xl">
      <RegionalHeader scope={scope} paramName={paramName} dynamicSubheading />
      <div className="mt-8">
        <StatusTabs scope={scope} scopeId={scopeId} />
      </div>
    </div>
  );
}
