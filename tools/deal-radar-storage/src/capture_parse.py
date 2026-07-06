"""Browser-assisted manual capture parser for deal-radar-storage v3.

This module only parses local text files manually copied by the user.
It does not scrape websites, open browser pages, log in, store cookies,
message sellers, auto-buy, or bypass platform security.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
RAW_CAPTURE_DIR = ROOT / "captures" / "raw"
PROCESSED_CAPTURE_DIR = ROOT / "captures" / "processed"
PARSED_LISTINGS_CSV = ROOT / "captures" / "parsed_listings.csv"
CAPTURE_REPORT_MD = PROCESSED_CAPTURE_DIR / "capture_report.md"
DISCOVERED_LISTINGS_CSV = ROOT / "data" / "discovered_listings.csv"

CAPTURE_FIELDS = [
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

RETURN_YES_TERMS = ["可退", "支持退货", "支持退貨", "到手測試", "到手测试", "可到手测试", "可到手測試"]
RETURN_NO_TERMS = ["不退不换", "不退不換", "售出不退"]
SUPPORTED_INTENDED_USES = ["cold_storage", "backup_drive", "test_only", "docker_cache", "main_work_drive", "external_mac_drive"]


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def read_raw_capture_files(input_dir: Path = RAW_CAPTURE_DIR) -> List[Tuple[Path, str]]:
    if not input_dir.exists():
        return []
    files = sorted(path for path in input_dir.glob("*.txt") if path.is_file())
    return [(path, path.read_text(encoding="utf-8", errors="replace")) for path in files]


def first_match(patterns: Iterable[str], text: str, flags: int = re.IGNORECASE) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            return normalize_text(match.group(1))
    return ""


def detect_url(text: str) -> str:
    return first_match([r"(https?://[^\s，,。)）]+)"], text)


def infer_platform(text: str, url: str) -> str:
    explicit = first_match([r"(?:平台|platform)\s*[:：]\s*([^\n]+)"], text)
    source = f"{explicit} {url}".lower()
    if "goofish" in source or "闲鱼" in source or "閒魚" in source or "xianyu" in source:
        return "goofish"
    if "taobao" in source or "淘宝" in source or "淘寶" in source:
        return "taobao"
    if "jd.com" in source or "京东" in source or "京東" in source:
        return "jd"
    return explicit or "unknown"


def clean_price(value: str) -> str:
    value = value.replace(",", "")
    match = re.search(r"\d+(?:\.\d+)?", value)
    if not match:
        return ""
    number = match.group(0)
    if number.endswith(".0"):
        return number[:-2]
    return number


def detect_price(text: str) -> str:
    value = first_match(
        [
            r"(?:價格|价格|售价|售價|price)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d+)?)",
            r"[¥￥]\s*(\d+(?:\.\d+)?)",
            r"(\d+(?:\.\d+)?)\s*包邮",
            r"(\d+(?:\.\d+)?)\s*包郵",
        ],
        text,
    )
    return clean_price(value)


def detect_labeled_block(text: str, labels: List[str]) -> str:
    label_pattern = "|".join(re.escape(label) for label in labels)
    stop_pattern = r"(?:URL|平台|標題|标题|價格|价格|售价|售價|描述|賣家備註|卖家备注|備註|备注|intended_use)\s*[:：]"
    pattern = rf"(?:{label_pattern})\s*[:：]\s*(.*?)(?=\n{stop_pattern}|\Z)"
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if match:
        return normalize_text(match.group(1))
    return ""


def detect_title(text: str) -> str:
    title = first_match([r"(?:標題|标题|title)\s*[:：]\s*([^\n]+)"], text)
    if title:
        return title
    for line in text.splitlines():
        cleaned = normalize_text(line)
        if not cleaned:
            continue
        if cleaned.lower().startswith("http") or re.match(r"^(url|平台|價格|价格|描述|賣家備註|卖家备注)\s*[:：]", cleaned, re.I):
            continue
        if any(term.lower() in cleaned.lower() for term in ["sn730", "sn740", "pm9a1", "kc3000", "990", "qvo", "ssd", "nvme", "m.2"]):
            return cleaned[:120]
    return ""


def detect_health(text: str) -> str:
    return clean_price(first_match([r"(?:健康度?|health)\s*[:：]?\s*(\d{1,3})\s*%?"], text))


def detect_power_on_hours(text: str) -> str:
    return clean_price(
        first_match(
            [
                r"(?:通电|通電)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:小时|小時)",
                r"power\s*on\s*hours\s*[:：=]?\s*(\d+(?:\.\d+)?)",
            ],
            text,
        )
    )


def detect_host_writes(text: str) -> str:
    return clean_price(
        first_match(
            [
                r"(?:写入|寫入)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*TB",
                r"host\s*writes\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*TB",
                r"total\s*host\s*writes\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*TB",
            ],
            text,
        )
    )


def detect_simple_number(label_patterns: List[str], text: str) -> str:
    escaped = [rf"{label}\s*[:：=]?\s*(\d+)" for label in label_patterns]
    return clean_price(first_match(escaped, text))


def detect_supports_return(text: str) -> str:
    if any(term in text for term in RETURN_NO_TERMS):
        return "no"
    if any(term in text for term in RETURN_YES_TERMS):
        return "yes"
    return "unknown"


def detect_intended_use(text: str) -> str:
    lower = text.lower()
    explicit = first_match([r"intended_use\s*[:：]\s*([a-z_]+)", r"用途\s*[:：]\s*([a-z_]+)"], text)
    if explicit in SUPPORTED_INTENDED_USES:
        return explicit
    for use in SUPPORTED_INTENDED_USES:
        if use in lower:
            return use
    return "external_mac_drive"


def detect_notes(text: str) -> str:
    notes = detect_labeled_block(text, ["賣家備註", "卖家备注", "備註", "备注", "notes"])
    risk_terms = [
        "不退不换",
        "不退不換",
        "不保品牌",
        "只保正常使用",
        "图吧显示",
        "图吧工具箱",
        "打包",
        "拆机打包",
        "假三星",
        "假990",
        "白牌",
        "杂牌",
    ]
    found = [term for term in risk_terms if term in text]
    parts = [notes] if notes else []
    if found:
        parts.append("風險詞：" + "、".join(found))
    return "；".join(parts)


def parse_capture_text(text: str, source_file: str = "") -> Dict[str, str]:
    url = detect_url(text)
    description = detect_labeled_block(text, ["描述", "description"])
    notes = detect_notes(text)
    if not description:
        description = normalize_text(text[:800])

    item = {
        "platform": infer_platform(text, url),
        "title": detect_title(text),
        "price": detect_price(text),
        "url": url,
        "description": description,
        "notes": notes,
        "health_percent": detect_health(text),
        "power_on_hours": detect_power_on_hours(text),
        "host_writes_tb": detect_host_writes(text),
        "reallocated_sector_count": detect_simple_number(["Reallocated Sector Count", "重映射磁區", "重映射扇区"], text),
        "current_pending_sector": detect_simple_number(["Current Pending Sector", "待處理磁區", "待处理扇区"], text),
        "offline_uncorrectable": detect_simple_number(["Offline Uncorrectable", "離線不可修正", "离线不可校正"], text),
        "media_integrity_errors": detect_simple_number(["Media/Data Integrity Errors", "Media Data Integrity Errors", "media_integrity_errors"], text),
        "critical_warning": detect_simple_number(["Critical Warning", "critical_warning"], text),
        "supports_return": detect_supports_return(text),
        "intended_use": detect_intended_use(text),
        "source_file": source_file,
    }
    return item


def parse_capture_files(input_dir: Path = RAW_CAPTURE_DIR) -> List[Dict[str, str]]:
    rows = []
    for path, text in read_raw_capture_files(input_dir):
        if not normalize_text(text):
            continue
        rows.append(parse_capture_text(text, source_file=path.name))
    return rows


def write_parsed_csv(rows: List[Dict[str, str]], output_path: Path = PARSED_LISTINGS_CSV) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [*CAPTURE_FIELDS, "source_file"]
    with output_path.open("w", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def load_existing_urls(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        return {normalize_text(row.get("url")) for row in reader if normalize_text(row.get("url"))}


def append_rows_to_csv(rows: List[Dict[str, str]], target_path: Path) -> Tuple[int, int]:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    existing_urls = load_existing_urls(target_path)
    target_exists = target_path.exists() and target_path.stat().st_size > 0
    appended = 0
    skipped = 0

    with target_path.open("a", encoding="utf-8-sig", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CAPTURE_FIELDS)
        if not target_exists:
            writer.writeheader()
        for row in rows:
            url = normalize_text(row.get("url"))
            if url and url in existing_urls:
                skipped += 1
                continue
            writer.writerow({field: row.get(field, "") for field in CAPTURE_FIELDS})
            if url:
                existing_urls.add(url)
            appended += 1
    return appended, skipped


def missing_fields_for(row: Dict[str, str]) -> List[str]:
    required = ["title", "price", "url", "description"]
    missing = [field for field in required if not normalize_text(row.get(field))]
    if row.get("supports_return") == "unknown":
        missing.append("supports_return")
    return missing


def markdown_escape(value: Any) -> str:
    return normalize_text(value).replace("|", "／").replace("\n", " ")


def write_capture_report(
    rows: List[Dict[str, str]],
    files_read: int,
    output_path: Path = CAPTURE_REPORT_MD,
    appended: int = 0,
    skipped: int = 0,
    append_target: Path | None = None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    warnings = [(row, missing_fields_for(row)) for row in rows if missing_fields_for(row)]
    lines = [
        "# Browser-assisted Manual Capture Report",
        "",
        "> v3 本地手動擷取流程。使用者手動從瀏覽器複製可見文字到 `captures/raw/*.txt`；工具只解析本地文字，不 scraping、不登入、不自動購買、不自動聯絡賣家。",
        "",
        "## Summary",
        "",
        f"- Files read: {files_read}",
        f"- Rows parsed: {len(rows)}",
        f"- Rows appended: {appended}",
        f"- Rows skipped: {skipped}",
    ]
    if append_target:
        lines.append(f"- Append target: `{append_target}`")

    lines.extend(["", "## Missing field warnings", ""])
    if not warnings:
        lines.append("- 暫時沒有明顯缺漏欄位。")
    for row, missing in warnings:
        lines.append(f"- `{row.get('source_file', '')}` / {row.get('title', '未知標題')}: 缺少 {', '.join(missing)}")

    lines.extend(
        [
            "",
            "## Candidate preview table",
            "",
            "| Source | Platform | Title | Price | Health | Writes TB | Return | URL |",
            "|---|---|---|---:|---:|---:|---|---|",
        ]
    )
    for row in rows:
        lines.append(
            "| {source} | {platform} | {title} | {price} | {health} | {writes} | {return_support} | {url} |".format(
                source=markdown_escape(row.get("source_file")),
                platform=markdown_escape(row.get("platform")),
                title=markdown_escape(row.get("title")),
                price=markdown_escape(row.get("price")),
                health=markdown_escape(row.get("health_percent")),
                writes=markdown_escape(row.get("host_writes_tb")),
                return_support=markdown_escape(row.get("supports_return")),
                url=markdown_escape(row.get("url")),
            )
        )

    lines.extend(
        [
            "",
            "## Suggested next command",
            "",
            "```bash",
            "python3 src/cli.py evaluate --input data/discovered_listings.csv",
            "```",
        ]
    )
    output_path.write_text("\n".join(lines), encoding="utf-8")


def run_capture(
    input_dir: Path = RAW_CAPTURE_DIR,
    output_path: Path = PARSED_LISTINGS_CSV,
    report_path: Path = CAPTURE_REPORT_MD,
    append_to: Path | None = None,
) -> Dict[str, Any]:
    input_dir.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    files = read_raw_capture_files(input_dir)
    rows = [parse_capture_text(text, source_file=path.name) for path, text in files if normalize_text(text)]
    write_parsed_csv(rows, output_path)

    appended = 0
    skipped = 0
    if append_to is not None:
        appended, skipped = append_rows_to_csv(rows, append_to)

    write_capture_report(
        rows,
        files_read=len(files),
        output_path=report_path,
        appended=appended,
        skipped=skipped,
        append_target=append_to,
    )
    return {
        "files_read": len(files),
        "rows_parsed": len(rows),
        "rows_appended": appended,
        "rows_skipped": skipped,
        "output": output_path,
        "report": report_path,
        "append_to": append_to,
    }


def print_capture_summary(summary: Dict[str, Any]) -> None:
    print("Browser-assisted manual capture completed.")
    print(f"Files read: {summary['files_read']}")
    print(f"Rows parsed: {summary['rows_parsed']}")
    print(f"Rows appended: {summary['rows_appended']}")
    print(f"Rows skipped: {summary['rows_skipped']}")
    print(f"Parsed CSV: {summary['output']}")
    print(f"Report: {summary['report']}")
