"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
  type AppNotification,
} from "@/lib/api/notifications";
import { cn, timeAgo } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { data: count } = useUnreadCount();
  // The bell popup is an unread-only view — once "Mark all read" (or a row
  // click) clears them, the list empties to the "all caught up" state. The
  // full read + unread history lives on the /notifications page.
  const { data: page } = useNotifications({ unreadOnly: true, limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = count?.unread ?? 0;
  const items = page?.items ?? [];

  const onRowClick = (n: AppNotification) => {
    if (n.read_at === null) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#1a6fc4] px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-bold text-slate-800">Notifications</span>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            className="text-xs font-semibold text-[#1a6fc4] hover:underline disabled:text-slate-400 disabled:no-underline"
          >
            Mark all read
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onRowClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50",
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
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>
                      ) : null}
                      <span className="mt-1 block text-[11px] font-medium text-slate-400">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-2.5 text-right">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-[#1a6fc4] hover:underline"
          >
            See all &rarr;
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
