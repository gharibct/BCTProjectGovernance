"""Contract Documents link — a SharePoint folder URL captured against each
Oracle project mapped to a governance project (project_oracle_ids.contract_url).

Only the folder's browser address-bar URL is accepted, because it carries the
folder path (either directly, or in the ``id`` query param of a library view
page like ``.../Forms/AllItems.aspx?id=...``). SharePoint "Copy link" / Share
links (``/:f:/s/...``) are opaque tokens with no folder name, so they are
rejected. The folder (last path segment) must contain the Oracle Project ID
the link belongs to. Mirrored client-side in
frontend/src/lib/sharepoint-link.ts.
"""

import re
from urllib.parse import parse_qs, unquote, urlsplit

from app.core.config import settings

# /:f:/ (folder), /:x:/ (Excel), /:w:/, /:u:/ ... — SharePoint sharing links.
_SHARE_LINK = re.compile(r"^/:[a-z]:/", re.IGNORECASE)


def _contains_token(folder: str, oracle_id: str) -> bool:
    """oracle_id appears in folder as a whole token (case-insensitive), so
    "1234" does not match "12345"."""
    oid = oracle_id.strip()
    if not oid:
        return False
    pattern = rf"(?<![A-Za-z0-9]){re.escape(oid)}(?![A-Za-z0-9])"
    return re.search(pattern, folder, re.IGNORECASE) is not None


def documents_folder_path(url: str) -> str | None:
    """The server-relative folder path a SharePoint URL points at, or None."""
    parts = urlsplit(url.strip())
    path = parts.path
    if path.lower().endswith(".aspx"):
        ids = parse_qs(parts.query).get("id")
        return ids[0] if ids else None  # parse_qs already URL-decodes
    return unquote(path)


def validate_contract_url(url: str | None, oracle_id: str) -> str | None:
    """Error message for an unacceptable Contract Documents link, or None when valid."""
    if not url or not url.strip():
        return "Contract Documents link is required."
    parts = urlsplit(url.strip())
    if parts.scheme.lower() != "https" or (parts.hostname or "").lower() != settings.sharepoint_host.lower():
        return f"Link must be a {settings.sharepoint_host} SharePoint URL."
    if _SHARE_LINK.match(parts.path):
        return "Share links are not accepted. Open the folder in SharePoint and copy the URL from the browser address bar."

    path = documents_folder_path(url)
    if path is None:  # a library view page with no ?id= — the library root
        return "Select the Oracle project's own folder, not the parent document library."
    site_prefix = f"/sites/{settings.sharepoint_site}/".lower()
    if not path.lower().startswith(site_prefix):
        return f"Link must point to a folder in the {settings.sharepoint_site} SharePoint site."
    # /sites/<site>/<library>/<folder...> — anything shallower is the library root.
    segments = [s for s in path.split("/") if s]
    if len(segments) < 4:
        return "Select the Oracle project's own folder, not the parent document library."

    folder = segments[-1]
    if not _contains_token(folder, oracle_id):
        return f'Folder name "{folder}" must contain the Oracle Project ID {oracle_id.strip()}.'
    return None
