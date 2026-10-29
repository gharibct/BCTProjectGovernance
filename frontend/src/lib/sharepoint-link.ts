// Contract Documents link rule — client-side mirror of
// backend/app/services/sharepoint_link.py (the server stays authoritative; this
// only gives the drawer an instant inline error). The link must be the folder's
// browser address-bar URL in the BCT_Finance SharePoint site, and the folder name
// must contain the Oracle Project ID the link belongs to.

export const SHAREPOINT_HOST = "bahwancybertek.sharepoint.com";
export const SHAREPOINT_SITE = "BCT_Finance";

const SHARE_LINK = /^\/:[a-z]:\//i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// oracleId appears in folder as a whole token, so "1234" does not match "12345".
function containsToken(folder: string, oracleId: string): boolean {
  const id = oracleId.trim();
  if (!id) return false;
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(id)}(?![A-Za-z0-9])`, "i").test(folder);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Error message for an unacceptable Contract Documents link, or null when valid. */
export function validateContractUrl(raw: string, oracleId: string): string | null {
  const value = raw.trim();
  if (!value) return "Contract Documents link is required.";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `Link must be a ${SHAREPOINT_HOST} SharePoint URL.`;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== SHAREPOINT_HOST) {
    return `Link must be a ${SHAREPOINT_HOST} SharePoint URL.`;
  }
  if (SHARE_LINK.test(url.pathname)) {
    return "Share links are not accepted. Open the folder in SharePoint and copy the URL from the browser address bar.";
  }

  // A library view page (…/Forms/AllItems.aspx) carries the folder in ?id=.
  const path = url.pathname.toLowerCase().endsWith(".aspx")
    ? url.searchParams.get("id")
    : safeDecode(url.pathname);
  if (!path) return "Select the Oracle project's own folder, not the parent document library.";
  if (!path.toLowerCase().startsWith(`/sites/${SHAREPOINT_SITE}/`.toLowerCase())) {
    return `Link must point to a folder in the ${SHAREPOINT_SITE} SharePoint site.`;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 4) return "Select the Oracle project's own folder, not the parent document library.";

  const folder = segments[segments.length - 1];
  if (!containsToken(folder, oracleId)) {
    return `Folder name "${folder}" must contain the Oracle Project ID ${oracleId.trim()}.`;
  }
  return null;
}
