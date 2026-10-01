import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-lg border border-[#5B9BE6] bg-[#F7FAFF] text-[#000000] hover:border-[#4F91D1] hover:bg-[#F3F8FE] px-3 py-2.5 text-base transition-colors outline-none placeholder:text-[#718096] focus-visible:border-[#2F80ED] focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#D5DAE0] disabled:bg-[#F1F3F5] disabled:text-[#98A2B3] disabled:[-webkit-text-fill-color:#98A2B3] disabled:opacity-70 read-only:border-[#D5DAE0] read-only:bg-[#F1F3F5] read-only:text-[#98A2B3] read-only:[-webkit-text-fill-color:#98A2B3] read-only:hover:border-[#D5DAE0] read-only:hover:bg-[#F1F3F5] aria-invalid:border-[#D92D20] aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-[#D92D20]/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
