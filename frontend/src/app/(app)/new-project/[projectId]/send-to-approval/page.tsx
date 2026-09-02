import type { Metadata } from "next";

import { SendToApprovalView } from "@/components/new-project/send-to-approval/send-to-approval-view";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "New Project — Send To Approval | Project Governance Tool",
};

export default function NewProjectSendToApprovalPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Send To Approval" />
      <div className="mt-8">
        <SendToApprovalView />
      </div>
    </div>
  );
}
