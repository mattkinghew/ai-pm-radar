# CONTEXT SUMMARY — deal-radar-storage v3.1

## Project goal

deal-radar-storage 是一個本地 Python 工具，用 rule-based workflow 協助評估二手 SSD / HDD / 硬碟盒 listing。它輸出 score、decision、suggested price range、use-case fit、seller questions、evidence checklist 和 validation report。

核心定位：AI PM / AI Engineer portfolio-ready 的 decision support prototype。

## Current version status

Current version: v3.1 Search Result Batch Capture and Seller / Price Reliability Screening baseline.

v3.1 重點是新增 search result batch capture：使用者手動打開搜尋結果頁，手動複製可見文字到 `captures/raw_search/*.txt`，工具只解析本地文字，輸出 `captures/search_candidates.csv`，並生成 candidate queue、price reliability、seller risk 三份報告。使用者再只打開 Top 3–5 個 HIGH / MEDIUM 候選。

v3 Browser-assisted Manual Capture 仍保留：使用者手動打開 listing page，手動複製完整可見文字到 `captures/raw/*.txt`，工具解析成 `captures/parsed_listings.csv`。確認後可 append 到 `data/discovered_listings.csv`，再用 evaluator 評估。

## File structure

```text
captures/
  raw/
    sample_sn730_good.txt
    sample_fake_990pro.txt
    sample_qvo_overpriced.txt
  processed/
    capture_report.md
    capture_validation.md
  raw_search/
    sample_sn730_search_results.txt
    sample_bad_broad_2tb_search_results.txt
    sample_pm9a1_mixed_results.txt
  search_processed/
    search_capture_validation.md
  parsed_listings.csv
  search_candidates.csv
config/
  requirements.ssd.yml
  requirements.hdd.yml
data/
  links.txt
  listings.csv
  sample_real_listings.csv
  discovered_listings.csv
docs/
  BROWSER_ASSISTED_CAPTURE.md
  SEARCH_RESULT_BATCH_CAPTURE.md
  REAL_PURCHASE_TRIAL.md
  RULE_DESIGN.md
  SAFETY_BOUNDARIES.md
  ROADMAP.md
  CONTEXT_SUMMARY.md
reports/
  candidate_queue.md
  price_reliability.md
  seller_risk.md
  today.md
  today.csv
  rejects.md
  real_trial_summary.md
  sample_validation.md
  avoid_patterns.md
  search_strategy.md
src/
  capture_parse.py
  search_capture_parse.py
  validate_capture_samples.py
  validate_search_capture_samples.py
  cli.py
  evaluate.py
  rules.py
  report.py
README.md
```

## Completed features

- Link-only mode：`python3 src/evaluate_links.py`
- Requirements-only mode：`python3 src/search_requirements.py`
- Manual CSV evaluation：`python3 src/evaluate.py`
- Optional CLI：`src/cli.py` 支援 `evaluate`、`links`、`search`、`validate`、`quick`、`discover`、`capture`、`search-capture`。
- v2.9 market screening：加強 mSATA / NGFF SATA、QVO / QLC、低信任品牌、賣家不保品牌、低價可疑 990 Pro、低健康度 work-drive 不適配等規則。
- v3 capture mode：`src/capture_parse.py` 解析本地 raw listing text。
- v3.1 search result capture：`src/search_capture_parse.py` 解析本地 raw search result text，產生 `follow_up_priority`、`price_reliability`、`option_price_risk`、`seller_risk_level`。
- Sample validation：20 real-market rule samples，20 matched，0 mismatches。
- Capture validation：3 local listing capture samples。
- Search capture validation：3 local search-result samples，覆蓋 HIGH / MEDIUM、SKIP、option price risk、low price reliability。

## Known limitations

- 價格區間不是即時市場價格。
- SMART 資料需要使用者或賣家提供，工具不能驗證截圖真偽。
- Capture parser 和 search-capture parser 只能解析使用者手動複製的文字；若原始文字太混亂，仍需人工校對。
- 搜尋結果顯示價可能不是實際 2TB 選項價，工具只能提醒風險，不能保證真實價格。
- Rule coverage 只包含目前列出的型號、風險詞和用途。
- 工具不處理真實平台登入、付款、賣家信譽或物流風險。

## Safety boundaries

- No auto-buying。
- No aggressive scraping。
- No credentials。
- No API keys。
- No automatic seller messaging。
- No automatic page crawling。
- Human confirmation required before purchase。
- SMART data is advisory, not a health guarantee。
- v3 / v3.1 only parse local text manually copied by the user.

## Suggested next prompts for Codex

### Prompt 1 — v3.2 search-capture parser polish

```text
Upgrade deal-radar-storage to v3.2.
Improve search-capture parsing for messy copied Goofish search result text where one candidate spans multiple lines without blank separators.
Keep it local-only and do not add scraping, auto-buying, credentials, API keys, automatic page opening, or automatic messaging.
Run python3 src/validate_search_capture_samples.py, python3 src/cli.py search-capture, python3 src/validate_capture_samples.py, python3 src/cli.py validate, python3 src/validate_samples.py, and python3 -m compileall src.
```

### Prompt 2 — expand search capture samples

```text
Add 10 more safe local sample search-result text files under captures/raw_search/.
Include missing URL, mixed capacities, misleading displayed prices, seller no-return terms, positive SMART evidence, and borderline NVMe candidates.
Update src/validate_search_capture_samples.py to check the new samples.
```

### Prompt 3 — portfolio polish

```text
Polish docs/CASE_STUDY.md for AI Product Manager job applications.
Keep it factual and avoid claiming commercial users, backend, AI scoring, scraping, or auto-buying.
Add a 60-second interview pitch section.
```
