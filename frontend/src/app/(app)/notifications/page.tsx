import type { Metadata } from "next";

import { NotificationsView } from "@/components/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications | Governance One",
};

export default function NotificationsPage() {
  return <NotificationsView />;
}
