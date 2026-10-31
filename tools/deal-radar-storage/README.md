# deal-radar-storage

一個小型、規則式 (rule-based)、beginner-friendly 的二手儲存裝置決策輔助工具。

它的工作不是幫你買東西，而是把你手上的商品連結、需求 YAML 與手動整理的商品資料，轉成:

- 初步決策: `BUY_CANDIDATE`, `NEGOTIATE_ONLY`, `WATCH_ONLY`, `NEED_MORE_INFO`, `REJECT`
- 建議下一步
- 賣家提問清單
- 需要補齊的證據
- 手動搜尋用的 query / URL

## 支援的三種輸入模式

### 1. Links only

只有商品連結也能跑。工具會保守地把資訊不足項目標成 `NEED_MORE_INFO`，提醒你先補資料。

```bash
python3 src/cli.py quick \
  --links examples/inputs/links_only.txt \
  --output-dir /tmp/deal-radar-links-only
```

### 2. Requirements YAML only

只有需求檔也能跑。工具不會假裝已分析真實商品，而是先幫你產生手動搜尋 query、平台搜尋 URL、購買準則與檢查清單。

```bash
python3 src/cli.py quick \
  --requirements examples/inputs/requirements_portable_ssd.yml \
  --output-dir /tmp/deal-radar-requirements
```

### 3. Links + requirements + optional listings metadata

這是最完整也最適合實際使用的模式。你可以同時提供:

- `--links`: 商品連結
- `--requirements`: 需求 YAML
- `--listings`: 與連結對應的手動 metadata CSV，例如 title、price、description、SMART

```bash
python3 src/cli.py quick \
  --links examples/inputs/combined.links.txt \
  --listings examples/inputs/combined.listings.csv \
  --requirements examples/inputs/requirements_portable_ssd.yml \
  --output-dir /tmp/deal-radar-both
```

## Quickstart

### Prerequisites

- Python 3.10+ 建議
- 可選 `PyYAML`
  - 沒有也能跑，專案有簡化 YAML fallback parser

### 1. 直接跑 sample

```bash
python3 src/cli.py quick \
  --links examples/inputs/combined.links.txt \
  --listings examples/inputs/combined.listings.csv \
  --requirements examples/inputs/requirements_portable_ssd.yml \
  --output-dir /tmp/deal-radar-demo
```

### 2. 查看輸出

主要輸出會出現在你指定的 `--output-dir`:

- `quick_report.md`
- `quick_report.csv`
- `quick_questions.md`
- `search_urls.md`
- `discovery_queries.md`
- `discovery_urls.md`
- `buying_criteria.md`
- `quick_checklist.md`

Sample 檔案可參考:

- `examples/inputs/`
- `examples/outputs/`

## 常用指令

### Quick mode

```bash
python3 src/cli.py quick --links data/links.txt
python3 src/cli.py quick --requirements config/requirements.ssd.yml
python3 src/cli.py quick --links data/links.txt --listings data/listings.csv --requirements config/requirements.ssd.yml
```

### Evaluate a prepared CSV

```bash
python3 src/cli.py evaluate --input data/listings.csv
```

### Generate manual search URLs only

```bash
python3 src/cli.py search --requirements config/requirements.ssd.yml
```

### Validate rule behavior

```bash
python3 src/cli.py validate
python3 -m unittest discover -s tests -p 'test_*.py'
```

## 檔案說明

### Main inputs

- `data/links.txt`: 真實使用時的一行一個商品連結
- `data/listings.csv`: 手動整理的商品 metadata
- `config/requirements.ssd.yml`
- `config/requirements.hdd.yml`

### Sample inputs

- `examples/inputs/links_only.txt`
- `examples/inputs/requirements_portable_ssd.yml`
- `examples/inputs/combined.links.txt`
- `examples/inputs/combined.listings.csv`

### Core outputs

- `reports/quick_report.md`
- `reports/quick_report.csv`
- `reports/search_urls.md`
- `reports/discovery_queries.md`
- `reports/discovery_urls.md`
- `reports/buying_criteria.md`
- `reports/quick_checklist.md`

## 安全邊界摘要

這個工具明確不做以下事情:

- 不自動下單
- 不代替你付款
- 不登入平台或繞過登入
- 不保存帳號、密碼、cookie、token、API key
- 不做 aggressive scraping
- 不繞過平台安全或反爬限制

完整說明見 [docs/SAFETY_BOUNDARIES.md](docs/SAFETY_BOUNDARIES.md)。

## 已知限制

- 規則與價格帶是啟發式，不是即時市場報價。
- `links only` 模式在 metadata 缺少時會偏保守，常回傳 `NEED_MORE_INFO`。
- `requirements only` 模式只生成手動搜尋與判斷輔助，不會自動找到商品。
- SMART 資料只屬 advisory evidence，不保證硬碟壽命或真實健康。
- 專案不評估賣家誠信、物流風險、平台糾紛處理品質。

## 文件

- [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md)
- [docs/SAFETY_BOUNDARIES.md](docs/SAFETY_BOUNDARIES.md)
- [docs/RULE_DESIGN.md](docs/RULE_DESIGN.md)
- [docs/CASE_STUDY.md](docs/CASE_STUDY.md)
