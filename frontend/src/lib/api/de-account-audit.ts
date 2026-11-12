import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "./client";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_STATUS_OPTIONS,
  type DEAssessmentStatus,
  type FindingCategory,
  type FindingClassification,
  type FindingHistoryEntry,
  type FindingStatus,
} from "./de-assessment";
import type { HealthRating } from "./projects";

export { FINDING_CATEGORY_OPTIONS, FINDING_CLASSIFICATION_OPTIONS, FINDING_STATUS_OPTIONS };
export type { FindingCategory, FindingClassification, FindingHistoryEntry, FindingStatus };

// DE Account Audit — the account-level counterpart of DE Assessment + DE
// Findings (backend: endpoints/de_account_audit.py, account_findings.py).
// Independent of the project-level assessment and of reporting periods: an
// account with a DE allocated is audited at least once per calendar month.

export const HEALTH_OPTIONS: HealthRating[] = ["Green", "Amber", "Potential Red", "Red"];

// --- Queue ------------------------------------------------------------------

export type AccountAuditStatus = "Due" | "Draft" | "Audited";

export type DeAccountQueueRow = {
  account_id: string;
  account_name: string;
  geo_name: string | null;
  region_name: string | null;
  critical_flag: string;
  account_head_name: string | null;
  delivery_excellence_name: string | null;
  status: AccountAuditStatus;
  de_health: HealthRating | null;
  last_audit_date: string | null;
  open_findings_count: number;
};

export type DeAccountQueue = {
  period_label: string;
  total_count: number;
  audited_count: number;
  due_count: number;
  red_amber_count: number;
  open_findings_count: number;
  rows: DeAccountQueueRow[];
};

export function useDeAccountAuditQueue() {
  return useQuery({
    queryKey: ["de-account-audit-queue"],
    queryFn: () => api.get<DeAccountQueue>("/de-account-audit/queue"),
  });
}

// --- Audits -----------------------------------------------------------------

export type DeAccountAudit = {
  id: string;
  account_id: string;
  audit_date: string | null;
  de_assessed_health: HealthRating;
  remarks: string | null;
  status: DEAssessmentStatus;
  next_audit_due_date: string | null;
  period_id: string | null;
  covered_project_ids: string[];
  audited_by: string | null;
  audited_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type DeAccountAuditPayload = {
  audit_date?: string | null;
  de_assessed_health?: HealthRating;
  remarks?: string | null;
  status?: DEAssessmentStatus;
  next_audit_due_date?: string | null;
  period_id?: string | null;
  covered_project_ids?: string[];
};

export function useDeAccountAudits(accountId: string | null) {
  return useQuery({
    queryKey: ["de-account-audits", accountId],
    queryFn: () => api.get<DeAccountAudit[]>(`/de-account-audit/accounts/${accountId}/audits`),
    enabled: !!accountId,
  });
}

function invalidateAudits(queryClient: ReturnType<typeof useQueryClient>, accountId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["de-account-audits", accountId] });
  queryClient.invalidateQueries({ queryKey: ["de-account-audit-queue"] });
}

export function useCreateDeAccountAudit(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DeAccountAuditPayload & { de_assessed_health: HealthRating }) =>
      api.post<DeAccountAudit>(`/de-account-audit/accounts/${accountId}/audits`, body),
    onSuccess: () => invalidateAudits(queryClient, accountId),
  });
}

export function useUpdateDeAccountAudit(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DeAccountAuditPayload }) =>
      api.patch<DeAccountAudit>(`/de-account-audit/audits/${id}`, payload),
    onSuccess: () => invalidateAudits(queryClient, accountId),
  });
}

// --- Findings ---------------------------------------------------------------

export type AccountFindingsBucket = "overdue" | "awaiting_closure" | "closed_this_period";

export type AccountFindingsFilter = {
  geoId?: string;
  accountId?: string;
  classification?: string;
  // A FindingStatus value, "Active" (default — not Closed/Cancelled) or "All".
  status?: string;
  search?: string;
  bucket?: AccountFindingsBucket;
};

