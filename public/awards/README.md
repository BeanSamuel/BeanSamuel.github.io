# 獎狀掃描檔

把圖檔丟進這個資料夾，檔名照下表。`src/data/resumeData.js` 的 `awards` 與
`outreach` 已經把路徑接好了，檔案放進來就會自動生效 —— 不用改程式。

沒放檔案的項目，點開時會顯示「尚未上傳」，不會出現破圖。

| 檔名 | 對應項目 | 區塊 | 狀態 |
| --- | --- | --- | --- |
| `2026-city-dashboard-hackathon-3rd.jpg` | 雙北程式設計節 — 城市儀表板大黑客松 第三名 | 獎項 | ⬜️ |
| `2025-icpc-taichung-bronze.jpg` | ICPC Asia Taichung Regional 2025 — 銅牌 | 獎項 | ✅ |
| `2025-icpc-taiwan-online-silver.jpg` | ICPC Asia Taiwan Online 2025 — 銀牌 | 獎項 | ✅ |
| `2025-ncu-academic-excellence-1132.jpg` | 中央大學 1132 學期書卷獎 | 獎項 | ⬜️ |
| `2025-ncu-eecs-project.jpg` | 113 學年度資電院大學部專題競賽 佳作 | 獎項 | ✅ |
| `2025-ncu-csie-project.jpg` | 113 學年度資工系大學部專題實驗競賽 佳作、人氣獎 | 獎項 | ✅ ⚠️ 低解析 305px |
| `2024-icpc-taichung-bronze.jpg` | ICPC Asia Taichung Regional 2024 — 銅牌 | 獎項 | ✅ |
| `2024-aicup-esun-rag-llm.jpg` | AICUP 2024 玉山人工智慧挑戰賽 | 獎項 | ✅ |
| `2024-future-network-bronze.jpg` | 未來網路應用創意競賽 — 銅牌 | 獎項 | ✅ |
| `2023-national-software-design.jpg` | 全國大專電腦軟體設計競賽 佳作（教育部獎狀） | 獎項 | ✅ |
| `2022-ncu-swimming-3rd.jpg` | 中央 111 學年度全校運動會 50 公尺仰式 第三名 | 獎項 | ✅ |
| `2021-vex-inspire-award.jpg` | VEX Inspire Award、全國技能挑戰賽 第 9 名 | 獎項 | ✅ ⚠️ 低解析 265px |
| `2024-quanta-cup-coaching.jpg` | 廣達游智盃 — 指導參賽證明（五常國小） | 教學 | ✅ |
| `2023-jingshin-alumni-talk.jpg` | 靜心高中 — 校友生涯分享 感謝狀 | 教學 | ✅ |

## 格式

- 副檔名一律 `.jpg`（路徑是寫死的）。手上是 PDF / PNG / HEIC 就丟進 `awards-src/`
  跟我說一聲，我轉檔改名（PDF 用 `qlmanage -t -s 1600` 轉 PNG 再 `sips` 壓 jpg；
  直接用 sips 轉 PDF 只有 842px，太糊）。
- 長邊建議 1600px 上下、單檔 500KB 以內。整包都會進 git，太大會拖慢 repo 和載入。
- 標 ⚠️ 的是手機翻拍的低解析檔，燈箱會以原尺寸顯示（不放大所以不糊，但框很小），
  之後有高解析版本覆蓋同名檔案即可。

## 原始檔

`awards-src/`（repo 根目錄）放未轉檔的原始 PDF/圖，已在 `.gitignore` 裡，不進版控。
`cpe.pdf` 印有身分證字號與學號，**遮蔽前不要上架**。
