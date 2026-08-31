import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Screen-level Action Tracker — design-reference/action-table-design.md,
// design-reference/Action-Tracker.html. Not tied to any one screen/section:
// an action is scoped to a Geo, Account, or Project (level+id) and shows up
// on every screen for that entity, backed by backend/app/api/v1/endpoints/actions.py.

export type ActionLevel = "GEO" | "ACCOUNT" | "PROJECT";
export type ActionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ActionStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";
export type ActionHistoryEventType =
  | "CREATED"
  | "COMMENT"
  | "STATUS_CHANGE"
  | "OWNER_CHANGE"
  | "DUE_DATE_CHANGE"
  | "PRIORITY_CHANGE";

// URL prefix per level — backend/app/api/v1/endpoints/actions.py mounts one
// router per level (/geos/{geo_id}/actions, /accounts/{account_id}/actions,
// /projects/{project_id}/actions), all reading/writing the same table.
export const LEVEL_PATH: Record<ActionLevel, string> = { GEO: "geos", ACCOUNT: "accounts", PROJECT: "projects" };

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export type Action = {
  id: string;
  action_code: string;
  level: ActionLevel;
  level_value: string;
  title: string;
  description: string | null;
  action_by_id: string;
  priority: ActionPriority;
  status: ActionStatus;
  due_date: string;
  raised_by: string;
  raised_at: string;
  completed_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  overdue: boolean;
};

export type ActionHistoryEntry = {
  id: string;
  action_id: string;
  event_type: ActionHistoryEventType;
  comment: string | null;
  old_value: string | null;
  new_value: string | null;
  created_by: string;
  created_at: string;
};

export type ActionCreatePayload = {
  title: string;
  description?: string | null;
  priority: ActionPriority;
  action_by_id?: string | null;
  due_date: string;
};

export type ActionUpdatePayload = Partial<ActionCreatePayload>;

function actionsQueryKey(level: ActionLevel, id: string | null) {
  return ["actions", level, id] as const;
}

function prefix(level: ActionLevel, id: string | null): string {
  return `/${LEVEL_PATH[level]}/${id}/actions`;
}

export function useActions(level: ActionLevel, id: string | null) {
  return useQuery({
    queryKey: actionsQueryKey(level, id),
    queryFn: () => api.get<Action[]>(prefix(level, id)),
    enabled: !!id,
  });
}

export function useActionHistory(level: ActionLevel, id: string | null, actionId: string | null) {
  return useQuery({
    queryKey: [...actionsQueryKey(level, id), actionId, "history"] as const,
    queryFn: () => api.get<ActionHistoryEntry[]>(`${prefix(level, id)}/${actionId}/history`),
    enabled: !!id && !!actionId,
  });
}

export function useCreateAction(level: ActionLevel, id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActionCreatePayload) => api.post<Action>(prefix(level, id), payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: actionsQueryKey(level, id) }),
  });
}

export function useUpdateAction(level: ActionLevel, id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, payload }: { actionId: string; payload: ActionUpdatePayload }) =>
      api.put<Action>(`${prefix(level, id)}/${actionId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: actionsQueryKey(level, id) }),
  });
}

function useTransition(level: ActionLevel, id: string | null, transition: "start" | "complete" | "close" | "cancel") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) => api.patch<Action>(`${prefix(level, id)}/${actionId}/${transition}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: actionsQueryKey(level, id) }),
  });
}

export const useStartAction = (level: ActionLevel, id: string | null) => useTransition(level, id, "start");
export const useCompleteAction = (level: ActionLevel, id: string | null) => useTransition(level, id, "complete");
export const useCloseAction = (level: ActionLevel, id: string | null) => useTransition(level, id, "close");
export const useCancelAction = (level: ActionLevel, id: string | null) => useTransition(level, id, "cancel");

export function useAddActionComment(level: ActionLevel, id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, text }: { actionId: string; text: string }) =>
      api.post<ActionHistoryEntry>(`${prefix(level, id)}/${actionId}/comments`, { text }),
    onSuccess: (_data, { actionId }) => {
      queryClient.invalidateQueries({ queryKey: [...actionsQueryKey(level, id), actionId, "history"] });
    },
  });
}