export type AccountFindingRow = {
  id: string;
  account_id: string;
  sequence_no: number;
  category: string;
  classification: FindingClassification;
  description: string | null;
  action_taken: string | null;
  action_taken_date: string | null;
  finding_date: string | null;
  due_date: string | null;
  status: FindingStatus;
  remarks: string | null;
  closure_date: string | null;
  project_ids: string[];
  created_at: string;
  updated_at: string;
  overdue: boolean;
  account_name: string | null;
  geo_name: string | null;
  region_name: string | null;
  age_days: number | null;
  project_codes: string[];
};

export type AccountFindingsKpis = {
  open_findings: number;
  overdue: number;
  awaiting_closure: number;
  closed_this_period: number;
  period_label: string | null;
};

export type DeAccountFindingCreatePayload = {
  account_id: string;
  category: FindingCategory;
  classification: FindingClassification;
  description?: string | null;
  finding_date: string;
  due_date: string;
  project_ids?: string[]; // optional
};

export type DeAccountFindingUpdatePayload = {
  status?: FindingStatus;
  closure_date?: string;
  remarks?: string;
};

function buildParams(p: AccountFindingsFilter & { skip?: number; limit?: number }): string {
  const q = new URLSearchParams();
  if (p.geoId) q.set("geo_id", p.geoId);
  if (p.accountId) q.set("account_id", p.accountId);
  if (p.classification) q.set("classification", p.classification);
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  if (p.bucket) q.set("bucket", p.bucket);
  if (p.skip !== undefined) q.set("skip", String(p.skip));
  if (p.limit !== undefined) q.set("limit", String(p.limit));
  return q.toString();
}

// DE side ---------------------------------------------------------------------

export function useDeAccountFindings(params: AccountFindingsFilter & { skip: number; limit: number }) {
  return useQuery({
    queryKey: ["de-account-findings", params],
    queryFn: () => api.get<Page<AccountFindingRow>>(`/de-account-audit/findings?${buildParams(params)}`),
  });
}

export function useDeAccountFindingsKpis(params: Pick<AccountFindingsFilter, "accountId"> = {}) {
  return useQuery({
    queryKey: ["de-account-findings-kpis", params],
    queryFn: () => api.get<AccountFindingsKpis>(`/de-account-audit/findings/kpis?${buildParams(params)}`),
  });
}

function invalidateFindings(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["de-account-findings"] });
  queryClient.invalidateQueries({ queryKey: ["de-account-findings-kpis"] });
  queryClient.invalidateQueries({ queryKey: ["account-findings"] });
  queryClient.invalidateQueries({ queryKey: ["account-findings-kpis"] });
  queryClient.invalidateQueries({ queryKey: ["account-finding-history"] });
  queryClient.invalidateQueries({ queryKey: ["de-account-audit-queue"] });
}

export function useCreateDeAccountFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DeAccountFindingCreatePayload) =>
      api.post<AccountFindingRow>("/de-account-audit/findings", body),
    onSuccess: () => invalidateFindings(queryClient),
  });
}

export function useUpdateDeAccountFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DeAccountFindingUpdatePayload }) =>
      api.put<AccountFindingRow>(`/de-account-audit/findings/${id}`, payload),
    onSuccess: () => invalidateFindings(queryClient),
  });
}

export function useAccountFindingHistory(findingId: string | null, scope: "de" | "owner") {
  const base = scope === "de" ? "/de-account-audit/findings" : "/account-findings";
  return useQuery({
    queryKey: ["account-finding-history", scope, findingId],
    queryFn: () => api.get<FindingHistoryEntry[]>(`${base}/${findingId}/history`),
    enabled: !!findingId,
  });
}

// Account owner (Delivery Manager) side ---------------------------------------

export function useAccountFindings(params: AccountFindingsFilter & { skip: number; limit: number }) {
  return useQuery({
    queryKey: ["account-findings", params],
    queryFn: () => api.get<Page<AccountFindingRow>>(`/account-findings?${buildParams(params)}`),
  });
}

export function useAccountFindingsKpis() {
  return useQuery({
    queryKey: ["account-findings-kpis"],
    queryFn: () => api.get<AccountFindingsKpis>("/account-findings/kpis"),
  });
}

export function useAccountFindingActionTaken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action_taken,
      action_taken_date,
    }: {
      id: string;
      action_taken: string;
      action_taken_date?: string;
    }) => api.put<AccountFindingRow>(`/account-findings/${id}/action-taken`, { action_taken, action_taken_date }),
    onSuccess: () => invalidateFindings(queryClient),
  });
}
