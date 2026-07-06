"""Evaluate link-only candidates from data/links.txt.

The fetch step is deliberately conservative:
- short timeout
- one normal HTTP request per URL
- only reads page title / simple metadata when accessible
- no login, no bypass, no browser automation, no aggressive scraping
"""

from __future__ import annotations

import csv
import re
from html import unescape
from pathlib import Path
from typing import Dict, List
from urllib.error import URLError
from urllib.request import Request, urlopen

from report import write_all_candidate_reports
from rules import SMART_FIELDS, evaluate_item


ROOT = Path(__file__).resolve().parents[1]
LINKS_TXT = ROOT / "data" / "links.txt"
LISTINGS_CSV = ROOT / "data" / "listings.csv"

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
DESCRIPTION_RE = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\'][^>]*>',
    re.IGNORECASE | re.DOTALL,
)


def clean_html_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    return unescape(value).strip()


def read_links(path: Path = LINKS_TXT) -> List[str]:
    if not path.exists():
        return []
    links = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            links.append(line)
    return links


def read_manual_listing_map(path: Path = LISTINGS_CSV) -> Dict[str, Dict[str, str]]:
    if not path.exists():
        return {}
    manual: Dict[str, Dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            url = (row.get("url") or "").strip()
            if url:
                manual[url] = {
                    "url": url,
                    "title": row.get("title", ""),
                    "price": row.get("price", ""),
                    "description": row.get("description", ""),
                    "intended_use": row.get("intended_use", ""),
                    **{field: row.get(field, "") for field in SMART_FIELDS},
                }
    return manual


def fetch_safe_metadata(url: str) -> Dict[str, str]:
    request = Request(
        url,
        headers={"User-Agent": "deal-radar-storage/2.7 beginner-friendly metadata checker"},
    )
    try:
        with urlopen(request, timeout=5) as response:
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type.lower():
                return {}
            raw_html = response.read(200_000).decode("utf-8", errors="ignore")
    except (URLError, TimeoutError, ValueError, OSError):
        return {}

    title = ""
    description = ""
    title_match = TITLE_RE.search(raw_html)
    if title_match:
        title = clean_html_text(title_match.group(1))
    description_match = DESCRIPTION_RE.search(raw_html)
    if description_match:
        description = clean_html_text(description_match.group(1))
    return {"title": title, "description": description}


def build_candidates(links_path: Path = LINKS_TXT, manual_csv_path: Path = LISTINGS_CSV) -> List[Dict[str, str]]:
    manual_map = read_manual_listing_map(manual_csv_path)
    candidates = []
    for url in read_links(links_path):
        item = manual_map.get(url, {"url": url, "title": "", "price": "", "description": "", "intended_use": "", **{field: "" for field in SMART_FIELDS}})
        if not item.get("title") and not item.get("description"):
            metadata = fetch_safe_metadata(url)
            item = {**item, **{key: value for key, value in metadata.items() if value}}
        candidates.append(item)
    return candidates


def main() -> None:
    candidates = build_candidates()
    results = [evaluate_item(item) for item in candidates]
    write_all_candidate_reports(results)
    print(f"Evaluated {len(results)} link candidate(s). Reports written to reports/.")


if __name__ == "__main__":
    main()
