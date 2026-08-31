import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-blue-400 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-muted-foreground disabled:opacity-70 read-only:border-neutral-200 read-only:bg-neutral-100 read-only:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-blue-900/50 dark:bg-blue-950/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
