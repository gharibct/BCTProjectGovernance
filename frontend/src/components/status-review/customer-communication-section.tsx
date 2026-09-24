"use client";

import { Presentation } from "lucide-react";

import { usePageBanner } from "@/stores/page-banner";
import { formatDayMonYear } from "@/lib/format-date";
import { downloadCustomerReportFile, type ProjectStatusReport } from "@/lib/api/project-status";

// Read-only "Customer Communication" section for a period's Project Delivery
// Status — whether (and when) the status report was shared with the customer,
// captured on Project Status. Shows "18-Sep-2026 | Weekly_Status.pptx | View"
// when shared, otherwise "Report not shared with Customer".

export function CustomerCommunicationSection({
  projectId,
  report,
}: {
  projectId: string;
  report: ProjectStatusReport | undefined;
}) {
  const showError = usePageBanner((s) => s.showError);
  const shared = report?.customer_report_shared === true;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Presentation className="size-5 text-[#1a6fc4]" />
        Customer Communication
      </h2>

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        {shared && report ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {report.customer_report_date ? (
              <span className="font-semibold text-slate-900">{formatDayMonYear(report.customer_report_date)}</span>
            ) : null}
            {report.customer_report_file_name ? (
              <>
                <span className="text-slate-300">|</span>
                <span>{report.customer_report_file_name}</span>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    downloadCustomerReportFile(projectId, report).catch((err) =>
                      showError(err instanceof Error ? err.message : "Failed to open the file.")
                    )
                  }
                  className="font-semibold text-[#1a6fc4] hover:underline"
                >
                  View
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <span className="text-slate-500">Report not shared with Customer</span>
        )}
      </div>
    </section>
  );
}
