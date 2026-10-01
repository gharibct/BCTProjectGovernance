import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

function NativeSelect({
  className,
  wrapperClassName,
  chevronClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & {
  wrapperClassName?: string
  chevronClassName?: string
}) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-[#5B9BE6] bg-[#F7FAFF] text-[#000000] hover:border-[#4F91D1] hover:bg-[#F3F8FE] pr-9 pl-3 text-base transition-colors outline-none focus-visible:border-[#2F80ED] focus-visible:bg-white focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#D5DAE0] disabled:bg-[#F1F3F5] disabled:text-[#98A2B3] disabled:[-webkit-text-fill-color:#98A2B3] disabled:opacity-70 md:text-sm",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#526A82]",
          chevronClassName
        )}
      />
    </div>
  )
}

export { NativeSelect }
