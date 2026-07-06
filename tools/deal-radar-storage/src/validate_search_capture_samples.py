"""Validate v3.1 search result batch capture samples.

This validation parses local sample search-result text files only. It does not
scrape, open pages, log in, auto-buy, message sellers, or bypass platform
security.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from search_capture_parse import RAW_SEARCH_DIR, SEARCH_PROCESSED_DIR, parse_search_files


REPORT_PATH = SEARCH_PROCESSED_DIR / "search_capture_validation.md"


def rows_from_source(rows: List[Dict[str, str]], source: str) -> List[Dict[str, str]]:
    return [row for row in rows if row.get("source_file") == source]


def run_validation(input_dir: Path = RAW_SEARCH_DIR, report_path: Path = REPORT_PATH) -> Dict[str, int]:
    rows = parse_search_files(input_dir)
    checks: List[str] = []

    if len(rows) < 6:
        raise AssertionError(f"Expected several candidates, got {len(rows)}")
    checks.append(f"PASS: parsed {len(rows)} candidates")

    sn730_rows = rows_from_source(rows, "sample_sn730_search_results.txt")
    if not any(row.get("follow_up_priority") in {"HIGH", "MEDIUM"} for row in sn730_rows):
        raise AssertionError("SN730 sample should produce at least one HIGH or MEDIUM candidate")
    checks.append("PASS: SN730 sample has HIGH/MEDIUM candidate")

    bad_rows = rows_from_source(rows, "sample_bad_broad_2tb_search_results.txt")
    if not bad_rows or not any(row.get("follow_up_priority") == "SKIP" for row in bad_rows):
        raise AssertionError("Bad broad 2TB sample should produce SKIP candidates")
    checks.append("PASS: bad broad 2TB sample produces SKIP candidates")

    if not any(row.get("option_price_risk") == "high" for row in rows):
        raise AssertionError("Expected at least one option_price_risk=high candidate")
    checks.append("PASS: option price risk detected")

    if not any(row.get("price_reliability") == "low" for row in rows):
        raise AssertionError("Expected at least one low price reliability candidate")
    checks.append("PASS: low price reliability detected")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Search Capture Sample Validation",
        "",
        "> v3.1 local search-result capture validation. This validates local text parsing only; it does not scrape, log in, buy, message sellers, or bypass security.",
        "",
        f"- Candidates parsed: {len(rows)}",
        f"- Checks passed: {len(checks)}",
        "",
        "## Checks",
        "",
    ]
    lines.extend(f"- {check}" for check in checks)
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return {"rows": len(rows), "checks": len(checks)}


def main() -> None:
    result = run_validation()
    print(f"Search capture validation passed: {result['rows']} candidate(s), {result['checks']} check(s).")
    print(f"Report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
