# 今日儲存裝置候選清單

> v2.8.2 rule-based report。此工具只協助整理、SMART 初步檢查、用途適配、購買決策、建議價區間、賣家提問與證據清單，不會自動購買、不會登入平台、不會繞過安全限制。

## 評估摘要

- Total rows read: 69
- Empty rows skipped: 66
- Total valid listings evaluated: 3
- BUY_CANDIDATE: 1
- NEGOTIATE_ONLY: 0
- WATCH_ONLY: 0
- NEED_MORE_INFO: 0
- REJECT: 2

### Top 3 listings to follow up

- SN730 2TB NVMe 固態硬盤 健康98｜BUY_CANDIDATE｜分數 98｜下一步: 先向賣家索取完整證據；證據一致後才考慮購買。

### Top 3 rejected listings with reasons

- Samsung 990 Pro 2TB 低价 图吧显示｜分數 0｜原因: 賣家明示不保品牌／只保正常使用／图吧顯示／打包，假貨或錯標風險高; 疑似低價假 Samsung 990 Pro 或錯標 listing，未有強證據前拒絕
- Samsung 870 QVO 2TB SATA 固態硬盤｜分數 0｜原因: 低端 SATA / QLC 2TB 標價 770 CNY > 750 CNY，拒絕; SATA / mSATA 不是 NVMe，2TB 價格超過 ¥600 且接近 NVMe 時不值得; QVO / QLC 不適合作高信任工作碟，且價格接近 NVMe 選項

## 1. SN730 2TB NVMe 固態硬盤 健康98

- 分數: 98 / 100
- 購買決策: BUY_CANDIDATE
- 用途: external_mac_drive
- 用途適配: 可議價
- 用途註解: NVMe + SMART 可作外置 Mac 碟候選；仍需確認硬碟盒散熱與晶片。
- 分數區間: worth asking seller
- 現有價格: 850
- 建議價區間: 750–900 CNY
- 價格註解: 此類 2TB SSD 健康度 >=95%，可用 750–900 CNY 作詢價區間。 v2.9: 已套用 real market screening。
- 下一步: 先向賣家索取完整證據；證據一致後才考慮購買。
- 賣家問題: 可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。；請確認 Critical Warning = 0。；請確認 Media/Data Integrity Errors = 0。；請提供 Total Host Writes、Power On Hours、Health / Percentage Used。；是否支持收貨後測試？如 SMART 與描述不符可否退換？
- 需要證據: CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。；Critical Warning = 0 的截圖或清楚數值。；Media/Data Integrity Errors = 0 的截圖或清楚數值。；賣家確認退換／測試條款的文字紀錄。
- 類別: SSD
- 介面: NVMe
- 型號: SN730
- 風險: none
- SMART / 退換摘要: 健康度: 98; 通電小時: 1000; 寫入量TB: 20; Media錯誤: 0; Critical warning: 0; 可否退換: yes
- 連結: https://www.goofish.com/item?id=sample-sn730-good
- 理由:
  - 命中偏好／已知型號: SN730
  - 識別類別: SSD
  - 識別介面: NVMe
  - 識別容量: 2TB, 2TB
  - SSD SMART 健康度 98%：加分
  - 賣家標示支持退換：加分

## 2. Samsung 990 Pro 2TB 低价 图吧显示

