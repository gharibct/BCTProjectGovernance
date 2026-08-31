import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

function NativeSelect({
  className,
  chevronClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { chevronClassName?: string }) {
  return (
    <div className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-blue-200 bg-blue-50 pr-9 pl-3 text-base transition-colors outline-none focus-visible:border-blue-400 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-muted-foreground disabled:opacity-70 md:text-sm dark:border-blue-900/50 dark:bg-blue-950/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground",
          chevronClassName
        )}
      />
    </div>
  )
}

export { NativeSelect }
