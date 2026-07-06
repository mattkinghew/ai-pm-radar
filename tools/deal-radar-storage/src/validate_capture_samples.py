"""Validate v3 browser-assisted manual capture samples.

This validation uses local sample .txt files only. It does not scrape, log in,
open browser pages, message sellers, buy products, or bypass platform security.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from capture_parse import PROCESSED_CAPTURE_DIR, RAW_CAPTURE_DIR, parse_capture_files


REPORT_PATH = PROCESSED_CAPTURE_DIR / "capture_validation.md"


def find_row(rows: List[Dict[str, str]], source_file: str) -> Dict[str, str]:
    for row in rows:
        if row.get("source_file") == source_file:
            return row
    raise AssertionError(f"Missing parsed row for {source_file}")


def assert_contains(value: str, expected: str, label: str) -> None:
    if expected.lower() not in str(value or "").lower():
        raise AssertionError(f"{label} expected to contain {expected!r}, got {value!r}")


def run_validation(input_dir: Path = RAW_CAPTURE_DIR, report_path: Path = REPORT_PATH) -> Dict[str, int]:
    rows = parse_capture_files(input_dir)
    checks: List[str] = []

    if len(rows) < 3:
        raise AssertionError(f"Expected at least 3 parsed rows, got {len(rows)}")
    checks.append(f"PASS: parsed {len(rows)} rows")

    sn730 = find_row(rows, "sample_sn730_good.txt")
    assert_contains(sn730.get("title", ""), "SN730", "SN730 title")
    if sn730.get("price") != "850":
        raise AssertionError(f"SN730 price expected 850, got {sn730.get('price')!r}")
    if sn730.get("health_percent") != "98":
        raise AssertionError(f"SN730 health expected 98, got {sn730.get('health_percent')!r}")
    if sn730.get("host_writes_tb") != "20":
        raise AssertionError(f"SN730 host_writes_tb expected 20, got {sn730.get('host_writes_tb')!r}")
    checks.append("PASS: sample_sn730_good extracts title, price, health_percent, host_writes_tb")

    fake_990 = find_row(rows, "sample_fake_990pro.txt")
    combined = " ".join([fake_990.get("title", ""), fake_990.get("description", ""), fake_990.get("notes", "")])
    for risk in ["不保品牌", "只保正常使用", "图吧", "打包"]:
        assert_contains(combined, risk, f"fake 990 risk {risk}")
    checks.append("PASS: sample_fake_990pro keeps risk keywords in description/notes")

    qvo = find_row(rows, "sample_qvo_overpriced.txt")
    if qvo.get("price") != "770":
        raise AssertionError(f"QVO price expected 770, got {qvo.get('price')!r}")
    if qvo.get("health_percent") != "92":
        raise AssertionError(f"QVO health expected 92, got {qvo.get('health_percent')!r}")
    checks.append("PASS: sample_qvo_overpriced extracts price and health")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Capture Sample Validation",
        "",
        "> v3 browser-assisted manual capture validation. This validates local sample text parsing only; it does not scrape, log in, buy, message sellers, or bypass security.",
        "",
        f"- Samples parsed: {len(rows)}",
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
    print(f"Capture validation passed: {result['rows']} row(s), {result['checks']} check(s).")
    print(f"Report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
