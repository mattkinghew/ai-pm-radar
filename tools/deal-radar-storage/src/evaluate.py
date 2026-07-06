"""Evaluate manually maintained listings from data/listings.csv."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List, Tuple

from report import write_all_candidate_reports
from rules import SMART_FIELDS, evaluate_item


ROOT = Path(__file__).resolve().parents[1]
LISTINGS_CSV = ROOT / "data" / "listings.csv"
BASE_FIELDS = ["platform", "url", "title", "price", "description", "notes", "intended_use"]
EMPTY_LISTING_FIELDS = ["title", "price", "url", "description", "notes"]


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def is_discovery_placeholder_note(value: str) -> bool:
    text = normalize_text(value)
    return text.startswith("手動搜尋：") and "來源：" in text


def is_empty_listing_row(row: Dict[str, str]) -> bool:
    """Return True when a CSV row is only a blank placeholder.

    v2.8 discovery creates manual-fill templates. Those rows may contain a
    generated note such as "手動搜尋：...；來源：...". That note is useful for
    discovery, but it is not real listing information and should not become an
    "unknown / REJECT" item in real purchase trial reports.
    """
    row_without_template_note = dict(row)
    if is_discovery_placeholder_note(row_without_template_note.get("notes", "")):
        row_without_template_note["notes"] = ""
    return all(not normalize_text(row_without_template_note.get(field, "")) for field in EMPTY_LISTING_FIELDS)


def is_url_only_row(item: Dict[str, str]) -> bool:
    return (
        bool(normalize_text(item.get("url")))
        and not normalize_text(item.get("title"))
        and not normalize_text(item.get("price"))
        and not normalize_text(item.get("description"))
    )


def read_listings(path: Path = LISTINGS_CSV, return_stats: bool = False):
    stats = {"total_rows_read": 0, "empty_rows_skipped": 0}
    if not path.exists():
        return ([], stats) if return_stats else []

    with path.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        rows = []
        for row in reader:
            stats["total_rows_read"] += 1
            if is_empty_listing_row(row):
                stats["empty_rows_skipped"] += 1
                continue
            item = {field: row.get(field, "") for field in BASE_FIELDS}
            for field in SMART_FIELDS:
                item[field] = row.get(field, "")
            rows.append(item)
    return (rows, stats) if return_stats else rows


def evaluate_listing(item: Dict[str, str]) -> Dict[str, Any]:
    result = evaluate_item(item)

    if is_url_only_row(item) and not result.get("reject_reasons"):
        warning_reasons = [
            "只有 URL，缺少商品標題、價格與描述，暫時只能要求補資料。",
            "請補充 title、price、description 或 SMART 資料後重新評估。",
        ]
        result["decision"] = "NEED_MORE_INFO"
        result["score"] = max(40, int(result.get("score", 0)))
        result["bucket"] = "weak"
        result["missing_fields"] = "title；price；description；SMART 資料"
        result["next_action"] = "先補商品標題、價格、描述與 SMART／退換資料；未補齊前不要付款。"
        result["seller_questions"] = "請提供商品標題、實際價格、商品描述、SMART／CrystalDiskInfo 完整截圖、實物照片與退換條款。"
        result["evidence_required"] = "商品標題、價格、描述、SMART／CrystalDiskInfo 完整截圖、實物照片、退換條款。"
        reasons = list(result.get("reasons", []))
        for reason in warning_reasons:
            if reason not in reasons:
                reasons.append(reason)
        result["reasons"] = reasons
    return result


def evaluate_listings(listings: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    return [evaluate_listing(item) for item in listings]


def main() -> None:
    listings, stats = read_listings(return_stats=True)
    results = evaluate_listings(listings)
    write_all_candidate_reports(results, evaluation_stats=stats)
    print(
        "Evaluated "
        f"{len(results)} listing(s). "
        f"Skipped {stats['empty_rows_skipped']} empty placeholder row(s). "
        "Reports written to reports/."
    )


if __name__ == "__main__":
    main()
