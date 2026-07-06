# RULE DESIGN — deal-radar-storage v2.5

## Overview

Rule engine 位於 `src/rules.py`。核心函式是 `evaluate_item(item)`，輸入一列 listing dictionary，輸出可放入 Markdown / CSV 報告的結構化結果。

設計原則：

- 優先使用清楚、可讀、可測試的規則。
- 缺資料時輸出 `NEED_MORE_INFO`，而不是假裝知道答案。
- hard reject 條件優先於分數。
- 所有交易決策都保留人工確認。

## Category detection

工具會從 title、description、URL 等文字欄位偵測 category：

- `SSD`
- `HDD`
- `enclosure`
- `cable`

用途：

- 決定要套用 SSD SMART 規則還是 HDD SMART 規則。
- 決定賣家問題應該問 CrystalDiskInfo、smartctl，還是硬碟盒 controller chip。
- 避免把 enclosure 錯當成實際 SSD / HDD 而要求磁碟 SMART。

## Model detection

工具偵測指定型號，例如：

- SSD：SN730、SN740、PM9A1、PM9A1a、Micron 3400、KC3000、SN770、P5 Plus、970 EVO Plus、980 PRO、P31、P41。
- HDD：HC620、HC550、HC530、Exos X18、Exos X16、MG08。
- Enclosure controller：RTL9210B、ASM2362。

用途：

- 提升已知型號的 score。
- 套用指定 2TB SSD suggested price rules。
- 判斷 unknown brand / white-label SSD 風險。

## Risk keyword detection

工具會偵測風險詞，例如：

- 飛牛
- Windows不能用
- USB不能用
- HBA
- PC3000
- 屏蔽
- 改容量
- ZBC
- SED鎖
- Linux專用
- 不支持USB
- SATA
- QLC
- 白牌
- 雜牌
- 不退不換
- 健康90
- 通電2萬小時

風險詞不一定全部 hard reject，但會影響 score、decision、use-case fit 和 seller_questions。

## SMART hard reject logic

SSD hard reject：

- `critical_warning != 0`
- `media_integrity_errors != 0`

SSD penalty / bonus：

- `health_percent >= 95`：加分。
- `health_percent < 90`：強扣分。
- `host_writes_tb > 200`：扣分。

HDD hard reject：

- `reallocated_sector_count != 0`
- `current_pending_sector != 0`
- `offline_uncorrectable != 0`

這些 hard reject 條件會令 decision 變成 `REJECT`，並在 `rejects.md` 顯示精確原因。

## Purchase decision logic

Decision values：

- `BUY_CANDIDATE`
- `NEGOTIATE_ONLY`
- `WATCH_ONLY`
- `REJECT`
- `NEED_MORE_INFO`

基本順序：

1. 有 hard reject → `REJECT`。
2. 缺少 key information，例如 SMART 或 price → `NEED_MORE_INFO`。
3. score >= 80 → `BUY_CANDIDATE`。
4. score 60–79 → `NEGOTIATE_ONLY`。
5. score 40–59 → `WATCH_ONLY`。
6. score < 40 → `REJECT`。

這個順序的重點是：hard reject 永遠優先，缺關鍵資料時不要過早建議購買。

## Suggested price logic

Suggested price 是 rough CNY negotiation reference，不是即時市場價格。

目前支援主要 2TB SSD 規則：

- PM9A1 2TB
  - health >= 95：800–950 CNY
  - health 90–94：550–700 CNY
  - health < 90：reject 或 test-only <= 500 CNY
- SN750 2TB
  - health >= 95 且 host_writes_tb < 100：700–850 CNY
  - health 85–94 或 host_writes_tb > 200：500–650 CNY
- SN730 / SN740 / Micron 3400 / KC3000 2TB
  - health >= 95：750–900 CNY
  - health 90–94：550–750 CNY
- Low-end SATA / QLC 2TB
  - 300–650 CNY
  - price > 750 CNY 時 reject
- Unknown brand / white-label SSD
  - 原則 reject
  - 只有 price <= 350 CNY 且明確 test-only 才可能考慮

## Use-case fit logic

`intended_use` 支援：

- `main_work_drive`
- `docker_cache`
- `cold_storage`
- `backup_drive`
- `test_only`
- `external_mac_drive`

主要規則：

- `main_work_drive`：偏好 NVMe TLC；SATA、QLC、未知品牌、health < 95、missing SMART 會強烈扣分或標記不建議。
- `docker_cache`：可接受 health 90–95 的低價 SSD，但仍拒絕 critical warning 或 media integrity errors。
- `cold_storage`：HDD 危險 SMART 欄位為 0 才可考慮；SATA SSD 只在 known brand 且低價時適合。
- `backup_drive`：提醒一隻二手盤不是完整備份策略；需要 SMART 欄位。
- `test_only`：弱或未知 listing 只有在 suggested price 很低時才可考慮。
- `external_mac_drive`：偏好 NVMe + 可靠 enclosure；高熱、未知品牌、QLC、無 SMART 會扣分。

## Seller evidence checklist

v2.4 起，工具會根據 category 和缺失欄位生成：

- `next_action`
- `seller_questions`
- `evidence_required`
- `rescue_comment`

SSD 通常要求：

- CrystalDiskInfo 完整截圖。
- Critical Warning = 0。
- Media/Data Integrity Errors = 0。
- Total Host Writes、Power On Hours、Health / Percentage Used。
- 退換或測試期確認。

HDD 通常要求：

- CrystalDiskInfo 或 `smartctl -a` 完整截圖。
- Reallocated Sector Count = 0。
- Current Pending Sector = 0。
- Offline Uncorrectable = 0。
- Power On Hours。
- 是否普通 SATA，非飛牛專用、非 ZBC、非 PC3000 改盤、非屏蔽改容量。
- USB dock / Windows / macOS 是否可識別。

Enclosure 通常要求：

- RTL9210B 或 ASM2362 controller chip 確認。
- TRIM、UASP、SMART passthrough 支援證據。

## Why this is rule-based instead of fully automated AI

此專案刻意不用 fully automated AI decision，原因：

- 交易風險需要可解釋、可追溯的判斷理由。
- SMART hard reject 不應由語言模型自由推測。
- 二手平台資訊常常不完整，應優先生成問題，而不是生成看似肯定的答案。
- Rule-based system 更容易做 sample validation 和 regression check。
- Human-in-the-loop 能避免工具越界到自動購買、平台登入或安全繞過。
