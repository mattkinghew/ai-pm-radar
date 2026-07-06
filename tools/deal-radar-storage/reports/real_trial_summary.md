# Real Trial Summary — 實購試行摘要

> v2.8.2。此摘要用於清理 `data/discovered_listings.csv` 實購 trial 評估結果；空白 placeholder rows 會被跳過。

## Overview

- Total rows read: 66
- Empty rows skipped: 66
- Valid listings evaluated: 0
- BUY_CANDIDATE: 0
- NEGOTIATE_ONLY: 0
- WATCH_ONLY: 0
- NEED_MORE_INFO: 0
- REJECT: 0

## Top follow-up candidates

- 暫時沒有 BUY_CANDIDATE / NEGOTIATE_ONLY。

## Listings that need more information

- 暫時沒有 NEED_MORE_INFO。

## Listings rejected

- 暫時沒有 REJECT。

## Suggested next manual actions

1. 先處理 BUY_CANDIDATE / NEGOTIATE_ONLY：向賣家索取完整 SMART、實物照片與退換條款。
2. 對 NEED_MORE_INFO：補 title、price、description、SMART 欄位後重新執行 evaluate。
3. 對 REJECT：除非賣家能提供證據推翻 hard reject，否則不要花時間追問。
4. 若 `Empty rows skipped` 很高，整理 `data/discovered_listings.csv`，刪除未使用 placeholder rows。
5. 購買前仍要人工檢查賣家信譽、實物照片、SMART 截圖與退換條款。

## Safety note

本工具不會自動購買、不會驗證賣家誠信、不會登入平台、不會繞過平台安全限制。SMART 資料只作參考，不等於硬碟健康保證。