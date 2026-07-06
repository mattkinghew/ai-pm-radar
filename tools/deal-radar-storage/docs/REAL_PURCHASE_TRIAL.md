# Real Purchase Trial Guide

本文件說明如何用 `deal-radar-storage` v2.9 做一次安全、手動、可驗證的二手 SSD / HDD 實購前篩選流程。v2.9 新增 Real Market Screening Rules，目標是更適合真實 Goofish 二手 SSD trial。

本工具只協助你準備搜尋、整理候選 listing、產生 rule-based 評估、賣家問題與證據清單。它不會替你購買產品，也不會驗證賣家是否誠實。最後購買前仍然要由你人工檢查 SMART 截圖、實物照片、賣家信譽與退換條款。

## 1. 先生成 discovery search URLs

在 `tools/deal-radar-storage` 目錄執行：

```bash
python3 src/cli.py discover --requirements config/requirements.ssd.yml
```

完成後打開：

```bash
open reports/discovery_urls.md
```

`reports/discovery_urls.md` 會列出 Goofish / Taobao / JD 的搜尋 URL。這些 URL 只是幫你更快手動搜尋，不會登入、不會抓取平台內容、不會自動購買。

## 2. 如何使用 Goofish / Taobao / JD 搜尋 URL

1. 打開 `reports/discovery_urls.md`。
2. 逐一點開 Goofish、Taobao、JD 的搜尋 URL。
3. 在平台頁面人工檢查標題、價格、圖片、描述、賣家評價與退換條款。
4. 遇到有潛力的 listing，不要急著付款；先複製資料到 `data/discovered_listings.csv`。
5. 向賣家索取 SMART / CrystalDiskInfo / 實物照片等證據，再用本工具重新評估。

建議優先看 Goofish / 閒魚的二手 listing，但要特別留意假貨、改盤、不能退換、Windows / USB 不能識別、健康度低、通電時間高等問題。

## 3. SSD 優先型號

實購 trial 可優先搜尋以下 2TB NVMe SSD：

- SN730 2TB
- SN740 2TB
- PM9A1 2TB
- Micron 3400 2TB
- KC3000 2TB
- SN770 2TB
- 970 EVO Plus 2TB
- 980 PRO 2TB
- Crucial P5 Plus 2TB

目前實購 trial 目標：2TB NVMe TLC SSD，用作 external Mac work drive，之後配合 RTL9210B / ASM2362 enclosure。優先次序是資料安全／可靠性 > 合理價格 > 速度。

一般方向：

- 優先 NVMe、TLC、已知品牌、SMART 資料完整、健康度高、價格合理、支援退換的 listing。
- `main_work_drive` 或 `external_mac_drive` 用途要更保守，盡量避免缺 SMART、低健康度、未知品牌、QLC 或高熱型號。
- PM9A1 / SN740 / Micron 3400 這類 OEM 盤要確認來源、健康度、寫入量、是否正常識別。
- 每輪只挑 3–5 個候選，不要用太廣泛的搜尋詞一次收集大量弱 listing。

## 4. SSD 應避免類型

以下 listing 建議直接跳過或只作 `test_only` 低價測試用途：

- WD Green
- WD Blue SATA
- QVO
- SN350
- NV1
- SA510
- white-label SSD / 白牌 SSD / 雜牌 SSD
- fake SN770 / 可疑 SN770
- SATA 2TB overpriced listings
- health below 90
- very high power-on hours
- mSATA / NGFF SATA / SATA 協議
- 不保品牌 / 只保正常使用 / 图吧顯示 / 打包
- Samsung 990 Pro 2TB 但價格異常低、描述不清或賣家不保品牌

另外也要特別避開：

- `critical_warning` 不是 0
- `media_integrity_errors` 不是 0
- 標題或描述出現「不退不換」但價格不夠低
- 賣家拒絕提供 CrystalDiskInfo 完整截圖
- 只有模糊截圖、遮蔽序號以外的重要資料、或描述前後矛盾
- SATA / mSATA 不是 NVMe，價格接近 NVMe 時不值得。
- QVO / QLC 不適合作高信任工作碟。
- 賣家明示不保品牌時，錯標或低信任風險高。

## 5. 如何填寫 data/discovered_listings.csv

打開：

```bash
open data/discovered_listings.csv
```

你可以用 Numbers、Excel、LibreOffice、VS Code 或純文字編輯器填寫。每一行代表一個候選 listing。

建議手動填入以下欄位：

