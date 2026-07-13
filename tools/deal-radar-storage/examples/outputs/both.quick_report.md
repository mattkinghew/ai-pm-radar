# Sample Output — Links Plus Requirements

這是一個示意輸出。當你同時提供連結、requirements YAML 與 matching `listings.csv` metadata，工具會同時做候選評分與手動搜尋準備。

## Summary

- 目標產品: SSD, M.2, TLC
- 已分析連結數: 2
- BUY_CANDIDATE: 1
- NEGOTIATE_ONLY: 0
- WATCH_ONLY: 0
- NEED_MORE_INFO: 0
- REJECT: 1

## Candidate

- `SN740 2TB NVMe TLC SSD`
  - Decision: `BUY_CANDIDATE`
  - Next action: 先索取完整 SMART、實物照片與退換條款

## Reject

- `PM9A1 2TB NVMe SSD`
  - Decision: `REJECT`
  - Reject reason: `critical_warning` 與 `media_integrity_errors` 不可接受
