"use client";

import Link from "next/link";
import { AlertTriangle, Lock, SearchX, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type ErrorKind = "forbidden" | "not-found" | "generic";

const KIND_CONTENT: Record<ErrorKind, { icon: LucideIcon; title: string; description: string }> = {
  forbidden: {
    icon: Lock,
    title: "Access Denied",
    description: "You don't have access to this record.",
  },
  "not-found": {
    icon: SearchX,
    title: "Not Found",
    description: "This record doesn't exist or may have been removed.",
  },
  generic: {
    icon: AlertTriangle,
    title: "Something went wrong",
    description: "This page couldn't be loaded.",
  },
};

function errorKind(error: unknown): ErrorKind {
  if (error instanceof ApiError) {
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "not-found";
  }
  return "generic";
}

// Full-page replacement for a screen's primary query when it errors, instead
// of the previous silent fallback (e.g. an empty title/table with no
// indication anything went wrong) — see reporting-hub.tsx / regional-
// reporting-hub.tsx for the two call sites this was introduced for.
export function QueryErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const kind = errorKind(error);
  const { icon: Icon, title, description } = KIND_CONTENT[kind];

  return (
    <div
      className={cn(
        "mx-auto flex max-w-7xl flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-20 text-center shadow-sm",
        className
      )}
    >
      <Icon className="size-10 text-slate-400" />
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-slate-500">{description}</p>
      </div>
      <div className="mt-2 flex gap-2">
        {kind === "generic" && onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button asChild variant={kind === "generic" ? "default" : "outline"}>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
