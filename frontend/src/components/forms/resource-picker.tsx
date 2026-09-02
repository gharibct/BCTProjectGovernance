"use client";

import * as React from "react";
import { ChevronDown, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUserSearch, useUsersByIds } from "@/lib/api/reference-data";

// Async typeahead for picking a person (Action owner, assignee, …). Replaces
// the native <select> fed by useUsers(), which loads and can't page past the
// first 200 of a 2000+-employee directory. Results are searched server-side,
// debounced; the current value's name is resolved with a targeted by-id fetch
// (or supplied via `initialLabel` when the parent already has it).
export type ResourcePickerProps = {
  value: string | null;
  onChange: (id: string | null) => void;
  roleCode?: string;
  activeOnly?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Render the selected name without a lookup when the parent already has it. */
  initialLabel?: string;
  id?: string;
  className?: string;
};

// Same token set as ui/native-select.tsx so the picker sits flush with the
// other form controls in both light and dark.
const TRIGGER_BASE =
  "relative flex h-11 w-full items-center rounded-lg border border-blue-200 bg-blue-50 pr-9 pl-3 text-left text-base transition-colors outline-none focus-visible:border-blue-400 focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:border-blue-900/50 dark:bg-blue-950/20";
const TRIGGER_DISABLED =
  "pointer-events-none cursor-not-allowed border-neutral-200 bg-neutral-100 text-muted-foreground opacity-70 dark:border-white/10 dark:bg-input/30";

export function ResourcePicker({
  value,
  onChange,
  roleCode,
  activeOnly = true,
  placeholder = "Search people…",
  disabled = false,
  initialLabel,
  id,
  className,
}: ResourcePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(term, 250);
  const { data: results = [], isFetching } = useUserSearch(open ? debounced : "", {
    roleCode,
    activeOnly,
  });

  // Resolve the selected id -> name, unless the parent handed us the label.
  const needsResolve = !initialLabel && !!value;
  const { data: resolved = [] } = useUsersByIds(needsResolve ? [value] : []);
  const selectedLabel =
    initialLabel ?? (value ? resolved.find((u) => u.id === value)?.full_name : undefined);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setActiveIndex(0);
    if (!next) setTerm("");
  };

  const commit = (nextId: string | null) => {
    onChange(nextId);
    handleOpenChange(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) commit(picked.id);
    }
  };

  return (
    <Popover open={disabled ? false : open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          className={cn(TRIGGER_BASE, disabled && TRIGGER_DISABLED, className)}
        >
          <span
            className={cn(
              "truncate",
              selectedLabel ? "text-slate-900 dark:text-slate-100" : "text-muted-foreground",
            )}
          >
            {selectedLabel ?? placeholder}
          </span>
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="absolute top-1/2 right-8 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <X className="size-3.5" />
            </span>
          ) : null}
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="border-b border-slate-100 p-2 dark:border-white/10">
          <Input
            ref={inputRef}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Type a name…"
            aria-label="Search people"
          />
        </div>

        <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
          {value ? (
            <li>
              <button
                type="button"
                onClick={() => commit(null)}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Clear selection
              </button>
            </li>
          ) : null}

          {isFetching && results.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-6 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </li>
          ) : !isFetching && results.length === 0 ? (
            <li className="px-3 py-6 text-sm text-slate-400">No people found.</li>
          ) : (
            results.map((u, i) => (
              <li key={u.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(u.id)}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-1.5 text-left",
                    i === activeIndex ? "bg-blue-50 dark:bg-blue-950/40" : "",
                  )}
                >
                  <span className="text-sm text-slate-900 dark:text-slate-100">{u.full_name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
