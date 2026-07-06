"""Quick analyze mode for deal-radar-storage v2.8.

This module provides a hurry-friendly workflow for users who only have links,
requirements, or both. It stays local, rule-based, and safe by default:
- no scraping beyond existing optional conservative metadata behavior
- no auto-buying
- no credentials, login bypass, API keys, or platform security bypass
"""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence

from evaluate_links import LINKS_TXT, LISTINGS_CSV, build_candidates, read_links, read_manual_listing_map
from report import REPORTS_DIR, format_price_range, sort_results
from rules import SMART_FIELDS, evaluate_item
from discover import run_discovery
from search_requirements import (
    REQUIREMENT_FILES,
    SEARCH_TARGETS,
    build_queries,
    load_yaml,
    search_url,
    write_search_report,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REQUIREMENT_FILE = ROOT / "config" / "requirements.ssd.yml"

QUICK_REPORT_MD = "quick_report.md"
QUICK_REPORT_CSV = "quick_report.csv"
QUICK_QUESTIONS_MD = "quick_questions.md"
BUYING_CRITERIA_MD = "buying_criteria.md"
QUICK_CHECKLIST_MD = "quick_checklist.md"

QUICK_CSV_FIELDS = [
    "decision",
    "score",
    "bucket",
    "title",
    "price",
    "suggested_price_min",
    "suggested_price_max",
    "price_comment",
    "intended_use",
    "use_case_fit",
    "use_case_comment",
    "missing_fields",
    "next_action",
    "seller_questions",
    "evidence_required",
    "categories",
    "interfaces",
    "models",
    "risks",
    "smart_summary",
    "reject_reasons",
    "url",
]


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def csv_join(values: Iterable[str]) -> str:
    return "；".join(value for value in values if value)


def markdown_escape(value: Any) -> str:
    return normalize_text(value).replace("|", "／").replace("\n", " ")


def short_text(value: Any, limit: int = 100) -> str:
    text = markdown_escape(value)
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def ensure_output_dir(output_dir: Path | None = None) -> Path:
    reports_dir = output_dir or REPORTS_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def has_manual_metadata(item: Dict[str, Any]) -> bool:
    if normalize_text(item.get("title")) or normalize_text(item.get("description")) or normalize_text(item.get("price")):
        return True
    return any(normalize_text(item.get(field)) for field in SMART_FIELDS)


def infer_missing_fields(item: Dict[str, Any], result: Dict[str, Any], metadata_missing: bool) -> List[str]:
    missing: List[str] = []
    if metadata_missing:
        missing.extend(["title", "price", "description"])
    if normalize_text(result.get("price")) in {"", "未知價格", "unknown"}:
        missing.append("price")
    categories = normalize_text(result.get("categories"))
    if "SSD" in categories:
        for field in ["health_percent", "power_on_hours", "host_writes_tb", "critical_warning", "media_integrity_errors", "supports_return"]:
            if not normalize_text(item.get(field)):
                missing.append(field)
    elif "HDD" in categories:
        for field in ["power_on_hours", "reallocated_sector_count", "current_pending_sector", "offline_uncorrectable", "supports_return"]:
            if not normalize_text(item.get(field)):
                missing.append(field)
    elif "enclosure" in categories:
        missing.extend(["controller_chip", "TRIM", "UASP", "SMART passthrough"])
    else:
        missing.extend(["category", "model", "capacity", "SMART screenshot", "return policy"])

    output: List[str] = []
    seen = set()
    for field in missing:
        if field not in seen:
            seen.add(field)
            output.append(field)
    return output


def build_quick_link_results(links_path: Path = LINKS_TXT) -> List[Dict[str, Any]]:
    manual_map = read_manual_listing_map(LISTINGS_CSV)
    candidates = build_candidates(links_path, LISTINGS_CSV)
    links = read_links(links_path)
    results: List[Dict[str, Any]] = []

    for index, item in enumerate(candidates):
        url = normalize_text(item.get("url"))
        metadata_missing = url not in manual_map and not has_manual_metadata(item)
        result = evaluate_item(item)
        if metadata_missing:
            result["decision"] = "NEED_MORE_INFO"
            result["next_action"] = "先補資料；目前只有連結，未有足夠標題、價格、SMART 或退換資料，未補齊前不要付款。"
            if not result.get("seller_questions"):
                result["seller_questions"] = "請提供商品標題、型號、容量、實際價格、SMART／測試截圖、實物照片與退換條款。"
            if not result.get("evidence_required"):
                result["evidence_required"] = "商品頁資料、實物照片、SMART／測試截圖、退換條款。"
        missing_fields = infer_missing_fields(item, result, metadata_missing)
        result["missing_fields"] = csv_join(missing_fields)
        result["quick_source"] = "manual_metadata" if url in manual_map else "link_only"
        result["row"] = str(index + 1)
        results.append(result)

    # If the links file is missing or empty, keep the report useful instead of failing.
    if not links and not results:
        results.append(
            {
                "row": "1",
                "url": "",
                "title": "未提供連結",
                "price": "未知價格",
                "decision": "NEED_MORE_INFO",
                "score": 0,
                "bucket": "reject",
                "categories": "unknown",
                "interfaces": "unknown",
                "models": "unknown",
                "risks": "none",
                "smart_summary": "未提供 SMART / 退換資料",
                "missing_fields": "links；title；price；description；SMART screenshot；return policy",
                "next_action": "請先在 data/links.txt 貼上一行一個商品連結，或在 data/listings.csv 手動填寫 metadata。",
                "seller_questions": "未有商品連結，暫時不適用。",
                "evidence_required": "商品連結、標題、價格、測試截圖、退換條款。",
                "reject_reasons": "",
                "price_comment": "未有候選資料，不能估價。",
                "suggested_price_min": "",
                "suggested_price_max": "",
                "intended_use": "",
                "use_case_fit": "未指定",
                "use_case_comment": "未提供 intended_use。",
            }
        )
    return results


def safe_requirement_summary(requirement_files: Sequence[Path]) -> Dict[str, Any]:
    loaded = []
    all_models: List[str] = []
    all_capacities: List[str] = []
    all_interfaces: List[str] = []
    all_keywords: List[str] = []
    for path in requirement_files:
        data = load_yaml(path)
        loaded.append({"path": path, "data": data, "queries": build_queries(path, data)})
        all_models.extend(as_list(data.get("preferred_models") or data.get("models") or data.get("model")))
        all_capacities.extend(as_list(data.get("capacities") or data.get("capacity")))
        all_interfaces.extend(as_list(data.get("interfaces") or data.get("interface")))
        all_keywords.extend(as_list(data.get("keywords")))
    return {
        "loaded": loaded,
        "target_product": ", ".join(dedupe(all_keywords or all_models)) or "未指定",
        "budget": "未指定；請以 suggested price bands 與人工比價判斷",
        "priority": "先排除 hard reject，再向賣家索取 SMART / 相容性證據，最後才議價。",
        "preferred_models": dedupe(all_models),
        "capacities": dedupe(all_capacities),
        "interfaces": dedupe(all_interfaces),
        "keywords": dedupe(all_keywords),
    }


def as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [normalize_text(item) for item in value if normalize_text(item)]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return [normalize_text(value)]


def dedupe(values: Iterable[str]) -> List[str]:
    seen = set()
    output: List[str] = []
    for value in values:
        key = value.lower()
        if key not in seen:
            seen.add(key)
            output.append(value)
    return output


def format_count_summary(results: Sequence[Dict[str, Any]]) -> List[str]:
    counter = Counter(normalize_text(item.get("decision")) or "NEED_MORE_INFO" for item in results)
    return [
        f"BUY_CANDIDATE: {counter.get('BUY_CANDIDATE', 0)}",
        f"NEGOTIATE_ONLY: {counter.get('NEGOTIATE_ONLY', 0)}",
        f"WATCH_ONLY: {counter.get('WATCH_ONLY', 0)}",
        f"NEED_MORE_INFO: {counter.get('NEED_MORE_INFO', 0)}",
        f"REJECT: {counter.get('REJECT', 0)}",
    ]


def recommended_next_steps(results: Sequence[Dict[str, Any]], has_requirements: bool) -> List[str]:
    counter = Counter(normalize_text(item.get("decision")) or "NEED_MORE_INFO" for item in results)
    steps: List[str] = []
    if has_requirements:
        steps.append("先打開 `reports/search_urls.md` 擴充候選清單，然後把有興趣的連結貼到 `data/links.txt`。")
    if counter.get("BUY_CANDIDATE", 0):
        steps.append("對 BUY_CANDIDATE 先索取完整 SMART / 實物 / 退換證據，不要直接付款。")
    if counter.get("NEGOTIATE_ONLY", 0):
        steps.append("對 NEGOTIATE_ONLY 用建議價區間與風險原因議價。")
    if counter.get("NEED_MORE_INFO", 0):
        steps.append("對 NEED_MORE_INFO 直接複製 `reports/quick_questions.md` 的訊息向賣家補資料。")
    if counter.get("REJECT", 0):
        steps.append("REJECT 項目通常不要救；除非賣家能提供證據推翻 hard reject。")
    if not steps:
        steps.append("目前沒有可用候選，先補 links 或 requirements。")
    return steps


def write_quick_report(
    results: Sequence[Dict[str, Any]],
    output_dir: Path,
    requirement_summary: Dict[str, Any] | None = None,
) -> None:
    path = output_dir / QUICK_REPORT_MD
    sorted_items = sort_results(results)
    has_requirements = bool(requirement_summary)

    lines = [
        "# Quick Analyze Report — 二手儲存裝置快速分析",
        "",
        "> v2.8 quick mode。此報告只做本地 rule-based 初步篩選；不會 scraping、不會登入、不會自動購買、不會繞過平台安全限制。",
        "",
        "## Summary",
        "",
    ]
    if requirement_summary:
        lines.extend(
            [
                f"- 目標產品: {requirement_summary['target_product']}",
                f"- 預算: {requirement_summary['budget']}",
                f"- 優先次序: {requirement_summary['priority']}",
                "- Discovery prep: 已生成 `reports/discovery_queries.md`、`reports/discovery_urls.md` 與 `data/discovered_listings.csv`，方便手動搜尋及填入候選資料。",
            ]
        )
    else:
        lines.extend(["- 目標產品: 未提供 requirements YAML", "- 預算: 未指定", "- 優先次序: 先補資料，再比較候選。"])
    lines.append(f"- 已分析連結數: {len(results)}")
    for count_line in format_count_summary(results):
        lines.append(f"- {count_line}")
    lines.extend(["", "### 建議下一步", ""])
    for step in recommended_next_steps(results, has_requirements):
        lines.append(f"- {step}")

    lines.extend(["", "## Candidate list", ""])
    candidates = [item for item in sorted_items if item.get("decision") in {"BUY_CANDIDATE", "NEGOTIATE_ONLY", "WATCH_ONLY"}]
    if not candidates:
        lines.append("暫時沒有可直接跟進的候選。")
    for item in candidates:
        append_quick_item(lines, item)

    lines.extend(["", "## Need more info list", ""])
    need_more = [item for item in sorted_items if item.get("decision") == "NEED_MORE_INFO"]
    if not need_more:
        lines.append("暫時沒有 NEED_MORE_INFO 項目。")
    for item in need_more:
        append_quick_item(lines, item)

    lines.extend(["", "## Reject list", ""])
    rejects = [item for item in sorted_items if item.get("decision") == "REJECT"]
    if not rejects:
        lines.append("暫時沒有 REJECT 項目。")
    for item in rejects:
        append_quick_item(lines, item)

    path.write_text("\n".join(lines), encoding="utf-8")


def append_quick_item(lines: List[str], item: Dict[str, Any]) -> None:
    lines.extend(
        [
            f"### {item.get('title', '未知標題')}",
            "",
            f"- Decision: {item.get('decision', 'NEED_MORE_INFO')}",
            f"- Score: {item.get('score', '')} / 100",
            f"- Price: {item.get('price', '未知價格')}",
            f"- Suggested price: {format_price_range(item)}",
            f"- Price comment: {item.get('price_comment', '')}",
            f"- Missing fields: {item.get('missing_fields', '')}",
            f"- Use-case fit: {item.get('use_case_fit', '未指定')}",
            f"- Next action: {item.get('next_action', '')}",
            f"- Seller questions: {item.get('seller_questions', '')}",
            f"- Evidence required: {item.get('evidence_required', '')}",
            f"- Reject reason: {item.get('reject_reasons', '') or '無 hard reject'}",
            f"- URL: {item.get('url', '')}",
            "",
        ]
    )


def write_quick_csv(results: Sequence[Dict[str, Any]], output_dir: Path) -> None:
    path = output_dir / QUICK_REPORT_CSV
    with path.open("w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=QUICK_CSV_FIELDS)
        writer.writeheader()
        for item in sort_results(results):
            writer.writerow({field: item.get(field, "") for field in QUICK_CSV_FIELDS})


def write_quick_questions(output_dir: Path) -> None:
    path = output_dir / QUICK_QUESTIONS_MD
    lines = [
        "# Quick Seller Questions — 可複製賣家訊息",
        "",
        "> 以下訊息用於人工詢問賣家。工具不會自動發訊息、不會登入、不會自動購買。",
        "",
        "## SSD message",
        "",
        "你好，我想確認這隻 SSD 的狀態。可否提供 CrystalDiskInfo 完整截圖？請包含型號、容量、Health / Percentage Used、Power On Hours、Total Host Writes、Critical Warning、Media/Data Integrity Errors。也請確認 Critical Warning = 0、Media/Data Integrity Errors = 0，以及收貨後測試如資料不符是否支持退換。",
        "",
        "## HDD message",
        "",
        "你好，我想確認這隻 HDD 是否正常可用。可否提供 CrystalDiskInfo 或 smartctl -a 完整截圖？請確認 Reallocated Sector Count = 0、Current Pending Sector = 0、Offline Uncorrectable = 0，並提供 Power On Hours。另請確認這是普通 SATA 盤，不是飛牛專用、不是 ZBC、不是 PC3000 改盤、不是屏蔽／改容量盤，並確認 Windows / macOS / USB 硬碟座可正常識別。",
        "",
        "## Enclosure message",
        "",
        "你好，我想確認硬碟盒晶片與功能。請問 controller chip 是 RTL9210B 還是 ASM2362？是否支援 TRIM、UASP、SMART passthrough？可否提供商品頁、晶片資訊或測試截圖作證明？",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def price_band_text() -> List[str]:
    return [
        "PM9A1 2TB：health >=95 可參考 800–950 CNY；health 90–94 只建議 550–700 CNY；health <90 原則上拒絕或只作 <=500 CNY 測試用途。",
        "SN750 2TB：health >=95 且 host_writes_tb <100 可參考 700–850 CNY；health 85–94 或寫入 >200TB 只建議 500–650 CNY。",
        "SN730 / SN740 / Micron 3400 / KC3000 2TB：health >=95 可參考 750–900 CNY；health 90–94 可參考 550–750 CNY。",
        "低端 SATA / QLC 2TB：只建議 300–650 CNY；高於 750 CNY 應拒絕。",
        "未知品牌／白牌 SSD：除非 <=350 CNY 並明確 test_only，否則不建議。",
    ]


def write_buying_criteria(requirement_files: Sequence[Path], output_dir: Path) -> Dict[str, Any]:
    summary = safe_requirement_summary(requirement_files)
    path = output_dir / BUYING_CRITERIA_MD
    lines = [
        "# Buying Criteria — 快速購買準則",
        "",
        "> 本檔由 requirements YAML 生成，目的是幫你更快搜尋與提問；不是自動購買或市場價格保證。",
        "",
        "## Preferred model list",
        "",
    ]
    models = summary["preferred_models"]
    lines.extend([f"- {model}" for model in models] if models else ["- 未指定；請在 requirements YAML 加入 preferred_models。"])
    lines.extend(["", "## Search keywords", ""])
    for loaded in summary["loaded"]:
        lines.append(f"### {loaded['path'].name}")
        for query in loaded["queries"]:
            lines.append(f"- {query}")
        lines.append("")

    lines.extend(["## Buying criteria", ""])
    if summary["capacities"]:
        lines.append("- 容量: " + ", ".join(summary["capacities"]))
    if summary["interfaces"]:
        lines.append("- 介面: " + ", ".join(summary["interfaces"]))
    lines.extend(
        [
            "- 優先選擇已知型號與可提供完整 SMART / 測試截圖的賣家。",
            "- 對 SSD，Critical Warning 與 Media/Data Integrity Errors 必須為 0。",
            "- 對 HDD，Reallocated / Pending / Offline Uncorrectable 必須為 0。",
            "- 沒有退換／測試條款的項目要降權或拒絕。",
            "",
            "## Reject keywords",
            "",
            "- 飛牛、Windows不能用、USB不能用、HBA、PC3000、屏蔽、改容量、ZBC、SED鎖、Linux專用、不支持USB、QLC、白牌、雜牌、不退不換、健康90、通電2萬小時。",
            "",
            "## Suggested price bands",
            "",
        ]
    )
    lines.extend(f"- {line}" for line in price_band_text())
    lines.extend(
        [
            "",
            "## Seller question template",
            "",
            "請提供完整 SMART / 測試截圖、實物照片、型號容量證明、退換條款，以及 Windows / macOS / USB 相容性證明。未補齊前不建議付款。",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")
    return summary


def write_quick_checklist(output_dir: Path) -> None:
    path = output_dir / QUICK_CHECKLIST_MD
    lines = [
        "# Quick Checklist — 購買前後檢查清單",
        "",
        "## Before buying checklist",
        "",
        "- 已確認型號、容量、介面與 intended use 相符。",
        "- 已取得完整 SMART / CrystalDiskInfo / smartctl 截圖。",
        "- 已確認價格不高於建議區間，或有明確議價理由。",
        "- 已確認退換／測試條款。",
        "- 沒有把單一二手硬碟當作唯一備份策略。",
        "",
        "## Seller evidence checklist",
        "",
        "- SSD：Health / Percentage Used、Power On Hours、Total Host Writes、Critical Warning = 0、Media/Data Integrity Errors = 0。",
        "- HDD：Reallocated Sector Count = 0、Current Pending Sector = 0、Offline Uncorrectable = 0、Power On Hours。",
        "- Enclosure：RTL9210B / ASM2362、TRIM、UASP、SMART passthrough。",
        "- 實物照片、商品頁截圖、賣家文字承諾、退換條款。",
        "",
        "## After receiving checklist",
        "",
        "- 第一時間拍攝開箱與外觀。",
        "- 用 CrystalDiskInfo / smartctl 對比賣家截圖。",
        "- 做短時間讀寫測試與溫度觀察。",
        "- 先不要放唯一重要資料；通過測試後才逐步使用。",
        "",
        "## Red flags",
        "",
        "- 拒絕提供完整 SMART 截圖。",
        "- 只截健康度，不給詳細欄位。",
        "- 飛牛專用、ZBC、PC3000 改盤、屏蔽／改容量、Windows / USB / macOS 不能識別。",
        "- 不退不換但價格不夠低。",
        "- 白牌／雜牌／未知品牌卻標高價。",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def run_quick(
    links_path: Path | None = None,
    requirement_files: Sequence[Path] | None = None,
    output_dir: Path | None = None,
) -> Dict[str, Any]:
    reports_dir = ensure_output_dir(output_dir)
    has_links = links_path is not None
    has_requirements = bool(requirement_files)

    if not has_links and not has_requirements:
        default_links_exists = LINKS_TXT.exists()
        default_requirements_exists = DEFAULT_REQUIREMENT_FILE.exists()
        if default_links_exists:
            links_path = LINKS_TXT
            has_links = True
        if default_requirements_exists:
            requirement_files = [DEFAULT_REQUIREMENT_FILE]
            has_requirements = True

    if not has_links and not has_requirements:
        raise FileNotFoundError(
            "沒有提供 --links 或 --requirements，且找不到預設 data/links.txt / config/requirements.ssd.yml。"
            "請使用：python3 src/cli.py quick --links data/links.txt 或 "
            "python3 src/cli.py quick --requirements config/requirements.ssd.yml"
        )

    requirement_summary: Dict[str, Any] | None = None
    if has_requirements and requirement_files is not None:
        selected_requirements = list(requirement_files)
        write_search_report(selected_requirements, reports_dir)
        run_discovery(requirement_files=selected_requirements, output_dir=reports_dir)
        requirement_summary = write_buying_criteria(selected_requirements, reports_dir)
        write_quick_checklist(reports_dir)

    results: List[Dict[str, Any]] = []
    if has_links and links_path is not None:
        results = build_quick_link_results(links_path)
        write_quick_report(results, reports_dir, requirement_summary)
        write_quick_csv(results, reports_dir)
        write_quick_questions(reports_dir)
    else:
        write_quick_questions(reports_dir)
        # Requirements-only mode should still leave a concise pointer report.
        write_quick_report([], reports_dir, requirement_summary)
        write_quick_csv([], reports_dir)

    return {
        "links_path": links_path,
        "requirement_files": list(requirement_files or []),
        "output_dir": reports_dir,
        "results": results,
        "requirement_summary": requirement_summary,
    }


def print_quick_summary(summary: Dict[str, Any]) -> None:
    output_dir = summary["output_dir"]
    results = summary.get("results", [])
    print("Quick analyze completed.")
    if summary.get("links_path"):
        print(f"Links input: {summary['links_path']}")
        print(f"Analyzed {len(results)} link candidate(s).")
    if summary.get("requirement_files"):
        reqs = ", ".join(str(path) for path in summary["requirement_files"])
        print(f"Requirements input: {reqs}")
    print(f"Reports written to {output_dir}:")
    for filename in [QUICK_REPORT_MD, QUICK_REPORT_CSV, QUICK_QUESTIONS_MD, "search_urls.md", "discovery_queries.md", "discovery_urls.md", BUYING_CRITERIA_MD, QUICK_CHECKLIST_MD]:
        path = output_dir / filename
        if path.exists():
            print(f"- {filename}")
