# Browser-assisted Manual Capture Report

> v3 本地手動擷取流程。使用者手動從瀏覽器複製可見文字到 `captures/raw/*.txt`；工具只解析本地文字，不 scraping、不登入、不自動購買、不自動聯絡賣家。

## Summary

- Files read: 3
- Rows parsed: 3
- Rows appended: 0
- Rows skipped: 0

## Missing field warnings

- 暫時沒有明顯缺漏欄位。

## Candidate preview table

| Source | Platform | Title | Price | Health | Writes TB | Return | URL |
|---|---|---|---:|---:|---:|---|---|
| sample_fake_990pro.txt | goofish | Samsung 990 Pro 2TB 低价 图吧显示 | 520 |  |  | no | https://www.goofish.com/item?id=sample-fake-990pro |
| sample_qvo_overpriced.txt | goofish | Samsung 870 QVO 2TB SATA 固態硬盤 | 770 | 92 | 120 | no | https://www.goofish.com/item?id=sample-qvo-overpriced |
| sample_sn730_good.txt | goofish | SN730 2TB NVMe 固態硬盤 健康98 | 850 | 98 | 20 | yes | https://www.goofish.com/item?id=sample-sn730-good |

## Suggested next command

```bash
python3 src/cli.py evaluate --input data/discovered_listings.csv
```