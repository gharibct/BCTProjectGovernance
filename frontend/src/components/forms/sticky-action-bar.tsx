"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Bottom action bar for long form / report screens: always visible at the
// bottom of the viewport while the form scrolls. It is position:fixed but
// aligned to the route's <main> content column (measured, and re-measured on
// resize), so it never overlaps the left nav or the right-hand progress
// panel. A same-height spacer stays in the normal flow so the last fields
// are never hidden behind the bar. (position:sticky isn't used: it can't
// leave its parent box, and the buttons' parent is only as tall as the
// buttons.) Secondary actions go in `secondary` (left); the primary action
// is the children (right).
const BAR_HEIGHT = "4.25rem"; // 68px

export function StickyActionBar({
  secondary,
  children,
  className,
}: {
  secondary?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);

  React.useLayoutEffect(() => {
    const main = spacerRef.current?.closest("main");
    if (!main) {
      setBox({ left: 0, width: window.innerWidth });
      return;
    }
    const measure = () => {
      const r = main.getBoundingClientRect();
      setBox((prev) =>
        prev && prev.left === r.left && prev.width === r.width ? prev : { left: r.left, width: r.width }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      <div ref={spacerRef} aria-hidden style={{ height: BAR_HEIGHT }} />
      <div
        style={{ height: BAR_HEIGHT, left: box?.left, width: box?.width, visibility: box ? "visible" : "hidden" }}
        className={cn(
          "fixed bottom-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-10 shadow-[0_-2px_8px_rgba(15,23,42,0.06)]",
          className
        )}
      >
        <div className="flex items-center gap-3">{secondary}</div>
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </>
  );
}
