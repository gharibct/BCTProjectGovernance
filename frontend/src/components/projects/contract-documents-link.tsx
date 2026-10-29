import { ExternalLink } from "lucide-react";

// An Oracle project's SharePoint contract documents folder, opened in a new tab. Access is
// SharePoint's call: users without folder permission get its request-access page.
export function ContractDocumentsLink({
  url,
  label = "Contract Documents",
  iconOnly = false,
}: {
  url: string | null | undefined;
  label?: string;
  iconOnly?: boolean;
}) {
  if (!url) return <span className="text-slate-400">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens in SharePoint — requires folder access"
      aria-label={iconOnly ? label : undefined}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 font-medium text-[#1a6fc4] hover:underline"
    >
      <ExternalLink className="size-4 shrink-0" />
      {iconOnly ? null : label}
    </a>
  );
}
