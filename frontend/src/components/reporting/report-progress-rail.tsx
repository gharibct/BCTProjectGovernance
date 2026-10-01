"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ProgressHeader } from "@/components/shell/progress-header";
import { StatusIcon } from "@/components/shell/nav-primitives";
import { SECTION_IDS, type ReportProgress, type ReportProgressItem } from "./report-progress";

// Right-hand menu of the merged Delivery Status Report (Project and Account):
// shows how many sections are complete and scrolls to each section of the same
// page. Submit Report opens the Submit Report screen, where the submit button
// lives; from there, section clicks navigate back to the status page.
export function ReportProgressRail({
  progress,
  mode = "status",
  statusPath,
  submitPath,
}: {
  progress: ReportProgress;
  mode?: "status" | "submit";
  statusPath: string;
  submitPath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period");

  const allIds = React.useMemo(
    () => [
      progress.metrics.id,
      ...(progress.customer ? [progress.customer.id] : []),
      ...progress.status.map((i) => i.id),
      SECTION_IDS.rag,
      ...progress.rag.map((i) => i.id),
    ],
    [progress.metrics.id, progress.customer, progress.status, progress.rag]
  );
  const [activeId, setActiveId] = React.useState<string>(SECTION_IDS.metrics);

  // Scroll-spy: the active section is the last one (in page order) whose top
  // has scrolled past a line near the top of the viewport. Order matters
  // because RAG contains its six categories — the deepest one passed wins.
  // The capture-phase listener catches scrolling in whichever ancestor is the
  // page's scroll container.
  React.useEffect(() => {
    if (mode !== "status") return;
    const LINE = 140;
    const update = () => {
      let current = allIds[0];
      for (const id of allIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= LINE) current = id;
      }
      setActiveId(current);
    };
    update();
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [allIds, mode]);

  const statusHref = (id?: string) =>
    `${statusPath}?${new URLSearchParams({
      ...(periodId ? { period: periodId } : {}),
      ...(id ? { section: id } : {}),
    })}`;

  // Arriving from Submit Report with ?section=… scrolls to that section once
  // the page content has rendered (it loads asynchronously).
  const targetSection = searchParams.get("section");
  React.useEffect(() => {
    if (mode !== "status" || !targetSection) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById(targetSection);
      if (el || ++tries > 20) {
        window.clearInterval(timer);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [mode, targetSection]);

  const jump = (id: string) => {
    if (mode === "submit") {
      router.push(statusHref(id));
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  const submitHref = periodId ? `${submitPath}?period=${periodId}` : submitPath;

  const row = (item: ReportProgressItem, opts?: { indent?: boolean }) => (
    <button
      key={item.id}
      type="button"
      onClick={() => jump(item.id)}
      aria-current={mode === "status" && activeId === item.id ? "true" : undefined}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md py-2 text-left text-sm transition-colors",
        opts?.indent ? "pr-3 pl-7" : "px-3",
        mode === "status" && activeId === item.id
          ? "bg-[#d9eafc] font-bold text-[#15406b]"
          : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {item.label}
      <StatusIcon done={item.done} />
    </button>
  );

  const ragDone = progress.rag.every((i) => i.done);

  return (
    <aside className="w-72 shrink-0 border-l border-[#94A3B3] bg-white shadow-[-4px_0_14px_rgba(15,23,42,0.16)] px-4 pt-0 pb-8">
      <div className="sticky top-0 flex flex-col gap-4">
        <ProgressHeader title="Report Progress" completed={progress.completed} total={progress.total} />

        <nav className="flex flex-col gap-0.5">
          {row(progress.metrics)}
          {progress.customer ? row(progress.customer) : null}
          {progress.status.map((i) => row(i))}
          {row({ id: SECTION_IDS.rag, label: "RAG", done: ragDone })}
          {progress.rag.map((i) => row(i, { indent: true }))}
        </nav>

        <Link
          href={submitHref}
          aria-current={mode === "submit" ? "page" : undefined}
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full justify-between bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]",
            mode === "submit" && "ring-2 ring-[#1a4a7a]/40"
          )}
        >
          Preview Report and Submit
          <Send className="size-4 shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
