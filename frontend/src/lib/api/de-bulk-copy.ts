import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthRating } from "./projects";

// DE bulk copy — carries each project's / account's latest Submitted assessment
// forward into a selected Weekly period, keeping its assessment date. Copies
// whose date is more than 35 days before the period end are returned as failed.
// Project Quality Audits are ignored (backend: endpoints/de_bulk_copy.py).

export type BulkCopyRow = {
  entity_id: string;
  entity_name: string;
  account_name: string | null;
  delivery_excellence_name: string | null;
  assessment_date: string | null;
  de_health: HealthRating | null;
  pci_score: string | null;
  reason: string | null;
};

export type BulkCopyResult = {
  period_label: string;
  period_end_date: string;
  earliest_assessment_date: string;
  copied: BulkCopyRow[];
  failed: BulkCopyRow[];
  skipped: BulkCopyRow[];
};

export type BulkCopyScope = "projects" | "accounts";

export function useBulkCopyAssessments(scope: BulkCopyScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { period_id: string; de_user_id: string | null }) =>
      api.post<BulkCopyResult>(`/de-bulk-copy/${scope}`, body),
    onSuccess: () => {
      if (scope === "projects") {
        queryClient.invalidateQueries({ queryKey: ["de-assessments"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["de-account-audits"] });
        queryClient.invalidateQueries({ queryKey: ["de-account-audit-queue"] });
      }
    },
  });
}
