import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PeriodActivityItem } from "@/lib/reporting-activity";
import { formatDayMonYear } from "@/lib/format-date";
import { api } from "./client";

// Account Reporting -> Customer Communications — the meetings / presentations
// shared with an account's customer (see
// backend/app/api/v1/endpoints/customer_communications.py). A running history
// per account, newest first; not period-scoped.

export type CustomerCommunication = {
  id: string;
  account_id: string;
  reporting_date: string; // YYYY-MM-DD
  title: string;
  file_name: string;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerCommunicationInput = {
  reportingDate: string;
  title: string;
  remarks: string;
  file: File;
};

export function useCustomerCommunications(accountId: string | null) {
  return useQuery({
    queryKey: ["customer-communications", accountId],
    queryFn: () => api.get<CustomerCommunication[]>(`/accounts/${accountId}/customer-communications`),
    enabled: !!accountId,
  });
}

export function useCreateCustomerCommunication(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerCommunicationInput) => {
      const formData = new FormData();
      formData.append("reporting_date", input.reportingDate);
      formData.append("title", input.title);
      if (input.remarks) formData.append("remarks", input.remarks);
      formData.append("file", input.file);
      return api.postForm<CustomerCommunication>(`/accounts/${accountId}/customer-communications`, formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-communications", accountId] }),
  });
}

// Fetches the presentation as a Blob and triggers the browser's Save dialog —
// a plain <a href> can't attach the X-API-Key header this backend requires.
export async function downloadCustomerCommunicationFile(
  accountId: string,
  communication: CustomerCommunication
): Promise<void> {
  const blob = await api.getBlob(`/accounts/${accountId}/customer-communications/${communication.id}/file`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = communication.file_name;
  link.click();
  URL.revokeObjectURL(url);
}

// What the Account Reporting hub's Customer Communications card shows: totals
// (all time / this year / quarter / month, by Reporting Date), the most recent
// communication, and one box per month of the year — green ("on-time" renders
// as the Communication Shared colour) for a month with at least one, else the
// plain outline.
export function summarizeCustomerCommunications(communications: CustomerCommunication[], today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based
  const quarter = Math.floor(month / 3);

  let thisYear = 0;
  let thisQuarter = 0;
  let thisMonth = 0;
  const monthsWithOne = new Set<number>();
  for (const c of communications) {
    const [y, m] = c.reporting_date.split("-").map(Number);
    if (y !== year) continue;
    thisYear += 1;
    monthsWithOne.add(m - 1);
    if (Math.floor((m - 1) / 3) === quarter) thisQuarter += 1;
    if (m - 1 === month) thisMonth += 1;
  }

  // The list arrives newest first (by Reporting Date).
  const latest = communications[0];
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
    counts: { total: communications.length, thisYear, thisQuarter, thisMonth },
    last: latest ? { date: formatDayMonYear(latest.reporting_date), title: latest.title } : null,
    monthItems,
  };
}
