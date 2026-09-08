import type { Metadata } from "next";

import { NotificationsView } from "@/components/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications | Project Governance Tool",
};

export default function NotificationsPage() {
  return <NotificationsView />;
}
