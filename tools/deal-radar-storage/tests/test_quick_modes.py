from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from quick_analyze import run_quick  # noqa: E402


EXAMPLES_DIR = ROOT / "examples" / "inputs"
LINKS_ONLY_PATH = EXAMPLES_DIR / "links_only.txt"
REQUIREMENTS_PATH = EXAMPLES_DIR / "requirements_portable_ssd.yml"
COMBINED_LINKS_PATH = EXAMPLES_DIR / "combined.links.txt"
COMBINED_LISTINGS_PATH = EXAMPLES_DIR / "combined.listings.csv"


class QuickModeTests(unittest.TestCase):
    def test_links_only_mode_generates_reports(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            summary = run_quick(
                links_path=COMBINED_LINKS_PATH,
                manual_csv_path=COMBINED_LISTINGS_PATH,
                output_dir=Path(tmp_dir),
            )

            self.assertEqual(len(summary["results"]), 2)
            self.assertTrue((Path(tmp_dir) / "quick_report.md").exists())
            self.assertTrue((Path(tmp_dir) / "quick_report.csv").exists())
            report_text = (Path(tmp_dir) / "quick_report.md").read_text(encoding="utf-8")
            self.assertIn("BUY_CANDIDATE: 1", report_text)
            self.assertIn("REJECT: 1", report_text)

    def test_requirements_only_mode_generates_guidance_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            summary = run_quick(
                requirement_files=[REQUIREMENTS_PATH],
                output_dir=Path(tmp_dir),
            )

            self.assertEqual(summary["results"], [])
            for filename in [
                "quick_report.md",
                "quick_report.csv",
                "quick_questions.md",
                "search_urls.md",
                "discovery_queries.md",
                "discovery_urls.md",
                "buying_criteria.md",
                "quick_checklist.md",
            ]:
                self.assertTrue((Path(tmp_dir) / filename).exists(), filename)
            report_text = (Path(tmp_dir) / "quick_report.md").read_text(encoding="utf-8")
            self.assertIn("已分析連結數: 0", report_text)
            self.assertIn("Discovery prep", report_text)

    def test_combined_mode_generates_scoring_and_search_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            summary = run_quick(
                links_path=COMBINED_LINKS_PATH,
                manual_csv_path=COMBINED_LISTINGS_PATH,
                requirement_files=[REQUIREMENTS_PATH],
                output_dir=Path(tmp_dir),
            )

            self.assertEqual(len(summary["results"]), 2)
            self.assertTrue((Path(tmp_dir) / "search_urls.md").exists())
            self.assertTrue((Path(tmp_dir) / "quick_report.md").exists())
            report_text = (Path(tmp_dir) / "quick_report.md").read_text(encoding="utf-8")
            self.assertIn("BUY_CANDIDATE: 1", report_text)
            self.assertIn("Discovery prep", report_text)


if __name__ == "__main__":
    unittest.main()
