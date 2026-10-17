# AI PM Radar 私人手機遠端存取部署

## 目前狀態（2026-09-21；已部署）

- 私人遠端入口已上線：[https://radar.lamlab.cc](https://radar.lamlab.cc/)，由 Cloudflare HTTPS、Access、Radar 專用 Tunnel 與本機 production static origin 組成。
- Access Self-hosted application 涵蓋整個 `radar.lamlab.cc`；Allow policy 只含使用者明確確認的一個 email identity，沒有 Everyone、整個 email domain 或 bypass 規則。Access 登入完成後，origin 仍驗證 JWT 簽章、issuer、audience、有效期及完全相符的允許 email。
- Radar 專用 Tunnel route 為 `radar.lamlab.cc` → `http://127.0.0.1:4320`，Tunnel 端已啟用 Protect with Access；DNS route 已建立。既有 `capture.lamlab.cc` 與其他服務保持不變。
- Tunnel token 存於 repo 外檔案，權限為 `600`；`.env.local` 保存本機啟動設定與 token-file 路徑且被 Git 忽略。文件不保存 token、AUD 或使用者 email。
- Production origin 只服務 `out/` 並綁定 loopback；helper 綁定 `127.0.0.1:4310`。Tunnel connector、origin 與 helper 均已啟動。未登入 API 請求在 Access 層被導向登入，登入後首頁、Research Brief、Source Inbox 及合成素材 review／approve／candidate download 流程已驗收。
- Cloudflare Zero Trust 使用現有免費方案，未新增 billing；研究排程及 Runner AI 開關沒有由部署流程變更。

## 架構

```text
手機瀏覽器
  -> Cloudflare HTTPS + Access（只允許一個明確身份）
  -> Radar 專用 Tunnel
  -> 127.0.0.1:4320（只服務 out/，先驗 Access JWT）
  -> 127.0.0.1:4310（既有 source / Gemini companion）
```

`out/` 是唯一靜態根目錄。Research runtime 留在 repo 外的本機 `.runtime/`，不進入 build。Production 頁面只呼叫同源 `/api/*`；server 僅代理明確列出的既有 API 路由。未知 API 回 JSON 404。Origin 驗證 Access 簽章、issuer、audience、有效期及 `CF_ACCESS_ALLOWED_EMAIL` 精確身份；缺設定或身份不符時拒絕服務。CORS 不作為身份驗證。

## Cloudflare 設定

本次已完成下列 Radar 專用設定；任何回滾或重設時均維持相同安全順序：

1. Access Self-hosted application 涵蓋 `radar.lamlab.cc` 全 hostname，policy 僅 Allow 一個由使用者確認的 email identity。
2. Radar 專用 remotely managed tunnel 僅路由 `radar.lamlab.cc` → `http://127.0.0.1:4320`，並啟用 **Protect with Access**（team 與 AUD 對應該 Access app）。
3. Origin 再驗 JWT 簽章、issuer、AUD、期限及精確 email；缺設定、登入過期、錯誤身份與未知 API 均 fail closed。
4. Tunnel token file 位於 repo 外且權限為 `600`。不修改根網域、`capture`、Storyloom 或其他 hostname。

官方操作依據：[建立 Self-hosted app 與保護 Origin](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)、[Access policy](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)、[Origin 驗證 Access JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)、[Tunnel route 的 Protect with Access 設定](https://developers.cloudflare.com/tunnel/reference/origin-parameters/)、[Tunnel token-file 參數](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/)。

## 本機設定與啟動

本機 `.env.local` 已配置本部署所需設定並由 Git 忽略；不在文件列出實際 AUD、email 或 token-file 路徑。新環境需依 Cloudflare Dashboard 建立對應值：

```dotenv
AI_PM_RADAR_PRODUCTION_PORT=4320
AI_PM_RADAR_PUBLIC_ORIGIN=https://radar.lamlab.cc
CF_ACCESS_TEAM_DOMAIN=https://<team-name>.cloudflareaccess.com
CF_ACCESS_AUD=<radar-access-application-aud>
CF_ACCESS_ALLOWED_EMAIL=<one-confirmed-email-address>
CLOUDFLARE_TUNNEL_TOKEN_FILE=<absolute-path-outside-this-repository>
```

既有 Gemini 設定仍只由 server-side helper 使用。不要使用 `NEXT_PUBLIC_` 前綴存放 key；本功能不要求另加 key。`.env.example` 只有空白 secret 欄位可作名稱參考。

啟動順序：

```bash
npm run validate:data
npm run validate:daily
npm run build:mobile
npm run start:mobile
```

在另一個 Terminal 啟動專用 tunnel：

```bash
npm run tunnel:mobile
```

第三個 Terminal 執行健康檢查：

```bash
npm run health:mobile
```

`start:mobile` 啟動 production static origin 與 companion helper；兩者只綁 `127.0.0.1`。它會檢查 build marker、Access 設定及 ports，任一服務停止會關閉同一 launcher 啟動的另一個服務。手機網址為 `https://radar.lamlab.cc/`。Tunnel 只應在 Access application/policy 已部署並核對後啟動。

`health:mobile` 會確認 Origin 在沒有 JWT 時 fail-closed（預期 401），再讀 helper `/status` 的 provider、model、configured；不輸出 API key。`configured=true` 只代表必要設定存在，不代表 Gemini key 有效或尚有 quota。

## 手機資料與操作

- 首頁、每日 Radar、Research Brief、Source Inbox、素材貼入／公開文章擷取、使用者主動觸發的 AI 分析、IndexedDB 草稿保存、review／approve 與 JSON 下載均走受保護的同源 HTTPS。
- 不會把 Gemini key 傳到瀏覽器；Access session 過期時提示重新登入。
- IndexedDB 屬於目前瀏覽器和 origin。新遠端 origin 沒有 localhost 草稿是正常狀況；桌面與手機不會同步。需要移轉時使用既有 JSON 匯出／匯入，匯入會驗證格式與版本。
- Research Brief 由受保護 API 讀本機 `.runtime/research/`。不包含在靜態輸出，也沒有遠端還原或雲端同步。
- Candidate 仍需既有 evidence、review 與明確 approval gate；輸出只下載候選 JSON，不修改正式 `data/daily/`。
- 排程與 runner AI 開關維持現況；此部署不會啟用它們或增加 quota。

### 手機驗收步驟

1. 在手機瀏覽器開啟 [https://radar.lamlab.cc](https://radar.lamlab.cc/)，於 Cloudflare Access 使用唯一獲准的 email identity 完成登入；登入過期時重新登入，不要改用其他公開入口。
2. 從首頁開啟「研究簡報」，確認內容能載入；再由主導覽開啟「來源工作台」。
3. 先以合成或公開素材測試貼連結／貼正文；只有按「AI 整理」時正文才會傳至 server-side Gemini provider。核對 evidence 和分析草稿，再測試保存或下載 SourceRecord 備份。
4. 要驗 candidate 時，先補齊 UI 列出的 daily 欄位與 evidence，執行 review，再明確 approve；下載後可用 `npm run validate:daily -- <candidate-directory>` 及 `npm run validate:data -- <candidate-directory>` 驗證。不要把候選檔複製進正式 `data/daily/` 作為此驗收的一部分。
5. 在 360–390px 手機寬度確認主要按鈕可觸及、軟鍵盤不遮住操作、卡片與錯誤文字可讀、JSON 備份／候選下載可操作。桌面 768px 也可作額外檢查。2026-09-21 使用者回報手機遠端存取測試通過；裝置、網路型態與實際 viewport 未記錄，因此不視為已獨立量測 360／390／768px。

## 停止與回滾

- 在啟動 tunnel 的 Terminal 按 `Ctrl-C`，只停止這次 Radar tunnel launcher。
- 在 `start:mobile` Terminal 按 `Ctrl-C`，只停止這次 production origin 與 helper。
- 回滾時先停 Radar tunnel，再停本機服務。若要移除雲端設定，只刪除 Radar 專用的 `radar.lamlab.cc` route/DNS record 與對應 Access application/tunnel；先確認名稱及 hostname，不修改其他 route。
- 本機 `.runtime/research/`、`.env.local` 與 IndexedDB 草稿不因停止服務而刪除。不要清除 localhost 網站資料。

Mac 必須保持開機、醒著且有網路；睡眠、關機或斷網時遠端服務可能不可用。本輪不承諾 24/7 雲端運行，不修改 Mac 睡眠設定。

## 本輪驗證範圍

- 本機：本次重新執行 `npm run build:mobile` 通過；本次部署驗收前既有 `npm test`（85 tests）、TypeScript、正式與 fixture candidate validators、`npm run build` 及 `npm run build:mobile` 均通過。`npm run health:mobile` 通過：origin 未帶 JWT 時回 401，helper 回報 Gemini／`gemini-3.5-flash-lite`／configured=true（只代表設定存在）。
- 外部 HTTPS：未登入的 `/api/status` 被 Cloudflare Access 導向登入（302）；登入後實際瀏覽首頁、Research Brief、Source Inbox。以合成素材完成輸入、AI 分析、IndexedDB reload、人工 review、明確 approve、candidate 與 SourceRecord 下載；下載 JSON 已解析，`validate:daily` 對實際下載檔通過，`validate:data` 對實際檔無資料錯誤（檔名有既有命名警告）；相同 JSON 使用 schema 預期日期檔名時兩個 validator 均無警告／錯誤。
- 真實 Gemini：一次合成素材分析成功，沒有再次呼叫；未改動排程或 Runner AI 開關。Candidate 僅為本地下載檔，正式 `data/daily/` 未寫入。
- 使用者驗收：2026-09-21 使用者回報手機遠端存取測試通過；由於沒有可用的真機觀測工具，設備／網路細節及測試畫面未獨立記錄。
- 尚未獨立驗證：360／390／768px viewport 與瀏覽器 Console。登入後瀏覽器流程及使用者的手機通過回報分別記錄，不互相替代。

## 2026-10-11 v0.4.0 Source Inbox mobile hotfix

- Radar `out/` was rebuilt with improved evidence-failure guidance and prominent quick save / draft backup controls. An earlier `out/` snapshot was retained outside the repo in a temporary local deployment rollback directory.
- `npm test` 120/120, typecheck, both daily validators and `build:mobile` PASS. After restarting only Radar origin/helper and the Radar-specific Cloudflare Tunnel, `health:mobile` PASS and unauthenticated `https://radar.lamlab.cc/source-inbox/` returned Access 302.
- Existing local IndexedDB autosave is browser/origin-specific; Save now persists a draft in the same browser, and Download draft backup writes a JSON file through the browser download flow. Neither is automatic cloud sync. User-facing physical-iPhone save/download/open/import still requires separate acceptance.
- If model evidence does not exactly match captured text, the AI output stays unapplied; the original draft may be manually reviewed or exported without another model call. Retry is user-triggered and may consume AI provider usage.
