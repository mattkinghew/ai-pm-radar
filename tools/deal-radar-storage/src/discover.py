"""Discovery preparation workflow for deal-radar-storage v2.8.

The workflow starts from requirements YAML and creates:
- human-readable discovery queries
- platform search URLs for manual clicking
- a discovered_listings.csv template for manual confirmation

It does not fetch or scrape platform pages, does not log in, does not buy, and
does not store credentials, cookies, API keys, or account data.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

from platform_urls import build_platform_urls
from search_queries import generate_discovery_queries, summarize_requirements

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"
DATA_DIR = ROOT / "data"
DEFAULT_REQUIREMENT_FILES = [ROOT / "config" / "requirements.ssd.yml"]

DISCOVERY_QUERIES_MD = "discovery_queries.md"
DISCOVERY_URLS_MD = "discovery_urls.md"
DISCOVERED_LISTINGS_CSV = "discovered_listings.csv"

DISCOVERED_LISTING_FIELDS = [
    "platform",
    "title",
    "price",
    "url",
    "description",
    "notes",
    "health_percent",
    "power_on_hours",
    "host_writes_tb",
    "reallocated_sector_count",
    "current_pending_sector",
    "offline_uncorrectable",
    "media_integrity_errors",
    "critical_warning",
    "supports_return",
    "intended_use",
]


def ensure_dirs(output_dir: Path | None = None, data_dir: Path | None = None) -> tuple[Path, Path]:
    reports_dir = output_dir or REPORTS_DIR
    selected_data_dir = data_dir or DATA_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)
    selected_data_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir, selected_data_dir


def write_discovery_queries(query_rows: Sequence[Dict[str, str]], output_dir: Path) -> Path:
    path = output_dir / DISCOVERY_QUERIES_MD
    lines = [
        "# Discovery Queries — 人工搜尋關鍵字",
        "",
        "> v2.8 discovery preparation mode。此檔只產生人工搜尋關鍵字；不登入、不抓取平台內容、不自動購買。",
        "",
        "## Queries",
        "",
    ]
    if not query_rows:
        lines.append("未生成 query。請檢查 requirements YAML 是否存在 preferred_models、capacity 或 keywords。")
    for row in query_rows:
        lines.append(f"- `{row['display_query']}` — {row['platform']}（來源: `{Path(row['requirement_file']).name}`）")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_discovery_urls(query_rows: Sequence[Dict[str, str]], output_dir: Path) -> Path:
    path = output_dir / DISCOVERY_URLS_MD
    lines = [
        "# Discovery URLs — 人工平台搜尋連結",
        "",
        "> 以下連結只供手動打開搜尋。工具不會 fetch、不會 scrape、不會登入、不會保存 cookies 或帳戶資料。",
        "",
        "| Platform | Query | URL |",
        "|---|---|---|",
    ]
    if not query_rows:
        lines.append("| - | 未生成 query | - |")
    for row in query_rows:
        url_row = build_platform_urls(row)
        query = url_row["query"].replace("|", "／")
        lines.append(f"| {url_row['platform']} | `{query}` | {url_row['url']} |")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_discovered_listings_template(query_rows: Sequence[Dict[str, str]], data_dir: Path) -> Path:
    path = data_dir / DISCOVERED_LISTINGS_CSV
    with path.open("w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=DISCOVERED_LISTING_FIELDS)
        writer.writeheader()
        for row in query_rows:
            writer.writerow(
                {
                    "platform": row.get("platform", ""),
                    "title": "",
                    "price": "",
                    "url": "",
                    "description": "",
                    "notes": f"手動搜尋：{row.get('display_query', '')}；來源：{Path(row.get('requirement_file', '')).name}",
                    "health_percent": "",
                    "power_on_hours": "",
                    "host_writes_tb": "",
                    "reallocated_sector_count": "",
                    "current_pending_sector": "",
                    "offline_uncorrectable": "",
                    "media_integrity_errors": "",
                    "critical_warning": "",
                    "supports_return": "",
                    "intended_use": "",
                }
            )
    return path


def write_discovery_summary(requirement_files: Sequence[Path], output_dir: Path) -> None:
    path = output_dir / "discovery_summary.md"
    profiles = summarize_requirements(requirement_files)
    lines = [
        "# Discovery Summary — 搜尋準備摘要",
        "",
        "本檔整理 requirements YAML 的目標、預算、優先型號與拒絕關鍵字，方便人工搜尋前快速確認。",
        "",
    ]
    for profile in profiles:
        lines.extend(
            [
                f"## {Path(profile['path']).name}",
                "",
                f"- 類別: {profile['category']}",
                f"- 容量: {profile['capacity']}",
                f"- 介面: {profile['interface']}",
                f"- 預算: {profile['budget']}",
                f"- Preferred models: {', '.join(profile['preferred_models']) or '未指定'}",
                f"- Reject keywords: {', '.join(profile['reject_keywords']) or '請參考 reports/buying_criteria.md / quick_checklist.md'}",
                "",
            ]
        )
    path.write_text("\n".join(lines), encoding="utf-8")


def run_discovery(
    requirement_files: Iterable[Path] | None = None,
    output_dir: Path | None = None,
    data_dir: Path | None = None,
) -> Dict[str, object]:
    reports_dir, selected_data_dir = ensure_dirs(output_dir, data_dir)
    selected_requirements = list(requirement_files or DEFAULT_REQUIREMENT_FILES)
    query_rows = generate_discovery_queries(selected_requirements)
    query_path = write_discovery_queries(query_rows, reports_dir)
    url_path = write_discovery_urls(query_rows, reports_dir)
    template_path = write_discovered_listings_template(query_rows, selected_data_dir)
    write_discovery_summary(selected_requirements, reports_dir)
    return {
        "requirement_files": selected_requirements,
        "query_count": len(query_rows),
        "queries_path": query_path,
        "urls_path": url_path,
        "template_path": template_path,
        "output_dir": reports_dir,
        "data_dir": selected_data_dir,
    }


def print_discovery_summary(summary: Dict[str, object]) -> None:
    print("Discovery preparation completed.")
    print(f"Generated {summary['query_count']} platform query row(s).")
    print(f"Reports written to {summary['output_dir']}:")
    print(f"- {DISCOVERY_QUERIES_MD}")
    print(f"- {DISCOVERY_URLS_MD}")
    print(f"Template written to {summary['template_path']}")
    print("Next step: open the URLs manually, then copy promising listing details into data/discovered_listings.csv or data/listings.csv.")


def main() -> None:
    summary = run_discovery()
    print_discovery_summary(summary)


if __name__ == "__main__":
    main()
