"use client";

import * as React from "react";
import { Loader2, Lock, type LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  badge?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
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
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-slate-400 italic">{hint}</p> : null}
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
