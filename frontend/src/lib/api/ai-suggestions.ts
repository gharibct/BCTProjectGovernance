import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// See AI-Implementation.md — the app never writes AI values directly into
// business tables. A suggestion here is reviewed on the screen it targets
// (matched by `screen` + `field_key`) and applied/ignored by the user; the
// value only becomes real project data once that screen is saved through its
// own normal save action, at which point the backend resolves whatever is
// still pending (see useResolveAiSuggestions).
export type AiSuggestionStatus = "pending" | "ignored" | "resolved";

export type AiSuggestion = {
  id: string;
  project_id: string;
  screen: string;
  period_id: string;
  field_key: string;
  value: string | null;
  confidence: number;
  source_document: string | null;
  source_location: string | null;
  evidence: string | null;
  status: AiSuggestionStatus;
  created_at: string;
};

// Session-scoped by design: `enabled: false` means this never auto-fetches
// on mount, no matter what's still `pending` server-side from an old,
// abandoned session that clicked "Apply AI Results" and never saved. The
// only writers of this query's cache are the mutations below (seed/ignore/
// resolve) — a fresh mount always starts clean until the user explicitly
// asks for suggestions again this visit (see use-ai-review.ts).
export function useAiSuggestions(projectId: string | null, screen: string, periodId: string | null) {
  return useQuery({
    queryKey: ["ai-suggestions", projectId, screen, periodId],
    queryFn: () =>
      api.get<AiSuggestion[]>(
        `/projects/${projectId}/ai-suggestions?screen=${encodeURIComponent(screen)}&period_id=${encodeURIComponent(periodId!)}`
      ),
    enabled: false,
  });
}

export function useIgnoreAiSuggestion(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) =>
      api.post<AiSuggestion>(`/projects/${projectId}/ai-suggestions/${suggestionId}/ignore`),
    onSuccess: (_data, suggestionId) => {
      queryClient.setQueryData<AiSuggestion[]>(["ai-suggestions", projectId, screen, periodId], (old) =>
        (old ?? []).filter((s) => s.id !== suggestionId)
      );
    },
  });
}

// Called right after the screen's own Save/Edit/Create action succeeds
// (AI-Implementation.md §9) — whatever is still pending becomes manual data.
export function useResolveAiSuggestions(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<void>(
        `/projects/${projectId}/ai-suggestions/resolve?screen=${encodeURIComponent(screen)}&period_id=${encodeURIComponent(periodId!)}`
      ),
    onSuccess: () => {
      queryClient.setQueryData(["ai-suggestions", projectId, screen, periodId], []);
    },
  });
}

// Testing-only: no real extraction pipeline exists yet (AI-Implementation.md
// §1-§2 aren't built), so this asks the backend to fabricate a canned batch
// of suggestions for the given screen instead, to exercise the review UI.
// The mutation response is the same shape GET .../ai-suggestions returns
// (a fresh pending batch for that screen), so it's written straight into the
// query cache — one round-trip instead of a POST followed by a refetch.
export function useSeedTestAiSuggestions(projectId: string | null, screen: string, periodId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<AiSuggestion[]>(
        `/projects/${projectId}/ai-suggestions/seed-test-data?screen=${encodeURIComponent(screen)}&period_id=${encodeURIComponent(periodId!)}`
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["ai-suggestions", projectId, screen, periodId], data);
    },
  });
}

