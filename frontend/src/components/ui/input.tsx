import * as React from "react"

import { cn } from "@/lib/utils"

// Date fields accept only years MIN_YEAR..MAX_YEAR. The native control lets a
// user type 0200 or a 5-digit year, so an out-of-range value is blanked when the
// field loses focus (via the native setter + an input event, so controlled
// React state clears too).
const MIN_YEAR = 2000
const MAX_YEAR = 2100

function isYearOutOfRange(value: string): boolean {
  const year = Number(value.split("-")[0])
  return !Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR
}

function Input({ className, type, onBlur, min, max, ...props }: React.ComponentProps<"input">) {
  const isDate = type === "date"
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event)
    const input = event.currentTarget
    if (isDate && input.value && isYearOutOfRange(input.value)) {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setValue?.call(input, "")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }
  return (
    <input
      type={type}
      min={min ?? (isDate ? `${MIN_YEAR}-01-01` : undefined)}
      max={max ?? (isDate ? `${MAX_YEAR}-12-31` : undefined)}
      onBlur={handleBlur}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-[#5B9BE6] bg-[#F7FAFF] text-[#000000] hover:border-[#4F91D1] hover:bg-[#F3F8FE] px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#718096] focus-visible:border-[#2F80ED] focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#D5DAE0] disabled:bg-[#F1F3F5] disabled:text-[#98A2B3] disabled:[-webkit-text-fill-color:#98A2B3] disabled:opacity-70 read-only:border-[#D5DAE0] read-only:bg-[#F1F3F5] read-only:text-[#98A2B3] read-only:[-webkit-text-fill-color:#98A2B3] read-only:hover:border-[#D5DAE0] read-only:hover:bg-[#F1F3F5] aria-invalid:border-[#D92D20] aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-[#D92D20]/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
