"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { PaginationBar } from "@/components/forms/pagination-bar";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
  type AppNotification,
} from "@/lib/api/notifications";
import { cn, timeAgo } from "@/lib/utils";

const PAGE_SIZE = 20;

export function NotificationsView() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [skip, setSkip] = React.useState(0);

  const { data: count } = useUnreadCount();
  const list = useNotifications({ unreadOnly, skip, limit: PAGE_SIZE });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = count?.unread ?? 0;
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const setFilter = (next: boolean) => {
    setUnreadOnly(next);
    setSkip(0);
  };

  const onRowClick = (n: AppNotification) => {
    if (n.read_at === null) markRead.mutate(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={unread === 0 || markAll.isPending}
          className="text-sm font-semibold text-[#1a6fc4] hover:underline disabled:text-slate-400 disabled:no-underline"
        >
          Mark all read
        </button>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-semibold">
        {[
          { label: "All", value: false },
          { label: "Unread", value: true },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={cn(
              "rounded-md px-4 py-1.5",
              unreadOnly === tab.value ? "bg-[#1a6fc4] text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {list.isLoading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            {unreadOnly ? "No unread notifications." : "No notifications yet."}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onRowClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50",
                      n.read_at === null && "bg-blue-50/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.read_at === null ? "bg-[#1a6fc4]" : "bg-transparent"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{n.title}</span>
                      {n.body ? (
                        <span className="mt-0.5 block text-sm text-slate-500">{n.body}</span>
                      ) : null}
                      <span className="mt-1 block text-xs font-medium text-slate-400">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {total > PAGE_SIZE ? (
              <PaginationBar skip={skip} limit={PAGE_SIZE} total={total} onPageChange={setSkip} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
