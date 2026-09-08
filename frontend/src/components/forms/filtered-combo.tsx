"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

// Generic "combobox + optional advanced-filter popup" for any large lookup list
// (projects, employees, …). The combo is the primary selector — open it, type to
// search, pick a row. When the list is too big, open the filter popup, set the
// facets + a name/keyword search, Apply, and the combo reloads to only the
// matching rows. Filtering is server-side: `fetchOptions` receives the applied
// facets + the search term + a page size and returns `{ items, total }`.
//
// Generalises components/forms/resource-picker.tsx (Popover + Input + listbox +
// arrow/Enter nav + debounce). Radix Popover handles portal / outside-click /
// Esc. Consumers usually use a thin wrapper (see components/forms/project-picker.tsx);
// an EmployeePicker would pass a `fetchOptions` hitting GET /users?search=&role_code=.

export type ComboItem = {
  id: string;
  primary: string;
  secondary?: string;
  /** Small chip shown at the right of the row (e.g. a status). */
  tag?: string;
};

export type ComboFacetOption = { value: string; label: string };

export type FilteredComboFacet = {
  key: string;
  label: string;
  /** Static list, or recomputed from the other draft facet values (cascades). */
  options: ComboFacetOption[] | ((draft: Record<string, string>) => ComboFacetOption[]);
  /** Text of the leading "[All]" option — defaults to `${label} [All]`. */
  placeholder?: string;
  /** Facet keys to reset when this facet changes (parent → child cascade). */
  clearsOnChangeOf?: string[];
};

export type FilteredComboProps = {
  value: string | null;
  onChange: (id: string | null) => void;

  /** Server-side fetch. `filters` holds only the applied facet values. */
  fetchOptions: (args: {
    search: string;
    filters: Record<string, string>;
    limit: number;
  }) => Promise<{ items: ComboItem[]; total: number }>;

  /** Show the current selection's label. Pass the item directly, or a resolver. */
  selectedItem?: ComboItem | null;
  resolveSelected?: (id: string) => Promise<ComboItem | undefined>;

  /** react-query key prefix — unique per consumer (e.g. ["projects", "picker"]). */
  queryKey: readonly unknown[];
  facets?: FilteredComboFacet[];
  /** Mirror the search box inside the filter popup (default true). */
  showSearchInFilterPopup?: boolean;
  searchLabel?: string;

  label?: string;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  pageSize?: number;
  id?: string;
  className?: string;
};

// Same token set as ui/native-select.tsx / resource-picker.tsx so the trigger
// sits flush with the other form controls.
const TRIGGER_BASE =
  "relative flex h-11 w-full items-center rounded-lg border border-blue-200 bg-blue-50 pr-9 pl-3 text-left text-base transition-colors outline-none focus-visible:border-blue-400 focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:border-blue-900/50 dark:bg-blue-950/20";
const TRIGGER_DISABLED =
  "pointer-events-none cursor-not-allowed border-neutral-200 bg-neutral-100 text-muted-foreground opacity-70 dark:border-white/10 dark:bg-input/30";

function resolveFacetOptions(facet: FilteredComboFacet, draft: Record<string, string>) {
  return typeof facet.options === "function" ? facet.options(draft) : facet.options;
}

