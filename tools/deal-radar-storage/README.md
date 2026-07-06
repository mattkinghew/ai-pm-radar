# deal-radar-storage v2.8

A beginner-friendly, rule-based storage deal helper with optional SMART checks, purchase decisions, suggested price ranges, use-case fit evaluation, seller questions, evidence checklists, sample validation, a portfolio-ready documentation package, an optional argparse CLI, and a quick analyze mode for hurry-friendly link / requirements workflows, and discovery preparation from requirements YAML.

It supports three workflows:

1. **Link-only mode**: paste product links into `data/links.txt`.
2. **Requirements-only mode**: edit `config/requirements.ssd.yml` and `config/requirements.hdd.yml`.
3. **Combined mode**: use links plus manually pasted title / price / description / SMART / intended use in `data/listings.csv`.
4. **Decision mode**: review `decision`, `suggested_price_min`, `suggested_price_max`, `price_comment`, `use_case_fit`, and `use_case_comment` before messaging a seller.
5. **Seller question mode**: use `next_action`, `seller_questions`, and `evidence_required` to ask for proof before paying.
6. **Sample validation mode**: run representative real-world-like examples to check whether rule changes still behave as expected.
7. **Quick analyze mode**: run one command when you only have links, requirements YAML, or both.
8. **Discovery preparation mode**: start from requirements YAML and generate manual discovery queries, platform search URLs, and a CSV template for confirmed listings.

## Safety boundaries

This tool does **not**:

- auto-buy products
- bypass login
- bypass platform security
- use credentials, cookies, API keys, or private tokens
- aggressively scrape websites

The tool is designed to help you shortlist items and prepare seller questions manually. It never contacts sellers for you.

## Real Purchase Trial Quick Start

Use this workflow when you want to manually search real SSD listings, copy promising items into a CSV, and run the local rule-based evaluator before messaging a seller.

```bash
python3 src/cli.py discover --requirements config/requirements.ssd.yml
open reports/discovery_urls.md
open data/discovered_listings.csv
python3 src/cli.py evaluate --input data/discovered_listings.csv
open reports/today.md
open reports/rejects.md
```

Warning:

- The tool does not buy products.
- It does not verify seller honesty.
- Final purchase decision still requires checking SMART screenshots, physical photos, seller reputation, and return terms.

For the full workflow, see [Real purchase trial guide](docs/REAL_PURCHASE_TRIAL.md).

## Project structure

```text
config/requirements.ssd.yml
config/requirements.hdd.yml
data/links.txt
data/listings.csv
data/sample_real_listings.csv
data/discovered_listings.csv
reports/today.md
reports/today.csv
reports/rejects.md
reports/search_urls.md
reports/sample_validation.md
reports/quick_report.md
reports/quick_report.csv
reports/quick_questions.md
reports/buying_criteria.md
reports/quick_checklist.md
reports/discovery_queries.md
reports/discovery_urls.md
reports/discovery_summary.md
docs/PRODUCT_BRIEF.md
docs/CASE_STUDY.md
docs/RULE_DESIGN.md
docs/VALIDATION_REPORT.md
docs/SAFETY_BOUNDARIES.md
docs/ROADMAP.md
docs/CONTEXT_SUMMARY.md
screenshots/
src/evaluate.py
src/evaluate_links.py
src/search_requirements.py
src/rules.py
src/report.py
src/validate_samples.py
src/cli.py
src/quick_analyze.py
src/discover.py
src/search_queries.py
src/platform_urls.py
```


## Portfolio documentation

v2.5 added a portfolio-ready documentation package for AI PM / AI Engineer presentation:

- [Product brief](docs/PRODUCT_BRIEF.md): product summary, target users, pain points, MVP scope, non-goals, metrics, risks, and positioning.
- [Case study](docs/CASE_STUDY.md): Traditional Chinese product case study with AI PM / AI Engineer framing.
- [Rule design](docs/RULE_DESIGN.md): explanation of category/model/risk/SMART/decision/price/use-case/seller-evidence rules.
- [Validation report](docs/VALIDATION_REPORT.md): sample validation workflow and current 12/12 matched result.
- [Safety boundaries](docs/SAFETY_BOUNDARIES.md): explicit no auto-buying, no login bypass, no aggressive scraping, no credentials, and no API keys.
- [Roadmap](docs/ROADMAP.md): v2.5 documentation baseline, v2.6 CLI usability baseline, and possible v3 directions.
- [Context summary](docs/CONTEXT_SUMMARY.md): project state, file structure, completed features, limitations, and next Codex prompts.


