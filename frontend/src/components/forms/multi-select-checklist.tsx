"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Small reusable checkbox list for FK multi-selects (e.g. assigning a user
// to several Accounts/Geos) — EntryFields/FieldDef only supports
// single-value controls backed by a flat string record, so this stays a
// separate component rather than bolting a multiselect kind onto that engine.
export function MultiSelectChecklist({
  options,
  value,
  onChange,
  emptyLabel,
  disabled = false,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div
      className={cn(
        "flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3",
        options.length === 0 && "items-center justify-center",
        disabled && "opacity-60"
      )}
    >
      {options.length === 0 ? (
        <p className="text-sm text-slate-400 italic">{emptyLabel}</p>
      ) : (
        options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5",
              disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
            )}
          >
            <Checkbox
              checked={value.includes(option.value)}
              onCheckedChange={() => toggle(option.value)}
              disabled={disabled}
            />
            <Label
              className={cn(
                "text-sm font-normal text-slate-700",
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              {option.label}
            </Label>
          </label>
        ))
      )}
    </div>
  );
}
