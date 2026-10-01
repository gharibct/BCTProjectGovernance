"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { X } from "lucide-react"

import { BannerView } from "@/components/shell/page-banner"
import { cn } from "@/lib/utils"
import { usePageBanner } from "@/stores/page-banner"

// Right-side sliding drawer — same Radix Dialog primitives as ui/dialog.tsx,
// restyled as a side sheet instead of a centered modal (matches
// design-reference/Action-Tracker.html's slide-in drawer CSS).
function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

// Inline success/error feedback pinned to the bottom of every drawer, next to
// its action buttons. The page-level banner sits behind the drawer overlay, so
// a message raised while the drawer is open would otherwise be hidden. Only
// messages raised after the drawer opened are shown (stale ones are ignored).
function SheetFeedback() {
  const banner = usePageBanner((state) => state.banner)
  const dismiss = usePageBanner((state) => state.dismiss)
  const [initial] = React.useState(banner)

  if (!banner || banner === initial) return null
  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <BannerView banner={banner} onDismiss={dismiss} />
    </div>
  )
}

function SheetContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl outline-none sm:w-[560px] lg:w-[40%]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          className
        )}
        {...props}
      >
        {children}
        <SheetFeedback />
        {showClose ? (
          <DialogPrimitive.Close
            data-slot="sheet-close-icon"
            className="absolute top-4 right-4 rounded-md p-1 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#1a6fc4]"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 border-b border-slate-200 px-6 py-5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-bold text-slate-900", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-slate-500", className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
