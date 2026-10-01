// Explanatory text for the Project Profile "Contract Type" field's info
// tooltip. Static (unlike Project Owned, which is served from a backend yaml).
export const CONTRACT_TYPE_INFO_ENTRIES: {
  label: string;
  description: string;
}[] = [
  {
    label: "FPP",
    description: "Fixed cost for agreed scope and deliverables. Typically FP/ FB/ FPP",
  },
  {
    label: "T&M",
    description: "Billing based on actual effort and resource usage",
  },
  {
    label: "Capped T&M",
    description: "Actual effort billing up to an agreed maximum limit",
  },
  {
    label: "Internal",
    description: "Non-billable work performed for internal business needs.",
  },
];

// Explanatory text for the Project Profile "Critical Flag" field's info tooltip.
export const CRITICAL_FLAG_INFO_ENTRIES: { label: string; description: string[] }[] = [
  {
    label: "Critical - Yes Scenarios",
    description: [
      "Pure Play Fixed Price",
      "SLA/ KPI/ Penalty Committments",
      "Customer Side CXO Sponsored Programs",
      "Strategic for BCT",
      "Niche Domain / Technology",
      "New Geo",
      "Multi vendor Model and Stiff Competition",
    ],
  },
];