- 分數: 0 / 100
- 購買決策: REJECT
- 用途: external_mac_drive
- 用途適配: 可議價
- 用途註解: NVMe + SMART 可作外置 Mac 碟候選；仍需確認硬碟盒散熱與晶片。
- 分數區間: reject
- 現有價格: 520
- 建議價區間: 未有建議價
- 價格註解: 型號未命中 v2.2/v2.4 指定價目表；請用同容量、同健康度、同保養條件人工比較。 v2.9: 已套用 real market screening。
- 下一步: 不建議購買；只在證據推翻拒絕原因時才重新評估。
- 賣家問題: 可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。；請確認 Critical Warning = 0。；請確認 Media/Data Integrity Errors = 0。；請提供 Total Host Writes、Power On Hours、Health / Percentage Used。；是否支持收貨後測試？如 SMART 與描述不符可否退換？
- 需要證據: CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。；Critical Warning = 0 的截圖或清楚數值。；Media/Data Integrity Errors = 0 的截圖或清楚數值。；賣家確認退換／測試條款的文字紀錄。
- 類別: SSD
- 介面: NVMe
- 型號: 990 Pro
- 風險: 不保品牌, 只保正常使用, 990Pro 低价, 图吧显示, 图吧工具箱, 图吧, 打包
- SMART / 退換摘要: 可否退換: no
- 連結: https://www.goofish.com/item?id=sample-fake-990pro
- 理由:
  - 命中偏好／已知型號: 990 Pro
  - 識別類別: SSD
  - 識別介面: NVMe
  - 識別容量: 2TB
  - 風險關鍵字: 不保品牌, 只保正常使用, 990Pro 低价, 图吧显示, 图吧工具箱, 图吧, 打包
  - 賣家標示不支持退換：扣分
  - SMART 欄位未完整，購買前需要賣家補充缺漏數值
  - 賣家明示不保品牌／只保正常使用／图吧顯示／打包，假貨或錯標風險高
  - 疑似低價假 Samsung 990 Pro 或錯標 listing，未有強證據前拒絕

## 3. Samsung 870 QVO 2TB SATA 固態硬盤

- 分數: 0 / 100
- 購買決策: REJECT
- 用途: external_mac_drive
- 用途適配: 不建議
- 用途註解: external_mac_drive 優先 NVMe、已知品牌、SMART 齊全；目前不符合。 QLC／未知品牌不適合長期外置工作碟。
- 分數區間: reject
- 現有價格: 770
- 建議價區間: 300–650 CNY
- 價格註解: 低端 SATA / QLC 2TB 只建議 300–650 CNY；高於 750 CNY 應拒絕。 v2.9: 已套用 real market screening。
- 下一步: 不建議購買；只在證據推翻拒絕原因時才重新評估。
- 賣家問題: 可否提供 CrystalDiskInfo 完整截圖？請不要只截健康度一小角。；請確認 Critical Warning = 0。；請確認 Media/Data Integrity Errors = 0。；請提供 Total Host Writes、Power On Hours、Health / Percentage Used。；是否支持收貨後測試？如 SMART 與描述不符可否退換？
- 需要證據: CrystalDiskInfo 完整截圖，包含型號、容量、健康度、通電小時、總寫入量。；Critical Warning = 0 的截圖或清楚數值。；Media/Data Integrity Errors = 0 的截圖或清楚數值。；賣家確認退換／測試條款的文字紀錄。
- 類別: SSD
- 介面: SATA
- 型號: 870 QVO
- 風險: SATA, QLC, QVO, 870 QVO
- SMART / 退換摘要: 健康度: 92; 通電小時: 4000; 寫入量TB: 120; Media錯誤: 0; Critical warning: 0; 可否退換: no
- 連結: https://www.goofish.com/item?id=sample-qvo-overpriced
- 理由:
  - 命中偏好／已知型號: 870 QVO
  - 識別類別: SSD
  - 識別介面: SATA
  - 識別容量: 2TB, 2TB
  - 風險關鍵字: SATA, QLC, QVO, 870 QVO
  - 賣家標示不支持退換：扣分
  - 健康度低於 95，external Mac / main work drive 只應議價或觀察，不應直接視為可買
  - 不是完全不能用，但不符合 external Mac 主力工作碟目標；SATA-class 盤速度與價值低於 NVMe
  - Samsung 870 QVO 屬 SATA QLC；不建議作主力工作碟，除非極低價且非關鍵用途
  - 用途適配分數調整: -30
  - 低端 SATA / QLC 2TB 標價 770 CNY > 750 CNY，拒絕
  - SATA / mSATA 不是 NVMe，2TB 價格超過 ¥600 且接近 NVMe 時不值得
  - QVO / QLC 不適合作高信任工作碟，且價格接近 NVMe 選項
