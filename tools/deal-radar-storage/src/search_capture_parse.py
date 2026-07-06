"""Search result batch capture parser for deal-radar-storage v3.1.

This module parses local text files that the user manually copied from visible
search result pages. It does not scrape, open pages, log in, store credentials,
message sellers, auto-buy, crawl results, or bypass platform security.
"""

from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List


ROOT = Path(__file__).resolve().parents[1]
RAW_SEARCH_DIR = ROOT / "captures" / "raw_search"
SEARCH_PROCESSED_DIR = ROOT / "captures" / "search_processed"
SEARCH_CANDIDATES_CSV = ROOT / "captures" / "search_candidates.csv"
CANDIDATE_QUEUE_MD = ROOT / "reports" / "candidate_queue.md"
PRICE_RELIABILITY_MD = ROOT / "reports" / "price_reliability.md"
SELLER_RISK_MD = ROOT / "reports" / "seller_risk.md"

PREFERRED_MODELS = [
    "SN730",
    "SN740",
    "PM9A1",
    "PM9A1a",
    "Micron 3400",
    "KC3000",
    "SN770",
    "970 EVO Plus",
    "980 PRO",
    "P5 Plus",
    "P31",
    "P41",
    "P44 Pro",
]

AVOID_TERMS = [
    "SATA",
    "mSATA",
    "NGFF SATA",
    "QVO",
    "870 QVO",
    "WD Green",
    "WD Blue SATA",
    "SN350",
    "NV1",
    "SA510",
    "不保品牌",
    "只保正常使用",
    "图吧",
    "图吧工具箱",
    "打包",
    "假三星",
    "白牌",
    "杂牌",
]

OPTION_PRICE_TERMS = [
    "多规格",
    "多規格",
    "选项",
    "選項",
    "价格区间",
    "價格區間",
    "到手价",
    "到手價",
    "低至",
    "起",
    "起售",
    "可选",
    "可選",
    "下单备注",
    "下單備註",
    "详情为准",
    "詳情為準",
    "标价不是实价",
    "標價不是實價",
]

NEGATIVE_SELLER_TERMS = [
    "不退不换",
    "不退不換",
    "售出不退",
    "只保点亮",
    "只保點亮",
    "只保正常使用",
    "不保品牌",
    "无售后",
    "無售後",
    "不议价",
    "不議價",
    "到手刀",
    "爽快的来",
    "爽快就出",
    "打包出",
    "懂的来",
    "懂的來",
]

POSITIVE_SELLER_TERMS = [
    "支持到手测试",
    "支持到手測試",
    "可退",
    "支持退货",
    "支持退貨",
    "有完整SMART",
    "CrystalDiskInfo",
    "CDI截图",
    "CDI截圖",
    "可提供测试",
    "可提供測試",
    "包邮",
    "包郵",
]

FIELDNAMES = [
    "source_file",
    "platform",
    "title",
    "displayed_price",
    "price",
    "url",
    "description",
    "notes",
    "model_guess",
    "capacity_guess",
    "interface_guess",
    "seller_text",
    "seller_risk_level",
    "price_reliability",
    "option_price_risk",
    "skip_reason",
    "follow_up_priority",
    "intended_use",
]


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def markdown_escape(value: Any) -> str:
    return normalize_text(value).replace("|", "／").replace("\n", " ")


def contains_any(text: str, terms: Iterable[str]) -> List[str]:
    lower = text.lower()
    return [term for term in terms if term.lower() in lower]


def read_raw_search_files(input_dir: Path = RAW_SEARCH_DIR) -> List[tuple[Path, str]]:
    if not input_dir.exists():
        return []
    return [(path, path.read_text(encoding="utf-8", errors="replace")) for path in sorted(input_dir.glob("*.txt"))]


def infer_platform(text: str, source_file: str = "") -> str:
    lower = f"{text} {source_file}".lower()
    if "goofish" in lower or "閒魚" in lower or "闲鱼" in lower or "xianyu" in lower:
        return "goofish"
    if "taobao" in lower or "淘寶" in lower or "淘宝" in lower:
        return "taobao"
    if "jd.com" in lower or "京東" in lower or "京东" in lower:
        return "jd"
    return "unknown"


def extract_url(text: str) -> str:
    match = re.search(r"https?://[^\s，,。)）]+", text)
    return match.group(0) if match else ""


