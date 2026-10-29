import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PeriodActivityItem } from "@/lib/reporting-activity";
import { formatDayMonYear } from "@/lib/format-date";
import { api } from "./client";

// Account Reporting -> Update Account QBR — the QBRs held (or being set up) with
// an account's customer (see backend/app/api/v1/endpoints/customer_communications.py).
// A running history per account, newest first; not period-scoped.

export const QBR_STATUSES = ["Initiated", "Scheduled", "Conducted"] as const;
export type QbrStatus = (typeof QBR_STATUSES)[number];

export type CustomerCommunication = {
  id: string;
  account_id: string;
  planned_date: string; // YYYY-MM-DD
  // Actual date, title, presentation and next QBR date are set only once Conducted.
  actual_date: string | null; // YYYY-MM-DD, never in the future
  status: QbrStatus;
  next_qbr_date: string | null;
  title: string | null;
  file_name: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerCommunicationInput = {
  plannedDate: string;
  actualDate: string;
  status: QbrStatus;
  nextQbrDate: string;
  title: string;
  remarks: string;
  file: File | null;
};

// The date a QBR is filed under: when it was held, else when it is planned.
export function qbrDate(c: CustomerCommunication): string {
  return c.actual_date ?? c.planned_date;
}

export function useCustomerCommunications(accountId: string | null) {
  return useQuery({
    queryKey: ["customer-communications", accountId],
    queryFn: () => api.get<CustomerCommunication[]>(`/accounts/${accountId}/customer-communications`),
    enabled: !!accountId,
  });
}

// An account has at most one QBR still Initiated / Scheduled — the one the
// Update QBR form works on.
export function openQbr(communications: CustomerCommunication[]): CustomerCommunication | undefined {
  return communications.find((c) => c.status === "Initiated" || c.status === "Scheduled");
}

// Updates the open QBR (id given) or, when there is none, creates one. Saving
// as Conducted also makes the backend open the next QBR, Initiated on the Next
// QBR Date.
export function useSaveCustomerCommunication(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CustomerCommunicationInput & { id?: string }) => {
      const formData = new FormData();
      formData.append("planned_date", input.plannedDate);
      formData.append("status", input.status);
      if (input.title) formData.append("title", input.title);
      if (input.actualDate) formData.append("actual_date", input.actualDate);
      if (input.nextQbrDate) formData.append("next_qbr_date", input.nextQbrDate);
      if (input.remarks) formData.append("remarks", input.remarks);
      if (input.file) formData.append("file", input.file);
      const url = `/accounts/${accountId}/customer-communications`;
      return id
        ? api.putForm<CustomerCommunication>(`${url}/${id}`, formData)
        : api.postForm<CustomerCommunication>(url, formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-communications", accountId] }),
  });
}

// Fetches the presentation as a Blob and triggers the browser's Save dialog —
// a plain <a href> can't attach the X-API-Key header this backend requires.
export async function downloadCustomerCommunicationFile(
  accountId: string,
  communication: Pick<CustomerCommunication, "id" | "file_name">
): Promise<void> {
  const blob = await api.getBlob(`/accounts/${accountId}/customer-communications/${communication.id}/file`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = communication.file_name ?? "presentation";
  link.click();
  URL.revokeObjectURL(url);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type CustomerCommunicationQuarter = {
  // Month range with its year, e.g. "Jan-Mar 2026".
  label: string;
  // QBRs filed under the quarter (see qbrDate): a past quarter counts only
  // Conducted ones, the current quarter planned (Initiated / Scheduled) and
  // Conducted, a future quarter whatever is planned there.
  count: number;
  conducted: number;
  planned: number;
  current: boolean;
  // Where the quarter sits relative to today.
  period: "past" | "current" | "next";
};

// Quarter offsets from the current one (0), oldest first.
const DEFAULT_QUARTER_OFFSETS = [-3, -2, -1, 0];

// What the Account Reporting hub's Customer Communications card shows: totals
// (Conducted QBRs all time, plus per-quarter counts — by default the previous
// three calendar quarters and the current one last, by qbrDate), the most
// recently Conducted QBR, and one box per month of the year — green ("on-time"
// renders as the Communication Shared colour) for a month with a Conducted QBR,
// else the plain outline.
export function summarizeCustomerCommunications(
  communications: CustomerCommunication[],
  quarterOffsets: number[] = DEFAULT_QUARTER_OFFSETS,
  today = new Date()
) {
  const year = today.getFullYear();

  // Quarters are counted by absolute index (year * 4 + quarter) so the window
  // can cross a year boundary.
  const currentQuarterIndex = year * 4 + Math.floor(today.getMonth() / 3);
  const quarterCounts = new Map<number, { conducted: number; planned: number }>();
  const monthsWithOne = new Set<number>();
  const conductedList = communications.filter((c) => c.status === "Conducted" && c.actual_date);
  for (const c of communications) {
    const [y, m] = qbrDate(c).split("-").map(Number);
    const index = y * 4 + Math.floor((m - 1) / 3);
    const entry = quarterCounts.get(index) ?? { conducted: 0, planned: 0 };
    if (c.status === "Conducted") entry.conducted += 1;
    else entry.planned += 1;
    quarterCounts.set(index, entry);
  }
  for (const c of conductedList) {
    const [y, m] = (c.actual_date as string).split("-").map(Number);
    if (y === year) monthsWithOne.add(m - 1);
  }

  const quarters: CustomerCommunicationQuarter[] = quarterOffsets.map((offset) => {
    const index = currentQuarterIndex + offset;
    const quarterYear = Math.floor(index / 4);
    const startMonth = (index % 4) * 3;
    const conducted = quarterCounts.get(index)?.conducted ?? 0;
    // A QBR still open in a past quarter was never held, so it isn't counted there.
    const planned = offset < 0 ? 0 : (quarterCounts.get(index)?.planned ?? 0);
    return {
      label: `${MONTH_ABBR[startMonth]}-${MONTH_ABBR[startMonth + 2]} ${quarterYear}`,
      count: conducted + planned,
      conducted,
      planned,
      current: offset === 0,
      period: offset < 0 ? "past" : offset === 0 ? "current" : "next",
    };
  });

  const latest = conductedList.reduce<CustomerCommunication | undefined>(
    (best, c) => (!best || (c.actual_date as string) > (best.actual_date as string) ? c : best),
    undefined
  );
  const monthItems: PeriodActivityItem[] = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return {
      period_id: `${year}-${mm}`,
      label: new Date(year, i, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      start_date: `${year}-${mm}-01`,
      end_date: `${year}-${mm}-01`,
      status: monthsWithOne.has(i) ? "on-time" : "n/a",
      has_report: monthsWithOne.has(i),
    };
  });

  return {
    counts: { total: conductedList.length, quarters },
    last: latest ? { date: formatDayMonYear(latest.actual_date as string), title: latest.title ?? "" } : null,
    monthItems,
  };
}
