"use client";

import * as React from "react";
import { Loader2, Lock, type LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AiFieldBadge } from "@/components/ai/ai-field-badge";
import type { AiSuggestion } from "@/lib/api/ai-suggestions";

// Inline spinner for a submit/save button's own label while its request is
// in flight — pair with `disabled={mutation.isPending}` on the same button.
export function ButtonSpinner() {
  return <Loader2 className="size-4 animate-spin" />;
}

export function SectionCard({
  icon: Icon,
  title,
  children,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
          <Icon className="size-5 text-slate-700" />
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  badge,
  hint,
  error,
  children,
  className,
  ai,
}: {
  label: string;
  htmlFor?: string;
  badge?: React.ReactNode;
  hint?: string;
  // Field-level validation message — shown in place of `hint` when present.
  // Purely presentational (no aria-invalid/border wiring on the control
  // itself, since Field wraps arbitrary children); pair with a page banner
  // for visibility per the app's notification standard.
  error?: string;
  children: React.ReactNode;
  className?: string;
  // Passed when a screen wires up AI-Implementation.md's suggestion
  // framework (see components/ai/use-ai-review.ts) — undefined/no-suggestion
  // renders exactly as before, so every other Field caller is unaffected.
  ai?: { suggestion: AiSuggestion; onRevert: () => void };
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={htmlFor}
          className="text-sm font-bold tracking-wide text-slate-800"
        >
          {label}
        </Label>
        {badge}
      </div>
      {/* AI-Implementation.md §6: the confidence indicator sits before the
          control, not next to the label like `badge` above. */}
      <div className="mt-2 flex items-center gap-2">
        {ai ? <AiFieldBadge suggestion={ai.suggestion} onRevert={ai.onRevert} /> : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-400 italic">{hint}</p>
      ) : null}
    </div>
  );
}

export function MandatoryBadge() {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase">
      Mandatory
    </span>
  );
}

export function AutoBadge({ label = "Auto" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
      <Lock className="size-2.5" />
      {label}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  activeClassName,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  activeClassName?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1",
        disabled && "bg-slate-100",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-full rounded-md px-4 text-sm font-semibold whitespace-nowrap transition-colors",
            disabled && "cursor-not-allowed",
            value === option.value
              ? (activeClassName ?? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200")
              : disabled
                ? "text-slate-400"
                : "text-slate-500 hover:text-slate-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
