# CONTEXT SUMMARY — deal-radar-storage v2.8

## Project goal

deal-radar-storage 是一個本地 Python 工具，用 rule-based workflow 協助評估二手 SSD / HDD / 硬碟盒 listing。它輸出 score、decision、suggested price range、use-case fit、seller questions、evidence checklist 和 validation report。

核心定位：AI PM / AI Engineer portfolio-ready 的 decision support prototype。

## Current version status

Current version: v2.8 discovery preparation mode baseline.

v2.8 重點是新增 discovery preparation mode，讓使用者只有 requirements YAML 時，也能生成 discovery queries、Goofish / Taobao / JD 手動搜尋 URL，以及 `data/discovered_listings.csv` 人工確認模板。v2.7 quick analyze mode 已整合 discovery outputs。

基線功能來自 v2.4.1，documentation package 來自 v2.5：

- 三種輸入模式。
- SMART scoring and hard reject。
- Purchase decision。
- Suggested price range。
- Use-case fit evaluation。
- Seller question and evidence checklist。
- Sample validation workflow。

## File structure

```text
config/
  requirements.ssd.yml
  requirements.hdd.yml
data/
  links.txt
  listings.csv
  sample_real_listings.csv
  discovered_listings.csv
docs/
  PRODUCT_BRIEF.md
  CASE_STUDY.md
  RULE_DESIGN.md
  VALIDATION_REPORT.md
  SAFETY_BOUNDARIES.md
  ROADMAP.md
  CONTEXT_SUMMARY.md
reports/
  today.md
  today.csv
  rejects.md
  search_urls.md
  sample_validation.md
  quick_report.md
  quick_report.csv
  quick_questions.md
  buying_criteria.md
  quick_checklist.md
  discovery_queries.md
  discovery_urls.md
  discovery_summary.md
screenshots/
src/
  evaluate.py
  evaluate_links.py
  search_requirements.py
  rules.py
  report.py
  validate_samples.py
  cli.py
  quick_analyze.py
  discover.py
  search_queries.py
  platform_urls.py
README.md
```

## Completed features

- Link-only mode：`python3 src/evaluate_links.py`
- Requirements-only mode：`python3 src/search_requirements.py`
- Manual CSV evaluation：`python3 src/evaluate.py`
- Rule engine：category、interface、model、risk keyword、SMART、decision、price、use-case、seller follow-up。
- Reports：Traditional Chinese Markdown and CSV outputs。
- Sample validation：12 samples，12 matched，0 mismatches。
- Documentation package：7 docs for portfolio presentation。
- Optional CLI：`src/cli.py` 支援 `evaluate`、`links`、`search`、`validate`、`quick`。
- Quick analyze mode：`src/quick_analyze.py` 支援 links-only、requirements-only、mixed quick workflow。
- Discovery preparation mode：`src/discover.py` 支援 requirements-only discovery queries、platform URLs、manual listing template。
- Quick reports：`quick_report.md`、`quick_report.csv`、`quick_questions.md`、`buying_criteria.md`、`quick_checklist.md`。
- Discovery reports：`discovery_queries.md`、`discovery_urls.md`、`discovery_summary.md`、`data/discovered_listings.csv`。

## Known limitations

- 價格區間不是即時市場價格。
- SMART 資料需要使用者或賣家提供，工具不能驗證截圖真偽。
- Rule coverage 只包含目前列出的型號、風險詞和用途。
- Missing data 會導致 `NEED_MORE_INFO`，這是設計選擇，不是錯誤。
- 工具不處理真實平台登入、付款、賣家信譽或物流風險。

## Safety boundaries

- No auto-buying。
- No login bypass。
- No aggressive scraping。
- No credentials。
- No API keys。
- No platform security bypass。
- Human confirmation required before purchase。
- SMART data is advisory, not a health guarantee。

## Suggested next prompts for Codex

### Prompt 1 — v2.9 discovery polish

```text
Upgrade deal-radar-storage to v2.9.
Polish discovery and quick mode error messages for missing links files, missing requirement YAML files, invalid CSV columns, empty generated queries, and invalid output directories.
Keep existing scripts and CLI commands working.
Do not add scraping, auto-buying, credentials, login bypass, API keys, or platform security bypass.
Run python3 src/cli.py discover --requirements config/requirements.ssd.yml, python3 src/cli.py quick, python3 src/cli.py validate, python3 src/validate_samples.py, and python3 -m compileall src.
```

### Prompt 2 — expand sample validation

```text
Expand data/sample_real_listings.csv from 12 to 20 samples.
Add more HDD, SATA SSD, external Mac drive, and test_only cases.
Update expected_decision and expected_comment.
Run python3 src/validate_samples.py and update docs/VALIDATION_REPORT.md if counts change.
```

### Prompt 3 — portfolio polish

```text
Polish docs/CASE_STUDY.md for AI Product Manager job applications.
Keep it factual and avoid claiming commercial users, backend, AI scoring, scraping, or auto-buying.
Add a 60-second interview pitch section.
```