// TEMP (backend down / no project yet): the same canned sets as the
// backend's seed-test-data endpoint (see ai_suggestions.py's
// _project_profile_test_fields/_scope_schedule_test_fields/
// _self_assessment_test_fields), but built entirely client-side — no
// network call, no project or backend required — so "Load Test AI
// Suggestions" still shows the review UI while iterating on a screen.
// project_profile's FK fields (project type/org/geo/account/PM) are left
// out since there's no reference data to resolve them against here. Revert
// once real ingestion (or at least a reachable backend) is in place.
const LOCAL_TEST_FIELDS: Record<string, Omit<AiSuggestion, "id" | "project_id" | "screen" | "period_id" | "status" | "created_at">[]> = {
  project_profile: [
    {
      field_key: "project_name",
      value: "Digital Field Optimization",
      confidence: 0.96,
      source_document: "Project_Charter.pdf",
      source_location: "Page 3",
      evidence: "The project shall be called Digital Field Optimization.",
    },
    {
      field_key: "engagement_type",
      value: "Implementation",
      confidence: 0.97,
      source_document: "Project_Charter.pdf",
      source_location: "Page 3",
      evidence: "This is an implementation engagement covering full lifecycle delivery.",
    },
    {
      field_key: "contract_type",
      value: "T&M",
      confidence: 0.55,
      source_document: "Statement_of_Work.docx",
      source_location: "Section 2",
      evidence: "Engagement will be billed on a time and materials basis.",
    },
    {
      field_key: "project_owned",
      value: "Co-Owned",
      confidence: 0.4,
      source_document: "Proposal.pdf",
      source_location: "Page 1",
      evidence: "Delivery will be jointly managed with the customer's PMO.",
    },
    {
      field_key: "project_revenue",
      value: "250000",
      confidence: 0.75,
      source_document: "Commercial_Terms.xlsx",
      source_location: "Sheet1!B4",
      evidence: "Total Contract Value: 250,000",
    },
    {
      field_key: "project_currency",
      value: "USD",
      confidence: 0.9,
      source_document: "Commercial_Terms.xlsx",
      source_location: "Sheet1!B5",
      evidence: "Currency: USD",
    },
    {
      field_key: "billing_type",
      value: "T&M",
      confidence: 0.5,
      source_document: "Commercial_Terms.xlsx",
      source_location: "Sheet1!B6",
      evidence: "Billing Type: Time & Materials",
    },
  ],
  scope_schedule: [
    {
      field_key: "customer_overview",
      value: "Global manufacturing client consolidating regional ERP instances into a single cloud platform.",
      confidence: 0.72,
      source_document: "Statement_of_Work.docx",
      source_location: "Section 1",
      evidence:
        "The customer operates manufacturing sites across three regions and is consolidating regional ERP instances into a single cloud platform.",
    },
    {
      field_key: "project_scope_description",
      value:
        "Implement and roll out the core ERP modules (Finance, Procurement, Inventory) across all regional sites, including data migration and integration with existing logistics systems.",
      confidence: 0.85,
      source_document: "Statement_of_Work.docx",
      source_location: "Section 2",
      evidence:
        "Scope covers implementation of Finance, Procurement, and Inventory modules, data migration from legacy systems, and integration with existing logistics systems.",
    },
    {
      field_key: "planned_start_date",
      value: "2026-09-01",
      confidence: 0.6,
      source_document: "Project_Charter.pdf",
      source_location: "Page 4",
      evidence: "Project is planned to kick off on September 1, 2026.",
    },
    {
      field_key: "planned_end_date",
      value: "2027-03-31",
      confidence: 0.58,
      source_document: "Project_Charter.pdf",
      source_location: "Page 4",
      evidence: "Go-live is targeted for end of March 2027.",
    },
  ],
  self_assessment: [
    {
      field_key: "core_delivery_rating",
      value: "Amber",
      confidence: 0.74,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 1",
      evidence: "Two milestones slipped by two weeks due to a procurement delay on the client side.",
    },
    {
      field_key: "core_delivery_description",
      value: "Two milestones slipped by two weeks due to procurement delays on the client side.",
      confidence: 0.7,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 1",
      evidence: "Two milestones slipped by two weeks due to a procurement delay on the client side.",
    },
    {
      field_key: "people_rating",
      value: "Green",
      confidence: 0.88,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 2",
      evidence: "Team is fully staffed with no attrition this quarter.",
    },
    {
      field_key: "people_description",
      value: "Team fully staffed with no attrition this quarter.",
      confidence: 0.8,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 2",
      evidence: "Team is fully staffed with no attrition this quarter.",
    },
    {
      field_key: "operational_rating",
      value: "Green",
      confidence: 0.65,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 2",
      evidence: "PO, invoicing, and timesheet compliance are all current.",
    },
    {
      field_key: "operational_description",
      value: "PO, invoicing, and timesheet compliance are all current.",
      confidence: 0.6,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 2",
      evidence: "PO, invoicing, and timesheet compliance are all current.",
    },
    {
      field_key: "customer_rating",
      value: "Amber",
      confidence: 0.55,
      source_document: "Steering_Committee_Minutes.pdf",
      source_location: "Page 1",
      evidence: "Customer raised concerns about response time in the last steering committee.",
    },
    {
      field_key: "customer_description",
      value: "Customer raised concerns about response time in the last steering committee.",
      confidence: 0.55,
      source_document: "Steering_Committee_Minutes.pdf",
      source_location: "Page 1",
      evidence: "Customer raised concerns about response time in the last steering committee.",
    },
    {
      field_key: "financial_rating",
      value: "Green",
      confidence: 0.7,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 3",
      evidence: "Margin is tracking to forecast this period.",
    },
    {
      field_key: "financial_description",
      value: "Margin tracking to forecast.",
      confidence: 0.65,
      source_document: "Weekly_Status_Report.pdf",
      source_location: "Page 3",
      evidence: "Margin is tracking to forecast this period.",
    },
    {
      field_key: "compliance_rating",
      value: "Red",
      confidence: 0.9,
      source_document: "Risk_Register.xlsx",
      source_location: "Sheet1!C12",
      evidence: "Security audit flagged an open vendor access review item, unresolved past due date.",
    },
    {
      field_key: "compliance_description",
      value: "Security audit flagged an open vendor access review item.",
      confidence: 0.85,
      source_document: "Risk_Register.xlsx",
      source_location: "Sheet1!C12",
      evidence: "Security audit flagged an open vendor access review item, unresolved past due date.",
    },
  ],
};

export function buildLocalTestAiSuggestions(screen: string): AiSuggestion[] {
  const now = new Date().toISOString();
  const rows = LOCAL_TEST_FIELDS[screen] ?? [];
  return rows.map((row, i) => ({
    ...row,
    id: `local-test-${screen}-${i}`,
    project_id: "local-test",
    screen,
    period_id: "local-test",
    status: "pending" as const,
    created_at: now,
  }));
}