def extract_price(text: str) -> tuple[str, str]:
    patterns = [
        r"[¥￥]\s*(\d+(?:\.\d+)?)",
        r"(?:价格|價格|售价|售價|到手价|到手價)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d+)?)",
        r"(\d+(?:\.\d+)?)\s*(?:包邮|包郵)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            value = match.group(1).replace(",", "")
            return match.group(0), value[:-2] if value.endswith(".0") else value
    return "", ""


def guess_model(text: str) -> str:
    found = contains_any(text, PREFERRED_MODELS)
    if found:
        return ", ".join(found)
    extra_models = ["990 Pro", "870 QVO", "WD Green", "WD Blue", "SN350", "NV1", "SA510", "金储星", "金存星", "Kingchuxing"]
    extra = contains_any(text, extra_models)
    return ", ".join(extra) if extra else "unknown"


def guess_capacity(text: str) -> str:
    match = re.search(r"\b(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\b", text, re.I)
    if match:
        return f"{match.group(1)}{match.group(2).upper()}"
    return "unknown"


def guess_interface(text: str) -> str:
    lower = text.lower()
    interfaces = []
    if any(term in lower for term in ["nvme", "pcie", "m.2", "gen3", "gen4"]):
        interfaces.append("NVMe")
    if any(term.lower() in lower for term in ["SATA", "mSATA", "NGFF SATA", "SATA协议", "SATA 协议"]):
        interfaces.append("SATA")
    if "usb" in lower or "type-c" in lower or "type c" in lower:
        interfaces.append("USB")
    return ", ".join(interfaces) if interfaces else "unknown"


def split_blocks(text: str) -> List[str]:
    """Split copied search-result text into rough item blocks.

    Prefer blank-line separated blocks because copied search results often keep
    title, price, seller note, and URL on nearby lines. This intentionally stays
    simple and local-only; users can improve results by adding blank lines
    between copied candidates.
    """
    raw_blocks = [block.strip() for block in re.split(r"\n\s*\n+", text) if block.strip()]
    blocks: List[str] = []
    for block in raw_blocks:
        clean = block.strip()
        lower = clean.lower()
        if lower.startswith("goofish search") or lower.startswith("search results") or lower.startswith("broad search"):
            continue
        if looks_like_candidate(clean):
            blocks.append(clean)
    return blocks


def looks_like_candidate(block: str) -> bool:
    return bool(
        extract_price(block)
        or extract_url(block)
        or contains_any(block, PREFERRED_MODELS)
        or contains_any(block, AVOID_TERMS)
    )


def seller_risk(text: str) -> tuple[str, str]:
    negative = contains_any(text, NEGATIVE_SELLER_TERMS)
    positive = contains_any(text, POSITIVE_SELLER_TERMS)
    if negative:
        level = "high" if len(negative) >= 2 or any(term in negative for term in ["不保品牌", "只保正常使用", "售出不退"]) else "medium"
    elif positive:
        level = "low"
    else:
        level = "unknown"
    parts = []
    if negative:
        parts.append("negative: " + "、".join(negative))
    if positive:
        parts.append("positive: " + "、".join(positive))
    return level, "；".join(parts)


def option_price_risk(text: str) -> str:
    return "high" if contains_any(text, OPTION_PRICE_TERMS) else "low"


def price_reliability(text: str, price: str, model: str, capacity: str, option_risk: str) -> str:
    lower = text.lower()
    price_num = float(price) if price else None
    known_model = model != "unknown"
    clear_2tb = capacity.lower() in {"2t", "2tb"}
    if option_risk == "high" or "价格区间" in text or "價格區間" in text:
        return "low"
    if "990 pro" in lower and clear_2tb and price_num is not None and price_num < 800:
        return "low"
    if known_model and clear_2tb and price_num is not None and price_num < 500:
        if not any(term in lower for term in ["坏", "壞", "test", "测试", "測試", "故障"]):
            return "low"
    if price_num is not None and known_model and clear_2tb:
        return "high"
    if price_num is not None:
        return "medium"
    return "low"


def skip_reason_for(text: str, model: str, capacity: str, interface: str, price: str, seller_level: str, reliability: str, option_risk: str) -> str:
    lower = text.lower()
    reasons = []
    avoid = contains_any(text, AVOID_TERMS)
    price_num = float(price) if price else None
    clear_2tb = capacity.lower() in {"2t", "2tb"}
    if avoid:
        reasons.append("命中避雷詞：" + "、".join(avoid))
    if seller_level == "high":
        reasons.append("賣家條款風險高")
    if reliability == "low":
        reasons.append("顯示價格可信度低，可能是選項價／釣魚價／容量不明")
    if option_risk == "high":
        reasons.append("多規格或選項價風險高")
    if "SATA" in interface and "NVMe" not in interface:
        reasons.append("SATA / mSATA / NGFF SATA 不是目標 NVMe")
    if "990 pro" in lower and clear_2tb and price_num is not None and price_num < 800:
        reasons.append("Samsung 990 Pro 2TB 價格異常低，需視為可疑")
    if clear_2tb and price_num is not None and price_num > 600 and any(term.lower() in lower for term in ["sata", "qvo", "白牌", "杂牌"]):
        reasons.append("SATA / QVO / 白牌 2TB 價格接近 NVMe，不值得優先跟進")
    return "；".join(dict.fromkeys(reasons))


def follow_up_priority(model: str, capacity: str, interface: str, seller_level: str, reliability: str, option_risk: str, skip_reason: str) -> str:
    preferred = model != "unknown" and any(term in model for term in PREFERRED_MODELS)
    is_2tb = capacity.lower() in {"2t", "2tb"}
    is_nvme = "NVMe" in interface
    if skip_reason and (seller_level == "high" or reliability == "low" or "不是目標 NVMe" in skip_reason or "可疑" in skip_reason):
        return "SKIP"
    if preferred and is_2tb and is_nvme and seller_level != "high" and reliability in {"high", "medium"} and option_risk != "high":
        return "HIGH"
    if preferred and seller_level in {"unknown", "low", "medium"}:
        return "MEDIUM"
    if skip_reason:
        return "SKIP"
    return "LOW"


def title_from_block(block: str, model: str) -> str:
    for line in block.splitlines():
        clean = line.strip()
        if not clean or clean.startswith("http") or re.search(r"^[¥￥]?\d+", clean):
            continue
        if model != "unknown" and any(part.lower() in clean.lower() for part in model.split(", ")):
            return clean[:120]
    first = next((line.strip() for line in block.splitlines() if line.strip()), "")
    return first[:120]


def parse_block(block: str, source_file: str, index: int, platform: str) -> Dict[str, str]:
    displayed_price, price = extract_price(block)
    model = guess_model(block)
    capacity = guess_capacity(block)
    interface = guess_interface(block)
    seller_level, seller_text = seller_risk(block)
    option_risk = option_price_risk(block)
    reliability = price_reliability(block, price, model, capacity, option_risk)
    skip = skip_reason_for(block, model, capacity, interface, price, seller_level, reliability, option_risk)
    priority = follow_up_priority(model, capacity, interface, seller_level, reliability, option_risk, skip)
    title = title_from_block(block, model)
    url = extract_url(block)
    return {
        "source_file": source_file,
        "platform": platform,
        "title": title,
        "displayed_price": displayed_price,
        "price": price,
        "url": url,
        "description": block[:800],
        "notes": f"search result block #{index}",
        "model_guess": model,
        "capacity_guess": capacity,
        "interface_guess": interface,
        "seller_text": seller_text,
        "seller_risk_level": seller_level,
        "price_reliability": reliability,
        "option_price_risk": option_risk,
        "skip_reason": skip,
        "follow_up_priority": priority,
        "intended_use": "external_mac_drive",
    }


def parse_search_files(input_dir: Path = RAW_SEARCH_DIR) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for path, text in read_raw_search_files(input_dir):
        platform = infer_platform(text, path.name)
        blocks = split_blocks(text)
        for index, block in enumerate(blocks, start=1):
            rows.append(parse_block(block, path.name, index, platform))
    return rows


def write_candidates_csv(rows: List[Dict[str, str]], output_path: Path = SEARCH_CANDIDATES_CSV) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=FIELDNAMES)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in FIELDNAMES})


