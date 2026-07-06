# 拒絕／高風險清單

## PM9A1 2TB NVMe SSD

- 分數: 0 / 100
- 購買決策: REJECT
- 用途: test_only
- 用途適配: 只限測試
- 用途註解: 雖有高風險，只可在極低價、可承受損失時作測試用途。
- 精確拒絕原因: SSD critical_warning = 1，必須拒絕; SSD media_integrity_errors = 3，必須拒絕
- 建議價區間: 0–500 CNY
- 價格註解: PM9A1 2TB 健康度 <90%，原則上拒絕；若只作測試，最高不宜超過 500 CNY。
- 是否可能救回: 已命中 SMART hard reject；除非賣家提供完整截圖證明原資料填錯且危險欄位為 0，否則不建議救回。
- 下一步: 不建議購買；只在證據推翻拒絕原因時才重新評估。
- 可補問問題: 可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。；請確認 Critical Warning = 0。；請確認 Media/Data Integrity Errors = 0。；請提供 Total Host Writes、Power On Hours、Health / Percentage Used。；是否支持收貨後測試？如 SMART 與描述不符可否退換？
- 需要證據: CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。；Critical Warning = 0 的截圖或清楚數值。；Media/Data Integrity Errors = 0 的截圖或清楚數值。；賣家確認退換／測試條款的文字紀錄。
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

## HC550 16TB SATA HDD

- 分數: 0 / 100
- 購買決策: REJECT
- 用途: backup_drive
- 用途適配: 不建議
- 用途註解: 注意：一隻二手硬碟不是完整備份策略；至少要有另一份獨立備份。 已有 SMART hard reject，不適合作備份碟。
- 精確拒絕原因: HDD reallocated_sector_count = 2，必須拒絕
- 建議價區間: 未有建議價
- 價格註解: 暫時只為 SSD 型號提供建議價區間；HDD / 配件需人工比價。
- 是否可能救回: 已命中 SMART hard reject；除非賣家提供完整截圖證明原資料填錯且危險欄位為 0，否則不建議救回。
- 下一步: 不建議購買；只在證據推翻拒絕原因時才重新評估。
- 可補問問題: 可否提供 CrystalDiskInfo 或 smartctl -a 完整截圖？；請確認 Reallocated Sector Count = 0。；請確認 Current Pending Sector = 0。；請確認 Offline Uncorrectable = 0。；請提供 Power On Hours。；請確認這是普通 SATA 盤，不是飛牛專用盤、不是 ZBC、不是 PC3000 改盤、不是屏蔽／改容量盤。；請確認 USB 硬碟座、Windows、macOS 是否可以正常識別。
- 需要證據: CrystalDiskInfo 或 smartctl -a 完整截圖。；Reallocated Sector Count / Current Pending Sector / Offline Uncorrectable 全部為 0 的證明。；Windows / macOS / USB 硬碟座可識別的截圖或影片。；賣家確認非飛牛專用、非 ZBC、非 PC3000 改盤、非屏蔽／改容量的文字紀錄。
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
