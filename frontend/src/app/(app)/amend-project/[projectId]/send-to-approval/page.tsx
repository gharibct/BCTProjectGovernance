import type { Metadata } from "next";

import { SendToApprovalView } from "@/components/new-project/send-to-approval/send-to-approval-view";
import { NewProjectHeader } from "@/components/new-project/new-project-header";

export const metadata: Metadata = {
  title: "Amend Project — Send To Approve | Project Governance Tool",
};

export default function AmendProjectSendToApprovePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <NewProjectHeader subheading="Send To Approve" />
      <div className="mt-8">
        <SendToApprovalView mode="amend-approve" />
      </div>
    </div>
  );
}
