"""Unit tests for app.services.sharepoint_link.validate_contract_url — the
Contract Documents link rule (BCT_Finance SharePoint folder whose name carries
the Oracle Project ID the link belongs to)."""

import pytest

from app.services.sharepoint_link import validate_contract_url

BASE = "https://bahwancybertek.sharepoint.com/sites/BCT_Finance"
VIEW = f"{BASE}/Shared%20Documents/Forms/AllItems.aspx"

# The parent library link as shared by Finance (no ?id= -> library root).
PARENT = (
    f"{VIEW}?viewid=7b7f7db8%2D5f48%2D4f4d%2Dac89%2D10feada04b81&p=true&nav=&sharingS3=true"
    "&fromShare=true&CID=655b45ef%2D54c6%2D4047%2Da152%2D981b08d97579"
)


@pytest.mark.parametrize(
    "url",
    [
        # Address bar after opening the folder in the library view.
        f"{VIEW}?id=%2Fsites%2FBCT%5FFinance%2FShared%20Documents%2FProjects%2FORA%2D101%20Acme&viewid=7b7f",
        # Direct folder path.
        f"{BASE}/Shared%20Documents/Projects/ORA-101%20Acme",
        # Case-insensitive host / site / ID.
        "https://BahwanCybertek.sharepoint.com/sites/bct_finance/Shared%20Documents/ora-101_Acme",
    ],
)
def test_valid_folder_links(url):
    assert validate_contract_url(url, "ORA-101") is None


def test_folder_must_carry_this_oracle_id():
    url = f"{BASE}/Shared%20Documents/Projects/ORA-202%20Acme"
    assert validate_contract_url(url, "ORA-202") is None
    error = validate_contract_url(url, "ORA-101")
    assert error is not None and "ORA-101" in error


@pytest.mark.parametrize(
    ("url", "fragment"),
    [
        (None, "required"),
        ("  ", "required"),
        (PARENT, "own folder"),
        (f"{BASE}/Shared%20Documents", "own folder"),
        ("http://bahwancybertek.sharepoint.com/sites/BCT_Finance/Shared%20Documents/ORA-101", "SharePoint URL"),
        ("https://example.com/sites/BCT_Finance/Shared%20Documents/ORA-101", "SharePoint URL"),
        ("https://bahwancybertek.sharepoint.com/:f:/s/BCT_Finance/EaB3xKabc", "Share links"),
        ("https://bahwancybertek.sharepoint.com/sites/HR/Shared%20Documents/ORA-101", "BCT_Finance"),
        (f"{BASE}/Shared%20Documents/Projects/Acme", "must contain"),
        # Partial-token match is not a match.
        (f"{BASE}/Shared%20Documents/Projects/ORA-1012%20Acme", "must contain"),
    ],
)
def test_rejected_links(url, fragment):
    error = validate_contract_url(url, "ORA-101")
    assert error is not None and fragment in error
