import { cleanThreadsExport } from "./threads-import.mjs";

const view = document.getElementById("view");
const dec = (s) => { const t = document.createElement("textarea"); t.innerHTML = String(s ?? ""); return t.value; };
const esc = (s) => dec(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (p, o) => { const r = await fetch(p, { credentials: "same-origin", ...o }); const j = await r.json().catch(() => ({})); if (r.headers.get("x-radar-fixture") === "1" && j.article) j.article.fixture = true; if (!r.ok) throw Object.assign(new Error(j.error || r.status), { j }); return j; };
const MSG = { ai_daily_cap_reached: "今日 AI 額度已用完（08:00 重設）", insufficient_content: "內容太短，請打開原文貼上正文（用「＋擷取」）",
  ai_bad_output: "AI 回覆格式有誤，素材已保留，可稍後重試或人工整理。", workers_ai_error: "後備 AI 暫時出錯，素材已保留。", workers_ai_unbound: "後備 AI 未設定",
  gemini_key_missing: "AI 服務未設定或認證失敗；請檢查伺服器端設定。", auth_or_config: "AI 服務未設定或認證失敗；請檢查伺服器端設定與權限。",
  provider_http: "AI 服務回應失敗；請檢查服務狀態。", timeout: "AI 請求逾時；可以稍後重試。", malformed: "AI 回應格式無法核對；素材已保留，可人工整理或稍後重試。",
  no_full_text: "未取得全文；摘錄不能當作全文摘要。", cap_reached: "AI 額度已用完；額度重設後再試。", unsafe_redirect: "來源重新導向到不允許的網址；請貼入正文。",
  unauthorized: "登入已過期，請重新整理頁面", stale_source: "來源已更新，請重新載入後再試", not_found: "找不到", duplicate_source: "已經有呢個訊息源", bad_source: "格式唔啱" };
const msgOf = (e) => e.j?.hint || MSG[e.j?.code || e.j?.error || e.message] || (e.j?.provider_status ? `AI 服務回應 HTTP ${e.j.provider_status}；請檢查 provider 權限或服務狀態。` : "處理失敗，素材已保留。") + "";
const basisLabel = (basis) => ({ from_excerpt: "根據來源摘錄", full_text: "根據擷取全文", insufficient: "正文不足" }[basis] || "分析範圍未記錄");
const targetLanguageName = (code) => ({ "zh-Hant": "繁體中文", "zh-Hans": "简体中文", en: "English" }[code] || "繁體中文");
let lang = localStorage.getItem("radar-lang") || "zh";
const NI = { not_relevant: "同我無關", duplicate: "重複", low_quality: "質素低", already_known: "已經知道", too_much_x: "X 帖太多", other: "其他" };
const dupLi = (x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.source || "")}</a>` : esc(x.source || "")}${x.title ? ` <span class="meta">${esc(x.title.slice(0, 60))}</span>` : ""}</li>`;
const dupList = (it) => { const d = it.dup_sources || []; if (!d.length) return "";
  const head = `<p class="dups-h">同一件事亦見於 ${d.length} 個來源：</p>`;
  return d.length > 3 ? `<details class="dups"><summary>同一件事亦見於 ${d.length} 個來源</summary><ul>${d.map(dupLi).join("")}</ul></details>` : `<div class="dups">${head}<ul>${d.map(dupLi).join("")}</ul></div>`; };
