import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = { label: string; href?: string };

// The one breadcrumb used across pages. Items with an href are links; the last
// item without an href (normally the current page) renders as plain text.
export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((item, i) => (
          <span key={`${i}-${item.label}`} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="size-4 text-slate-400" /> : null}
            {item.href ? (
              <Link href={item.href} className="font-semibold text-[#1a6fc4] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-600">{item.label}</span>
            )}
          </span>
      ))}
    </nav>
  );
}
