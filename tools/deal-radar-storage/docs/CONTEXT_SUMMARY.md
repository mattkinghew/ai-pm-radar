# CONTEXT SUMMARY — deal-radar-storage v3

## Project goal

deal-radar-storage 是一個本地 Python 工具，用 rule-based workflow 協助評估二手 SSD / HDD / 硬碟盒 listing。它輸出 score、decision、suggested price range、use-case fit、seller questions、evidence checklist 和 validation report。

核心定位：AI PM / AI Engineer portfolio-ready 的 decision support prototype。

## Current version status

Current version: v3 Browser-assisted Manual Capture baseline.

v3 重點是新增本地手動 capture workflow：使用者手動打開 listing page，手動複製可見文字到 `captures/raw/*.txt`，工具只解析本地文字並輸出 `captures/parsed_listings.csv`。使用者確認後可 append 到 `data/discovered_listings.csv`，再用現有 evaluator 評估。

v2.9 Real Market Screening Rules 仍保留：根據真實二手 SSD trial 補強 market screening rules，特別針對 external Mac work drive 目標：2TB NVMe TLC SSD、資料安全／可靠性優先、價格合理、之後配合 RTL9210B / ASM2362 enclosure 使用。

## File structure

```text
captures/
  raw/
    .gitkeep
    sample_sn730_good.txt
    sample_fake_990pro.txt
    sample_qvo_overpriced.txt
  processed/
    .gitkeep
    capture_report.md
    capture_validation.md
  parsed_listings.csv
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
  REAL_PURCHASE_TRIAL.md
  BROWSER_ASSISTED_CAPTURE.md
reports/
  today.md
  today.csv
  rejects.md
  real_trial_summary.md
  sample_validation.md
  avoid_patterns.md
  search_strategy.md
src/
  capture_parse.py
  cli.py
  discover.py
  evaluate.py
  evaluate_links.py
  platform_urls.py
  quick_analyze.py
  report.py
  rules.py
  search_queries.py
  search_requirements.py
  validate_capture_samples.py
  validate_samples.py
README.md
```

## Completed features

- Link-only mode：`python3 src/evaluate_links.py`
- Requirements-only mode：`python3 src/search_requirements.py`
- Manual CSV evaluation：`python3 src/evaluate.py`
- Rule engine：category、interface、model、risk keyword、SMART、decision、price、use-case、seller follow-up。
- Reports：Traditional Chinese Markdown and CSV outputs。
- Sample validation：20 samples，覆蓋 suspicious 990 Pro、MZVLB health 40、870 QVO、NGFF SATA、低信任 mSATA、SanDisk H3、good SN730、good KC3000 等真實市場案例。
- Documentation package：portfolio presentation docs。
- Optional CLI：`src/cli.py` 支援 `evaluate`、`links`、`search`、`validate`、`quick`、`discover`、`capture`。
- Quick analyze mode：`src/quick_analyze.py` 支援 links-only、requirements-only、mixed quick workflow。
- Discovery preparation mode：`src/discover.py` 支援 requirements-only discovery queries、platform URLs、manual listing template。
- v2.9 reports：`avoid_patterns.md`、`search_strategy.md`，用於下一輪更精準搜尋。
- v3 capture mode：`src/capture_parse.py` 解析本地 raw text，輸出 `captures/parsed_listings.csv` 和 `captures/processed/capture_report.md`。
- v3 capture validation：`src/validate_capture_samples.py` 驗證 sample capture parsing。

## Known limitations

- 價格區間不是即時市場價格。
- SMART 資料需要使用者或賣家提供，工具不能驗證截圖真偽。
- Capture parser 只能解析使用者手動複製的文字；若原始文字太混亂，仍需人工校對。
- Rule coverage 只包含目前列出的型號、風險詞和用途。
- Missing data 會導致 `NEED_MORE_INFO`，這是設計選擇，不是錯誤。
- 工具不處理真實平台登入、付款、賣家信譽或物流風險。

## Safety boundaries

- No auto-buying。
- No aggressive scraping。
- No credentials。
- No API keys。
- No automatic seller messaging。
- Human confirmation required before purchase。
- SMART data is advisory, not a health guarantee。
- v3 capture mode only parses local text manually copied by the user.

## Suggested next prompts for Codex

### Prompt 1 — v3.1 capture parser polish

```text
Upgrade deal-radar-storage to v3.1.
Improve capture parsing for messy Goofish pasted text, especially multi-line prices, seller location lines, and SMART screenshots manually transcribed as text.
Keep it local-only and do not add scraping, auto-buying, credentials, API keys, or automatic messaging.
Run python3 src/validate_capture_samples.py, python3 src/cli.py capture, python3 src/cli.py validate, python3 src/validate_samples.py, and python3 -m compileall src.
```

### Prompt 2 — expand capture samples

```text
Add 10 more safe local sample capture text files under captures/raw/.
Include messy pasted text, missing URL, missing price, QVO, mSATA, good PM9A1, and good KC3000 examples.
Update src/validate_capture_samples.py to check the new samples.
```

### Prompt 3 — portfolio polish

```text
Polish docs/CASE_STUDY.md for AI Product Manager job applications.
Keep it factual and avoid claiming commercial users, backend, AI scoring, scraping, or auto-buying.
Add a 60-second interview pitch section.
```
