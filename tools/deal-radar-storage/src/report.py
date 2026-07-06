"""Report writers for deal-radar-storage v2.7."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, Iterable, List


ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"
SMART_FIELDS = [
    "health_percent",
    "power_on_hours",
    "host_writes_tb",
    "reallocated_sector_count",
    "current_pending_sector",
    "offline_uncorrectable",
    "media_integrity_errors",
    "critical_warning",
    "supports_return",
]


def ensure_reports_dir(output_dir: Path | None = None) -> Path:
    reports_dir = output_dir or REPORTS_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def sort_results(results: Iterable[Dict]) -> List[Dict]:
    return sorted(results, key=lambda item: int(item.get("score", 0)), reverse=True)


def format_price_range(item: Dict) -> str:
    min_price = item.get("suggested_price_min", "")
    max_price = item.get("suggested_price_max", "")
    if min_price == "" or max_price == "":
        return "未有建議價"
    return f"{min_price}–{max_price} CNY"


def write_today_markdown(results: Iterable[Dict], path: Path | None = None) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "today.md"
    sorted_results = sort_results(results)

    lines = [
        "# 今日儲存裝置候選清單",
        "",
        "> v2.7 rule-based report。此工具只協助整理、SMART 初步檢查、用途適配、購買決策、建議價區間、賣家提問與證據清單，不會自動購買、不會登入平台、不會繞過安全限制。",
        "",
    ]

    if not sorted_results:
        lines.append("暫時沒有候選項目。")
    else:
        for index, item in enumerate(sorted_results, start=1):
            lines.extend(
                [
                    f"## {index}. {item.get('title', '未知標題')}",
                    "",
                    f"- 分數: {item.get('score')} / 100",
                    f"- 購買決策: {item.get('decision', 'NEED_MORE_INFO')}",
                    f"- 用途: {item.get('intended_use', '') or '未指定'}",
                    f"- 用途適配: {item.get('use_case_fit', '未指定')}",
                    f"- 用途註解: {item.get('use_case_comment', '')}",
                    f"- 分數區間: {item.get('bucket')}",
                    f"- 現有價格: {item.get('price', '未知價格')}",
                    f"- 建議價區間: {format_price_range(item)}",
                    f"- 價格註解: {item.get('price_comment', '')}",
                    f"- 下一步: {item.get('next_action', '')}",
                    f"- 賣家問題: {item.get('seller_questions', '')}",
                    f"- 需要證據: {item.get('evidence_required', '')}",
                    f"- 類別: {item.get('categories', 'unknown')}",
                    f"- 介面: {item.get('interfaces', 'unknown')}",
                    f"- 型號: {item.get('models', 'unknown')}",
                    f"- 風險: {item.get('risks', 'none')}",
                    f"- SMART / 退換摘要: {item.get('smart_summary', '未提供 SMART / 退換資料')}",
                    f"- 連結: {item.get('url', '')}",
                    "- 理由:",
                ]
            )
            for reason in item.get("reasons", []):
                lines.append(f"  - {reason}")
            lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_rejects_markdown(results: Iterable[Dict], path: Path | None = None) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "rejects.md"
    rejects = [item for item in sort_results(results) if item.get("decision") == "REJECT" or int(item.get("score", 0)) < 40]

    lines = ["# 拒絕／高風險清單", ""]
    if not rejects:
        lines.append("暫時沒有 0–39 分的拒絕項目。")
    else:
        for item in rejects:
            exact_reject_reason = item.get("reject_reasons") or "分數低於 40 或命中高風險規則"
            lines.extend(
                [
                    f"## {item.get('title', '未知標題')}",
                    "",
                    f"- 分數: {item.get('score')} / 100",
                    f"- 購買決策: {item.get('decision', 'REJECT')}",
                    f"- 用途: {item.get('intended_use', '') or '未指定'}",
                    f"- 用途適配: {item.get('use_case_fit', '未指定')}",
                    f"- 用途註解: {item.get('use_case_comment', '')}",
                    f"- 精確拒絕原因: {exact_reject_reason}",
                    f"- 建議價區間: {format_price_range(item)}",
                    f"- 價格註解: {item.get('price_comment', '')}",
                    f"- 是否可能救回: {item.get('rescue_comment', '')}",
                    f"- 下一步: {item.get('next_action', '')}",
                    f"- 可補問問題: {item.get('seller_questions', '')}",
                    f"- 需要證據: {item.get('evidence_required', '')}",
                    f"- 風險: {item.get('risks', 'none')}",
                    f"- SMART / 退換摘要: {item.get('smart_summary', '未提供 SMART / 退換資料')}",
                    f"- 連結: {item.get('url', '')}",
                    "- 理由:",
                ]
            )
            for reason in item.get("reasons", []):
                lines.append(f"  - {reason}")
            lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_today_csv(results: Iterable[Dict], path: Path | None = None) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "today.csv"
    fieldnames = [
        "score",
        "bucket",
        "decision",
        "suggested_price_min",
        "suggested_price_max",
        "price_comment",
        "next_action",
        "seller_questions",
        "evidence_required",
        "rescue_comment",
        "intended_use",
        "use_case_fit",
        "use_case_comment",
        "title",
        "price",
        "categories",
        "interfaces",
        "models",
        "risks",
        "smart_summary",
        "reject_reasons",
        *SMART_FIELDS,
        "url",
    ]

    with output_path.open("w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for item in sort_results(results):
            writer.writerow({key: item.get(key, "") for key in fieldnames})


def write_all_candidate_reports(results: Iterable[Dict], output_dir: Path | None = None) -> None:
    reports_dir = ensure_reports_dir(output_dir)
    result_list = list(results)
    write_today_markdown(result_list, reports_dir / "today.md")
    write_today_csv(result_list, reports_dir / "today.csv")
    write_rejects_markdown(result_list, reports_dir / "rejects.md")
