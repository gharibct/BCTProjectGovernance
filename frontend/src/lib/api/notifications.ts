import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "./client";

// Per-user in-app notification inbox — backed by
// backend/app/api/v1/endpoints/notifications.py. Every route is scoped to the
// signed-in person on the server, so no recipient id is passed here.
// The unread count polls on a 60s interval (the app does no other polling) so
// the header bell badge stays roughly live without SSE/WebSocket.

export type NotificationType =
  | "REPORT_SUBMITTED"
  | "REPORT_REVIEWED"
  | "REPORT_DEFAULTER"
  | "DE_DECISION"
  | "DE_APPROVAL_QUEUED"
  | "FINDING_RAISED"
  | "FINDING_STATUS"
  | "ACTION_ASSIGNED"
  | "ACTION_STATUS"
  | "ACTION_DUE"
  | "AMENDMENT_INITIATED"
  | "ASSESSMENT_OVERDUE";

export type AppNotification = {
  id: string;
  recipient_id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  actor_id: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
};

const KEY = ["notifications"] as const;
const UNREAD_KEY = ["notifications", "unread-count"] as const;

export function useNotifications(params: { unreadOnly?: boolean; skip?: number; limit?: number } = {}) {
  const { unreadOnly = false, skip = 0, limit = 20 } = params;
  const q = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (unreadOnly) q.set("unread_only", "true");
  return useQuery({
    queryKey: [...KEY, { unreadOnly, skip, limit }] as const,
    queryFn: () => api.get<Page<AppNotification>>(`/notifications?${q.toString()}`),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => api.get<{ unread: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: KEY });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AppNotification>(`/notifications/${id}/read`),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/notifications/read-all"),
    onSuccess: () => invalidate(queryClient),
  });
}
