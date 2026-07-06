"""Rule-based evaluator for deal-radar-storage v2.4.1.

This module is intentionally simple and beginner-friendly:
- no credentials
- no auto-buying
- no platform bypass
- no aggressive scraping
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional


MODEL_KEYWORDS = [
    "SN730",
    "SN740",
    "PM9A1",
    "PM9A1a",
    "Micron 3400",
    "KC3000",
    "SN770",
    "SN750",
    "P5 Plus",
    "970 EVO Plus",
    "980 PRO",
    "P31",
    "P41",
    "HC620",
    "HC550",
    "HC530",
    "Exos X18",
    "Exos X16",
    "MG08",
    "RTL9210B",
    "ASM2362",
]

RISK_KEYWORDS = [
    "飛牛",
    "Windows不能用",
    "USB不能用",
    "HBA",
    "PC3000",
    "屏蔽",
    "改容量",
    "ZBC",
    "SED鎖",
    "Linux專用",
    "不支持USB",
    "SATA",
    "QLC",
    "白牌",
    "雜牌",
    "不退不換",
    "健康90",
    "通電2萬小時",
]

CATEGORY_PATTERNS = {
    "SSD": ["ssd", "固態", "固态", "nvme", "m.2", "pm9a1", "sn740", "sn770", "kc3000", "p5 plus", "970 evo", "980 pro", "p31", "p41"],
    "HDD": ["hdd", "硬碟", "硬盘", "hc620", "hc550", "hc530", "exos", "mg08", "企業盤", "企业盘"],
    "enclosure": ["硬碟盒", "硬盘盒", "外置盒", "enclosure", "rtl9210b", "asm2362", "盒子"],
    "cable": ["線", "线", "cable", "轉接", "转接", "adapter"],
}

INTERFACE_PATTERNS = {
    "NVMe": ["nvme", "pcie", "m.2", "gen3", "gen4"],
    "SATA": ["sata"],
    "USB": ["usb", "type-c", "type c", "usb-c", "usbc", "10gbps", "20gbps"],
}

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

SUPPORTED_INTENDED_USES = {
    "main_work_drive",
    "docker_cache",
    "cold_storage",
    "backup_drive",
    "test_only",
    "external_mac_drive",
}

NUMERIC_SMART_FIELDS = [field for field in SMART_FIELDS if field != "supports_return"]

CAPACITY_PATTERN = re.compile(r"\b(\d+(?:\.\d+)?)\s*(tb|t|gb|g)\b", re.IGNORECASE)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def combine_text(item: Dict[str, Any]) -> str:
    parts = [
        normalize_text(item.get("title")),
        normalize_text(item.get("description")),
        normalize_text(item.get("url")),
    ]
    return " ".join(part for part in parts if part)


def find_keywords(text: str, keywords: Iterable[str]) -> List[str]:
    lower_text = text.lower()
    found = []
    for keyword in keywords:
        if keyword.lower() in lower_text:
            found.append(keyword)
    return found


def detect_categories(text: str) -> List[str]:
    found = []
    lower_text = text.lower()
    for category, patterns in CATEGORY_PATTERNS.items():
        if any(pattern.lower() in lower_text for pattern in patterns):
            found.append(category)
    return found


def detect_interfaces(text: str) -> List[str]:
    found = []
    lower_text = text.lower()
    for interface, patterns in INTERFACE_PATTERNS.items():
        if any(pattern.lower() in lower_text for pattern in patterns):
            found.append(interface)
    return found


def detect_capacities(text: str) -> List[str]:
    capacities = []
    for amount, unit in CAPACITY_PATTERN.findall(text):
        capacities.append(f"{amount}{unit.upper()}")
    return capacities


def has_capacity_2tb(capacities: List[str]) -> bool:
    for capacity in capacities:
        normalized = capacity.lower().replace(" ", "")
        if normalized in {"2t", "2tb"}:
            return True
    return False


def parse_price_cny(value: Any) -> Optional[float]:
    return parse_number(value)


def has_any_smart_info(item: Dict[str, Any]) -> bool:
    return any(normalize_text(item.get(field)) for field in SMART_FIELDS)


def is_low_end_sata_or_qlc(text: str, categories: List[str], interfaces: List[str], risks: List[str]) -> bool:
    lower_text = text.lower()
    low_end_terms = ["qlc", "sata", "dramless", "低端", "入門", "入门", "白牌", "雜牌", "杂牌"]
    return "SSD" in categories and ("SATA" in interfaces or any(term in lower_text for term in low_end_terms) or "QLC" in risks)


def is_unknown_or_white_label_ssd(text: str, categories: List[str], models: List[str], risks: List[str]) -> bool:
    lower_text = text.lower()
    white_label_terms = ["白牌", "雜牌", "杂牌", "unknown brand", "no brand", "無牌", "无牌"]
    return "SSD" in categories and not models and (any(term in lower_text for term in white_label_terms) or "白牌" in risks or "雜牌" in risks)


def looks_test_only(text: str) -> bool:
    lower_text = text.lower()
    return any(term in lower_text for term in ["test-only", "test only", "測試用", "测试用", "只測試", "只测试", "玩具", "實驗", "实验"])


def price_range(min_price: int, max_price: int, comment: str) -> Dict[str, Any]:
    return {
        "suggested_price_min": min_price,
        "suggested_price_max": max_price,
        "price_comment": comment,
    }


def no_price_range(comment: str) -> Dict[str, Any]:
    return {
        "suggested_price_min": "",
        "suggested_price_max": "",
        "price_comment": comment,
    }


def suggest_price(
    item: Dict[str, Any],
    text: str,
    categories: List[str],
    interfaces: List[str],
    models: List[str],
    risks: List[str],
    capacities: List[str],
    reject_reasons: List[str],
) -> Dict[str, Any]:
    """Return a beginner-friendly suggested CNY price range.

    The ranges are rough manual decision aids, not market-price guarantees.
    """
    if "SSD" not in categories:
        return no_price_range("暫時只為 SSD 型號提供建議價區間；HDD / 配件需人工比價。")

    health = parse_number(item.get("health_percent"))
    host_writes = parse_number(item.get("host_writes_tb"))
    price = parse_price_cny(item.get("price"))
    is_2tb = has_capacity_2tb(capacities) or "2tb" in text.lower() or "2t" in text.lower()

    if is_unknown_or_white_label_ssd(text, categories, models, risks):
        if price is not None and price <= 350 and looks_test_only(text):
            return price_range(0, 350, "白牌／未知品牌只適合作測試用途；只在 <=350 CNY 並清楚標示 test-only 時考慮。")
        reject_reasons.append("白牌／未知品牌 SSD：除非 <=350 CNY 並標示測試用途，否則拒絕")
        return no_price_range("白牌／未知品牌 SSD 不建議作正式資料儲存。")

    if is_low_end_sata_or_qlc(text, categories, interfaces, risks) and is_2tb:
        if price is not None and price > 750:
            reject_reasons.append(f"低端 SATA / QLC 2TB 標價 {price:g} CNY > 750 CNY，拒絕")
        return price_range(300, 650, "低端 SATA / QLC 2TB 只建議 300–650 CNY；高於 750 CNY 應拒絕。")

    if not is_2tb:
        return no_price_range("未識別為 2TB，暫不套用 v2.2/v2.4 指定價區間；請人工按容量比價。")

    normalized_models = {model.lower() for model in models}

    if "pm9a1" in normalized_models:
        if health is None:
            return no_price_range("PM9A1 2TB 需要 health_percent 才能估價。")
        if health >= 95:
            return price_range(800, 950, "PM9A1 2TB 且健康度 >=95%，可用 800–950 CNY 作詢價區間。")
        if 90 <= health <= 94:
            return price_range(550, 700, "PM9A1 2TB 健康度 90–94%，只建議 550–700 CNY。")
        return price_range(0, 500, "PM9A1 2TB 健康度 <90%，原則上拒絕；若只作測試，最高不宜超過 500 CNY。")

    if "sn750" in normalized_models:
        if health is None:
            return no_price_range("SN750 2TB 需要 health_percent 才能估價。")
        if health >= 95 and (host_writes is not None and host_writes < 100):
            return price_range(700, 850, "SN750 2TB 健康度 >=95% 且寫入量 <100TB，可用 700–850 CNY 作詢價區間。")
        if 85 <= health <= 94 or (host_writes is not None and host_writes > 200):
            return price_range(500, 650, "SN750 2TB 健康度 85–94% 或寫入量 >200TB，只建議 500–650 CNY。")
        return no_price_range("SN750 2TB 資料不足或狀態不在預設區間，建議先索取更多 SMART 資料。")

    preferred_2tb_models = {"sn730", "sn740", "micron 3400", "kc3000"}
    if normalized_models & preferred_2tb_models:
        if health is None:
            return no_price_range("SN730 / SN740 / Micron 3400 / KC3000 2TB 需要 health_percent 才能估價。")
        if health >= 95:
            return price_range(750, 900, "此類 2TB SSD 健康度 >=95%，可用 750–900 CNY 作詢價區間。")
        if 90 <= health <= 94:
            return price_range(550, 750, "此類 2TB SSD 健康度 90–94%，只建議 550–750 CNY。")
        return no_price_range("此類 2TB SSD 健康度 <90%，不建議作主力盤；請壓價或拒絕。")

    return no_price_range("型號未命中 v2.2/v2.4 指定價目表；請用同容量、同健康度、同保養條件人工比較。")



def join_labels(values: List[str]) -> str:
    return ", ".join(values) if values else "unknown"


def parse_intended_use(value: Any) -> str:
    intended_use = normalize_text(value).lower()
    if intended_use in SUPPORTED_INTENDED_USES:
        return intended_use
    return ""


def is_known_brand_or_model(models: List[str]) -> bool:
    return bool(models)


def is_qlc_or_unknown_brand(text: str, categories: List[str], models: List[str], risks: List[str]) -> bool:
    lower_text = text.lower()
    return (
        "SSD" in categories
        and (
            "QLC" in risks
            or "qlc" in lower_text
            or is_unknown_or_white_label_ssd(text, categories, models, risks)
        )
    )


def is_nvme_tlc_candidate(text: str, categories: List[str], interfaces: List[str], models: List[str], risks: List[str]) -> bool:
    lower_text = text.lower()
    if "SSD" not in categories or "NVMe" not in interfaces:
        return False
    if is_qlc_or_unknown_brand(text, categories, models, risks):
        return False
    if "tlc" in lower_text:
        return True
    # Treat known NVMe models as likely acceptable candidates, but keep wording conservative.
    preferred_models = {"sn730", "sn740", "pm9a1", "pm9a1a", "micron 3400", "kc3000", "sn770", "sn750", "p5 plus", "970 evo plus", "980 pro", "p31", "p41"}
    return bool({model.lower() for model in models} & preferred_models)


def suggested_max_price(price_fields: Dict[str, Any]) -> Optional[float]:
    return parse_number(price_fields.get("suggested_price_max"))


def has_complete_smart_for_storage(item: Dict[str, Any], categories: List[str]) -> bool:
    if "SSD" in categories:
        required = ["health_percent", "critical_warning", "media_integrity_errors"]
        return all(normalize_text(item.get(field)) for field in required)
    if "HDD" in categories:
        required = ["reallocated_sector_count", "current_pending_sector", "offline_uncorrectable"]
        return all(normalize_text(item.get(field)) for field in required)
    return False


def evaluate_use_case_fit(
    item: Dict[str, Any],
    text: str,
    categories: List[str],
    interfaces: List[str],
    models: List[str],
    risks: List[str],
    price_fields: Dict[str, Any],
    reject_reasons: List[str],
    reasons: List[str],
) -> Dict[str, str]:
    """Evaluate whether the listing fits the user's intended use.

    This stays rule-based and conservative. It does not replace manual inspection.
    """
    intended_use = parse_intended_use(item.get("intended_use"))
    if not intended_use:
        return {
            "intended_use": normalize_text(item.get("intended_use")),
            "use_case_fit": "未指定",
            "use_case_comment": "未提供 intended_use；未套用用途適配評估。",
            "use_case_score_delta": 0,
        }

    health = parse_number(item.get("health_percent"))
    host_writes = parse_number(item.get("host_writes_tb"))
    current_price = parse_price_cny(item.get("price"))
    max_suggested = suggested_max_price(price_fields)
    has_smart = has_any_smart_info(item)
    has_required_smart = has_complete_smart_for_storage(item, categories)
    is_ssd = "SSD" in categories
    is_hdd = "HDD" in categories
    is_sata = "SATA" in interfaces
    is_nvme = "NVMe" in interfaces
    low_price = False
    if current_price is not None and max_suggested is not None:
        low_price = current_price <= max_suggested
    elif current_price is not None:
        low_price = current_price <= 650

    fit = "適合度不明"
    comments: List[str] = []
    score_delta = 0

    if intended_use == "main_work_drive":
        fit = "不建議"
        if not has_smart:
            score_delta -= 25
            comments.append("主力工作碟需要完整 SMART；目前資料不足。")
            reasons.append("用途評估：main_work_drive 缺少 SMART，強烈不建議直接購買")
        if is_sata:
            score_delta -= 20
            comments.append("SATA 不適合作為這個工具的主力工作碟優先選項。")
        if is_qlc_or_unknown_brand(text, categories, models, risks):
            score_delta -= 25
            comments.append("QLC／未知品牌不適合作主力工作碟。")
        if health is not None and health < 95:
            score_delta -= 20
            comments.append(f"健康度 {health:g}% < 95%，不建議作主力工作碟。")
        if is_nvme_tlc_candidate(text, categories, interfaces, models, risks) and has_required_smart and health is not None and health >= 95:
            fit = "適合"
            score_delta += 5
            comments.append("NVMe + 已知型號 + SMART 合格，可作主力工作碟候選。")
        else:
            reasons.append("用途評估：main_work_drive 未達 NVMe TLC / 已知型號 / SMART 合格要求")

    elif intended_use == "docker_cache":
        fit = "可議價"
        if reject_reasons:
            fit = "不建議"
            comments.append("已有 hard reject，不適合作 Docker cache。")
        elif is_ssd and health is not None and 90 <= health <= 95 and low_price:
            fit = "可議價"
            comments.append("健康度 90–95% 可接受，但只適合低價作 Docker cache。")
        elif is_ssd and is_nvme and health is not None and health >= 95:
            fit = "適合"
            score_delta += 3
            comments.append("NVMe SSD 健康度良好，適合作 Docker cache 候選。")
        else:
            comments.append("Docker cache 可容忍中等狀態，但仍需 SMART 與低價。")

    elif intended_use == "cold_storage":
        fit = "適合度不明"
        if is_hdd and has_required_smart:
            fit = "適合"
            score_delta += 3
            comments.append("HDD 可作 cold storage 候選，但只限危險 SMART 欄位為 0。")
        elif is_ssd and is_sata and is_known_brand_or_model(models) and low_price:
            fit = "可議價"
            comments.append("已知品牌 SATA SSD 可低價作 cold storage，但不應存唯一副本。")
        else:
            fit = "不建議"
            score_delta -= 10
            comments.append("cold_storage 需要 HDD SMART 安全，或已知品牌低價 SATA SSD；目前不符合。")

    elif intended_use == "backup_drive":
        fit = "適合度不明"
        comments.append("注意：一隻二手硬碟不是完整備份策略；至少要有另一份獨立備份。")
        reasons.append("用途評估：backup_drive 需提醒不要把單一二手硬碟當作完整備份策略")
        if not has_required_smart:
            fit = "需要更多資料"
            score_delta -= 15
            comments.append("backup_drive 必須提供相關 SMART 欄位。")
        elif reject_reasons:
            fit = "不建議"
            comments.append("已有 SMART hard reject，不適合作備份碟。")
        else:
            fit = "可議價"
            comments.append("SMART 基本合格，可作非唯一備份媒介候選。")

    elif intended_use == "test_only":
        if reject_reasons:
            fit = "只限測試"
            comments.append("雖有高風險，只可在極低價、可承受損失時作測試用途。")
        elif max_suggested is not None and max_suggested <= 500:
            fit = "只限測試"
            comments.append("建議價很低，較適合 test_only，而非正式儲存。")
        elif current_price is not None and current_price <= 350:
            fit = "只限測試"
            comments.append("價格很低，可作測試用途候選。")
        else:
            fit = "不建議"
            score_delta -= 10
            comments.append("test_only 只應接受很低價格；目前價格／建議價不夠低。")

    elif intended_use == "external_mac_drive":
        fit = "適合度不明"
        heat_terms = ["高溫", "高温", "hot", "overheat", "發熱", "发热", "燙", "烫"]
        high_heat = any(term in text.lower() for term in heat_terms)
        has_enclosure_model = any(model in models for model in ["RTL9210B", "ASM2362"]) or "enclosure" in categories
        if is_nvme and not is_qlc_or_unknown_brand(text, categories, models, risks) and has_smart:
            fit = "可議價"
            comments.append("NVMe + SMART 可作外置 Mac 碟候選；仍需確認硬碟盒散熱與晶片。")
            if has_enclosure_model:
                fit = "適合"
                score_delta += 5
                comments.append("有可靠硬碟盒／橋接晶片線索，對 external_mac_drive 加分。")
        else:
            fit = "不建議"
            score_delta -= 15
            comments.append("external_mac_drive 優先 NVMe、已知品牌、SMART 齊全；目前不符合。")
        if high_heat:
            score_delta -= 10
            comments.append("描述出現高熱／發熱風險，外置 Mac 使用需扣分。")
        if is_qlc_or_unknown_brand(text, categories, models, risks):
            score_delta -= 15
            comments.append("QLC／未知品牌不適合長期外置工作碟。")
        if not has_smart:
            score_delta -= 15
            comments.append("缺少 SMART，不建議直接購買作外置 Mac 碟。")

    return {
        "intended_use": intended_use,
        "use_case_fit": fit,
        "use_case_comment": " ".join(comments) if comments else "未有額外用途註解。",
        "use_case_score_delta": score_delta,
    }



def csv_join(values: Iterable[str]) -> str:
    cleaned = [normalize_text(value) for value in values if normalize_text(value)]
    return "；".join(cleaned)


def missing_smart_fields_for_item(item: Dict[str, Any], categories: List[str]) -> List[str]:
    missing: List[str] = []
    if "SSD" in categories:
        for field in [
            "health_percent",
            "power_on_hours",
            "host_writes_tb",
            "critical_warning",
            "media_integrity_errors",
            "supports_return",
        ]:
            if not normalize_text(item.get(field)):
                missing.append(field)
    if "HDD" in categories:
        for field in [
            "power_on_hours",
            "reallocated_sector_count",
            "current_pending_sector",
            "offline_uncorrectable",
            "supports_return",
        ]:
            if not normalize_text(item.get(field)):
                missing.append(field)
    return missing


def add_unique(target: List[str], value: str) -> None:
    if value and value not in target:
        target.append(value)


def generate_seller_followup(
    item: Dict[str, Any],
    categories: List[str],
    interfaces: List[str],
    models: List[str],
    risks: List[str],
    decision: str,
    reject_reasons: List[str],
    missing_fields: List[str],
) -> Dict[str, str]:
    """Generate manual seller questions and evidence checklist.

    This is deliberately simple text generation. It does not contact sellers,
    scrape websites, log in, or automate buying.
    """
    questions: List[str] = []
    evidence: List[str] = []
    rescue_notes: List[str] = []

    is_ssd = "SSD" in categories
    is_hdd = "HDD" in categories
    is_enclosure = "enclosure" in categories

    if decision == "NEED_MORE_INFO" and missing_fields:
        field_labels = {
            "health_percent": "SSD 健康度 / Percentage Used",
            "power_on_hours": "通電小時 Power On Hours",
            "host_writes_tb": "Total Host Writes",
            "critical_warning": "Critical Warning",
            "media_integrity_errors": "Media/Data Integrity Errors",
            "reallocated_sector_count": "Reallocated Sector Count",
            "current_pending_sector": "Current Pending Sector",
            "offline_uncorrectable": "Offline Uncorrectable",
            "supports_return": "是否支持退換／測試",
            "price": "實際成交價／可議價空間",
        }
        missing_label = "、".join(field_labels.get(field, field) for field in missing_fields)
        add_unique(questions, f"目前缺少 {missing_label}，可否補充完整資料或截圖？")

    if is_ssd:
        add_unique(questions, "可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。")
        add_unique(questions, "請確認 Critical Warning = 0。")
        add_unique(questions, "請確認 Media/Data Integrity Errors = 0。")
        add_unique(questions, "請提供 Total Host Writes、Power On Hours、Health / Percentage Used。")
        add_unique(questions, "是否支持收貨後測試？如 SMART 與描述不符可否退換？")
        add_unique(evidence, "CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。")
        add_unique(evidence, "Critical Warning = 0 的截圖或清楚數值。")
        add_unique(evidence, "Media/Data Integrity Errors = 0 的截圖或清楚數值。")
        add_unique(evidence, "賣家確認退換／測試條款的文字紀錄。")

    if is_hdd:
        add_unique(questions, "可否提供 CrystalDiskInfo 或 smartctl -a 完整截圖？")
        add_unique(questions, "請確認 Reallocated Sector Count = 0。")
        add_unique(questions, "請確認 Current Pending Sector = 0。")
        add_unique(questions, "請確認 Offline Uncorrectable = 0。")
        add_unique(questions, "請提供 Power On Hours。")
        add_unique(questions, "請確認這是普通 SATA 盤，不是飛牛專用盤、不是 ZBC、不是 PC3000 改盤、不是屏蔽／改容量盤。")
        add_unique(questions, "請確認 USB 硬碟座、Windows、macOS 是否可以正常識別。")
        add_unique(evidence, "CrystalDiskInfo 或 smartctl -a 完整截圖。")
        add_unique(evidence, "Reallocated Sector Count / Current Pending Sector / Offline Uncorrectable 全部為 0 的證明。")
        add_unique(evidence, "Windows / macOS / USB 硬碟座可識別的截圖或影片。")
        add_unique(evidence, "賣家確認非飛牛專用、非 ZBC、非 PC3000 改盤、非屏蔽／改容量的文字紀錄。")

    if is_enclosure:
        add_unique(questions, "請確認硬碟盒 controller chip 是 RTL9210B 還是 ASM2362。")
        add_unique(questions, "請確認是否支援 TRIM、UASP、SMART passthrough。")
        add_unique(evidence, "硬碟盒晶片型號截圖／商品圖／賣家文字確認。")
        add_unique(evidence, "TRIM、UASP、SMART passthrough 支援證明。")

    if not questions:
        add_unique(questions, "請提供清楚實物照片、型號、容量、價格、測試截圖與退換條款。")
        add_unique(evidence, "商品實物照片、型號／容量證明、測試截圖、退換條款。")

    if reject_reasons:
        hard_text = "；".join(reject_reasons)
        if any(term in hard_text for term in ["critical_warning", "media_integrity_errors", "reallocated_sector_count", "current_pending_sector", "offline_uncorrectable"]):
            add_unique(rescue_notes, "已命中 SMART hard reject；除非賣家提供完整截圖證明原資料填錯且危險欄位為 0，否則不建議救回。")
        else:
            add_unique(rescue_notes, "目前因價格／品牌／風險規則被拒絕；只有在賣家補充證據、降價，並明確限於測試用途時才可能重新評估。")
    elif decision == "NEED_MORE_INFO":
        add_unique(rescue_notes, "可救回：補齊 SMART、價格、退換與相容性證據後再重新評分。")
    else:
        add_unique(rescue_notes, "未命中 hard reject；仍需完成證據檢查後才適合付款。")

    if decision == "BUY_CANDIDATE":
        next_action = "先向賣家索取完整證據；證據一致後才考慮購買。"
    elif decision == "NEGOTIATE_ONLY":
        next_action = "只適合議價；用建議價區間與 SMART 證據壓價。"
    elif decision == "WATCH_ONLY":
        next_action = "放入觀察清單；除非大幅降價或補齊證據，否則不急買。"
    elif decision == "NEED_MORE_INFO":
        next_action = "先問賣家補資料；未補齊前不要付款。"
    else:
        next_action = "不建議購買；只在證據推翻拒絕原因時才重新評估。"

    return {
        "next_action": next_action,
        "seller_questions": csv_join(questions),
        "evidence_required": csv_join(evidence),
        "rescue_comment": csv_join(rescue_notes),
    }

def decide_item(score: int, reject_reasons: List[str], missing_key_info: bool) -> str:
    if reject_reasons:
        return "REJECT"
    if missing_key_info and score >= 40:
        return "NEED_MORE_INFO"
    if score >= 80:
        return "BUY_CANDIDATE"
    if score >= 60:
        return "NEGOTIATE_ONLY"
    if score >= 40:
        return "WATCH_ONLY"
    return "REJECT"


def score_bucket(score: int) -> str:
    if score >= 80:
        return "worth asking seller"
    if score >= 60:
        return "maybe, negotiate"
    if score >= 40:
        return "weak"
    return "reject"


def parse_number(value: Any) -> Optional[float]:
    text = normalize_text(value)
    if not text or text.lower() in {"unknown", "n/a", "na", "none", "null", "-"}:
        return None
    text = text.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def parse_yes_no(value: Any) -> Optional[bool]:
    text = normalize_text(value).lower()
    if not text:
        return None
    yes_values = {"yes", "y", "true", "1", "support", "supports", "可退", "支持", "支援", "有", "是"}
    no_values = {"no", "n", "false", "0", "不退", "不支持", "不支援", "沒有", "否"}
    if text in yes_values:
        return True
    if text in no_values:
        return False
    if "不退" in text or "不支持" in text or "不支援" in text:
        return False
    if "可退" in text or "支持" in text or "支援" in text:
        return True
    return None


def format_smart_value(value: Any) -> str:
    text = normalize_text(value)
    return text if text else "unknown"


def smart_summary(item: Dict[str, Any]) -> str:
    labels = {
        "health_percent": "健康度",
        "power_on_hours": "通電小時",
        "host_writes_tb": "寫入量TB",
        "reallocated_sector_count": "重映射磁區",
        "current_pending_sector": "待處理磁區",
        "offline_uncorrectable": "離線不可修正",
        "media_integrity_errors": "Media錯誤",
        "critical_warning": "Critical warning",
        "supports_return": "可否退換",
    }
    parts = []
    for field in SMART_FIELDS:
        value = format_smart_value(item.get(field))
        if value != "unknown":
            parts.append(f"{labels[field]}: {value}")
    return "; ".join(parts) if parts else "未提供 SMART / 退換資料"


def smart_output_values(item: Dict[str, Any]) -> Dict[str, str]:
    return {field: format_smart_value(item.get(field)) for field in SMART_FIELDS}


def apply_smart_rules(item: Dict[str, Any], categories: List[str], score: int, reasons: List[str], reject_reasons: List[str]) -> int:
    is_ssd = "SSD" in categories
    is_hdd = "HDD" in categories

    if is_ssd:
        health = parse_number(item.get("health_percent"))
        if health is not None:
            if health >= 95:
                score += 8
                reasons.append(f"SSD SMART 健康度 {health:g}%：加分")
            elif health < 90:
                score -= 30
                reasons.append(f"SSD SMART 健康度 {health:g}%：強扣分")

        host_writes = parse_number(item.get("host_writes_tb"))
        if host_writes is not None and host_writes > 200:
            score -= 15
            reasons.append(f"SSD host_writes_tb {host_writes:g}TB > 200TB：扣分")

        critical_warning = parse_number(item.get("critical_warning"))
        if critical_warning is not None and critical_warning != 0:
            reject_reasons.append(f"SSD critical_warning = {critical_warning:g}，必須拒絕")

        media_errors = parse_number(item.get("media_integrity_errors"))
        if media_errors is not None and media_errors != 0:
            reject_reasons.append(f"SSD media_integrity_errors = {media_errors:g}，必須拒絕")

    if is_hdd:
        for field, label in [
            ("reallocated_sector_count", "HDD reallocated_sector_count"),
            ("current_pending_sector", "HDD current_pending_sector"),
            ("offline_uncorrectable", "HDD offline_uncorrectable"),
        ]:
            value = parse_number(item.get(field))
            if value is not None and value != 0:
                reject_reasons.append(f"{label} = {value:g}，必須拒絕")

    supports_return = parse_yes_no(item.get("supports_return"))
    if supports_return is True:
        score += 5
        reasons.append("賣家標示支持退換：加分")
    elif supports_return is False:
        score -= 8
        reasons.append("賣家標示不支持退換：扣分")

    return score


def evaluate_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate one candidate using simple text, optional SMART rules, and v2.4.1 decision, use-case, and seller-question rules."""
    text = combine_text(item)
    models = find_keywords(text, MODEL_KEYWORDS)
    risks = find_keywords(text, RISK_KEYWORDS)
    categories = detect_categories(text)
    interfaces = detect_interfaces(text)
    capacities = detect_capacities(text)

    score = 50
    reasons: List[str] = []
    reject_reasons: List[str] = []

    if models:
        score += min(25, 10 + 5 * len(models))
        reasons.append("命中偏好／已知型號: " + ", ".join(models))
    else:
        score -= 5
        reasons.append("未命中已知型號")

    if categories:
        score += 8
        reasons.append("識別類別: " + ", ".join(categories))
    else:
        score -= 5
        reasons.append("類別不明")

    if interfaces:
        score += 7
        reasons.append("識別介面: " + ", ".join(interfaces))
    else:
        reasons.append("介面不明")

    if capacities:
        score += 5
        reasons.append("識別容量: " + ", ".join(capacities))

    if risks:
        penalty = min(45, 12 * len(risks))
        score -= penalty
        reasons.append("風險關鍵字: " + ", ".join(risks))

    score = apply_smart_rules(item, categories, score, reasons, reject_reasons)

    if not normalize_text(item.get("title")) and not normalize_text(item.get("description")):
        score -= 10
        reasons.append("缺少標題／描述，只能保守評估 URL")

    price_fields = suggest_price(item, text, categories, interfaces, models, risks, capacities, reject_reasons)
    use_case_fields = evaluate_use_case_fit(
        item, text, categories, interfaces, models, risks, price_fields, reject_reasons, reasons
    )
    use_case_score_delta = int(use_case_fields.get("use_case_score_delta", 0))
    if use_case_score_delta != 0:
        score += use_case_score_delta
        reasons.append(f"用途適配分數調整: {use_case_score_delta:+d}")

    missing_key_info = False
    missing_fields = missing_smart_fields_for_item(item, categories)
    is_enclosure_listing = "enclosure" in categories
    # Enclosures need controller / TRIM / UASP / SMART passthrough evidence,
    # but they are not drives themselves, so do not require disk SMART fields.
    if ("SSD" in categories or "HDD" in categories) and not is_enclosure_listing:
        if not has_any_smart_info(item):
            missing_key_info = True
            reasons.append("缺少 SMART 欄位，購買前需要賣家補充截圖或數值")
        elif missing_fields:
            missing_key_info = True
            reasons.append("SMART 欄位未完整，購買前需要賣家補充缺漏數值")
    if normalize_text(item.get("price")) in {"", "未知價格", "unknown"}:
        missing_key_info = True
        missing_fields.append("price")
        reasons.append("缺少價格，暫時不能判斷是否值得購買")

    if reject_reasons:
        score = 0
        reasons.extend(reject_reasons)

    score = max(0, min(100, score))
    decision = decide_item(score, reject_reasons, missing_key_info)
    bucket = score_bucket(score)
    followup_fields = generate_seller_followup(
        item, categories, interfaces, models, risks, decision, reject_reasons, missing_fields
    )

    output = {
        "url": normalize_text(item.get("url")),
        "title": normalize_text(item.get("title")) or "未知標題",
        "price": normalize_text(item.get("price")) or "未知價格",
        "description": normalize_text(item.get("description")),
        "intended_use": use_case_fields.get("intended_use", ""),
        "use_case_fit": use_case_fields.get("use_case_fit", "未指定"),
        "use_case_comment": use_case_fields.get("use_case_comment", ""),
        "score": score,
        "bucket": bucket,
        "decision": decision,
        "categories": ", ".join(categories) or "unknown",
        "interfaces": ", ".join(interfaces) or "unknown",
        "models": ", ".join(models) or "unknown",
        "risks": ", ".join(risks) or "none",
        "smart_summary": smart_summary(item),
        "reject_reasons": "; ".join(reject_reasons) or "",
        "reasons": reasons,
    }
    output.update(price_fields)
    output.update(followup_fields)
    output.update(smart_output_values(item))
    return output
