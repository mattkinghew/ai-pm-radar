"""Evaluate manually maintained listings from data/listings.csv."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, List

from report import write_all_candidate_reports
from rules import SMART_FIELDS, evaluate_item


ROOT = Path(__file__).resolve().parents[1]
LISTINGS_CSV = ROOT / "data" / "listings.csv"
BASE_FIELDS = ["url", "title", "price", "description", "intended_use"]


def read_listings(path: Path = LISTINGS_CSV) -> List[Dict[str, str]]:
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        rows = []
        for row in reader:
            item = {field: row.get(field, "") for field in BASE_FIELDS}
            for field in SMART_FIELDS:
                item[field] = row.get(field, "")
            rows.append(item)
        return rows


def main() -> None:
    listings = read_listings()
    results = [evaluate_item(item) for item in listings]
    write_all_candidate_reports(results)
    print(f"Evaluated {len(results)} listing(s). Reports written to reports/.")


if __name__ == "__main__":
    main()