## Quick analyze mode

v2.7 adds a quick workflow for when you are in a hurry and only have links, requirements, or both. It is still local, rule-based, and beginner-friendly. It does not add scraping, auto-buying, credentials, login bypass, API keys, or platform security bypass.

Analyze links only:

```bash
python3 src/cli.py quick --links data/links.txt
```

Analyze requirements only:

```bash
python3 src/cli.py quick --requirements config/requirements.ssd.yml
```

Analyze requirements and links together:

```bash
python3 src/cli.py quick --requirements config/requirements.ssd.yml --links data/links.txt
```

Run with default files when available:

```bash
python3 src/cli.py quick
```

Quick mode outputs:

- `reports/quick_report.md`: Traditional Chinese summary, candidate list, need-more-info list, reject list, next action, seller questions, and evidence required.
- `reports/quick_report.csv`: spreadsheet-friendly quick analysis table.
- `reports/quick_questions.md`: copy-and-paste seller messages for SSD, HDD, and enclosure listings.
- `reports/search_urls.md`: manual search URLs generated from requirements YAML.
- `reports/discovery_queries.md` and `reports/discovery_urls.md`: discovery preparation outputs generated when quick mode includes requirements.
- `reports/buying_criteria.md`: preferred models, search keywords, reject keywords, price bands, and seller question template.
- `reports/quick_checklist.md`: before buying checklist, seller evidence checklist, after receiving checklist, and red flags.


## Discovery preparation mode

v2.8 adds a safe discovery preparation workflow for when you only have a requirements YAML and want to search faster manually. It generates search phrases, clickable platform search URLs, and a CSV template for manual confirmation. It does not fetch, scrape, log in, store cookies, buy items, or bypass platform security.

Prepare SSD discovery:

```bash
python3 src/cli.py discover --requirements config/requirements.ssd.yml
```

Prepare HDD discovery with a custom output directory:

```bash
python3 src/cli.py discover --requirements config/requirements.hdd.yml --output-dir reports
```

Discovery mode outputs:

- `reports/discovery_queries.md`: human-readable search queries such as `SN740 2TB 閒魚` or `HC620 14T 普通 SATA 閒魚`.
- `reports/discovery_urls.md`: Goofish / Taobao / JD search URLs for manual clicking.
- `reports/discovery_summary.md`: requirement summary for target category, capacity, interface, budget, preferred models, and reject keywords.
- `data/discovered_listings.csv`: blank manual-fill template for listings discovered from those searches.

Recommended workflow:

1. Run `python3 src/cli.py discover --requirements config/requirements.ssd.yml`.
2. Open `reports/discovery_urls.md` manually.
3. Copy promising title / price / URL / SMART details into `data/discovered_listings.csv` or `data/listings.csv`.
4. Run `python3 src/cli.py evaluate --input data/discovered_listings.csv`.


## Optional CLI usage

v2.6 added an optional `argparse` CLI for users who want one entry point. The original beginner commands still work, so you do not need to use the CLI if the direct scripts are easier.

Evaluate manually maintained listings:

```bash
python3 src/cli.py evaluate
```

Use a custom input file or output directory:

```bash
python3 src/cli.py evaluate --input data/listings.csv --output-dir reports
```

Evaluate product links:

```bash
python3 src/cli.py links
```

Generate manual search URLs from default requirement files:

```bash
python3 src/cli.py search
```

Generate search URLs from one or more custom YAML files:

```bash
python3 src/cli.py search --requirements config/requirements.ssd.yml config/requirements.hdd.yml --output-dir reports
```

Validate representative sample listings:

```bash
python3 src/cli.py validate
```

Prepare discovery queries and manual listing template:

```bash
python3 src/cli.py discover --requirements config/requirements.ssd.yml
```

The CLI remains local and rule-based. It does not add scraping, auto-buying, credentials, login bypass, API keys, or platform security bypass.

## Commands

Generate manual search URLs from requirements:

```bash
python3 src/search_requirements.py
```

Evaluate manually maintained listings:

