"""Optional command-line interface for deal-radar-storage.

This CLI is a thin beginner-friendly wrapper around the existing scripts.
It does not change the scoring engine and does not add scraping, buying,
credentials, login bypass, API keys, or platform security bypass.

Examples:
    python3 src/cli.py evaluate
    python3 src/cli.py links
    python3 src/cli.py search
    python3 src/cli.py validate
    python3 src/cli.py quick
    python3 src/cli.py discover --requirements config/requirements.ssd.yml
    python3 src/cli.py capture
    python3 src/cli.py search-capture
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List

from evaluate import LISTINGS_CSV, evaluate_listings, read_listings
from evaluate_links import LINKS_TXT, build_candidates
from report import REPORTS_DIR, write_all_candidate_reports
from rules import evaluate_item
from search_requirements import REQUIREMENT_FILES, write_search_report
from validate_samples import SAMPLE_CSV, compare_samples, read_samples, write_validation_report
from quick_analyze import DEFAULT_REQUIREMENT_FILE, LINKS_TXT as QUICK_LINKS_TXT, print_quick_summary, run_quick
from discover import DEFAULT_REQUIREMENT_FILES as DISCOVER_REQUIREMENT_FILES, print_discovery_summary, run_discovery
from capture_parse import CAPTURE_REPORT_MD, PARSED_LISTINGS_CSV, RAW_CAPTURE_DIR, print_capture_summary, run_capture
from search_capture_parse import RAW_SEARCH_DIR, SEARCH_CANDIDATES_CSV, print_search_capture_summary, run_search_capture


def as_path(value: str) -> Path:
    return Path(value).expanduser()


def print_candidate_summary(count: int, output_dir: Path) -> None:
    print(f"Evaluated {count} candidate(s).")
    print(f"Reports written to {output_dir}:")
    print("- today.md")
    print("- today.csv")
    print("- rejects.md")


def run_evaluate(args: argparse.Namespace) -> None:
    input_path = as_path(args.input)
    output_dir = as_path(args.output_dir)
    listings, stats = read_listings(input_path, return_stats=True)
    results = evaluate_listings(listings)
    write_all_candidate_reports(results, output_dir, evaluation_stats=stats)
    print_candidate_summary(len(results), output_dir)
    print(f"Skipped {stats['empty_rows_skipped']} empty placeholder row(s).")


def run_links(args: argparse.Namespace) -> None:
    input_path = as_path(args.input)
    output_dir = as_path(args.output_dir)
    candidates = build_candidates(input_path)
    results = [evaluate_item(item) for item in candidates]
    write_all_candidate_reports(results, output_dir)
    print_candidate_summary(len(results), output_dir)


def run_search(args: argparse.Namespace) -> None:
    output_dir = as_path(args.output_dir)
    requirement_files = [as_path(path) for path in args.requirements]
    write_search_report(requirement_files, output_dir)



def run_discover(args: argparse.Namespace) -> None:
    output_dir = as_path(args.output_dir)
    requirement_files = [as_path(path) for path in args.requirements]
    summary = run_discovery(requirement_files=requirement_files, output_dir=output_dir)
    print_discovery_summary(summary)

def run_validate(args: argparse.Namespace) -> None:
    input_path = as_path(args.input)
    output_dir = as_path(args.output_dir)
    output_path = output_dir / "sample_validation.md"
    samples = read_samples(input_path)
    comparisons = compare_samples(samples)
    write_validation_report(comparisons, output_path)
    matched = sum(1 for item in comparisons if item["matched"] == "PASS")
    mismatched = len(comparisons) - matched
    print(f"Validated {len(comparisons)} sample(s): {matched} matched, {mismatched} mismatch(es).")
    print(f"Report written to {output_path}")


def run_quick_command(args: argparse.Namespace) -> None:
    links_path = as_path(args.links) if args.links else None
    manual_csv_path = as_path(args.listings) if args.listings else None
    requirement_files = [as_path(path) for path in args.requirements] if args.requirements else None
    output_dir = as_path(args.output_dir)
    try:
        summary = run_quick(
            links_path=links_path,
            manual_csv_path=manual_csv_path,
            requirement_files=requirement_files,
            output_dir=output_dir,
        )
    except FileNotFoundError as error:
        print(f"Quick analyze could not start: {error}")
        print("Try one of these commands:")
        print("- python3 src/cli.py quick --links data/links.txt")
        print("- python3 src/cli.py quick --requirements config/requirements.ssd.yml")
        print("- python3 src/cli.py quick --links data/links.txt --listings data/listings.csv --requirements config/requirements.ssd.yml")
        return
    print_quick_summary(summary)


def run_capture_command(args: argparse.Namespace) -> None:
    input_dir = as_path(args.input_dir)
    output = as_path(args.output)
    report = as_path(args.report)
    append_to = as_path(args.append_to) if args.append_to else None
    summary = run_capture(input_dir=input_dir, output_path=output, report_path=report, append_to=append_to)
    print_capture_summary(summary)


def run_search_capture_command(args: argparse.Namespace) -> None:
    input_dir = as_path(args.input_dir)
    output = as_path(args.output)
    summary = run_search_capture(input_dir=input_dir, output_path=output)
    print_search_capture_summary(summary)


def add_output_dir_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--output-dir",
        default=str(REPORTS_DIR),
        help="Output directory for generated reports. Default: reports/",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="deal-radar-storage v2.8 optional CLI. Rule-based, local, and safe by default."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    evaluate_parser = subparsers.add_parser("evaluate", help="Evaluate data/listings.csv.")
    evaluate_parser.add_argument(
        "--input",
        default=str(LISTINGS_CSV),
        help="Input listings CSV. Default: data/listings.csv",
    )
    add_output_dir_argument(evaluate_parser)
    evaluate_parser.set_defaults(func=run_evaluate)

    links_parser = subparsers.add_parser("links", help="Evaluate product links from data/links.txt.")
    links_parser.add_argument(
        "--input",
        default=str(LINKS_TXT),
        help="Input links text file. Default: data/links.txt",
    )
    add_output_dir_argument(links_parser)
    links_parser.set_defaults(func=run_links)

    search_parser = subparsers.add_parser("search", help="Generate manual search URLs from requirement YAML files.")
    search_parser.add_argument(
        "--requirements",
        nargs="+",
        default=[str(path) for path in REQUIREMENT_FILES],
        help="One or more requirement YAML files. Default: config/requirements.ssd.yml config/requirements.hdd.yml",
    )
    add_output_dir_argument(search_parser)
    search_parser.set_defaults(func=run_search)

    discover_parser = subparsers.add_parser("discover", help="Prepare manual discovery queries, platform URLs, and discovered listings template.")
    discover_parser.add_argument(
        "--requirements",
        nargs="+",
        default=[str(path) for path in DISCOVER_REQUIREMENT_FILES],
        help="One or more requirement YAML files. Default: config/requirements.ssd.yml",
    )
    add_output_dir_argument(discover_parser)
    discover_parser.set_defaults(func=run_discover)

    validate_parser = subparsers.add_parser("validate", help="Validate representative sample listings.")
    validate_parser.add_argument(
        "--input",
        default=str(SAMPLE_CSV),
        help="Input sample CSV. Default: data/sample_real_listings.csv",
    )
    add_output_dir_argument(validate_parser)
    validate_parser.set_defaults(func=run_validate)


    quick_parser = subparsers.add_parser("quick", help="Run hurry-friendly quick analysis from links, requirements, or both.")
    quick_parser.add_argument(
        "--links",
        default=None,
        help=f"Links text file. If omitted with no requirements, defaults to {QUICK_LINKS_TXT.relative_to(Path(__file__).resolve().parents[1])} when available.",
    )
    quick_parser.add_argument(
        "--listings",
        default=None,
        help="Optional listings CSV with manual title/price/SMART metadata for the same URLs. Default: data/listings.csv when links are used.",
    )
    quick_parser.add_argument(
        "--requirements",
        nargs="+",
        default=None,
        help=f"One or more requirement YAML files. If omitted with no links, defaults to {DEFAULT_REQUIREMENT_FILE.relative_to(Path(__file__).resolve().parents[1])} when available.",
    )
    add_output_dir_argument(quick_parser)
    quick_parser.set_defaults(func=run_quick_command)

    capture_parser = subparsers.add_parser("capture", help="Parse manually copied browser listing text from captures/raw/*.txt.")
    capture_parser.add_argument(
        "--input-dir",
        default=str(RAW_CAPTURE_DIR),
        help="Directory containing manually copied .txt capture files. Default: captures/raw",
    )
    capture_parser.add_argument(
        "--output",
        default=str(PARSED_LISTINGS_CSV),
        help="Output parsed CSV path. Default: captures/parsed_listings.csv",
    )
    capture_parser.add_argument(
        "--report",
        default=str(CAPTURE_REPORT_MD),
        help="Capture report path. Default: captures/processed/capture_report.md",
    )
    capture_parser.add_argument(
        "--append-to",
        default=None,
        help="Optional target CSV to append parsed rows to, e.g. data/discovered_listings.csv. Duplicate URLs are skipped.",
    )
    capture_parser.set_defaults(func=run_capture_command)

    search_capture_parser = subparsers.add_parser("search-capture", help="Parse manually copied search result text and rank candidates for triage.")
    search_capture_parser.add_argument(
        "--input-dir",
        default=str(RAW_SEARCH_DIR),
        help="Directory containing manually copied search result .txt files. Default: captures/raw_search",
    )
    search_capture_parser.add_argument(
        "--output",
        default=str(SEARCH_CANDIDATES_CSV),
        help="Output search candidates CSV path. Default: captures/search_candidates.csv",
    )
    search_capture_parser.set_defaults(func=run_search_capture_command)

    return parser


def main(argv: Iterable[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    args.func(args)


if __name__ == "__main__":
    main()
