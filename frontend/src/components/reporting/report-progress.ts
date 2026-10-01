// Anchor ids + progress shape shared by the weekly Delivery Status Report
// pages (Project and Account) and their Report Progress rail. The page renders
// each section under its id; the rail scrolls to it.
export const SECTION_IDS = {
  metrics: "metrics",
  customer: "customer-communication",
  rag: "rag",
  attachments: "attachments",
} as const;

export const statusSectionId = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const ragSectionId = (label: string) => `rag-${statusSectionId(label)}`;

export type ReportProgressItem = { id: string; label: string; done: boolean };

// Every section of the report is mandatory — returns the submit-blocking message
// naming what's still missing, or undefined once the report is complete.
export function incompleteReportReason(progress: ReportProgress): string | undefined {
  const items = [progress.metrics, ...(progress.customer ? [progress.customer] : []), ...progress.status, ...progress.rag];
  const missing = items.filter((i) => !i.done).map((i) => i.label);
  return missing.length
    ? `All sections are mandatory. Complete these before submitting: ${missing.join(", ")}.`
    : undefined;
}

export type ReportProgress = {
  metrics: ReportProgressItem;
  // Project only — Account's Customer Communications lives on its own page.
  customer?: ReportProgressItem;
  status: ReportProgressItem[];
  rag: ReportProgressItem[];
  completed: number;
  total: number;
};
