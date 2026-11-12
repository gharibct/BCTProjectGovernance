import type { Metadata } from "next";

import { DeBulkCopy } from "@/components/de-bulk-copy/de-bulk-copy";

export const metadata: Metadata = {
  title: "Bulk Copy Assessments | Governance One",
};

export default function DeBulkCopyPage() {
  return <DeBulkCopy />;
}
