"use client";

import * as React from "react";

// "Come back to where you were" for list screens that link out to a detail page
// (Report Submissions, High Risk and its siblings). The click on a row's link is
// remembered for the browser session; when the user returns and the rows have
// loaded, the page opens on the same page of results, scrolls that row into
// view, highlights it briefly and focuses its link.
//
// Rows carry `data-row-key` (RegisterTable and GovernanceMatrix set it). The list
// screen attaches `onClickCapture` to its container so any link inside a row is
// picked up without touching each link.

const PREFIX = "pg-return-row:";
const MAX_AGE_MS = 30 * 60 * 1000;
const HIGHLIGHT_MS = 2000;

type Saved = { rowKey: string; skip: number; at: number };

function read(screen: string): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + screen);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    return Date.now() - saved.at < MAX_AGE_MS ? saved : null;
  } catch {
    return null;
  }
}

function write(screen: string, rowKey: string, skip: number) {
  try {
    window.sessionStorage.setItem(PREFIX + screen, JSON.stringify({ rowKey, skip, at: Date.now() } satisfies Saved));
  } catch {
    // Storage blocked — the page simply opens at the top, as before.
  }
}

function clear(screen: string) {
  try {
    window.sessionStorage.removeItem(PREFIX + screen);
  } catch {
    // ignore
  }
}

// Page of results to reopen on (0 on a normal visit) — for the list's `skip` state.
export function readReturnSkip(screen: string): number {
  return read(screen)?.skip ?? 0;
}

export function useReturnToRow(screen: string, ready: boolean, currentSkip = 0) {
  // Snapshot once on mount: the row to return to, if the user is coming back.
  const [saved] = React.useState(() => read(screen));

  React.useEffect(() => {
    if (!ready || !saved) return;
    const row = document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(saved.rowKey)}"]`);
    clear(screen);
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    row.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
    row.style.transition = "background-color 0.6s";
    row.style.backgroundColor = "#DBEAFE";
    const timer = window.setTimeout(() => {
      row.style.backgroundColor = "";
    }, HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, saved, screen]);

  // Remember the row whose link (or row click) is about to open a detail page.
  const markRow = React.useCallback(
    (rowKey: string) => write(screen, rowKey, currentSkip),
    [screen, currentSkip]
  );

  // Container handler: a click on a link inside a keyed row marks that row.
  const onClickCapture = React.useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("a[href]")) return;
      const key = target.closest<HTMLElement>("[data-row-key]")?.dataset.rowKey;
      if (key) write(screen, key, currentSkip);
    },
    [screen, currentSkip]
  );

  return { markRow, onClickCapture };
}
