# Real Trial Summary — 實購試行摘要

> v2.8.2。此摘要用於清理 `data/discovered_listings.csv` 實購 trial 評估結果；空白 placeholder rows 會被跳過。

## Overview

- Total rows read: 69
- Empty rows skipped: 66
- Valid listings evaluated: 3
- BUY_CANDIDATE: 1
- NEGOTIATE_ONLY: 0
- WATCH_ONLY: 0
- NEED_MORE_INFO: 0
- REJECT: 2

## Top follow-up candidates

- SN730 2TB NVMe 固態硬盤 健康98｜BUY_CANDIDATE｜分數 98｜建議價 750–900 CNY｜下一步: 先向賣家索取完整證據；證據一致後才考慮購買。

## Listings that need more information

- 暫時沒有 NEED_MORE_INFO。

## Listings rejected

- Samsung 990 Pro 2TB 低价 图吧显示｜原因: 賣家明示不保品牌／只保正常使用／图吧顯示／打包，假貨或錯標風險高; 疑似低價假 Samsung 990 Pro 或錯標 listing，未有強證據前拒絕｜URL: https://www.goofish.com/item?id=sample-fake-990pro
- Samsung 870 QVO 2TB SATA 固態硬盤｜原因: 低端 SATA / QLC 2TB 標價 770 CNY > 750 CNY，拒絕; SATA / mSATA 不是 NVMe，2TB 價格超過 ¥600 且接近 NVMe 時不值得; QVO / QLC 不適合作高信任工作碟，且價格接近 NVMe 選項｜URL: https://www.goofish.com/item?id=sample-qvo-overpriced

## Suggested next manual actions

1. 先處理 BUY_CANDIDATE / NEGOTIATE_ONLY：向賣家索取完整 SMART、實物照片與退換條款。
2. 對 NEED_MORE_INFO：補 title、price、description、SMART 欄位後重新執行 evaluate。
3. 對 REJECT：除非賣家能提供證據推翻 hard reject，否則不要花時間追問。
4. 若 `Empty rows skipped` 很高，整理 `data/discovered_listings.csv`，刪除未使用 placeholder rows。
5. 購買前仍要人工檢查賣家信譽、實物照片、SMART 截圖與退換條款。

## Safety note

本工具不會自動購買、不會驗證賣家誠信、不會登入平台、不會繞過平台安全限制。SMART 資料只作參考，不等於硬碟健康保證。