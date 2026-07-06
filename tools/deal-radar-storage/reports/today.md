# 今日儲存裝置候選清單

> v2.7 rule-based report。此工具只協助整理、SMART 初步檢查、用途適配、購買決策、建議價區間、賣家提問與證據清單，不會自動購買、不會登入平台、不會繞過安全限制。

## 1. SN740 2TB NVMe TLC SSD

- 分數: 100 / 100
- 購買決策: BUY_CANDIDATE
- 用途: main_work_drive
- 用途適配: 適合
- 用途註解: NVMe + 已知型號 + SMART 合格，可作主力工作碟候選。
- 分數區間: worth asking seller
- 現有價格: 820
- 建議價區間: 750–900 CNY
- 價格註解: 此類 2TB SSD 健康度 >=95%，可用 750–900 CNY 作詢價區間。
- 下一步: 先向賣家索取完整證據；證據一致後才考慮購買。
- 賣家問題: 可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。；請確認 Critical Warning = 0。；請確認 Media/Data Integrity Errors = 0。；請提供 Total Host Writes、Power On Hours、Health / Percentage Used。；是否支持收貨後測試？如 SMART 與描述不符可否退換？
- 需要證據: CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。；Critical Warning = 0 的截圖或清楚數值。；Media/Data Integrity Errors = 0 的截圖或清楚數值。；賣家確認退換／測試條款的文字紀錄。
- 類別: SSD
- 介面: NVMe
- 型號: SN740
- 風險: none
- SMART / 退換摘要: 健康度: 98; 通電小時: 1200; 寫入量TB: 45; Media錯誤: 0; Critical warning: 0; 可否退換: yes
- 連結: https://example.com/item/ssd-good
- 理由:
  - 命中偏好／已知型號: SN740
  - 識別類別: SSD
  - 識別介面: NVMe
  - 識別容量: 2TB
  - SSD SMART 健康度 98%：加分
  - 賣家標示支持退換：加分
  - 用途適配分數調整: +5

## 2. PM9A1 2TB NVMe SSD

- 分數: 0 / 100
- 購買決策: REJECT
- 用途: test_only
- 用途適配: 只限測試
- 用途註解: 雖有高風險，只可在極低價、可承受損失時作測試用途。
- 分數區間: reject
- 現有價格: 250
- 建議價區間: 0–500 CNY
- 價格註解: PM9A1 2TB 健康度 <90%，原則上拒絕；若只作測試，最高不宜超過 500 CNY。
- 下一步: 不建議購買；只在證據推翻拒絕原因時才重新評估。
- 賣家問題: 可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。；請確認 Critical Warning = 0。；請確認 Media/Data Integrity Errors = 0。；請提供 Total Host Writes、Power On Hours、Health / Percentage Used。；是否支持收貨後測試？如 SMART 與描述不符可否退換？
- 需要證據: CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。；Critical Warning = 0 的截圖或清楚數值。；Media/Data Integrity Errors = 0 的截圖或清楚數值。；賣家確認退換／測試條款的文字紀錄。
- 類別: SSD
- 介面: NVMe
- 型號: PM9A1
- 風險: none
- SMART / 退換摘要: 健康度: 88; 通電小時: 5000; 寫入量TB: 260; Media錯誤: 3; Critical warning: 1; 可否退換: no
- 連結: https://example.com/item/ssd-reject
- 理由:
  - 命中偏好／已知型號: PM9A1
  - 識別類別: SSD
  - 識別介面: NVMe
  - 識別容量: 2TB
  - SSD SMART 健康度 88%：強扣分
  - SSD host_writes_tb 260TB > 200TB：扣分
  - 賣家標示不支持退換：扣分
  - SSD critical_warning = 1，必須拒絕
  - SSD media_integrity_errors = 3，必須拒絕

## 3. HC550 16TB SATA HDD

- 分數: 0 / 100
- 購買決策: REJECT
- 用途: backup_drive
- 用途適配: 不建議
- 用途註解: 注意：一隻二手硬碟不是完整備份策略；至少要有另一份獨立備份。 已有 SMART hard reject，不適合作備份碟。
- 分數區間: reject
- 現有價格: 600
- 建議價區間: 未有建議價
- 價格註解: 暫時只為 SSD 型號提供建議價區間；HDD / 配件需人工比價。
- 下一步: 不建議購買；只在證據推翻拒絕原因時才重新評估。
- 賣家問題: 可否提供 CrystalDiskInfo 或 smartctl -a 完整截圖？；請確認 Reallocated Sector Count = 0。；請確認 Current Pending Sector = 0。；請確認 Offline Uncorrectable = 0。；請提供 Power On Hours。；請確認這是普通 SATA 盤，不是飛牛專用盤、不是 ZBC、不是 PC3000 改盤、不是屏蔽／改容量盤。；請確認 USB 硬碟座、Windows、macOS 是否可以正常識別。
- 需要證據: CrystalDiskInfo 或 smartctl -a 完整截圖。；Reallocated Sector Count / Current Pending Sector / Offline Uncorrectable 全部為 0 的證明。；Windows / macOS / USB 硬碟座可識別的截圖或影片。；賣家確認非飛牛專用、非 ZBC、非 PC3000 改盤、非屏蔽／改容量的文字紀錄。
- 類別: HDD
- 介面: SATA
- 型號: HC550
- 風險: Linux專用, SATA, 不退不換, 通電2萬小時
- SMART / 退換摘要: 通電小時: 20000; 重映射磁區: 2; 待處理磁區: 0; 離線不可修正: 0; 可否退換: no
- 連結: https://example.com/item/hdd-reject
- 理由:
  - 命中偏好／已知型號: HC550
  - 識別類別: HDD
  - 識別介面: SATA
  - 識別容量: 16TB
  - 風險關鍵字: Linux專用, SATA, 不退不換, 通電2萬小時
  - 賣家標示不支持退換：扣分
  - 用途評估：backup_drive 需提醒不要把單一二手硬碟當作完整備份策略
  - HDD reallocated_sector_count = 2，必須拒絕
