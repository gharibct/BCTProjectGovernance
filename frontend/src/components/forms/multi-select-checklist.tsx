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
        "flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border p-3 transition-colors",
        options.length === 0 && "items-center justify-center",
        disabled
          ? "border-[#D5DAE0] bg-[#F1F3F5]"
          : "border-[#5B9BE6] bg-white hover:border-[#4F91D1] focus-within:border-[#2F80ED]"
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
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <Checkbox
              checked={value.includes(option.value)}
              onCheckedChange={() => toggle(option.value)}
              disabled={disabled}
              className={cn(
                "border-[#5B9BE6] bg-white hover:border-[#4F91D1] focus-visible:border-[#2F80ED] data-checked:border-[#2F80ED] data-checked:bg-[#2F80ED]",
                "disabled:border-[#D5DAE0] disabled:bg-[#F1F3F5] disabled:opacity-100"
              )}
            />
            <Label
              className={cn(
                "text-sm font-normal",
                disabled ? "cursor-not-allowed text-[#98A2B3]" : "cursor-pointer text-[#000000]"
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