export function FilteredCombo({
  value,
  onChange,
  fetchOptions,
  selectedItem,
  resolveSelected,
  queryKey,
  facets = [],
  showSearchInFilterPopup = true,
  searchLabel = "Name / keyword",
  label,
  required = false,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  pageSize = 25,
  id,
  className,
}: FilteredComboProps) {
  const [open, setOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [term, setTerm] = React.useState(""); // live + applied search
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [appliedFacets, setAppliedFacets] = React.useState<Record<string, string>>({});
  const [draftFacets, setDraftFacets] = React.useState<Record<string, string>>({});
  const [draftSearch, setDraftSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(term, 250);
  const key = React.useMemo(() => [...queryKey], [queryKey]);

  const optionsQuery = useQuery({
    queryKey: [...key, "options", debounced, appliedFacets],
    queryFn: () => fetchOptions({ search: debounced, filters: appliedFacets, limit: pageSize }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: !disabled,
  });
  const items = optionsQuery.data?.items ?? [];
  const total = optionsQuery.data?.total ?? 0;

  // Live "N results" preview inside the filter popup (draft facets + draft search).
  const debouncedDraftSearch = useDebouncedValue(draftSearch, 250);
  const previewQuery = useQuery({
    queryKey: [...key, "preview", debouncedDraftSearch, draftFacets],
    queryFn: () => fetchOptions({ search: debouncedDraftSearch, filters: draftFacets, limit: 1 }),
    placeholderData: keepPreviousData,
    enabled: !disabled && filterOpen,
  });

  // Resolve the selected id -> label unless the parent handed us the item.
  const needsResolve = !selectedItem && !!value && !!resolveSelected;
  const selectedQuery = useQuery({
    queryKey: [...key, "selected", value],
    queryFn: () => resolveSelected!(value!),
    enabled: needsResolve && !disabled,
    staleTime: 5 * 60_000,
  });
  const selectedLabel = selectedItem?.primary ?? selectedQuery.data?.primary;

  const facetCount = Object.keys(appliedFacets).length + (term.trim() ? 1 : 0);
  const filtered = facetCount > 0;

  const summary = React.useMemo(() => {
    const parts = facets
      .filter((f) => appliedFacets[f.key])
      .map((f) => {
        const opts = resolveFacetOptions(f, appliedFacets);
        const opt = opts.find((o) => o.value === appliedFacets[f.key]);
        return `${f.label}: ${opt?.label ?? appliedFacets[f.key]}`;
      });
    if (term.trim()) parts.push(`"${term.trim()}"`);
    return parts.join(" • ");
  }, [facets, appliedFacets, term]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setActiveIndex(0);
  };

  const commit = (nextId: string | null) => {
    onChange(nextId);
    handleOpenChange(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = items[activeIndex];
      if (picked) commit(picked.id);
    }
  };

  const openFilters = () => {
    setDraftFacets(appliedFacets);
    setDraftSearch(term);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedFacets(draftFacets);
    setTerm(draftSearch);
    setFilterOpen(false);
  };

  const clearAll = () => {
    setTerm("");
    setAppliedFacets({});
    setDraftFacets({});
    setDraftSearch("");
  };

  const setDraftFacet = (facet: FilteredComboFacet, next: string) => {
    setDraftFacets((prev) => {
      const out = { ...prev };
      if (next) out[facet.key] = next;
      else delete out[facet.key];
      for (const dep of facet.clearsOnChangeOf ?? []) delete out[dep];
      return out;
    });
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-wide text-slate-800">
            {label}
            {required ? <span className="ml-0.5 font-bold text-red-600">*</span> : null}
          </span>
          {!disabled && (optionsQuery.data || optionsQuery.isFetching) ? (
            <span className="text-xs font-medium text-slate-400">
              {optionsQuery.isFetching && !optionsQuery.data
                ? "…"
                : `${total} ${filtered ? "matching" : "available"}`}
            </span>
          ) : null}
        </div>
      ) : null}

      {filtered ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
            <SlidersHorizontal className="size-3.5 shrink-0 text-slate-400" />
            <span className="truncate">Filtered: {summary}</span>
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-xs font-semibold text-[#1a6fc4] hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Popover open={disabled ? false : open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              disabled={disabled}
              aria-haspopup="listbox"
              className={cn(TRIGGER_BASE, "flex-1 justify-between", disabled && TRIGGER_DISABLED)}
            >
              <span
                className={cn(
                  "truncate",
                  selectedLabel ? "font-medium text-slate-900 dark:text-slate-100" : "text-muted-foreground",
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
                placeholder={searchPlaceholder}
                aria-label={searchLabel}
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

              {optionsQuery.isFetching && items.length === 0 ? (
                <li className="flex items-center gap-2 px-3 py-6 text-sm text-slate-400">
                  <Loader2 className="size-4 animate-spin" />
                  Searching…
                </li>
              ) : items.length === 0 ? (
                <li className="px-3 py-6 text-sm text-slate-400">No results.</li>
              ) : (
                items.map((it, i) => (
                  <li key={it.id} role="option" aria-selected={it.id === value}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commit(it.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left",
                        i === activeIndex ? "bg-blue-50 dark:bg-blue-950/40" : "",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-sm",
                            it.id === value
                              ? "font-semibold text-[#1a6fc4]"
                              : "text-slate-900 dark:text-slate-100",
                          )}
                        >
                          <span className="truncate">{it.primary}</span>
                          {it.id === value ? <Check className="size-3.5 shrink-0" /> : null}
                        </span>
                        {it.secondary ? (
                          <span className="block truncate text-xs text-muted-foreground">{it.secondary}</span>
                        ) : null}
                      </span>
                      {it.tag ? (
                        <span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500">
                          {it.tag}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>

            {total > items.length ? (
              <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 dark:border-white/10">
                Showing {items.length} of {total} — refine to narrow.
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        {facets.length > 0 || showSearchInFilterPopup ? (
          <Popover
            open={disabled ? false : filterOpen}
            onOpenChange={(next) => (next ? openFilters() : setFilterOpen(false))}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                aria-label="Filter list"
                className="relative h-11 w-11 shrink-0 border-blue-200 bg-blue-50 text-[#1a4a7a] hover:bg-blue-100"
              >
                <SlidersHorizontal className="size-4" />
                {facetCount > 0 ? (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-[#1a4a7a] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                    {facetCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>

            <PopoverContent align="end" sideOffset={4} className="w-80 space-y-3 p-4">
              <p className="text-sm font-bold text-slate-900">Filter</p>

              {facets.map((facet) => {
                const opts = resolveFacetOptions(facet, draftFacets);
                return (
                  <label key={facet.key} className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-600">{facet.label}</span>
                    <NativeSelect
                      className="h-9 bg-white text-sm"
                      value={draftFacets[facet.key] ?? ""}
                      onChange={(e) => setDraftFacet(facet, e.target.value)}
                    >
                      <option value="">{facet.placeholder ?? `${facet.label} [All]`}</option>
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                );
              })}

              {showSearchInFilterPopup ? (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">{searchLabel}</span>
                  <Input
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="e.g. %abc%"
                    aria-label={searchLabel}
                  />
                </label>
              ) : null}

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                <span>Scoped results</span>
                <span className="font-semibold text-[#1a4a7a]">
                  {previewQuery.isFetching && !previewQuery.data ? "…" : (previewQuery.data?.total ?? 0)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 flex-1 text-sm"
                  onClick={() => {
                    setDraftFacets({});
                    setDraftSearch("");
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  className="h-9 flex-1 bg-[#1a4a7a] text-sm font-semibold text-white hover:bg-[#15406b]"
                  onClick={applyFilters}
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
