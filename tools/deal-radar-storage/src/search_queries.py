"""Generate human-readable discovery search queries from requirements YAML.

This module is intentionally local and rule-based. It does not fetch, scrape,
log in, store credentials, or interact with platform accounts.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List

from search_requirements import load_yaml

PLATFORM_KEYWORDS = {
    "Goofish / 閒魚": "閒魚",
    "Taobao": "淘寶",
    "JD": "京東",
}


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


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
        cleaned = normalize_text(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            output.append(cleaned)
    return output


def load_requirement_profile(path: Path) -> Dict[str, Any]:
    data = load_yaml(path)
    preferred_models = as_list(data.get("preferred_models") or data.get("models") or data.get("model"))
    capacities = as_list(data.get("capacities") or data.get("capacity"))
    interfaces = as_list(data.get("interfaces") or data.get("interface"))
    reject_keywords = as_list(data.get("reject_keywords"))
    keywords = as_list(data.get("keywords"))
    category = normalize_text(data.get("category") or data.get("target_category") or data.get("product_category"))
    if not category:
        lowered = path.name.lower()
        if "hdd" in lowered:
            category = "HDD"
        elif "ssd" in lowered:
            category = "SSD"
        else:
            category = "storage"
    budget = normalize_text(data.get("budget") or data.get("max_budget") or data.get("budget_cny"))
    return {
        "path": path,
        "category": category,
        "capacity": ", ".join(capacities) if capacities else "未指定",
        "capacities": capacities,
        "interface": ", ".join(interfaces) if interfaces else "未指定",
        "interfaces": interfaces,
        "budget": budget or "未指定",
        "preferred_models": preferred_models,
        "reject_keywords": reject_keywords,
        "keywords": keywords,
        "raw": data,
    }


def infer_category_keyword(profile: Dict[str, Any]) -> str:
    category = normalize_text(profile.get("category")).upper()
    if "HDD" in category:
        return "硬碟"
    if "SSD" in category:
        return "SSD"
    return normalize_text(profile.get("category")) or "儲存裝置"


def interface_hint(profile: Dict[str, Any]) -> str:
    category = normalize_text(profile.get("category")).upper()
    interfaces = [item.upper() for item in profile.get("interfaces", [])]
    if "HDD" in category and any("SATA" in item for item in interfaces):
        return "普通 SATA"
    if any("NVME" in item for item in interfaces):
        return "NVMe"
    if any("SATA" in item for item in interfaces):
        return "SATA"
    if any("USB" in item for item in interfaces):
        return "USB"
    return ""


def build_base_queries(profile: Dict[str, Any]) -> List[str]:
    models = profile.get("preferred_models", [])
    capacities = profile.get("capacities", [])
    keywords = profile.get("keywords", [])
    category_keyword = infer_category_keyword(profile)
    hint = interface_hint(profile)

    queries: List[str] = []
    if models and capacities:
        for model in models:
            for capacity in capacities:
                parts = [model, capacity]
                if hint:
                    parts.append(hint)
                elif category_keyword:
                    parts.append(category_keyword)
                queries.append(" ".join(parts))
    elif models:
        for model in models:
            parts = [model]
            if hint:
                parts.append(hint)
            elif category_keyword:
                parts.append(category_keyword)
            queries.append(" ".join(parts))
    elif capacities:
        for capacity in capacities:
            parts = [category_keyword, capacity]
            if hint:
                parts.append(hint)
            queries.append(" ".join(parts))
    else:
        query = " ".join([category_keyword, *keywords]).strip()
        queries.append(query or "二手 儲存裝置")

    return dedupe(queries)


def generate_discovery_queries(requirement_files: Iterable[Path]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for file_path in requirement_files:
        profile = load_requirement_profile(file_path)
        for base_query in build_base_queries(profile):
            for platform, platform_keyword in PLATFORM_KEYWORDS.items():
                rows.append(
                    {
                        "requirement_file": str(file_path),
                        "platform": platform,
                        "query": base_query,
                        "display_query": f"{base_query} {platform_keyword}",
                        "category": normalize_text(profile.get("category")),
                        "capacity": normalize_text(profile.get("capacity")),
                        "interface": normalize_text(profile.get("interface")),
                        "budget": normalize_text(profile.get("budget")),
                        "preferred_models": ", ".join(profile.get("preferred_models", [])),
                        "reject_keywords": ", ".join(profile.get("reject_keywords", [])),
                    }
                )
    return rows


def summarize_requirements(requirement_files: Iterable[Path]) -> List[Dict[str, Any]]:
    return [load_requirement_profile(path) for path in requirement_files]