```bash
python3 src/evaluate.py
```

Evaluate links from `data/links.txt`:

```bash
python3 src/evaluate_links.py
```

Validate representative sample listings:

```bash
python3 src/validate_samples.py
```

## Input files

### `data/links.txt`

Paste one URL per line. Lines starting with `#` are ignored.

### `data/listings.csv`

Optional manual metadata. Recommended columns:

```csv
url,title,price,description,intended_use,health_percent,power_on_hours,host_writes_tb,reallocated_sector_count,current_pending_sector,offline_uncorrectable,media_integrity_errors,critical_warning,supports_return
```

`intended_use` is optional. Supported values:

- `main_work_drive`
- `docker_cache`
- `cold_storage`
- `backup_drive`
- `test_only`
- `external_mac_drive`

SMART columns are optional. Leave unknown values blank. The tool only applies SMART rules when values are provided. Missing SMART values can produce `NEED_MORE_INFO` instead of a buy decision.

Simple meaning:

- `health_percent`: SSD health percentage, for example `98`
- `power_on_hours`: power-on hours
- `host_writes_tb`: SSD total host writes in TB
- `reallocated_sector_count`: HDD reallocated sectors
- `current_pending_sector`: HDD pending sectors
- `offline_uncorrectable`: HDD offline uncorrectable count
- `media_integrity_errors`: SSD media/data integrity error count
- `critical_warning`: SSD critical warning value
- `supports_return`: `yes` / `no`, or `支持` / `不支持`

If a URL in `data/links.txt` also appears in `data/listings.csv`, the manual title / price / description / SMART / intended use are used.


### `data/sample_real_listings.csv`

v2.4.1 adds representative sample listings for regression checks. The file includes examples such as:

- good NVMe TLC SSD
- PM9A1 with 91% health
- overpriced PM9A1 with 90% health
- SN750 with high writes
- KC3000 missing SMART
- WD Blue SATA with high power-on hours
- WD Green SATA overpriced
- suspicious / fake SN770
- HC620 Feiniu / Windows cannot use
- normal SATA enterprise HDD
- RTL9210B enclosure

Extra validation columns:

- `expected_decision`: the expected rule-engine decision
- `expected_comment`: short human explanation of the expected result

Run this after changing rules:

```bash
python3 src/validate_samples.py
```

It creates `reports/sample_validation.md` with total samples, matched count, mismatch count, per-row comparison, and mismatch explanations.

### `config/requirements.*.yml`

Supported simple fields:

```yaml
preferred_models:
  - SN740
capacities:
  - 1TB
interfaces:
  - NVMe
keywords:
  - SSD
```

`pyyaml` is supported when installed. A very small fallback parser is included for simple key/list YAML.

## Seller questions and evidence checklist

v2.4 adds three output fields:

- `next_action`: what to do next, for example ask for proof, negotiate only, watch only, or reject.
- `seller_questions`: copyable questions to ask the seller.
- `evidence_required`: screenshots or written confirmations you should collect before paying.

For `NEED_MORE_INFO`, the tool asks questions based on missing fields such as SMART values, price, or return support.

SSD questions usually ask for:

- CrystalDiskInfo full screenshot
- `Critical Warning = 0`
- `Media/Data Integrity Errors = 0`
- Total Host Writes
- Power On Hours
- Health / Percentage Used
- whether return/testing is supported

HDD questions usually ask for:

- CrystalDiskInfo or `smartctl -a` full screenshot
- `Reallocated Sector Count = 0`
- `Current Pending Sector = 0`
- `Offline Uncorrectable = 0`
- Power On Hours
- confirmation that it is normal SATA, not Feiniu-only, not ZBC, not PC3000 modified, and not capacity-shielded
- whether USB dock / Windows / macOS can identify it

Enclosure questions usually ask for:

- controller chip confirmation: `RTL9210B` or `ASM2362`
- whether TRIM, UASP, and SMART passthrough are supported

For rejected listings, `rejects.md` also explains whether any seller answer could rescue the listing. A SMART hard reject should normally not be rescued unless the seller proves the original data was wrong.

## Use-case fit rules

The `use_case_fit` and `use_case_comment` fields explain whether the listing fits the selected `intended_use`.

### `main_work_drive`

