"""Report writers for deal-radar-storage v2.8.2."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List


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
DECISION_ORDER = ["BUY_CANDIDATE", "NEGOTIATE_ONLY", "WATCH_ONLY", "NEED_MORE_INFO", "REJECT"]


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


def decision_counts(results: Iterable[Dict[str, Any]]) -> Counter:
    return Counter(str(item.get("decision") or "NEED_MORE_INFO") for item in results)


def reject_reason(item: Dict[str, Any]) -> str:
    return item.get("reject_reasons") or item.get("price_comment") or "分數低於 40 或命中高風險規則"


def title_for(item: Dict[str, Any]) -> str:
    return str(item.get("title") or "未知標題")


def append_summary_section(lines: List[str], results: List[Dict[str, Any]], evaluation_stats: Dict[str, int] | None = None) -> None:
    stats = evaluation_stats or {}
    counts = decision_counts(results)
    valid_count = len(results)
    follow_up = [
        item
        for item in sort_results(results)
        if item.get("decision") in {"BUY_CANDIDATE", "NEGOTIATE_ONLY", "NEED_MORE_INFO"}
    ][:3]
    rejected = [item for item in sort_results(results) if item.get("decision") == "REJECT"][:3]

    lines.extend(
        [
            "## 評估摘要",
            "",
            f"- Total rows read: {stats.get('total_rows_read', valid_count)}",
            f"- Empty rows skipped: {stats.get('empty_rows_skipped', 0)}",
            f"- Total valid listings evaluated: {valid_count}",
        ]
    )
    for decision in DECISION_ORDER:
        lines.append(f"- {decision}: {counts.get(decision, 0)}")

    lines.extend(["", "### Top 3 listings to follow up", ""])
    if not follow_up:
        lines.append("- 暫時沒有建議跟進的 listing。")
    for item in follow_up:
        lines.append(
            f"- {title_for(item)}｜{item.get('decision')}｜分數 {item.get('score')}｜下一步: {item.get('next_action', '')}"
        )

    lines.extend(["", "### Top 3 rejected listings with reasons", ""])
    if not rejected:
        lines.append("- 暫時沒有 REJECT listing。")
    for item in rejected:
        lines.append(f"- {title_for(item)}｜分數 {item.get('score')}｜原因: {reject_reason(item)}")
    lines.append("")


def write_today_markdown(
    results: Iterable[Dict],
    path: Path | None = None,
    evaluation_stats: Dict[str, int] | None = None,
) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "today.md"
    sorted_results = sort_results(results)

    lines = [
        "# 今日儲存裝置候選清單",
        "",
        "> v2.8.2 rule-based report。此工具只協助整理、SMART 初步檢查、用途適配、購買決策、建議價區間、賣家提問與證據清單，不會自動購買、不會登入平台、不會繞過安全限制。",
        "",
    ]
    append_summary_section(lines, sorted_results, evaluation_stats)

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
            exact_reject_reason = reject_reason(item)
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
        "missing_fields",
        *SMART_FIELDS,
        "url",
    ]

    with output_path.open("w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for item in sort_results(results):
            writer.writerow({key: item.get(key, "") for key in fieldnames})


def write_real_trial_summary(
    results: Iterable[Dict],
    path: Path | None = None,
    evaluation_stats: Dict[str, int] | None = None,
) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "real_trial_summary.md"
    result_list = sort_results(results)
    stats = evaluation_stats or {}
    counts = decision_counts(result_list)
    follow_up = [
        item
        for item in result_list
        if item.get("decision") in {"BUY_CANDIDATE", "NEGOTIATE_ONLY"}
    ][:5]
    need_more = [item for item in result_list if item.get("decision") == "NEED_MORE_INFO"]
    rejected = [item for item in result_list if item.get("decision") == "REJECT"]

    lines = [
        "# Real Trial Summary — 實購試行摘要",
        "",
        "> v2.8.2。此摘要用於清理 `data/discovered_listings.csv` 實購 trial 評估結果；空白 placeholder rows 會被跳過。",
        "",
        "## Overview",
        "",
        f"- Total rows read: {stats.get('total_rows_read', len(result_list))}",
        f"- Empty rows skipped: {stats.get('empty_rows_skipped', 0)}",
        f"- Valid listings evaluated: {len(result_list)}",
    ]
    for decision in DECISION_ORDER:
        lines.append(f"- {decision}: {counts.get(decision, 0)}")

    lines.extend(["", "## Top follow-up candidates", ""])
    if not follow_up:
        lines.append("- 暫時沒有 BUY_CANDIDATE / NEGOTIATE_ONLY。")
    for item in follow_up:
        lines.append(
            f"- {title_for(item)}｜{item.get('decision')}｜分數 {item.get('score')}｜建議價 {format_price_range(item)}｜下一步: {item.get('next_action', '')}"
        )

    lines.extend(["", "## Listings that need more information", ""])
    if not need_more:
        lines.append("- 暫時沒有 NEED_MORE_INFO。")
    for item in need_more[:10]:
        lines.append(
            f"- {title_for(item)}｜缺資料: {item.get('missing_fields', '') or '請看 reasons'}｜下一步: {item.get('next_action', '')}｜URL: {item.get('url', '')}"
        )

    lines.extend(["", "## Listings rejected", ""])
    if not rejected:
        lines.append("- 暫時沒有 REJECT。")
    for item in rejected[:10]:
        lines.append(f"- {title_for(item)}｜原因: {reject_reason(item)}｜URL: {item.get('url', '')}")

    lines.extend(
        [
            "",
            "## Suggested next manual actions",
            "",
            "1. 先處理 BUY_CANDIDATE / NEGOTIATE_ONLY：向賣家索取完整 SMART、實物照片與退換條款。",
            "2. 對 NEED_MORE_INFO：補 title、price、description、SMART 欄位後重新執行 evaluate。",
            "3. 對 REJECT：除非賣家能提供證據推翻 hard reject，否則不要花時間追問。",
            "4. 若 `Empty rows skipped` 很高，整理 `data/discovered_listings.csv`，刪除未使用 placeholder rows。",
            "5. 購買前仍要人工檢查賣家信譽、實物照片、SMART 截圖與退換條款。",
            "",
            "## Safety note",
            "",
            "本工具不會自動購買、不會驗證賣家誠信、不會登入平台、不會繞過平台安全限制。SMART 資料只作參考，不等於硬碟健康保證。",
        ]
    )
    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_avoid_patterns_report(path: Path | None = None) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "avoid_patterns.md"
    lines = [
        "# Avoid Patterns — 搜尋避雷詞與更好搜尋詞",
        "",
        "> v2.9 Real Market Screening Rules。此報告用於下一輪手動搜尋；不會抓取平台內容、不會登入、不會自動購買。",
        "",
        "## Bad search terms that produce too many weak listings",
        "",
        "- 2T 固态",
        "- 2TB 固态",
        "- 2T M.2",
        "- 便宜 2T SSD",
        "",
        "這些廣泛搜尋詞容易混入 SATA、mSATA、NGFF SATA、白牌、QVO / QLC、假 Samsung 或資料不完整 listing。",
        "",
        "## Better search terms",
        "",
        "- SN730 2TB",
        "- SN740 2TB",
        "- PM9A1 2TB 健康",
        "- Micron 3400 2TB",
        "- KC3000 2TB",
        "- SN770 2TB",
        "- 970 EVO Plus 2TB",
        "- 980 PRO 2TB",
        "- P5 Plus 2TB",
        "",
        "## Instant-skip keywords",
        "",
        "- SATA",
        "- mSATA",
        "- NGFF SATA",
        "- QVO",
        "- 不保品牌",
        "- 只保正常使用",
        "- 图吧",
        "- 打包",
        "- 假三星",
        "- 白牌",
        "- 杂牌",
    ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_search_strategy_report(path: Path | None = None) -> None:
    reports_dir = ensure_reports_dir(path.parent if path else None)
    output_path = path or reports_dir / "search_strategy.md"
    lines = [
        "# Search Strategy — 下一輪實購搜尋策略",
        "",
        "## Current target",
        "",
        "目標是尋找一隻 **2TB NVMe TLC SSD**，用作 external Mac work drive，之後配合 RTL9210B / ASM2362 硬碟盒。優先次序是：資料安全／可靠性 > 合理價格 > 速度。",
        "",
        "## Search round rule",
        "",
        "- 每一輪只挑 3–5 個候選，不要一次收集太多。",
        "- 不要再用 `2T 固态`、`2TB 固态`、`便宜 2T SSD` 這類廣泛詞。",
        "- 優先搜尋已知 NVMe TLC 型號，例如 SN730、SN740、PM9A1、Micron 3400、KC3000、SN770、970 EVO Plus、980 PRO、P5 Plus。",
        "- 看到 SATA / mSATA / NGFF SATA / QVO / 不保品牌 / 图吧 / 打包 / 白牌 / 杂牌，先跳過。",
        "",
        "## Manual workflow",
        "",
        "1. 從 `reports/discovery_urls.md` 打開搜尋 URL。",
        "2. 每輪只挑 3–5 個看起來有潛力的 listing。",
        "3. 把 title、price、url、description、notes、intended_use 填入 `data/discovered_listings.csv`。",
        "4. 向賣家索取 SMART / CrystalDiskInfo 完整截圖，再補 health_percent、power_on_hours、host_writes_tb、critical_warning、media_integrity_errors、supports_return。",
        "5. 執行 `python3 src/cli.py evaluate --input data/discovered_listings.csv`。",
        "6. 先看 `reports/real_trial_summary.md`，再看 `reports/today.md` 與 `reports/rejects.md`。",
        "",
        "## Seller evidence before payment",
        "",
        "- CrystalDiskInfo 完整截圖，不只健康度一角。",
        "- Critical Warning = 0。",
        "- Media/Data Integrity Errors = 0。",
        "- Health / Percentage Used、Power On Hours、Total Host Writes。",
        "- 實物照片、標籤、容量、型號一致。",
        "- 支援到手測試與退換條款。",
        "",
        "## Safety reminder",
        "",
        "本工具不會自動購買、不會自動聯絡賣家、不會登入平台、不會繞過平台安全。最後付款前仍需人工判斷賣家信譽、退換條款與資料風險。",
    ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_all_candidate_reports(
    results: Iterable[Dict],
    output_dir: Path | None = None,
    evaluation_stats: Dict[str, int] | None = None,
) -> None:
    reports_dir = ensure_reports_dir(output_dir)
    result_list = list(results)
    write_today_markdown(result_list, reports_dir / "today.md", evaluation_stats=evaluation_stats)
    write_today_csv(result_list, reports_dir / "today.csv")
    write_rejects_markdown(result_list, reports_dir / "rejects.md")
    write_real_trial_summary(result_list, reports_dir / "real_trial_summary.md", evaluation_stats=evaluation_stats)
    write_avoid_patterns_report(reports_dir / "avoid_patterns.md")
    write_search_strategy_report(reports_dir / "search_strategy.md")
