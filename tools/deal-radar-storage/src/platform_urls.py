"""Build manual platform search URLs for discovery preparation.

This module only creates URLs for the user to click manually. It does not fetch
or scrape platform pages and it does not use credentials, cookies, or API keys.
"""

from __future__ import annotations

from typing import Dict
from urllib.parse import quote_plus

PLATFORM_URLS = {
    "Goofish / 閒魚": "https://www.goofish.com/search?q={query}",
    "Taobao": "https://s.taobao.com/search?q={query}",
    "JD": "https://search.jd.com/Search?keyword={query}&enc=utf-8",
}


def build_platform_url(platform: str, query: str) -> str:
    template = PLATFORM_URLS.get(platform)
    if not template:
        raise ValueError(f"Unsupported platform: {platform}")
    return template.format(query=quote_plus(query))


def build_platform_urls(query_row: Dict[str, str]) -> Dict[str, str]:
    platform = query_row.get("platform", "")
    query = query_row.get("display_query") or query_row.get("query") or ""
    return {
        "platform": platform,
        "query": query,
        "url": build_platform_url(platform, query),
    }