- Prefer NVMe TLC / known NVMe models.
- Strongly penalize or warn against SATA, QLC, unknown brand, health < 95, or missing SMART.
- Intended for your primary work drive, so the rule is intentionally conservative.

### `docker_cache`

- Allows SSD health around 90–95 when the price is low.
- Rejects or warns against hard SMART failures such as `critical_warning` or `media_integrity_errors`.

### `cold_storage`

- HDD is allowed when danger SMART fields are provided and equal to 0.
- SATA SSD is allowed only when it is a known brand/model and low price.
- Do not store the only copy of important data on one second-hand drive.

### `backup_drive`

- Warns that one second-hand drive is not a complete backup strategy.
- Requires relevant SMART fields.
- Treat it as one backup layer only, not the full backup plan.

### `test_only`

- Allows weak or unknown listings only when the suggested price is very low.
- This is for experiments, compatibility testing, or learning, not important data.

### `external_mac_drive`

- Prefer NVMe plus reliable enclosure / bridge chip clues such as `RTL9210B` or `ASM2362`.
- Penalize high heat, unknown brand, QLC, and missing SMART.

## Purchase decision values

- `BUY_CANDIDATE`: score is strong and no hard reject exists. Still ask the seller for proof before paying.
- `NEGOTIATE_ONLY`: possible candidate, but only worth discussing at the right price.
- `WATCH_ONLY`: weak candidate; keep it on a watchlist rather than buying immediately.
- `REJECT`: hard reject exists or score is too low.
- `NEED_MORE_INFO`: key information is missing, such as SMART fields or price.

Decision rules:

1. Hard reject exists → `REJECT`
2. Missing key information and score is not already rejected → `NEED_MORE_INFO`
3. Score >= 80 → `BUY_CANDIDATE`
4. Score 60–79 → `NEGOTIATE_ONLY`
5. Score 40–59 → `WATCH_ONLY`
6. Score < 40 → `REJECT`

## Suggested price rules

The tool outputs rough CNY ranges only. These are negotiation references, not live market prices.

- PM9A1 2TB:
  - health >= 95: 800–950 CNY
  - health 90–94: 550–700 CNY
  - health < 90: reject or <= 500 CNY for test-only use
- SN750 2TB:
  - health >= 95 and host_writes_tb < 100: 700–850 CNY
  - health 85–94 or host_writes_tb > 200: 500–650 CNY
- SN730 / SN740 / Micron 3400 / KC3000 2TB:
  - health >= 95: 750–900 CNY
  - health 90–94: 550–750 CNY
- Low-end SATA / QLC 2TB:
  - 300–650 CNY depending on model
  - reject if price > 750 CNY
- Unknown brand / white-label SSD:
  - reject unless price <= 350 CNY and clearly marked as test-only

## SMART scoring rules

SSD rules:

- `health_percent >= 95`: add score
- `health_percent < 90`: strong penalty
- `host_writes_tb > 200`: penalty
- `critical_warning != 0`: reject
- `media_integrity_errors != 0`: reject

HDD rules:

- `reallocated_sector_count != 0`: reject
- `current_pending_sector != 0`: reject
- `offline_uncorrectable != 0`: reject

Return support:

- `supports_return = yes` / `支持`: small score bonus
- `supports_return = no` / `不支持`: small score penalty

These checks are basic triage only. Always ask the seller for screenshots and verify manually before buying.

## Scoring guide

- 80–100: worth asking seller
- 60–79: maybe, negotiate
- 40–59: weak
- 0–39: reject

## Reports

- `reports/today.md`: sorted candidate list in Traditional Chinese, including decision, suggested price range, SMART summary, and use-case fit
- `reports/today.csv`: spreadsheet-friendly summary with decision, suggested price, and use-case fields
- `reports/rejects.md`: rejected / high-risk items with exact reject reasons, price comments, and use-case comments
- `reports/search_urls.md`: generated search URLs from requirements


## Sample validation workflow

Use this when changing `src/rules.py`. It helps catch accidental behavior changes before you rely on the reports.

```bash
python3 src/validate_samples.py
python3 -m compileall src
```

The validation report is written to `reports/sample_validation.md`. A mismatch does not automatically mean the code is wrong; it means either the rule changed intentionally and `expected_decision` should be updated, or the rule introduced an unintended regression.