const PV = { gemini: "Gemini", "workers-ai": "Workers AI", extractive: "摘錄" };
const TITLE_SOURCE = { feed: "來源 Feed", og: "頁面 Open Graph", page: "頁面資料", x_text_truncation: "X 正文截取（140 字）", user: "手動輸入", synthesized: "合成標題", inferred: "由正文推定" };
const EDITORIAL_STATUS = { draft: "編輯狀態：待審核", reviewed: "編輯狀態：已審核", approved: "編輯狀態：已批准", rejected: "編輯狀態：已拒絕" };
const REVIEW_STATUS = { NEEDS_SOURCE_REVIEW: "正文待核對", needs_review: "內容待人工核對", ai_enriched: "AI 整理完成，待人工核對", human_reviewed: "正文已人工核對" };
const DIMENSION_LABEL = { relevance: "相關性", novelty: "新穎度", actionability: "可行動性", promo_noise: "宣傳／噪音" };
const CURATION_REASON = { relevance_unknown: "未命中明確相關主題規則", low_relevance_signal: "相關性訊號低於 20", injection_suspect: "含疑似指令注入或風險連結" };
const SCORE_EVIDENCE = { paid_pilot: "付費試點／定價", agent_governance: "代理治理／評測", content_workflow: "內容工作流", free_resource: "官方免費資源", free_resource_lane: "免費資源（一般）", learning_path: "學習路徑", github_project: "開源專案", tech_news: "技術新聞", apply_now: "實作／工作流程", hype_only: "宣傳誇大訊號", copyright_reupload: "疑似未授權搬運", unverified_incident: "未核實事件歸因", injection_suspect: "疑似不可信指令／風險連結" };
const ul = (a) => (a || []).length ? "<ul>" + a.map((k) => `<li>${esc(k)}</li>`).join("") + "</ul>" : "";
const dimensionLine = (name, item) => `${DIMENSION_LABEL[name]}：${item?.status === "observed" ? `${esc(item.score)}/100（${esc((item.evidence || []).map((key) => SCORE_EVIDENCE[key] || key).join("、"))}）` : item?.status === "flagged" ? `已標記（${esc((item.evidence || []).map((key) => SCORE_EVIDENCE[key] || key).join("、"))}）` : `未知／未評（${esc(({ no_relevance_rule_match: "未命中明確主題規則", no_corpus_wide_novelty_check: "未做全庫新穎度比對", no_actionability_rule_match: "未命中明確行動規則", no_noise_classifier_signal: "目前沒有噪音分類訊號" })[item?.reason] || "歷史資料未記錄") }）`}`;
const curationMeta = (it) => {
  const dimensions = it.pref_breakdown?.dimensions;
  const quarantine = it.curation_status === "quarantine" ? `<p class="err">隔離待判斷：${esc(CURATION_REASON[it.curation_reason] || "評分訊號不足")}。放行只調整列表，不代表內容已審核或事實已查證。</p>` : it.curation_status === "released" ? `<p class="meta">人工放行至主列表；仍需獨立核對來源與事實。</p>` : "";
  const detail = dimensions ? `<details class="why"><summary>評分依據（訊號覆蓋 ${esc(it.pref_breakdown.observed_dimensions)}/4；不是準確率）</summary><ul>${Object.entries(DIMENSION_LABEL).map(([key]) => `<li>${dimensionLine(key, dimensions[key])}</li>`).join("")}</ul><p class="meta">${it.feedback_adj ? `使用者回饋調整 ${it.feedback_adj >= 0 ? "+" : ""}${esc(it.feedback_adj)}：${esc((it.train_reasons || []).map((reason) => `${reason.key} ${reason.weight >= 0 ? "+" : ""}${reason.weight}`).join(" · ") || "無匹配標籤")}` : "沒有匹配的使用者回饋調整"}</p></details>` : `<p class="meta">評分維度：未知／未評（歷史紀錄沒有分項依據）</p>`;
  return quarantine + detail;
};
function body(it) {
  const zhT = it.title_zh || it.title, orT = it.title_original || it.title;
  const hasAI = ["gemini", "workers-ai"].includes(it.ai_provider) && !!it.summary;
  const excerpt = it.raw_excerpt || (!hasAI ? it.summary : "") || "";
  const xOriginal = it.source_type === "x_post" ? `<details data-x-original="${esc(it.id)}"><summary>X 完整原文（未改寫）</summary><p>展開時載入原文</p></details>` : "";
  if (lang === "orig") return `<h3>${esc(orT)}</h3><p class="meta">${hasAI && it.summary_en ? "AI 英文摘要" : it.source_type === "x_post" ? "X 原文已保存，展開查看全文" : "來源摘錄（原文，未經 AI）"}</p>${hasAI ? `<p>${esc(it.summary_en || it.summary || excerpt)}</p>${ul(it.key_points_en?.length ? it.key_points_en : it.key_points)}` : it.source_type === "x_post" ? "" : `<p>${esc(excerpt)}</p>`}${xOriginal}`;
  if (lang === "both") return `<h3>${esc(zhT)}</h3>${orT !== zhT ? `<div class="orig">${esc(orT)}</div>` : ""}${hasAI ? `<p class="meta">AI 繁中摘要 · ${esc(PV[it.ai_provider] || it.ai_provider)}</p><p>${esc(it.summary)}</p>${it.summary_en ? `<p class="orig">AI 英文摘要：${esc(it.summary_en)}</p>` : ""}${ul(it.key_points)}` : it.source_type === "x_post" ? `<p class="meta">X 原文已保存，展開查看全文</p>` : `<p class="meta">來源摘錄（原文，未經 AI）</p><p>${esc(excerpt)}</p>`}${xOriginal}`;
  return `<h3>${esc(zhT)}</h3><p class="meta">${hasAI ? `AI 繁中摘要 · ${esc(PV[it.ai_provider] || it.ai_provider)}` : it.source_type === "x_post" ? "X 原文已保存，展開查看全文" : "來源摘錄（原文，未經 AI）"}</p>${hasAI ? `<p>${esc(it.summary)}</p>${ul(it.key_points)}` : it.source_type === "x_post" ? "" : `<p>${esc(excerpt)}</p>`}${xOriginal}`;
}
const size = (it, i) => i === 0 ? "feat" : (i < 3 || (it.score ?? 0) >= 8) ? "wide" : "";
const actionLine = (it) => it.action_14d || (it.summary ? it.summary.split(/[。.!?\n]/u)[0].slice(0, 120) : "待 Owner 補充下一步");
const titleToken = (it) => (String(it.title_zh || it.title || "").normalize("NFKC").match(/[\p{L}\p{N}]{2,80}/u) || [])[0] || "";
const titleMeta = (it) => `<div class="meta">${it.title_zh && it.title_original ? "AI 翻譯標題；原標題來源：" : "標題來源："}${esc(TITLE_SOURCE[it.title_source] || "未記錄")}</div>`;
const statusMeta = (it) => `${esc(EDITORIAL_STATUS[it.status] || "編輯狀態待確認")} · ${esc(REVIEW_STATUS[it.review_status] || "內容核對狀態待確認")}`;
const train = (item_id, scope, term, vote) => api("/api/trainer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_id, scope, term, vote }) });
const card = (it, i = 9) => `<article id="i-${it.id}" class="card ${size(it, i)}">${it.lane || it.category || it.source ? `<div class="kicker">${esc(it.lane || it.category || it.source)}</div>` : ""}${body(it)}${it.kind === "daily" && it.status === "draft" && (!it.ai_provider || it.ai_provider === "extractive") && String(it.raw_excerpt || "").length >= 200 ? `<label class="meta"><input type="checkbox" data-batch-ai-select value="${esc(it.id)}"> 選作 AI 摘要（會傳送來源摘錄）</label>` : ""}${it.analysis_basis ? `<p class="meta">${esc(basisLabel(it.analysis_basis))}${it.ai_model ? ` · ${esc(it.ai_model)}` : ""}</p>` : ""}${it.analysis_error_code ? `<p class="err">AI 分析 ${esc(it.analysis_status || "failed")}：${esc(it.analysis_error_code)}</p>` : ""}${titleMeta(it)}${it.lane ? `<p class="lane-action"><b>14 日行動：</b>${esc(actionLine(it))}</p>` : ""}${it.injection_suspect ? `<p class="err">含可疑指令或連結，僅作不可信資料；未執行。</p>` : ""}${it.review_status === "NEEDS_SOURCE_REVIEW" ? `<p class="err">正文待核對 · 尚未取得可核對正文</p>` : ""}${curationMeta(it)}${it.status === "draft" && it.ai_provider === "extractive" && it.review_status !== "NEEDS_SOURCE_REVIEW" ? `<div class="acts"><button data-act="deep-read" data-id="${it.id}">AI 深讀</button></div>` : ""}${it.side_income_new ? `<p class="money"><b>💰 新變現機會</b>${esc(it.side_income_reason || "")}</p>` : ""}${it.score != null ? `<p class="why score-why"><b>評分 ${esc(it.score)}</b>${esc(it.score_reason || it.reco_reason || "")}</p>` : ""}${it.reco_reason && it.reco_reason !== it.score_reason ? `<p class="why"><b>推薦理由</b>${esc(it.reco_reason)}</p>` : ""}${it.train_reasons?.length ? `<p class="why"><b>訓練調整 ${it.feedback_adj >= 0 ? "+" : ""}${esc(it.feedback_adj)}</b> ${esc(it.train_reasons.map((r) => `${r.key} ${r.weight >= 0 ? "+" : ""}${r.weight}`).join(" · "))}</p>` : ""}<div class="meta">${it.pref_score != null ? `偏好 ${esc(it.pref_score)} · ` : "偏好 未評／未知 · "}${it.pref_reasons?.length ? `命中 ${esc(it.pref_reasons.join(", "))} · ` : ""}${it.reco_score != null ? `<span class="reco">推薦 ${esc(it.reco_score)}</span> · ` : ""}${esc(it.source || "")} · ${statusMeta(it)}${it.ai_provider ? " · " + esc(PV[it.ai_provider] || it.ai_provider) : ""}</div>
<div class="links">${(it.kind === "capture" || (it.url && !/^https?:\/\/(x|twitter)\.com\//.test(it.url))) ? `<a href="#" data-read="${it.id}">閱讀正文 →</a>` : ""}${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}</div>
<div class="acts">${it.curation_status === "quarantine" ? `<button class="sec" data-do="release_quarantine" data-id="${it.id}">人工放行至主列表</button>` : ""}${it.status === "draft" ? `<button data-act="review" data-id="${it.id}">標記為已審核</button>` : ""}${it.status === "reviewed" ? `<button data-act="approve" data-id="${it.id}">批准重用</button>` : ""}<button class="sec" data-do="${it.starred ? "unstar" : "star"}" data-id="${it.id}" aria-pressed="${!!it.starred}" title="收藏入知識庫">${it.starred ? "★ 已收藏" : "☆ 收藏"}</button><button class="sec" data-do="${it.read_later ? "unread_later" : "read_later"}" data-id="${it.id}" aria-pressed="${!!it.read_later}">${it.read_later ? "✓ 稍後讀" : "稍後讀"}</button>
<div class="more"><button class="sec more-btn" aria-haspopup="menu" aria-expanded="false" aria-label="更多動作" data-more="${it.id}">⋯</button><div class="menu" role="menu" hidden>${!it.title_zh ? `<button role="menuitem" data-act="translate" data-id="${it.id}">轉中文</button>` : ""}${["draft", "reviewed"].includes(it.status) ? `<button role="menuitem" data-act="reject" data-id="${it.id}">拒絕</button>` : ""}${it.dismissed_reason ? `<button role="menuitem" data-do="restore" data-id="${it.id}">取消唔感興趣</button>` : `<label class="ni">唔感興趣<select data-ni="${it.id}" aria-label="唔感興趣原因"><option value="">揀原因…</option>${Object.entries(NI).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`}${(it.source || "").startsWith("x:@") ? `<button role="menuitem" data-mute="handle" data-v="${esc(it.source.slice(2))}">靜音 ${esc(it.source.slice(2))}</button>` : it.category ? `<button role="menuitem" data-mute="topic" data-v="${esc(it.category)}">靜音題材 ${esc(it.category)}</button>` : ""}</div></div></div>${titleToken(it) ? `<div class="acts"><span class="meta">標題詞 ${esc(titleToken(it))}</span><button class="sec" data-train="up" data-id="${it.id}" data-term="${esc(titleToken(it))}">👍</button><button class="sec" data-train="down" data-id="${it.id}" data-term="${esc(titleToken(it))}">👎</button></div>` : ""}<form data-trainer="${it.id}" class="acts"><label>關鍵字 <input name="term" maxlength="80" placeholder="文章內字詞"></label><button class="sec" name="vote" value="up">👍</button><button class="sec" name="vote" value="down">👎</button></form>${dupList(it)}</article>`;
const list = (items) => items.length ? `<div class="grid">${items.map(card).join("")}</div>` : "<p class='meta'>暫時冇內容</p>";
const batchSummaryToolbar = (items) => items.some((it) => it.kind === "daily" && it.status === "draft" && (!it.ai_provider || it.ai_provider === "extractive") && String(it.raw_excerpt || "").length >= 200)
  ? `<details class="panel"><summary>批次 AI 摘要（需明確確認預算）</summary><p class="meta">只處理下方已勾選的待審核素材。分析不代表已審核／批准；正文摘錄會傳送到目前設定的模型供應商。</p><label>最多素材數<input id="batch-max-items" type="number" min="1" max="10" value="1"></label><label>最多模型呼叫數<input id="batch-max-calls" type="number" min="1" max="20" value="1"></label><label><input id="batch-confirm" type="checkbox"> 我確認以上素材數及模型呼叫上限，並同意傳送所選摘錄。</label><button id="batch-summarize">對所選素材執行 AI 摘要</button><p id="batch-summarize-status" role="status"></p></details>` : "";
async function show(tab) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  try {
    if (tab === "capture") { view.innerHTML = ""; view.append(document.getElementById("capture-tpl").content.cloneNode(true)); return bindCapture(); }
    if (tab === "sources") { view.innerHTML = ""; view.append(document.getElementById("sources-tpl").content.cloneNode(true)); return bindSources(); }
    if (tab === "daily") {
      if (localStorage.getItem("radar-digest") === "1") {
        const [d, trained] = await Promise.all([api("/api/digest?days=7"), api("/api/trainer")]);
        view.innerHTML = `<button data-digest="0">返回今日</button><p class="meta">近 ${d.days} 日精選 · AI 呼叫 ${d.ai_calls}</p><details><summary>已訓練權重（${trained.weights.length}）</summary><ul>${trained.weights.map((w) => `<li>${esc(w.key)} ${w.weight >= 0 ? "+" : ""}${esc(w.weight)}</li>`).join("")}</ul></details>${Object.entries(d.lanes).filter(([, rows]) => rows.length).map(([name, rows]) => `<section><h2>${esc(name)}</h2>${list(rows)}</section>`).join("")}`;
        return;
      }
      const lane = localStorage.getItem("radar-lane") || "ALL";
      const d = await api(`/api/daily${lane === "QUARANTINE" ? "?quarantine=1" : lane === "ARCHIVE" ? "?archive=1" : lane === "ALL" ? "" : `?lane=${encodeURIComponent(lane)}`}`);
      const laneNames = ["ALL", "AI_LEARNING_PATH", "MONETIZATION_GAP", "TECH_NEWS", "GITHUB_PROJECT", "APPLY_NOW", "FREE_RESOURCE", "AGENT_GOVERNANCE", "CONTENT_WORKFLOW", "OTHER", "ARCHIVE", "QUARANTINE"];
      const topN = localStorage.getItem("radar-top-n") || "10";
      const tabs = `<div class="lane-tabs">${laneNames.map((x) => `<button data-lane="${x}" class="${lane === x ? "on" : ""}">${x === "ALL" ? "全部" : x === "ARCHIVE" ? `低分封存 (${d.archived_count || 0})` : x === "QUARANTINE" ? `隔離待判斷 (${d.quarantine_count ?? d.count ?? 0})` : x}</button>`).join("")}<label>Top N <select data-topn>${[5,10,20,"all"].map((n)=>`<option value="${n}" ${String(n)===topN?"selected":""}>${n}</option>`).join("")}</select></label></div>`;
      const picks = d.items.filter((i) => (i.reco_score ?? 0) >= 7 || i.side_income_new || (i.score ?? 0) >= 8).slice(0, 6);
      const only = localStorage.getItem("radar-reco") === "1";
      const minS = Number(localStorage.getItem("radar-min-score") || 0);
      const shownAll = (only ? picks : d.items).filter((i) => (i.score ?? 0) >= minS);
      const shown = topN === "all" ? shownAll : shownAll.slice(0, Number(topN));
      const st = d.stats ? ` · 已隱藏 ${d.stats.hidden} · 合併重複 ${d.stats.duplicates} · 配額暫留 ${d.stats.quota_held}` : "";
      view.innerHTML = `<p class="dateline">${esc(d.date || "未有")} · 今日焦點 ${d.items.length} 則${esc(st)}</p><button data-digest="1">近 7 日精選</button>${tabs}
<div class="filters"><button data-reco="0" class="${only ? "" : "on"}">全部</button><button data-reco="1" class="${only ? "on" : ""}">只睇推薦（${picks.length}）</button>
<label class="score-f">評分 ≥ <select data-minscore>${[0,5,6,7,8,9].map((n)=>`<option value="${n}" ${minS===n?"selected":""}>${n||"不限"}</option>`).join("")}</select></label></div>
${picks.length ? `<section class="picks" aria-label="推薦給你"><h2>推薦給你</h2><ol>${picks.map((p) => `<li>${p.side_income_new ? `<span class="badge">💰 新變現機會</span>` : ""}<span class="sc">${p.score != null ? esc(p.score) : "–"}</span><a href="#i-${p.id}">${esc(p.title_zh || p.title)}</a><span>${esc(p.side_income_new ? p.side_income_reason || p.score_reason || p.reco_reason || "" : p.score_reason || p.reco_reason || "")}</span></li>`).join("")}</ol></section>` : ""}` + batchSummaryToolbar(shown) + list(shown);
    }
    else if (tab === "later") { const d = await api("/api/read-later"); view.innerHTML = list(d.items); }
    else if (tab === "kb") return renderKB();
    else { const d = await api(tab === "draft" ? "/api/library?status=all" : "/api/library?status=approved");
      const items = tab === "draft" ? d.items.filter((i) => ["draft", "reviewed"].includes(i.status)) : d.items;
      const minS = Number(localStorage.getItem("radar-min-score") || 0);
      view.innerHTML = `<div class="filters"><label class="score-f">評分 ≥ <select data-minscore>${[0,5,6,7,8,9].map((n)=>`<option value="${n}" ${minS===n?"selected":""}>${n||"不限"}</option>`).join("")}</select></label></div>` + list(items.filter((i) => (i.score ?? 0) >= minS)); }
  } catch (e) { view.innerHTML = `<p>載入失敗：${esc(e.message)}</p>`; }
}
async function bindSources() {
  const listEl = document.getElementById("src-list"); const msg = document.getElementById("src-msg");
  const healthEl = document.getElementById("source-health");
  api("/api/source-health").then((h) => { const a = h.last_analysis; const analysis = a ? `每日分析：${esc(a.status || "unknown")} · 已整理 ${esc(a.analyzed || 0)} · 跳過 ${esc(a.skipped?.length || 0)} · 失敗 ${esc(a.failures?.length || 0)}${a.skipped?.[0] ? ` · 首個跳過原因 ${esc(a.skipped[0].reason)}` : ""}${a.failures?.[0] ? ` · 首個錯誤 ${esc(a.failures[0].code)}` : ""}` : "每日分析狀態未記錄"; healthEl.innerHTML = `<p class="meta">類型數：${Object.entries(h.catalog_counts).map(([type, n]) => `${esc(type)} ${esc(n)}`).join(" · ")} · 手動擷取記錄 ${esc(h.manual_captures)}</p><p class="meta">${analysis}</p><p class="meta">${esc(h.note)}</p><details><summary>逐個來源（${h.sources.length}）</summary>${h.sources.map((s) => `<p class="meta">${esc(s.id)} · ${esc(s.type)} · 記錄 ${esc(s.count)} · ${esc(s.status)} · 上次檢查 ${esc(s.last_check_at || "unknown")} · ${esc(s.reason)}</p>`).join("")}</details>`; }).catch((e) => { healthEl.textContent = `來源健康無法讀取：${msgOf(e)}`; });
  const render = async () => { const { sources } = await api("/api/sources?include_disabled=1");
    listEl.innerHTML = sources.length ? sources.map((s) => `<div class="src ${s.enabled ? "" : "off"}"><span class="tag">${esc(s.type)}</span><div class="grow"><b>${esc(s.label || s.value)}</b><div class="meta">${esc(s.value)}</div><details><summary>來源設定</summary><form data-source-setting="${s.id}" class="settings-form"><label>預設 Lane<select name="lane_default">${["AI_LEARNING_PATH","MONETIZATION_GAP","TECH_NEWS","GITHUB_PROJECT","APPLY_NOW","FREE_RESOURCE","AGENT_GOVERNANCE","CONTENT_WORKFLOW","OTHER"].map((x)=>`<option ${x===s.lane_default?"selected":""}>${x}</option>`).join("")}</select></label><div class="row"><label>權重<input name="weight" type="number" min="-2" max="2" value="${s.weight}"></label><label>每日上限<input name="max_per_day" type="number" min="1" max="100" value="${s.max_per_day}"></label></div><label>包含關鍵字<input name="include_keywords" value="${esc((JSON.parse(s.include_keywords||"[]")).join(", "))}"></label><label>排除關鍵字<input name="exclude_keywords" value="${esc((JSON.parse(s.exclude_keywords||"[]")).join(", "))}"></label><label><input name="ai_eligible" type="checkbox" ${s.ai_eligible?"checked":""}>AI 自動分析候選</label><button type="submit">儲存設定</button></form></details></div>
<button class="sec" data-src="toggle" data-id="${s.id}" data-on="${s.enabled}" aria-pressed="${!!s.enabled}">${s.enabled ? "停用" : "啟用"}</button><button class="rej" data-src="del" data-id="${s.id}">刪除</button></div>`).join("")
      : "<p class='meta'>未有自訂訊息源。內建：OpenAI、Anthropic、TechCrunch AI、Coursera、Hugging Face、Hacker News。</p>"; };
  document.getElementById("src-form").addEventListener("submit", async (ev) => { ev.preventDefault(); const f = new FormData(ev.target);
    try { const b = Object.fromEntries(f); b.weight = Number(b.weight); b.max_per_day = Number(b.max_per_day); b.ai_eligible = f.get("ai_eligible") === "true"; b.include_keywords = b.include_keywords.split(",").map((x)=>x.trim()).filter(Boolean); b.exclude_keywords = b.exclude_keywords.split(",").map((x)=>x.trim()).filter(Boolean); await api("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); msg.textContent = "已新增"; ev.target.reset(); render(); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); } });
  listEl.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-src]"); if (!b) return;
    if (b.dataset.src === "del" && !confirm("確定刪除？")) return;
    try { await api(`/api/sources/${b.dataset.id}`, b.dataset.src === "del" ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: b.dataset.on !== "1" }) }); render(); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); } });
  listEl.addEventListener("submit", async (ev) => { const form = ev.target.closest("[data-source-setting]"); if (!form) return; ev.preventDefault(); const f = new FormData(form); const b = Object.fromEntries(f); b.weight=Number(b.weight); b.max_per_day=Number(b.max_per_day); b.include_keywords=b.include_keywords.split(",").map(x=>x.trim()).filter(Boolean); b.exclude_keywords=b.exclude_keywords.split(",").map(x=>x.trim()).filter(Boolean); b.ai_eligible=f.get("ai_eligible")==="on"; try { await api(`/api/sources/${form.dataset.sourceSetting}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(b)}); msg.textContent="設定已儲存"; render(); } catch(e) { msg.textContent="設定失敗："+msgOf(e); } });
  render().catch((e) => { listEl.textContent = "載入失敗：" + msgOf(e); });
  const ml = document.getElementById("mute-list"); const mm = document.getElementById("mute-msg");
  const renderM = async () => { const { mutes } = await api("/api/mutes"); ml.innerHTML = mutes.length ? mutes.map((x) => `<div class="src"><span class="tag">${{ keyword: "字", topic: "題", handle: "X" }[x.kind]}</span><div class="grow"><b>${esc(x.value)}</b></div><button class="rej" data-unmute="${x.id}">取消靜音</button></div>`).join("") : "<p class='meta'>未有靜音。</p>"; };
  document.getElementById("mute-form").addEventListener("submit", async (ev) => { ev.preventDefault();
    try { await api("/api/mutes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(ev.target))) }); mm.textContent = "已靜音"; ev.target.reset(); renderM(); } catch (e) { mm.textContent = "失敗：" + msgOf(e); } });
  ml.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-unmute]"); if (!b) return; try { await api(`/api/mutes/${b.dataset.unmute}`, { method: "DELETE" }); renderM(); } catch (e) { mm.textContent = "失敗：" + msgOf(e); } });
  renderM().catch(() => {});
  bindSourceImports();
}
function bindSourceImports() {
  const panel = document.getElementById("source-import"); if (!panel) return;
  const content = document.getElementById("source-import-content"), format = document.getElementById("source-import-format");
  const previewOut = document.getElementById("source-import-preview-out"), mapOut = document.getElementById("source-import-mapping");
  const confirmButton = document.getElementById("source-import-confirm"), jobOut = document.getElementById("source-import-job");
  let lastPreview = null, previewRevision = 0;
  const invalidatePreview = () => { previewRevision++; lastPreview = null; confirmButton.disabled = true; };
  const mapping = () => Object.fromEntries([...mapOut.querySelectorAll("select[data-map]")].map((el) => [el.dataset.map, el.value]));
  content.addEventListener("input", invalidatePreview); format.addEventListener("change", invalidatePreview); mapOut.addEventListener("change", invalidatePreview);
  const renderJob = (job) => {
    localStorage.setItem("radar-source-import-job", job.id);
    const retryIds = job.rows.filter((row) => row.status === "failed").map((row) => row.id);
    const active = ["queued", "running", "partial"].includes(job.status);
    const invalidRows = job.rows.filter((row) => row.status === "invalid");
    const types = ["rss", "x", "github_search", "github_releases", "youtube_channel"];
    jobOut.innerHTML = `<p>匯入 ${esc(job.status)} · 已處理 ${esc(job.processed)}/${esc(job.total)} · 新增 ${esc(job.counts.added)} · 已存在 ${esc(job.counts.exists)} · 無效 ${esc(job.counts.invalid)} · 失敗 ${esc(job.counts.failed)} · AI 呼叫 0</p><table class="prev-t"><thead><tr><th>狀態／修正</th><th>項目</th><th>原因</th></tr></thead><tbody>${job.rows.map((row) => `<tr><td>${esc(row.status)}${row.error_code ? ` · ${esc(row.error_code)}` : ""}${row.status === "invalid" ? `<label>類型<select data-revalidate-type="${esc(row.id)}">${types.map((type) => `<option value="${type}" ${row.adapter_type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label>修正值<input data-revalidate-value="${esc(row.id)}" value="${esc(row.value)}" maxlength="2048"></label><label>名稱<input data-revalidate-label="${esc(row.id)}" value="${esc(row.label || "")}" maxlength="200"></label>` : ""}</td><td>${esc(row.label || row.value)}</td><td>${esc(row.error_code || "")}</td></tr>`).join("")}</tbody></table>${invalidRows.length && job.status !== "cancelled" ? `<button data-import-job="revalidate" data-id="${esc(job.id)}">重新驗證 ${invalidRows.length} 個修正項目</button><p class="meta">無效資料不會當成暫時故障重試；通過格式驗證後才會回到匯入佇列。</p>` : ""}${active ? `<button data-import-job="run" data-id="${esc(job.id)}">${job.status === "queued" ? "開始匯入" : "處理下一批／續傳"}</button><button data-import-job="cancel" data-id="${esc(job.id)}">取消後續項目</button>` : ""}${retryIds.length && job.status !== "cancelled" ? `<button data-import-job="retry" data-id="${esc(job.id)}">重試 ${retryIds.length} 個失敗項目</button>` : ""}`;
  };
  document.getElementById("source-import-file").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0]; if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop(); format.value = ext === "opml" || ext === "xml" ? "opml" : ext === "csv" ? "csv" : "text";
    content.value = await file.text(); invalidatePreview();
  });
  document.getElementById("source-import-preview").addEventListener("click", async () => {
    previewOut.textContent = "正在預覽；不會呼叫 AI…"; confirmButton.disabled = true;
    try {
      const revision = previewRevision, submitted = { format: format.value, content: content.value, mapping: Object.keys(mapping()).length ? mapping() : undefined };
      const result = await postJ("/api/source-imports/preview", submitted);
      if (revision !== previewRevision) { previewOut.textContent = "預覽期間內容已修改；請重新預覽，確認按鈕保持停用。"; return; }
      if (result.mapping_required) {
        mapOut.innerHTML = `<p class="meta">請對應 CSV 欄位；選擇完成後重新預覽。GitHub Search 可把查詢文字對應到「來源網址或查詢值」，並在類型欄指定 github_search。</p>${Object.entries({ url: "來源網址或查詢值", handle: "X 帳號", title: "標題", adapter_type: "來源類型", category: "分類" }).map(([key, label]) => `<label>${label}<select data-map="${key}"><option value="">不使用</option>${result.headers.map((h) => `<option value="${esc(h)}" ${h === result.suggested?.[key] ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></label>`).join("")}`;
        previewOut.textContent = `CSV 有 ${result.headers.length} 個欄位，請對應後重新預覽。`; return;
      }
      lastPreview = submitted;
      const sourceImportStatus = { new: "可匯入", exists: "已存在", duplicate_in_batch: "本批重複", invalid: "無效來源", needs_map: "需人工指定類型" };
      mapOut.replaceChildren(); previewOut.innerHTML = `<p>預覽 ${result.preview.length} 項 · ${Object.entries(result.counts).map(([k, v]) => `${esc(sourceImportStatus[k] || k)} ${esc(v)}`).join(" · ")} · AI 呼叫 0</p><table class="prev-t"><tbody>${result.preview.map((row) => `<tr><td>${esc(sourceImportStatus[row.status] || row.status)}</td><td>${esc(row.label || row.value || `第 ${row.line} 行`)}</td><td>${esc(row.error === "needs_map" ? "請在 CSV 明確指定來源類型，或修正輸入格式" : row.error || row.category || "")}</td></tr>`).join("")}</tbody></table>`;
      confirmButton.disabled = !result.preview.some((row) => row.status === "new");
    } catch (error) { previewOut.innerHTML = `<p class="err">預覽失敗：${esc(msgOf(error))}；內容仍保留。</p>`; }
  });
  confirmButton.addEventListener("click", async () => {
    if (!lastPreview || confirmButton.disabled) return;
    confirmButton.disabled = true; previewOut.textContent = "已確認；建立可續傳工作…";
    try {
      const jobId = crypto.randomUUID();
      const result = await postJ("/api/source-imports", { ...lastPreview, confirm: true, job_id: jobId });
      lastPreview = null;
      renderJob(result.job);
    } catch (error) { confirmButton.disabled = false; previewOut.innerHTML = `<p class="err">建立失敗：${esc(msgOf(error))}；輸入仍保留。</p>`; }
  });
  panel.addEventListener("click", async (ev) => {
    const button = ev.target.closest("[data-import-job]"); if (!button) return;
    button.disabled = true; const id = button.dataset.id, action = button.dataset.importJob;
    try {
      let result;
      if (action === "run") result = await postJ(`/api/source-imports/${id}/run`, {});
      else if (action === "cancel") result = await postJ(`/api/source-imports/${id}/cancel`, {});
      else if (action === "revalidate") {
        const rows = [...jobOut.querySelectorAll("[data-revalidate-value]")].slice(0, 20).map((input) => ({ id: input.dataset.revalidateValue, type: jobOut.querySelector(`[data-revalidate-type="${CSS.escape(input.dataset.revalidateValue)}"]`).value,
          value: input.value, label: jobOut.querySelector(`[data-revalidate-label="${CSS.escape(input.dataset.revalidateValue)}"]`).value }));
        result = await postJ(`/api/source-imports/${id}/revalidate`, { rows });
      }
      else {
        const job = await api(`/api/source-imports/${id}`);
        result = await postJ(`/api/source-imports/${id}/retry`, { row_ids: job.job.rows.filter((row) => row.status === "failed").map((row) => row.id) });
      }
      renderJob(result.job);
    } catch (error) { jobOut.insertAdjacentHTML("afterbegin", `<p class="err">操作失敗：${esc(msgOf(error))}；可重新載入後續傳。</p>`); button.disabled = false; }
  });
  const priorJob = localStorage.getItem("radar-source-import-job");
  if (priorJob) api(`/api/source-imports/${priorJob}`).then(({ job }) => renderJob(job)).catch(() => localStorage.removeItem("radar-source-import-job"));
}
const cur = () => document.querySelector("nav button.on").dataset.tab;
const doAct = (id, action, reason) => api(`/api/items/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
function bindCapture() {
  document.getElementById("cap-form").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target); const msg = document.getElementById("cap-msg"); msg.textContent = "儲存待審核資料…";
    try { const r = await api("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: f.get("title"), url: f.get("url"), text: f.get("text"), source_language: f.get("source_language") }) }); msg.textContent = r.result === "manual_enrichment" ? "已補上手動正文；原來源歷史可在閱讀頁核對。沒有呼叫 AI。" : r.result === "duplicate" ? "已有相同擷取，未重複儲存。" : r.review_status === "NEEDS_SOURCE_REVIEW" ? "已存入；來源正文待核對。沒有呼叫 AI。" : "已存為待審核草稿。沒有呼叫 AI。"; ev.target.reset(); if (f.get("text") || f.get("url")) openReader(r.id); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); }
  });
  document.getElementById("inbox-import").addEventListener("click", async () => { const msg=document.getElementById("inbox-import-msg"); try { const records=JSON.parse(document.getElementById("inbox-json").value); if(!Array.isArray(records)) throw new Error("JSON 須為陣列"); const r=await api("/api/inbox/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(records)}); msg.textContent=`已存 ${r.inserted} 筆；重複 ${r.duplicate}；需核對正文 ${r.needs_source_review}。沒有呼叫 AI。`; } catch(e) { msg.textContent="匯入失敗："+msgOf(e); } });
}
view.addEventListener("change", async (ev) => { const ni = ev.target.closest("[data-ni]"); if (ni) { if (!ni.value) return; try { await doAct(ni.dataset.ni, "not_interested", ni.value); show(cur()); } catch (e) { alert(msgOf(e)); } return; }
  const topn = ev.target.closest("[data-topn]"); if (topn) { localStorage.setItem("radar-top-n", topn.value); show("daily"); return; }
  const s = ev.target.closest("[data-minscore]"); if (!s) return; localStorage.setItem("radar-min-score", s.value); show(document.querySelector("nav button.on").dataset.tab); });
const closeMenus = (except) => document.querySelectorAll(".more .menu:not([hidden])").forEach((m) => { if (m !== except) { m.hidden = true; m.previousElementSibling.setAttribute("aria-expanded", "false"); } });
document.addEventListener("click", (ev) => { if (!ev.target.closest(".more")) closeMenus(); });
document.addEventListener("keydown", (ev) => { if (ev.key !== "Escape") return; const open = document.querySelector(".more .menu:not([hidden])"); if (open) { closeMenus(); open.previousElementSibling.focus(); } });
view.addEventListener("click", async (ev) => {
  const original = ev.target.closest("[data-x-original]"); if (original) {
    if (original.dataset.loaded) return;
    original.dataset.loaded = "loading";
    try { const result = await api(`/api/items/${original.dataset.xOriginal}`); original.querySelector("p").textContent = result.item.original_text || "此項目沒有保存完整原文。"; original.dataset.loaded = "yes"; }
    catch (error) { original.querySelector("p").textContent = `原文載入失敗：${msgOf(error)}`; delete original.dataset.loaded; }
    return;
  }
  const batchSummary = ev.target.closest("#batch-summarize"); if (batchSummary) {
    const status = document.getElementById("batch-summarize-status");
    const ids = [...view.querySelectorAll("[data-batch-ai-select]:checked")].map((input) => input.value);
    const maxItems = Number(document.getElementById("batch-max-items")?.value), maxCalls = Number(document.getElementById("batch-max-calls")?.value);
    if (!document.getElementById("batch-confirm")?.checked || !ids.length || ids.length > maxItems || !Number.isInteger(maxItems) || maxItems < 1 || maxItems > 10 || !Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 20) { status.textContent = "請勾選確認、選取不超過素材上限，並設定 1–10 筆及 1–20 次模型呼叫上限。"; return; }
    batchSummary.disabled = true; status.textContent = `正在整理 ${ids.length} 筆；最多 ${maxCalls} 次模型呼叫…`;
    try { const result = await postJ("/api/items/batch-summarize", { ids, confirm: true, budget: { max_items: maxItems, max_calls: maxCalls } }); const summary = `完成 ${result.results.filter((r) => r.status === "completed").length} 筆；失敗 ${result.results.filter((r) => r.status === "failed").length}；略過 ${result.results.filter((r) => r.status === "skipped").length}；模型呼叫 ${result.model_calls}/${result.budget.max_calls}${result.remaining_ids.length ? `；預算停止，尚有 ${result.remaining_ids.length} 筆未處理` : ""}。分析仍需人工核對。`; await show("daily"); const freshStatus = document.getElementById("batch-summarize-status"); if (freshStatus) freshStatus.textContent = summary; }
    catch (error) { status.textContent = `批次分析未完成：${msgOf(error)}；草稿已保留。`; batchSummary.disabled = false; } return;
  }
  const digest = ev.target.closest("[data-digest]"); if (digest) { localStorage.setItem("radar-digest", digest.dataset.digest); return show("daily"); }
  const thumb = ev.target.closest("[data-train]"); if (thumb) { thumb.disabled = true; try { await train(thumb.dataset.id, "title", thumb.dataset.term, thumb.dataset.train); await show(cur()); } catch (e) { thumb.disabled = false; alert(msgOf(e)); } return; }
  const laneTab = ev.target.closest("[data-lane]"); if (laneTab) { localStorage.setItem("radar-lane", laneTab.dataset.lane); return show("daily"); }
  const mb = ev.target.closest("[data-more]"); if (mb) { const m = mb.nextElementSibling; const show = m.hidden; closeMenus(m); m.hidden = !show; mb.setAttribute("aria-expanded", String(show)); if (show) m.querySelector("button,select")?.focus(); return; } const r = ev.target.closest("[data-reco]"); if (r) { localStorage.setItem("radar-reco", r.dataset.reco); return show("daily"); }
  const d2 = ev.target.closest("[data-do]"); if (d2) { if (d2.dataset.do === "release_quarantine" && !confirm("放行只會把素材移出隔離清單；不代表內容已審核、主張已查證或已批准。確定繼續？")) return; d2.disabled = true; try { await doAct(d2.dataset.id, d2.dataset.do, d2.dataset.do === "release_quarantine" ? "owner_reviewed_relevance" : undefined); } catch (e) { alert(msgOf(e)); } return show(cur()); }
  const mu = ev.target.closest("[data-mute]"); if (mu) { if (!confirm(`靜音 ${mu.dataset.v}？之後唔會再喺今日出現（可喺訊息源取消）`)) return; try { await api("/api/mutes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: mu.dataset.mute, value: mu.dataset.v }) }); } catch (e) { alert(msgOf(e)); } return show(cur()); }
  const kn = ev.target.closest("[data-kbnote]"); if (kn) { const note = prompt("筆記（會一齊匯出去 Obsidian）"); if (note == null) return; try { await api(`/api/kb/${kn.dataset.kbnote}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ note }) }); } catch (e) { alert(msgOf(e)); } return show("kb"); }
  const kd = ev.target.closest("[data-kbdel]"); if (kd) { if (!confirm("由知識庫移除？")) return; try { await api(`/api/kb/${kd.dataset.kbdel}`, { method: "DELETE" }); } catch (e) { alert(msgOf(e)); } return show("kb"); }
  const b = ev.target.closest("[data-act]"); if (!b) return; b.disabled = true;
  if (b.dataset.act === "translate") b.textContent = "AI 處理中…";
  try { await api(`/api/items/${b.dataset.id}/${b.dataset.act}`, { method: "POST" }); }
  catch (e) { refreshCap(); const n = document.createElement("div"); n.className = "err"; n.textContent = msgOf(e); b.closest(".acts").after(n); b.disabled = false; if (b.dataset.act === "translate") b.textContent = "轉中文"; return; }
  refreshCap();
  show(document.querySelector("nav button.on").dataset.tab); });
document.querySelector("nav").addEventListener("click", (ev) => { const t = ev.target.dataset.tab; if (t) show(t); });
function refreshCap() { api("/api/cloud/capabilities").then((c) => { const u = c.ai.usage; const providers = [u.gemini, u.workersAi].filter((x) => x.cap > 0); const reserve = providers.map((x, i) => `${i ? "Workers AI" : "Gemini"} ${x.manualReserveRemaining}`).join(" / "); document.getElementById("cap").textContent = `自動分析 ${u.auto.used}/${u.auto.cap}（餘 ${u.auto.remaining}） · 手動整理保留 ${reserve}`; }).catch(() => {}); }
document.getElementById("lang").addEventListener("click", (ev) => { const l = ev.target.dataset.lang; if (!l) return; lang = l; localStorage.setItem("radar-lang", l);
  document.querySelectorAll("#lang button").forEach((x) => x.classList.toggle("on", x.dataset.lang === l)); const t = document.querySelector("nav button.on").dataset.tab; if (t !== "capture") show(t); });
document.querySelectorAll("#lang button").forEach((x) => x.classList.toggle("on", x.dataset.lang === lang));
refreshCap();

// ---------- P1: Reader view ----------
const JH = { "content-type": "application/json" };
const postJ = (p, b) => api(p, { method: "POST", headers: JH, body: JSON.stringify(b ?? {}) });
const reader = document.createElement("section"); reader.id = "reader"; reader.hidden = true; reader.setAttribute("role", "dialog"); reader.setAttribute("aria-modal", "true"); reader.setAttribute("aria-label", "閱讀全文");
document.body.append(reader);
let R = null; // { id, article, highlights, mode, err, busy }
const ST = { ok: "全文", paywall: "付費牆", failed: "擷取失敗" };
function readerHTML() {
  const a = R.article, h = R.highlights || [], tr = a.translation || [], mode = R.mode;
  const prog = a.total_chunks ? `${a.translated_chunks}/${a.total_chunks}` : "";
  const sm = a.summary;
  const paras = (a.paragraphs || []).map((p, i) => { const t = tr[i]; const tag = p.tag === "h2" || p.tag === "h3" ? p.tag : p.tag === "li" ? "li" : p.tag === "blockquote" ? "blockquote" : "p";
    const zh = t ? `<${tag} class="zh" lang="${esc(a.translation_language || "zh-Hant")}">${esc(t)}</${tag}>` : ""; const en = `<${tag} class="en">${esc(p.text)}</${tag}>`;
    return `<div class="para" data-i="${i}">${mode === "orig" || !t ? en : mode === "both" ? zh + en : zh}</div>`; }).join("");
  return `<div class="r-bar"><button class="r-close" data-rclose aria-label="關閉閱讀（Esc）">← 返回</button><span class="meta">${esc(ST[a.status] || a.status)}${a.error ? ` · ${esc(MSG[a.error_code] || a.error_code || a.error)}` : ""}${a.chars ? ` · ${Math.round(a.chars / 1000 * 10) / 10}k 字元` : ""}${a.ai_provider ? " · " + esc(PV[a.ai_provider] || a.ai_provider) : ""}</span>
<div class="r-mode" role="group" aria-label="顯示語言">${[["zh", "中文"], ["both", "對照"], ["orig", "原文"]].map(([k, v]) => `<button data-rmode="${k}" class="${mode === k ? "on" : ""}" aria-pressed="${mode === k}">${v}</button>`).join("")}</div></div>
<article class="r-body"><div class="kicker">${esc(a.site || "")}${a.byline ? " · " + esc(a.byline) : ""}</div><h2>${esc(sm?.title_zh || a.title || "")}</h2>${sm?.title_zh && a.title ? `<p class="orig">${esc(a.title)}</p>` : ""}
${a.fixture ? `<p class="err" role="status">FIXTURE 測試資料／注入式 AI 回覆；並非 live provider 驗收</p>` : ""}
<p class="meta">標題來源：${esc(TITLE_SOURCE[a.title_source] || "未記錄")} · 來源類型：${esc(a.source_type || "unknown")} · 原文語言：${esc(a.source_language || "unknown")}（${esc(a.language_provenance || "unknown")}）· 擷取：${esc(a.captured_at || "unknown")}</p>${a.original_url ? `<p class="meta">原始 URL：${esc(a.original_url)}</p>` : ""}${a.url && a.url !== a.original_url ? `<p class="meta">最終 URL：${esc(a.url)}</p>` : ""}
${a.source_type === "manual_text" ? `<p class="meta">手動提供正文（user_supplied；須人工核對事實）</p>` : ""}${a.capture_history?.length ? `<details class="r-fb"><summary>先前來源與 AI 歷史（${a.capture_history.length}）</summary>${a.capture_history.map((h) => `<section><p class="meta">${esc(h.at)} · ${esc(h.item?.url || "")} · ${esc(h.item?.source_language || "unknown")}（${esc(h.item?.language_provenance || "unknown")}） · AI：${esc(h.article?.ai_provider || h.item?.ai_provider || "none")}</p><p>${esc((h.article?.paragraphs ? JSON.parse(h.article.paragraphs).map((p) => p.text).join("\n") : h.item?.raw_excerpt) || "")}</p>${h.article?.summary ? `<p class="meta">舊 AI 摘要（歷史）：${esc(h.article.summary)}</p>` : ""}</section>`).join("")}</details>` : ""}
<div class="r-acts">${a.source_type === "selected_url" ? `<button class="sec" data-rrefresh ${R.busy ? "disabled" : ""}>${R.busy === "refresh" ? "重新擷取中…" : "重新擷取正文"}</button>` : ""}${a.status === "ok" ? (a.translated_chunks < a.total_chunks ? `<button data-rtr ${R.busy ? "disabled" : ""}>${R.busy === "tr" ? "翻譯中…" : a.translated_chunks ? `繼續翻譯（${prog}）` : `翻譯成${targetLanguageName(a.translation_language)}（共 ${a.total_chunks} 段）`}</button>` : `<span class="ok">✓ 已全文翻譯成${targetLanguageName(a.translation_language)}（${prog}）</span>`) : ""}
${sm ? "" : `<button class="sec" data-rsum ${R.busy ? "disabled" : ""}>${R.busy === "sum" ? "AI 總結中…" : "AI 總結"}</button>`}${a.original_url ? `<a href="${esc(a.original_url)}" target="_blank" rel="noopener noreferrer">原文 ↗</a>` : ""}</div>
<p class="meta quota">每段翻譯／每次總結用 1 次 AI 額度（<span data-capmirror>${esc(document.getElementById("cap").textContent)}</span>）。結果會保存，重開唔再扣。</p>
${R.err ? `<div class="err" role="alert">${esc(R.err)}</div>` : ""}
${sm ? `<section class="r-sum" aria-label="AI 總結"><h3>AI 摘要（${esc(sm.content_basis === "full_text" ? targetLanguageName(a.translation_language) : basisLabel(sm.content_basis))}） · ${esc(sm.provider || a.ai_provider || "unknown")}${sm.model ? ` · ${esc(sm.model)}` : ""}</h3><p class="meta">${esc(basisLabel(sm.content_basis))}；來源事實與 AI 推論須人工核對。</p><p class="tldr">${esc(sm.tldr)}</p>${ul(sm.key_points)}<p class="why"><b>對 AI PM 有咩用（推論）</b>${esc(sm.why_ai_pm)}</p><p class="money"><b>對副業有咩用（推論）</b>${esc(sm.why_side_income)}</p>${sm.actions?.length ? `<p class="why score-why"><b>下一步</b>${sm.actions.map(esc).join("；")}</p>` : ""}${sm.partial ? `<p class="meta">（長文：只根據頭 11k 字元總結）</p>` : ""}</section>` : ""}
${h.length ? `<section class="r-hl"><h3>標記重點（${h.length}）</h3>${h.map((x) => `<blockquote>${esc(x.text)}<button class="x" data-hldel="${x.id}" aria-label="刪除標記">×</button></blockquote>`).join("")}<p class="meta">收藏入知識庫後，標記會一齊匯出去 Obsidian。</p></section>` : ""}
${a.source_excerpt ? `<section class="r-fb"><h3>來源摘錄（原文，未經 AI）</h3><p>${esc(a.source_excerpt)}</p></section>` : ""}${a.fallback ? `<div class="r-fb"><p class="err">${esc(a.fallback.note)}</p></div>` : `<div class="r-text"><h3>擷取正文（原文）${tr.length ? `與 AI 翻譯（目標：${targetLanguageName(a.translation_language)}）` : ""}</h3><p class="meta">${tr.length ? `翻譯提供者 ${esc(a.translation_provider || "unknown")} · ` : ""}翻譯進度 ${esc(prog || "0/0")}；未翻譯段落仍顯示原文。</p>${paras}</div>`}
<p class="meta r-tip">揀選文字 → 「標記重點」。快捷鍵：Esc 關閉 · t 翻譯 · m 總結</p></article><button id="hl-pop" hidden>✎ 標記重點</button>`;
}
const paintR = () => { const y = reader.scrollTop; reader.innerHTML = readerHTML(); reader.scrollTop = y; };
async function openReader(id) {
  R = { id, mode: lang, article: { paragraphs: [], status: "ok", title: "載入中…", url: "" }, highlights: [] }; reader.hidden = false; document.body.classList.add("r-open"); reader.innerHTML = `<div class="r-bar"><button class="r-close" data-rclose>← 返回</button></div><p class="r-body meta">擷取全文中…</p>`;
  try { const d = await api(`/api/items/${id}/reader`); Object.assign(R, d); paintR(); reader.querySelector(".r-close")?.focus(); }
  catch (e) { reader.innerHTML = `<div class="r-bar"><button class="r-close" data-rclose>← 返回</button></div><p class="err r-body">載入失敗：${esc(msgOf(e))}</p>`; }
}
const closeReader = () => { reader.hidden = true; document.body.classList.remove("r-open"); R = null; };
async function rAI(kind) {
  if (!R || R.busy) return; R.busy = kind; R.err = null; paintR();
  try { const d = await postJ(`/api/items/${R.id}/reader/${kind === "tr" ? "translate" : "summary"}`); R.article = d.article; }
  catch (e) { if (e.message === "stale_source") {
      try { R.article = (await api(`/api/items/${R.id}/reader`)).article; } catch { /* Keep the conflict visible if reload fails. */ }
    } else if (e.j?.article) R.article = e.j.article; R.err = msgOf(e); }
  R.busy = null; refreshCap(); paintR();
}
async function refreshReader() {
  if (!R || R.busy) return; R.busy = "refresh"; R.err = null; paintR();
  try { const d = await api(`/api/items/${R.id}/reader?refresh=1`); R.article = d.article; R.highlights = d.highlights; }
  catch (e) { R.err = msgOf(e); }
  R.busy = null; paintR();
}
reader.addEventListener("click", async (ev) => {
  if (ev.target.closest("[data-rclose]")) return closeReader();
  const md = ev.target.closest("[data-rmode]"); if (md) { R.mode = md.dataset.rmode; return paintR(); }
  if (ev.target.closest("[data-rrefresh]")) return refreshReader();
  if (ev.target.closest("[data-rtr]")) return rAI("tr");
  if (ev.target.closest("[data-rsum]")) return rAI("sum");
  const hd = ev.target.closest("[data-hldel]"); if (hd) { await api(`/api/highlights/${hd.dataset.hldel}`, { method: "DELETE" }).catch(() => {}); R.highlights = R.highlights.filter((x) => x.id !== hd.dataset.hldel); return paintR(); }
  if (ev.target.id === "hl-pop") { const t = String(getSelection()).trim(); ev.target.hidden = true; if (t.length < 3) return;
    try { const d = await postJ(`/api/items/${R.id}/reader/highlights`, { text: t }); R.highlights.push({ id: d.highlight.id, text: t }); getSelection().removeAllRanges(); paintR(); } catch (e) { R.err = msgOf(e); paintR(); } }
});
view.addEventListener("submit", async (ev) => { const form = ev.target.closest("[data-trainer]"); if (!form) return; ev.preventDefault(); const button = ev.submitter; if (!button) return;
  button.disabled = true; try { await train(form.dataset.trainer, "keyword", form.elements.term.value, button.value); await show(cur()); } catch (e) { button.disabled = false; alert(msgOf(e)); } });
document.addEventListener("selectionchange", () => { if (!R) return; const pop = document.getElementById("hl-pop"); if (!pop) return; const sel = getSelection();
  const ok = sel && !sel.isCollapsed && String(sel).trim().length >= 3 && sel.anchorNode && reader.querySelector(".r-text,.r-fb")?.contains(sel.anchorNode);
  if (!ok) { pop.hidden = true; return; } const rc = sel.getRangeAt(0).getBoundingClientRect(); pop.hidden = false;
  pop.style.top = `${Math.max(8, rc.top - 48)}px`; pop.style.left = `${Math.min(innerWidth - 150, Math.max(8, rc.left))}px`; });
view.addEventListener("click", (ev) => { const r = ev.target.closest("[data-read]"); if (r) { ev.preventDefault(); ev.stopPropagation(); openReader(r.dataset.read); } }, true);

// ---------- P1: Knowledge base (search, tags, bulk import, 整理) ----------
const KBT = { item: "文章", note: "筆記", synthesis: "整理" };
let KBQ = { q: "", tag: "", type: "" }; const KBSEL = new Set(); let KBNEW = null;
let KBTHREADS = null, KBTHREADS_MESSAGE = "", KBTHREADS_RUN = null, KBTHREADS_FILENAME = "", KBTHREADS_STARTED = false;
const md2html = (md) => esc(md).split(/\n/).map((l) => /^## /.test(l) ? `<h4>${l.slice(3)}</h4>` : /^### /.test(l) ? `<h5>${l.slice(4)}</h5>` : /^- /.test(l) ? `<li>${l.slice(2).replace(/^\[ \] /, "☐ ")}</li>` : /^\d+\. /.test(l) ? `<li class="num">${l.replace(/^\d+\. /, "")}</li>` : l.trim() ? `<p>${l}</p>` : "").join("");
const kbCard = (e) => `<article class="card kb ${e.kb_type === "synthesis" ? "synth" : ""} ${KBNEW === e.id ? "new" : ""}" id="kb-${e.id}"><label class="sel"><input type="checkbox" data-sel="${e.id}" ${KBSEL.has(e.id) ? "checked" : ""} aria-label="揀選「${esc(e.title)}」"></label>
<div class="kicker">${esc(KBT[e.kb_type] || "文章")} · ${esc(e.kb_type === "item" ? (e.origin === "star" ? "收藏" : e.origin === "approved" ? "批准" : "手動") : e.source === "import" ? "匯入" : "AI")}${e.category && !["NOTE", "SYNTHESIS"].includes(e.category) ? " · " + esc(e.category) : ""}</div><h3>${esc(e.title)}</h3>
${e.kb_type === "synthesis" ? `<div class="synth-body">${md2html(e.note || "")}</div>` : `<p>${esc(e.summary || "")}</p>${ul(e.key_points)}${e.note ? `<p class="why"><b>筆記</b>${esc(e.note.slice(0, 600))}</p>` : ""}`}
${(e.tags || []).length ? `<div class="tags">${e.tags.map((t) => `<button class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
<div class="links">${e.item_id ? `<a href="#" data-read="${e.item_id}">閱讀全文 →</a>` : ""}${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}</div>
<div class="acts"><button class="sec" data-kbnote="${e.id}">${e.note && e.kb_type !== "synthesis" ? "改筆記" : "加筆記"}</button><button class="sec" data-kbtags="${e.id}" data-v="${esc((e.tags || []).join(" "))}">標籤</button><button class="rej" data-kbdel="${e.id}">移除</button></div></article>`;
async function renderKB() {
  const qs = new URLSearchParams(Object.entries(KBQ).filter(([, v]) => v)); const d = await api("/api/kb" + (qs.size ? "?" + qs : ""));
  const tags = Object.entries(d.tags || {}).sort((a, b) => b[1] - a[1]).slice(0, 14);
  view.innerHTML = `<div class="kb-top"><form id="kb-search" role="search" class="grow"><input type="search" name="q" value="${esc(KBQ.q)}" placeholder="搜尋知識庫（/）" aria-label="搜尋知識庫"></form>
<select data-kbtype aria-label="類型">${[["", "全部類型"], ["item", "文章"], ["note", "筆記"], ["synthesis", "整理"]].map(([k, v]) => `<option value="${k}" ${KBQ.type === k ? "selected" : ""}>${v}</option>`).join("")}</select>
<a class="btn" href="/api/kb/export" download="radar-kb.md">匯出 Obsidian</a></div>
${tags.length ? `<div class="tags tagbar">${KBQ.tag ? `<button class="chip on" data-tag="">✕ #${esc(KBQ.tag)}</button>` : ""}${tags.filter(([t]) => t !== KBQ.tag).map(([t, n]) => `<button class="chip" data-tag="${esc(t)}">#${esc(t)} <span>${n}</span></button>`).join("")}</div>` : ""}
<details class="panel bulk" id="kb-import" ${KBQ.importOpen ? "open" : ""}><summary>批量匯入筆記</summary><p class="meta">支援 Markdown／純文字：用 <code>---</code> 分隔、每篇以 <code># 標題</code> 開頭、或每行一條網址。<code>#tag</code> 會變標籤。唔使用 AI 額度。</p>
<textarea id="kb-imp-text" rows="7" placeholder="# 筆記標題&#10;https://…&#10;內容… #agents&#10;---&#10;# 第二篇…"></textarea><div class="row"><button data-kbimp="preview">預覽</button></div><div id="kb-imp-out" role="status"></div>
<section class="threads-import" aria-labelledby="threads-import-title"><h3 id="threads-import-title">Threads JSON 拖拉／上傳</h3><p class="meta">在瀏覽器本地清理與預覽，不呼叫 AI；只匯入有效筆記，隔離項目預設排除。</p>
<label class="threads-drop" id="threads-drop">拖放 .json 檔案到此處，或選擇檔案<input id="threads-json-file" type="file" accept=".json,application/json"></label><p id="threads-file-name" class="meta">尚未選擇檔案</p><div id="threads-preview" aria-live="polite"></div></section>
 </details>
${KBTHREADS_MESSAGE ? `<p class="meta" role="status">${esc(KBTHREADS_MESSAGE)}</p>` : ""}
<p class="meta">共 ${d.entries.length} 篇${KBQ.q || KBQ.tag || KBQ.type ? "（已篩選）" : ""}</p>
${d.entries.length ? `<div class="grid kbgrid">${d.entries.map(kbCard).join("")}</div>` : "<p class='meta'>冇符合嘅筆記。喺「今日」撳「☆ 收藏」，或者用上面「批量匯入筆記」。</p>"}
<div class="selbar" ${KBSEL.size ? "" : "hidden"} role="region" aria-label="已揀選"><span>已揀 <b>${KBSEL.size}</b> 篇</span><button class="rej" data-selclear>清除</button><button data-synth ${KBSEL.size < 2 ? "disabled" : ""}>AI 整理（1 次額度）</button><span id="synth-msg" role="status"></span></div>`;
  if (KBTHREADS) { document.getElementById("threads-file-name").textContent = KBTHREADS_FILENAME; renderThreadsPreview(KBTHREADS); }
  if (KBNEW) document.getElementById("kb-" + KBNEW)?.scrollIntoView({ block: "start" });
}
const selbar = () => { const b = view.querySelector(".selbar"); if (!b) return; b.hidden = !KBSEL.size; b.querySelector("b").textContent = KBSEL.size; b.querySelector("[data-synth]").disabled = KBSEL.size < 2; };
view.addEventListener("submit", (ev) => { if (ev.target.id !== "kb-search") return; ev.preventDefault(); KBQ.q = new FormData(ev.target).get("q").trim(); KBNEW = null; renderKB(); });
view.addEventListener("change", (ev) => {
  const s = ev.target.closest("[data-sel]"); if (s) { s.checked ? KBSEL.add(s.dataset.sel) : KBSEL.delete(s.dataset.sel); return selbar(); }
  const t = ev.target.closest("[data-kbtype]"); if (t) { KBQ.type = t.value; renderKB(); } });
function renderThreadsPreview(result) {
  const preview = document.getElementById("threads-preview");
  const lanes = Object.entries(result.byLane).map(([lane, count]) => `${esc(lane)} ${count}`).join(" · ");
  preview.innerHTML = `<p>原始筆數 ${result.rawCount} · 去重後筆數 ${result.uniqueCount} · 有效筆數 ${result.validItems.length} · 已隔離雜訊 ${result.quarantinedItems.length} · 預計批次 ${result.batches.length}（最多 50 筆／批）</p><p class="meta">Lane：${lanes || "無"}</p>${result.githubRepos.length ? `<p>找到 ${result.githubRepos.length} 個 GitHub Repo URL。</p><button data-threads-import="copy">複製 GitHub 來源清單</button>` : ""}<details><summary>預覽有效筆記（${result.validItems.length}）</summary><ol class="prev">${result.validItems.slice(0, 20).map((item) => `<li><b>${esc(item.title)}</b>${item.canonical_url ? ` <span class="meta">${esc(item.canonical_url)}</span>` : ""}<div class="meta">${esc(item.lane)} · 分數 ${item.pref_score}</div></li>`).join("")}${result.validItems.length > 20 ? `<li>其餘 ${result.validItems.length - 20} 筆略</li>` : ""}</ol></details>${result.quarantinedItems.length ? `<details><summary>查看隔離項目（預設不匯入）</summary><ul class="prev">${result.quarantinedItems.slice(0, 20).map((item) => `<li>${esc(item.title)} <span class="meta">${esc(item.quarantine_reason)}</span></li>`).join("")}</ul></details>` : ""}${result.batches.length ? `<p><button data-threads-import="start" ${KBTHREADS_RUN || KBTHREADS_STARTED ? "disabled" : ""}>${KBTHREADS_STARTED ? "此檔已處理" : "開始分批匯入 KB（0 AI）"}</button> ${KBTHREADS_RUN ? '<button data-threads-import="stop">停止匯入</button>' : ""}</p>` : "<p class='meta'>沒有有效筆記可匯入。</p>"}`;
}
async function loadThreadsFile(file) {
  if (!file) return;
  if (KBTHREADS_RUN) { KBTHREADS_MESSAGE = "分批匯入進行中，請等目前批次結束後再選新檔。"; return; }
  KBTHREADS = null; KBTHREADS_MESSAGE = ""; KBTHREADS_STARTED = false; KBTHREADS_FILENAME = file.name;
  document.getElementById("threads-file-name").textContent = file.name;
  const preview = document.getElementById("threads-preview");
  try {
    const result = cleanThreadsExport(await file.text()); KBTHREADS = result;
    renderThreadsPreview(result);
  } catch (error) { preview.innerHTML = `<p class="err">${esc(error.message)}</p>`; }
}
view.addEventListener("change", (ev) => { if (ev.target.id === "threads-json-file") loadThreadsFile(ev.target.files?.[0]); });
view.addEventListener("dragover", (ev) => { if (ev.target.closest?.("#threads-drop")) ev.preventDefault(); });
view.addEventListener("drop", (ev) => { if (!ev.target.closest?.("#threads-drop")) return; ev.preventDefault(); loadThreadsFile(ev.dataTransfer?.files?.[0]); });
view.addEventListener("click", async (ev) => {
  const threadsAction = ev.target.closest("[data-threads-import]");
  if (threadsAction) {
    const action = threadsAction.dataset.threadsImport;
    if (action === "copy") {
      try { await navigator.clipboard.writeText(KBTHREADS?.githubRepos.join("\n") || ""); KBTHREADS_MESSAGE = "GitHub 來源清單已複製。"; }
      catch { KBTHREADS_MESSAGE = "無法存取剪貼簿；可從匯出清單手動複製。"; }
      threadsAction.insertAdjacentHTML("afterend", `<span class="meta">${esc(KBTHREADS_MESSAGE)}</span>`); return;
    }
    if (action === "stop") { if (KBTHREADS_RUN) KBTHREADS_RUN.stop = true; threadsAction.disabled = true; threadsAction.textContent = "目前批次完成後停止…"; return; }
    if (action === "start" && KBTHREADS && !KBTHREADS_RUN) {
      const run = { stop: false }; KBTHREADS_RUN = run; KBTHREADS_STARTED = true; let imported = 0, errors = 0;
      const batches = KBTHREADS.batches;
      threadsAction.disabled = true; threadsAction.insertAdjacentHTML("afterend", '<button data-threads-import="stop">停止匯入</button>');
      for (let i = 0; i < batches.length; i++) {
        if (run.stop) break;
        const batch = batches[i];
        const preview = document.getElementById("threads-preview");
        preview.querySelector("[data-threads-progress]")?.remove();
        preview.insertAdjacentHTML("beforeend", `<p class="meta" data-threads-progress>匯入中：第 ${i + 1} / ${batches.length} 批 · 已匯入 ${imported} · 錯誤 ${errors}</p>`);
        try { const result = await postJ("/api/kb/import", { text: batch.text, commit: true }); imported += Number(result.added) || 0; }
        catch { errors++; }
      }
      KBTHREADS_RUN = null;
      KBTHREADS_MESSAGE = `${run.stop ? "已停止後續批次" : "分批匯入完成"}；新增 ${imported} 筆，錯誤 ${errors} 批。全程沒有呼叫 AI。`;
      KBQ.importOpen = true; KBQ.type = "note"; await renderKB(); return;
    }
    return;
  }
  const tg = ev.target.closest("[data-tag]"); if (tg) { KBQ.tag = tg.dataset.tag; KBNEW = null; return renderKB(); }
  if (ev.target.closest("[data-selclear]")) { KBSEL.clear(); return renderKB(); }
  const kt = ev.target.closest("[data-kbtags]"); if (kt) { const v = prompt("標籤（用空格分隔）", kt.dataset.v); if (v == null) return;
    try { await api(`/api/kb/${kt.dataset.kbtags}`, { method: "PATCH", headers: JH, body: JSON.stringify({ tags: v.split(/[\s,，#]+/).filter(Boolean) }) }); } catch (e) { alert(msgOf(e)); } return renderKB(); }
  const sy = ev.target.closest("[data-synth]"); if (sy) { sy.disabled = true; sy.textContent = "AI 整理中…"; const m = document.getElementById("synth-msg");
    try { const d = await postJ("/api/kb/synthesize", { ids: [...KBSEL] }); KBSEL.clear(); KBNEW = d.entry.id; KBQ = { q: "", tag: "", type: "" }; refreshCap(); return renderKB(); }
    catch (e) { refreshCap(); m.textContent = msgOf(e); m.className = "err"; sy.disabled = false; sy.textContent = "AI 整理（1 次額度）"; return; } }
  const im = ev.target.closest("[data-kbimp]"); if (im) { const text = document.getElementById("kb-imp-text").value; const out = document.getElementById("kb-imp-out");
    try { if (im.dataset.kbimp === "preview") { const d = await postJ("/api/kb/import", { text }); out.innerHTML = `<ol class="prev">${d.preview.map((n) => `<li><b>${esc(n.title)}</b>${n.url ? ` <span class="meta">${esc(n.url)}</span>` : ""}${n.tags.length ? ` <span class="meta">#${n.tags.map(esc).join(" #")}</span>` : ""}<div class="meta">${esc((n.note || "").slice(0, 120))}</div></li>`).join("")}</ol><button data-kbimp="commit">確認匯入 ${d.preview.length} 篇</button>`; }
      else { const d = await postJ("/api/kb/import", { text, commit: true }); KBQ.importOpen = false; out.textContent = `已匯入 ${d.added} 篇`; KBQ.type = "note"; return renderKB(); } }
    catch (e) { out.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`; } return; }
});
// tag/note PATCH already supported by /api/kb/:id

// ---------- P1: Bulk add sources ----------
const SRCST = { new: ["將新增", "ok"], exists: ["已存在", "mut"], duplicate_in_batch: ["重複", "mut"], invalid: ["格式唔啱", "bad"], not_feed: ["唔係 feed", "bad"], added: ["已新增", "ok"], pending: ["未檢查", "mut"] };
function bindBulkSources() {
  const f = document.getElementById("bulk-src"); if (!f) return; const out = document.getElementById("bulk-out");
  f.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-bulk]"); if (!b) return; ev.preventDefault(); const text = f.querySelector("textarea").value; b.disabled = true; out.textContent = b.dataset.bulk === "commit" ? "新增中…" : "檢查緊（會試讀每個 RSS／自動搵 feed）…";
    try { const d = await postJ("/api/sources/bulk", { text, commit: b.dataset.bulk === "commit" }); const n = d.preview.filter((r) => r.status === "new").length;
      out.innerHTML = `<table class="prev-t"><thead><tr><th>狀態</th><th>類型</th><th>來源</th></tr></thead><tbody>${d.preview.map((r) => { const [l, c] = SRCST[r.status] || [r.status, "mut"]; return `<tr><td><span class="st ${c}">${l}</span></td><td>${r.type === "x" ? "X" : r.type === "rss" ? "RSS" : "–"}</td><td><div>${esc(r.value || r.line)}</div>${r.discovered_from ? `<div class="meta">由 ${esc(r.discovered_from)} 自動搵到 feed</div>` : ""}${r.error ? `<div class="meta">${esc(r.error)}</div>` : ""}</td></tr>`; }).join("")}</tbody></table>
${d.added != null ? `<p class="ok">✓ 已新增 ${d.added} 個訊息源</p>` : n ? `<button data-bulk="commit">確認新增 ${n} 個</button>` : `<p class="meta">冇可新增嘅項目</p>`}`;
      if (d.added != null) document.querySelector("#src-list") && bindSourcesRefresh?.();
    } catch (e) { out.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`; } b.disabled = false; });
}
let bindSourcesRefresh = null;

// ---------- P1: Keyboard shortcuts ----------
const HELP = [["j / k", "下一張／上一張卡"], ["o 或 Enter", "閱讀全文"], ["s", "收藏"], ["l", "稍後讀"], ["t / m", "閱讀時：翻譯／AI 總結"], ["/", "搜尋知識庫"], ["1–6", "切換分頁"], ["Esc", "關閉"], ["?", "顯示快捷鍵"]];
const help = document.createElement("div"); help.id = "kbd-help"; help.hidden = true; help.setAttribute("role", "dialog"); help.setAttribute("aria-label", "快捷鍵");
help.innerHTML = `<div class="panel"><h3>快捷鍵</h3><dl>${HELP.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join("")}</dl><button data-helpclose>關閉</button></div>`; document.body.append(help);
help.addEventListener("click", (ev) => { if (ev.target === help || ev.target.closest("[data-helpclose]")) help.hidden = true; });
let focusIdx = -1;
const cards = () => [...view.querySelectorAll(".card")];
document.addEventListener("keydown", (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  if (ev.key === "Escape") { if (!help.hidden) help.hidden = true; else if (R) closeReader(); return; }
  if (ev.key === "?") { help.hidden = !help.hidden; return; }
  if (R) { if (ev.key === "t") rAI("tr"); else if (ev.key === "m" && !R.article.summary) rAI("sum"); return; }
  const tabs = [...document.querySelectorAll("nav button")]; if (/^[1-6]$/.test(ev.key)) { tabs[+ev.key - 1]?.click(); return; }
  if (ev.key === "/") { const q = view.querySelector("#kb-search input"); if (q) { ev.preventDefault(); q.focus(); } else { ev.preventDefault(); tabs.find((b) => b.dataset.tab === "kb").click(); setTimeout(() => view.querySelector("#kb-search input")?.focus(), 300); } return; }
  const cs = cards(); if (!cs.length) return;
  if (ev.key === "j" || ev.key === "k") { focusIdx = Math.max(0, Math.min(cs.length - 1, (cs.indexOf(document.activeElement.closest?.(".card")) + 1 || focusIdx + 1) - 1 + (ev.key === "j" ? 1 : -1)));
    cs.forEach((c) => c.classList.remove("kfocus")); const c = cs[focusIdx]; c.classList.add("kfocus"); c.tabIndex = -1; c.focus({ preventScroll: true }); c.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  const c = cs[focusIdx]; if (!c) return;
  if (ev.key === "o" || ev.key === "Enter") c.querySelector("[data-read]")?.click();
  else if (ev.key === "s") c.querySelector('[data-do="star"],[data-do="unstar"]')?.click();
  else if (ev.key === "l") c.querySelector('[data-do="read_later"],[data-do="unread_later"]')?.click();
});
const _show = show;
show = async (t) => { focusIdx = -1; await _show(t); if (t === "sources") { bindBulkSources(); bindSourcesRefresh = () => _show("sources").then(bindBulkSources); } };
show(new URLSearchParams(location.search).get("tab") || "daily");