| 欄位 | 如何填 |
|---|---|
| `platform` | 例如 `goofish`、`taobao`、`jd` |
| `title` | 複製 listing 標題 |
| `price` | 只填數字，例如 `680` |
| `url` | 複製 listing URL |
| `description` | 複製賣家描述、型號、容量、使用狀態 |
| `notes` | 你自己的觀察，例如「賣家稱可退」、「圖片模糊」、「疑似拆機盤」 |
| `intended_use` | 例如 `main_work_drive`、`docker_cache`、`external_mac_drive`、`test_only` |
| `health_percent` | CrystalDiskInfo 顯示的健康度，例如 `95` |
| `power_on_hours` | 通電時間，例如 `1200` |
| `host_writes_tb` | Total Host Writes，單位 TB，例如 `35` |
| `critical_warning` | SSD SMART Critical Warning，正常應為 `0` |
| `media_integrity_errors` | Media/Data Integrity Errors，正常應為 `0` |
| `supports_return` | 例如 `yes`、`no`、`unknown` |

如果暫時沒有 SMART 資料，可以先留空。工具會把缺資料的 listing 標記為 `NEED_MORE_INFO`，並在報告中產生賣家追問問題。

## 6. 執行 discovered listings 評估

填好 `data/discovered_listings.csv` 後執行：

```bash
python3 src/cli.py evaluate --input data/discovered_listings.csv
```

完成後主要閱讀三份報告：

```bash
open reports/today.md
open reports/rejects.md
open reports/quick_questions.md
```

## 7. 如何閱讀 reports/today.md

`reports/today.md` 是主要候選清單。你應重點看：

- `decision`
  - `BUY_CANDIDATE`: 可以進一步問賣家與議價，但仍不是直接購買。
  - `NEGOTIATE_ONLY`: 只適合議價，價格不夠低就放棄。
  - `WATCH_ONLY`: 暫時觀察，不建議急買。
  - `NEED_MORE_INFO`: 資料不足，要先問賣家。
  - `REJECT`: 不建議購買。
- `suggested_price_min` / `suggested_price_max`: rule-based 參考價，不是即時市場價。
- `use_case_fit`: 是否適合你填寫的 `intended_use`。
- `next_action`: 下一步應該問賣家、議價、觀察或放棄。
- `seller_questions`: 可複製給賣家的問題。
- `evidence_required`: 需要賣家提供的證據。

## 8. 如何閱讀 reports/rejects.md

`reports/rejects.md` 會列出被拒絕 listing 與原因。你應留意：

- 是否因 hard reject 被拒，例如 `critical_warning != 0`、`media_integrity_errors != 0`。
- 是否因 HDD 危險 SMART 欄位被拒，例如 reallocated / pending / uncorrectable 不為 0。
- 是否因價格過高、白牌、健康度太低、缺重要資料而不建議。
- `rescue_comment` 會說明該 listing 是否有機會靠補充證據救回。

如果是 hard reject，通常不值得再花時間追問；如果只是缺資料，可向賣家索取完整 SMART 截圖後再評估。

## 9. 如何使用 reports/quick_questions.md

`reports/quick_questions.md` 會提供可複製的賣家訊息模板，包括：

- SSD message
- HDD message
- enclosure message

你可以把相應段落貼給賣家，要求對方提供：

- CrystalDiskInfo 完整截圖
- Critical Warning = 0
- Media/Data Integrity Errors = 0
- Total Host Writes
- Power On Hours
- Health / Percentage Used
- 是否支援退換或到手測試

如是硬碟盒，則要求確認：

- RTL9210B 或 ASM2362 controller chip
- TRIM
- UASP
- SMART passthrough

## 10. 安全提醒

- 本工具不會自動購買產品。
- 本工具不會驗證賣家是否誠實。
- 本工具不會登入平台、繞過登入、繞過平台安全或儲存 cookies / credentials / API keys。
- SMART 資料只可作參考，不等於硬碟健康保證。
- 二手 SSD / HDD 即使 SMART 正常，也可能有運輸、假貨、改盤、保養、相容性與退換風險。
- 最後購買前必須人工確認 SMART 截圖、實物照片、賣家信譽、退換條款與你的實際用途。

## 11. 建議實購 trial 流程

```bash
python3 src/cli.py discover --requirements config/requirements.ssd.yml
open reports/discovery_urls.md
open data/discovered_listings.csv
python3 src/cli.py evaluate --input data/discovered_listings.csv
open reports/today.md
open reports/rejects.md
open reports/quick_questions.md
```

建議每次只挑 3–5 個 listing 填入 CSV，再跑一次評估。這樣比一次收集太多資料更容易判斷，也更適合初期實購 trial。
