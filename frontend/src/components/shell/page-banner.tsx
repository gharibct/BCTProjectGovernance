"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, X, XCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePageBanner, type BannerVariant } from "@/stores/page-banner";

const VARIANT_STYLES: Record<BannerVariant, { wrap: string; icon: LucideIcon; iconClass: string }> = {
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
  },
  error: {
    wrap: "border-red-200 bg-red-50 text-red-700",
    icon: XCircle,
    iconClass: "text-red-600",
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
  },
};

// Renders directly below the page header wherever it's mounted (see
// project-header.tsx / new-project-header.tsx / status-header.tsx) — the
// single visible surface for "important" success/error/warning feedback,
// per the app-wide notification standard. Minor/transient notices stay as
// sonner toasts (top-right) and don't go through this component.
export function PageBanner() {
  const banner = usePageBanner((state) => state.banner);
  const dismiss = usePageBanner((state) => state.dismiss);

  if (!banner) return null;

  const { wrap, icon: Icon, iconClass } = VARIANT_STYLES[banner.variant];

  return (
    <div
      role="alert"
      className={cn(
        "mt-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm",
        wrap
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
      <p className="flex-1">{banner.message}</p>
      {banner.action ? (
        banner.action.href ? (
          <Link
            href={banner.action.href}
            className="shrink-0 font-semibold whitespace-nowrap underline underline-offset-2"
          >
            {banner.action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={banner.action.onClick}
            className="shrink-0 font-semibold whitespace-nowrap underline underline-offset-2"
          >
            {banner.action.label}
          </button>
        )
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