def priority_sorted(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "SKIP": 3}
    return sorted(rows, key=lambda row: (rank.get(row.get("follow_up_priority", "LOW"), 2), row.get("price_reliability") == "low"))


def write_candidate_queue(rows: List[Dict[str, str]], files_read: int, path: Path = CANDIDATE_QUEUE_MD) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    counts = Counter(row.get("follow_up_priority", "LOW") for row in rows)
    top = [row for row in priority_sorted(rows) if row.get("follow_up_priority") in {"HIGH", "MEDIUM"}][:5]
    skips = [row for row in rows if row.get("follow_up_priority") == "SKIP"]
    lines = [
        "# Candidate Queue — 搜尋結果候選排序",
        "",
        "> v3.1 search-capture。此報告只分析使用者手動貼入的本地搜尋結果文字；不自動開頁、不抓取、不購買、不聯絡賣家。",
        "",
        "## Summary",
        "",
        f"- Total raw search files read: {files_read}",
        f"- Total candidates parsed: {len(rows)}",
        f"- HIGH: {counts.get('HIGH', 0)}",
        f"- MEDIUM: {counts.get('MEDIUM', 0)}",
        f"- LOW: {counts.get('LOW', 0)}",
        f"- SKIP: {counts.get('SKIP', 0)}",
        "",
        "## Top 5 candidates to open first",
        "",
    ]
    if not top:
        lines.append("- 暫時沒有 HIGH / MEDIUM 候選。")
    for row in top:
        lines.append(f"- {row['follow_up_priority']}｜{row['title']}｜¥{row['price'] or '?'}｜{row['model_guess']}｜{row['capacity_guess']}｜{row['price_reliability']}｜{row['seller_risk_level']}")
    lines.extend(["", "## Candidates to skip and reasons", ""])
    if not skips:
        lines.append("- 暫時沒有 SKIP 候選。")
    for row in skips[:20]:
        lines.append(f"- {row['title']}｜原因: {row['skip_reason'] or '低優先級'}")
    lines.extend(
        [
            "",
            "## Suggested next manual action",
            "",
            "1. 只打開 HIGH / MEDIUM 中最像真實 2TB NVMe TLC 的 3–5 個候選。",
            "2. 避免打開 SKIP，除非你想做 test_only 或補充驗證。",
            "3. 對 price_reliability = low 或 option_price_risk = high 的候選，先確認 2TB 實際價格。",
            "",
            "## Promote selected candidate to full listing capture",
            "",
            "1. Open the product page manually.",
            "2. Copy full visible listing text into `captures/raw/goofish_001.txt`.",
            "3. Run: `python3 src/cli.py capture`",
            "4. Review: `captures/parsed_listings.csv`",
            "5. Then append: `python3 src/cli.py capture --append-to data/discovered_listings.csv`",
            "6. Evaluate: `python3 src/cli.py evaluate --input data/discovered_listings.csv`",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def write_price_reliability(rows: List[Dict[str, str]], path: Path = PRICE_RELIABILITY_MD) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    risky = [row for row in rows if row.get("price_reliability") == "low" or row.get("option_price_risk") == "high"]
    lines = ["# Price Reliability — 顯示價格可信度", ""]
    if not risky:
        lines.append("暫時沒有明顯 bait price / option price 風險。")
    for row in risky:
        lines.append(f"- {row['title']}｜顯示價格: {row['displayed_price'] or '未知'}｜reliability: {row['price_reliability']}｜option risk: {row['option_price_risk']}｜原因: {row['skip_reason']}")
    lines.extend(["", "## Before opening or evaluating", "", "- 先確認 listing 是否多規格。", "- 確認 2TB 選項實際價格，不要只看搜尋結果顯示價。", "- 價格異常低的高階型號要先視為可疑。"])
    path.write_text("\n".join(lines), encoding="utf-8")


def write_seller_risk(rows: List[Dict[str, str]], path: Path = SELLER_RISK_MD) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# Seller Risk — 賣家條款風險", ""]
    risky = [row for row in rows if row.get("seller_risk_level") in {"high", "medium"}]
    positive = [row for row in rows if row.get("seller_risk_level") == "low"]
    lines.append("## Negative / unclear seller terms")
    lines.append("")
    if not risky:
        lines.append("- 暫時沒有明顯負面賣家條款。")
    for row in risky:
        lines.append(f"- {row['title']}｜risk: {row['seller_risk_level']}｜{row['seller_text']}")
    lines.extend(["", "## Positive signals", ""])
    if not positive:
        lines.append("- 暫時沒有明顯正面訊號。")
    for row in positive:
        lines.append(f"- {row['title']}｜{row['seller_text']}")
    path.write_text("\n".join(lines), encoding="utf-8")


def run_search_capture(input_dir: Path = RAW_SEARCH_DIR, output_path: Path = SEARCH_CANDIDATES_CSV) -> Dict[str, Any]:
    input_dir.mkdir(parents=True, exist_ok=True)
    SEARCH_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    files = read_raw_search_files(input_dir)
    rows = parse_search_files(input_dir)
    write_candidates_csv(rows, output_path)
    write_candidate_queue(rows, len(files))
    write_price_reliability(rows)
    write_seller_risk(rows)
    return {"files_read": len(files), "candidates": len(rows), "output": output_path}


def print_search_capture_summary(summary: Dict[str, Any]) -> None:
    print("Search result batch capture completed.")
    print(f"Files read: {summary['files_read']}")
    print(f"Candidates parsed: {summary['candidates']}")
    print(f"Output CSV: {summary['output']}")
    print("Reports written:")
    print("- reports/candidate_queue.md")
    print("- reports/price_reliability.md")
    print("- reports/seller_risk.md")
