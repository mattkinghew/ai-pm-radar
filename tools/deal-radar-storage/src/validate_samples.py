"""Validate rule engine behavior with representative real-world-like samples.

This script is intentionally local and beginner-friendly:
- no scraping
- no credentials
- no auto-buying
- no login bypass

Run from the project root:
    python3 src/validate_samples.py
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, List

from rules import SMART_FIELDS, evaluate_item


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_CSV = ROOT / "data" / "sample_real_listings.csv"
REPORT_PATH = ROOT / "reports" / "sample_validation.md"
BASE_FIELDS = ["url", "title", "price", "description", "intended_use"]
EXPECTED_FIELDS = ["expected_decision", "expected_comment"]


def read_samples(path: Path = SAMPLE_CSV) -> List[Dict[str, str]]:
    """Load sample rows and keep only fields used by the rule engine plus expectations."""
    if not path.exists():
        raise FileNotFoundError(f"Sample CSV not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        rows: List[Dict[str, str]] = []
        for row in reader:
            item = {field: row.get(field, "") for field in BASE_FIELDS}
            for field in SMART_FIELDS:
                item[field] = row.get(field, "")
            for field in EXPECTED_FIELDS:
                item[field] = row.get(field, "")
            rows.append(item)
        return rows


def short_text(value: str, limit: int = 120) -> str:
    text = str(value or "").replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def compare_samples(samples: List[Dict[str, str]]) -> List[Dict[str, str]]:
    comparisons: List[Dict[str, str]] = []
    for index, sample in enumerate(samples, start=1):
        result = evaluate_item(sample)
        expected_decision = sample.get("expected_decision", "").strip()
        actual_decision = str(result.get("decision", "")).strip()
        matched = expected_decision == actual_decision
        mismatch_explanation = ""
        if not matched:
            mismatch_explanation = (
                f"預期 {expected_decision or '未填'}，實際 {actual_decision or '未產生'}。"
                f"主要原因：{short_text('；'.join(result.get('reasons', [])), 180)}"
            )

        comparisons.append(
            {
                "row": str(index),
                "title": sample.get("title", "未知標題"),
                "expected_decision": expected_decision,
                "actual_decision": actual_decision,
                "matched": "PASS" if matched else "FAIL",
                "score": str(result.get("score", "")),
                "use_case_fit": str(result.get("use_case_fit", "")),
                "expected_comment": sample.get("expected_comment", ""),
                "actual_price_comment": str(result.get("price_comment", "")),
                "reject_reasons": str(result.get("reject_reasons", "")),
                "mismatch_explanation": mismatch_explanation,
            }
        )
    return comparisons


def markdown_escape(value: str) -> str:
    return str(value or "").replace("|", "／").replace("\n", " ")


def write_validation_report(comparisons: List[Dict[str, str]], path: Path = REPORT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    total = len(comparisons)
    matched = sum(1 for item in comparisons if item["matched"] == "PASS")
    mismatched = total - matched

    lines = [
        "# v2.4.1 樣本驗證報告",
        "",
        "> 本報告使用 `data/sample_real_listings.csv` 的代表性二手 SSD / HDD / 硬碟盒樣本，檢查 rule engine 的實際 decision 是否符合預期。此流程不會 scraping、不會登入、不會自動購買。",
        "",
        f"- 總樣本數: {total}",
        f"- 符合預期: {matched}",
        f"- 不符合預期: {mismatched}",
        "",
        "## 每列比較",
        "",
        "| Row | 結果 | 標題 | 預期 decision | 實際 decision | 分數 | 用途適配 | 預期註解 | 拒絕原因 |",
        "|---:|---|---|---|---|---:|---|---|---|",
    ]

    for item in comparisons:
        lines.append(
            "| {row} | {matched} | {title} | {expected_decision} | {actual_decision} | {score} | {use_case_fit} | {expected_comment} | {reject_reasons} |".format(
                row=markdown_escape(item["row"]),
                matched=markdown_escape(item["matched"]),
                title=markdown_escape(short_text(item["title"], 60)),
                expected_decision=markdown_escape(item["expected_decision"]),
                actual_decision=markdown_escape(item["actual_decision"]),
                score=markdown_escape(item["score"]),
                use_case_fit=markdown_escape(item["use_case_fit"]),
                expected_comment=markdown_escape(short_text(item["expected_comment"], 90)),
                reject_reasons=markdown_escape(short_text(item["reject_reasons"], 90)),
            )
        )

    lines.extend(["", "## Mismatch explanation", ""])
    failed = [item for item in comparisons if item["matched"] == "FAIL"]
    if not failed:
        lines.append("所有樣本 decision 均符合預期。")
    else:
        for item in failed:
            lines.extend(
                [
                    f"### Row {item['row']}: {item['title']}",
                    "",
                    f"- {item['mismatch_explanation']}",
                    f"- 價格註解: {item['actual_price_comment']}",
                    "",
                ]
            )

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    samples = read_samples()
    comparisons = compare_samples(samples)
    write_validation_report(comparisons)
    matched = sum(1 for item in comparisons if item["matched"] == "PASS")
    print(f"Validated {len(comparisons)} sample(s): {matched} matched, {len(comparisons) - matched} mismatch(es).")
    print(f"Report written to {REPORT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
