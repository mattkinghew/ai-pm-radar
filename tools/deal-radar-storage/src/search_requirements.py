"""Generate manual search URLs from YAML requirement files.

This script does not scrape. It only creates links that the user can click.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List
from urllib.parse import quote_plus


ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"
REPORTS_DIR = ROOT / "reports"
REQUIREMENT_FILES = [
    CONFIG_DIR / "requirements.ssd.yml",
    CONFIG_DIR / "requirements.hdd.yml",
]

SEARCH_TARGETS = {
    "Goofish / 閒魚": "https://www.goofish.com/search?q={query}",
    "Taobao": "https://s.taobao.com/search?q={query}",
    "JD": "https://search.jd.com/Search?keyword={query}&enc=utf-8",
}


def load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        import yaml  # type: ignore
    except ImportError:
        return parse_minimal_yaml(path.read_text(encoding="utf-8"))
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def parse_minimal_yaml(text: str) -> Dict[str, Any]:
    """Very small fallback parser for simple key/list YAML.

    It supports:
    key: value
    key:
      - value
      - value
    """
    result: Dict[str, Any] = {}
    current_key = ""
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("-") and current_key:
            result.setdefault(current_key, []).append(stripped[1:].strip().strip('"\''))
            continue
        if ":" in stripped:
            key, value = stripped.split(":", 1)
            current_key = key.strip()
            value = value.strip().strip('"\'')
            result[current_key] = value if value else []
    return result


def as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return [str(value).strip()]


def collect_requirement_terms(requirements: Dict[str, Any]) -> List[str]:
    terms: List[str] = []
    for key in [
        "preferred_models",
        "models",
        "model",
        "capacity",
        "capacities",
        "interface",
        "interfaces",
        "keywords",
    ]:
        terms.extend(as_list(requirements.get(key)))
    return dedupe(terms)


def dedupe(values: Iterable[str]) -> List[str]:
    seen = set()
    output = []
    for value in values:
        lowered = value.lower()
        if lowered not in seen:
            seen.add(lowered)
            output.append(value)
    return output


def build_queries(file_path: Path, requirements: Dict[str, Any]) -> List[str]:
    terms = collect_requirement_terms(requirements)
    if not terms:
        fallback = "SSD" if "ssd" in file_path.name.lower() else "HDD"
        return [fallback]

    models = as_list(requirements.get("preferred_models")) or as_list(requirements.get("models")) or as_list(requirements.get("model"))
    capacities = as_list(requirements.get("capacities")) or as_list(requirements.get("capacity"))
    extra_keywords = as_list(requirements.get("keywords"))

    queries = []
    if models and capacities:
        for model in models:
            for capacity in capacities:
                queries.append(" ".join([model, capacity, *extra_keywords]).strip())
    elif models:
        queries.extend(" ".join([model, *extra_keywords]).strip() for model in models)
    else:
        queries.append(" ".join(terms).strip())

    return dedupe([query for query in queries if query])


def search_url(template: str, query: str) -> str:
    return template.format(query=quote_plus(query))


def write_search_report(requirement_files: List[Path] | None = None, output_dir: Path | None = None) -> None:
    reports_dir = output_dir or REPORTS_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)
    selected_requirement_files = requirement_files or REQUIREMENT_FILES
    lines = [
        "# Generated Search URLs",
        "",
        "> v2 requirements-only mode。此檔只產生搜尋連結，方便手動點擊搜尋；不會登入、不會自動購買、不會批量 scraping。",
        "",
    ]

    for requirement_file in selected_requirement_files:
        requirements = load_yaml(requirement_file)
        lines.extend([f"## {requirement_file.name}", ""])
        if not requirement_file.exists():
            lines.extend(["- 狀態: 找不到設定檔，已略過。", ""])
            continue

        queries = build_queries(requirement_file, requirements)
        for query in queries:
            lines.extend([f"### `{query}`", ""])
            for site_name, template in SEARCH_TARGETS.items():
                lines.append(f"- {site_name}: {search_url(template, query)}")
            lines.append("")

    output_path = reports_dir / "search_urls.md"
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {output_path}")


if __name__ == "__main__":
    write_search_report()
