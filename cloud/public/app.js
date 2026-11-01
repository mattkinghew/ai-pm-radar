const view = document.getElementById("view");
const dec = (s) => { const t = document.createElement("textarea"); t.innerHTML = String(s ?? ""); return t.value; };
const esc = (s) => dec(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (p, o) => { const r = await fetch(p, { credentials: "same-origin", ...o }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { j }); return j; };
const MSG = { ai_daily_cap_reached: "今日 AI 額度已用完（08:00 重設）", insufficient_content: "內容太短，請打開原文貼上正文（用「＋擷取」）",
  ai_bad_output: "AI 回覆格式有誤，請稍後再試", workers_ai_error: "後備 AI 暫時出錯，請稍後再試", workers_ai_unbound: "後備 AI 未設定",
  gemini_key_missing: "Gemini key 未設定", unauthorized: "登入已過期，請重新整理頁面", not_found: "找不到", duplicate_source: "已經有呢個訊息源", bad_source: "格式唔啱" };
const msgOf = (e) => e.j?.hint || MSG[e.message] || (/^gemini_http_/.test(e.message) ? "Gemini 暫時出錯，請稍後再試" : "處理失敗，請稍後再試") + "";
let lang = localStorage.getItem("radar-lang") || "zh";
const NI = { not_relevant: "同我無關", duplicate: "重複", low_quality: "質素低", already_known: "已經知道", too_much_x: "X 帖太多", other: "其他" };
const dupLi = (x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.source || "")}</a>` : esc(x.source || "")}${x.title ? ` <span class="meta">${esc(x.title.slice(0, 60))}</span>` : ""}</li>`;
const dupList = (it) => { const d = it.dup_sources || []; if (!d.length) return "";
  const head = `<p class="dups-h">同一件事亦見於 ${d.length} 個來源：</p>`;
  return d.length > 3 ? `<details class="dups"><summary>同一件事亦見於 ${d.length} 個來源</summary><ul>${d.map(dupLi).join("")}</ul></details>` : `<div class="dups">${head}<ul>${d.map(dupLi).join("")}</ul></div>`; };
const PV = { gemini: "Gemini", "workers-ai": "Workers AI" };
const ul = (a) => (a || []).length ? "<ul>" + a.map((k) => `<li>${esc(k)}</li>`).join("") + "</ul>" : "";
function body(it) {
  const zhT = it.title_zh || it.title, orT = it.title_original || it.title, zhS = it.summary || "（未有 AI 摘要，可撳「轉中文」）";
  if (lang === "orig") return `<h3>${esc(orT)}</h3><p>${esc(it.summary_en || it.raw_excerpt || it.summary || "")}</p>${ul(it.key_points_en?.length ? it.key_points_en : it.key_points)}`;
  if (lang === "both") return `<h3>${esc(zhT)}</h3>${orT !== zhT ? `<div class="orig">${esc(orT)}</div>` : ""}<p>${esc(zhS)}</p>${it.summary_en ? `<p class="orig">${esc(it.summary_en)}</p>` : ""}${ul(it.key_points)}${ul(it.key_points_en)}`;
  return `<h3>${esc(zhT)}</h3><p>${esc(zhS)}</p>${ul(it.key_points)}`;
}
const size = (it, i) => i === 0 ? "feat" : (i < 3 || (it.score ?? 0) >= 8) ? "wide" : "";
const card = (it, i = 9) => `<article id="i-${it.id}" class="card ${size(it, i)}">${it.category || it.source ? `<div class="kicker">${esc(it.category || it.source)}</div>` : ""}${body(it)}${it.side_income_new ? `<p class="money"><b>💰 新變現機會</b>${esc(it.side_income_reason || "")}</p>` : ""}${it.score != null ? `<p class="why score-why"><b>評分 ${esc(it.score)}</b>${esc(it.score_reason || it.reco_reason || "")}</p>` : ""}${it.reco_reason && it.reco_reason !== it.score_reason ? `<p class="why"><b>推薦理由</b>${esc(it.reco_reason)}</p>` : ""}<div class="meta">${it.reco_score != null ? `<span class="reco">推薦 ${esc(it.reco_score)}</span> · ` : ""}${esc(it.source || "")} · ${esc(it.status)}${it.score != null ? " · 評分 " + esc(it.score) : ""}${it.ai_provider ? " · " + esc(PV[it.ai_provider] || it.ai_provider) : ""}</div>
<div class="links">${it.url && !/^https?:\/\/(x|twitter)\.com\//.test(it.url) ? `<a href="#" data-read="${it.id}">閱讀全文 →</a>` : ""}${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}</div>
<div class="acts">${it.status === "draft" ? `<button data-act="review" data-id="${it.id}">已審核</button>` : ""}${it.status === "reviewed" ? `<button data-act="approve" data-id="${it.id}">批准重用</button>` : ""}<button class="sec" data-do="${it.starred ? "unstar" : "star"}" data-id="${it.id}" aria-pressed="${!!it.starred}" title="收藏入知識庫">${it.starred ? "★ 已收藏" : "☆ 收藏"}</button><button class="sec" data-do="${it.read_later ? "unread_later" : "read_later"}" data-id="${it.id}" aria-pressed="${!!it.read_later}">${it.read_later ? "✓ 稍後讀" : "稍後讀"}</button>
<div class="more"><button class="sec more-btn" aria-haspopup="menu" aria-expanded="false" aria-label="更多動作" data-more="${it.id}">⋯</button><div class="menu" role="menu" hidden>${!it.title_zh ? `<button role="menuitem" data-act="translate" data-id="${it.id}">轉中文</button>` : ""}${["draft", "reviewed"].includes(it.status) ? `<button role="menuitem" data-act="reject" data-id="${it.id}">拒絕</button>` : ""}${it.dismissed_reason ? `<button role="menuitem" data-do="restore" data-id="${it.id}">取消唔感興趣</button>` : `<label class="ni">唔感興趣<select data-ni="${it.id}" aria-label="唔感興趣原因"><option value="">揀原因…</option>${Object.entries(NI).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`}${(it.source || "").startsWith("x:@") ? `<button role="menuitem" data-mute="handle" data-v="${esc(it.source.slice(2))}">靜音 ${esc(it.source.slice(2))}</button>` : it.category ? `<button role="menuitem" data-mute="topic" data-v="${esc(it.category)}">靜音題材 ${esc(it.category)}</button>` : ""}</div></div></div>${dupList(it)}</article>`;
const list = (items) => items.length ? `<div class="grid">${items.map(card).join("")}</div>` : "<p class='meta'>暫時冇內容</p>";
async function show(tab) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  try {
    if (tab === "capture") { view.innerHTML = ""; view.append(document.getElementById("capture-tpl").content.cloneNode(true)); return bindCapture(); }
    if (tab === "sources") { view.innerHTML = ""; view.append(document.getElementById("sources-tpl").content.cloneNode(true)); return bindSources(); }
    if (tab === "daily") {
      const d = await api("/api/daily");
      const byScore = (a, b) => ((b.score ?? -1) - (a.score ?? -1)) || ((b.reco_score ?? 0) - (a.reco_score ?? 0));
      d.items.sort(byScore);
      const picks = d.items.filter((i) => (i.reco_score ?? 0) >= 7 || i.side_income_new || (i.score ?? 0) >= 8).sort((a, b) => (b.side_income_new - a.side_income_new) || byScore(a, b)).slice(0, 6);
      const only = localStorage.getItem("radar-reco") === "1";
      const minS = Number(localStorage.getItem("radar-min-score") || 0);
      const shown = (only ? picks : d.items).filter((i) => (i.score ?? 0) >= minS);
      const st = d.stats ? ` · 已隱藏 ${d.stats.hidden} · 合併重複 ${d.stats.duplicates} · 配額暫留 ${d.stats.quota_held}` : "";
      view.innerHTML = `<p class="dateline">${esc(d.date || "未有")} · 今日焦點 ${d.items.length} 則${esc(st)}</p>
<div class="filters"><button data-reco="0" class="${only ? "" : "on"}">全部</button><button data-reco="1" class="${only ? "on" : ""}">只睇推薦（${picks.length}）</button>
<label class="score-f">評分 ≥ <select data-minscore>${[0,5,6,7,8,9].map((n)=>`<option value="${n}" ${minS===n?"selected":""}>${n||"不限"}</option>`).join("")}</select></label></div>
${picks.length ? `<section class="picks" aria-label="推薦給你"><h2>推薦給你</h2><ol>${picks.map((p) => `<li>${p.side_income_new ? `<span class="badge">💰 新變現機會</span>` : ""}<span class="sc">${p.score != null ? esc(p.score) : "–"}</span><a href="#i-${p.id}">${esc(p.title_zh || p.title)}</a><span>${esc(p.side_income_new ? p.side_income_reason || p.score_reason || p.reco_reason || "" : p.score_reason || p.reco_reason || "")}</span></li>`).join("")}</ol></section>` : ""}` + list(shown);
    }
    else if (tab === "later") { const d = await api("/api/read-later"); view.innerHTML = list(d.items); }
    else if (tab === "kb") return renderKB();
    else { const d = await api(tab === "draft" ? "/api/library?status=all" : "/api/library?status=approved");
      const byScore = (a, b) => ((b.score ?? -1) - (a.score ?? -1)) || ((b.reco_score ?? 0) - (a.reco_score ?? 0));
      const items = (tab === "draft" ? d.items.filter((i) => ["draft", "reviewed"].includes(i.status)) : d.items).sort(byScore);
      const minS = Number(localStorage.getItem("radar-min-score") || 0);
      view.innerHTML = `<div class="filters"><label class="score-f">評分 ≥ <select data-minscore>${[0,5,6,7,8,9].map((n)=>`<option value="${n}" ${minS===n?"selected":""}>${n||"不限"}</option>`).join("")}</select></label></div>` + list(items.filter((i) => (i.score ?? 0) >= minS)); }
  } catch (e) { view.innerHTML = `<p>載入失敗：${esc(e.message)}</p>`; }
}
async function bindSources() {
  const listEl = document.getElementById("src-list"); const msg = document.getElementById("src-msg");
  const render = async () => { const { sources } = await api("/api/sources");
    listEl.innerHTML = sources.length ? sources.map((s) => `<div class="src ${s.enabled ? "" : "off"}"><span class="tag">${s.type === "x" ? "X" : "RSS"}</span><div class="grow"><b>${esc(s.label || s.value)}</b><div class="meta">${esc(s.value)}</div></div>
<button class="sec" data-src="toggle" data-id="${s.id}" data-on="${s.enabled}" aria-pressed="${!!s.enabled}">${s.enabled ? "停用" : "啟用"}</button><button class="rej" data-src="del" data-id="${s.id}">刪除</button></div>`).join("")
      : "<p class='meta'>未有自訂訊息源。內建：OpenAI、Anthropic、TechCrunch AI、Coursera、Hugging Face、Hacker News。</p>"; };
  document.getElementById("src-form").addEventListener("submit", async (ev) => { ev.preventDefault(); const f = new FormData(ev.target);
    try { await api("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) }); msg.textContent = "已新增"; ev.target.reset(); render(); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); } });
  listEl.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-src]"); if (!b) return;
    if (b.dataset.src === "del" && !confirm("確定刪除？")) return;
    try { await api(`/api/sources/${b.dataset.id}`, b.dataset.src === "del" ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: b.dataset.on !== "1" }) }); render(); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); } });
  render().catch((e) => { listEl.textContent = "載入失敗：" + msgOf(e); });
  const ml = document.getElementById("mute-list"); const mm = document.getElementById("mute-msg");
  const renderM = async () => { const { mutes } = await api("/api/mutes"); ml.innerHTML = mutes.length ? mutes.map((x) => `<div class="src"><span class="tag">${{ keyword: "字", topic: "題", handle: "X" }[x.kind]}</span><div class="grow"><b>${esc(x.value)}</b></div><button class="rej" data-unmute="${x.id}">取消靜音</button></div>`).join("") : "<p class='meta'>未有靜音。</p>"; };
  document.getElementById("mute-form").addEventListener("submit", async (ev) => { ev.preventDefault();
    try { await api("/api/mutes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(ev.target))) }); mm.textContent = "已靜音"; ev.target.reset(); renderM(); } catch (e) { mm.textContent = "失敗：" + msgOf(e); } });
  ml.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-unmute]"); if (!b) return; try { await api(`/api/mutes/${b.dataset.unmute}`, { method: "DELETE" }); renderM(); } catch (e) { mm.textContent = "失敗：" + msgOf(e); } });
  renderM().catch(() => {});
}
const cur = () => document.querySelector("nav button.on").dataset.tab;
const doAct = (id, action, reason) => api(`/api/items/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
function bindCapture() {
  document.getElementById("cap-form").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target); const msg = document.getElementById("cap-msg"); msg.textContent = "AI 整理中…";
    try { await api("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: f.get("url"), text: f.get("text") }) }); msg.textContent = "已存為草稿，請到「待審核」核對。"; ev.target.reset(); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); }
  });
}
view.addEventListener("change", async (ev) => { const ni = ev.target.closest("[data-ni]"); if (ni) { if (!ni.value) return; try { await doAct(ni.dataset.ni, "not_interested", ni.value); show(cur()); } catch (e) { alert(msgOf(e)); } return; }
  const s = ev.target.closest("[data-minscore]"); if (!s) return; localStorage.setItem("radar-min-score", s.value); show(document.querySelector("nav button.on").dataset.tab); });
const closeMenus = (except) => document.querySelectorAll(".more .menu:not([hidden])").forEach((m) => { if (m !== except) { m.hidden = true; m.previousElementSibling.setAttribute("aria-expanded", "false"); } });
document.addEventListener("click", (ev) => { if (!ev.target.closest(".more")) closeMenus(); });
document.addEventListener("keydown", (ev) => { if (ev.key !== "Escape") return; const open = document.querySelector(".more .menu:not([hidden])"); if (open) { closeMenus(); open.previousElementSibling.focus(); } });
view.addEventListener("click", async (ev) => {
  const mb = ev.target.closest("[data-more]"); if (mb) { const m = mb.nextElementSibling; const show = m.hidden; closeMenus(m); m.hidden = !show; mb.setAttribute("aria-expanded", String(show)); if (show) m.querySelector("button,select")?.focus(); return; } const r = ev.target.closest("[data-reco]"); if (r) { localStorage.setItem("radar-reco", r.dataset.reco); return show("daily"); }
  const d2 = ev.target.closest("[data-do]"); if (d2) { d2.disabled = true; try { await doAct(d2.dataset.id, d2.dataset.do); } catch (e) { alert(msgOf(e)); } return show(cur()); }
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
function refreshCap() { api("/api/cloud/capabilities").then((c) => { const u = c.ai.usage; document.getElementById("cap").textContent = `Gemini ${u.gemini.used}/${u.gemini.cap}` + (u.workersAi.cap ? ` · Workers AI ${u.workersAi.used}/${u.workersAi.cap}` : ""); }).catch(() => {}); }
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
    const zh = t ? `<${tag} class="zh" lang="zh-Hant">${esc(t)}</${tag}>` : ""; const en = `<${tag} class="en">${esc(p.text)}</${tag}>`;
    return `<div class="para" data-i="${i}">${mode === "orig" || !t ? en : mode === "both" ? zh + en : zh}</div>`; }).join("");
  return `<div class="r-bar"><button class="r-close" data-rclose aria-label="關閉閱讀（Esc）">← 返回</button><span class="meta">${esc(ST[a.status] || a.status)}${a.chars ? ` · ${Math.round(a.chars / 1000 * 10) / 10}k 字元` : ""}${a.ai_provider ? " · " + esc(PV[a.ai_provider] || a.ai_provider) : ""}</span>
<div class="r-mode" role="group" aria-label="顯示語言">${[["zh", "中文"], ["both", "對照"], ["orig", "原文"]].map(([k, v]) => `<button data-rmode="${k}" class="${mode === k ? "on" : ""}" aria-pressed="${mode === k}">${v}</button>`).join("")}</div></div>
<article class="r-body"><div class="kicker">${esc(a.site || "")}${a.byline ? " · " + esc(a.byline) : ""}</div><h2>${esc(sm?.title_zh || a.title || "")}</h2>${sm?.title_zh && a.title ? `<p class="orig">${esc(a.title)}</p>` : ""}
<div class="r-acts">${a.status === "ok" ? (a.translated_chunks < a.total_chunks ? `<button data-rtr ${R.busy ? "disabled" : ""}>${R.busy === "tr" ? "翻譯中…" : a.translated_chunks ? `繼續翻譯（${prog}）` : `翻譯成中文（共 ${a.total_chunks} 段）`}</button>` : `<span class="ok">✓ 已全文翻譯（${prog}）</span>`) : ""}
${sm ? "" : `<button class="sec" data-rsum ${R.busy ? "disabled" : ""}>${R.busy === "sum" ? "AI 總結中…" : "AI 總結"}</button>`}<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">原文 ↗</a></div>
<p class="meta quota">每段翻譯／每次總結用 1 次 AI 額度（<span data-capmirror>${esc(document.getElementById("cap").textContent)}</span>）。結果會保存，重開唔再扣。</p>
${R.err ? `<div class="err" role="alert">${esc(R.err)}</div>` : ""}
${sm ? `<section class="r-sum" aria-label="AI 總結"><h3>AI 總結</h3><p class="tldr">${esc(sm.tldr)}</p>${ul(sm.key_points)}<p class="why"><b>對 AI PM 有咩用</b>${esc(sm.why_ai_pm)}</p><p class="money"><b>對副業有咩用</b>${esc(sm.why_side_income)}</p>${sm.actions?.length ? `<p class="why score-why"><b>下一步</b>${sm.actions.map(esc).join("；")}</p>` : ""}${sm.from_excerpt ? `<p class="meta">（只根據 RSS 摘錄總結）</p>` : sm.partial ? `<p class="meta">（長文：只根據頭 11k 字元總結）</p>` : ""}</section>` : ""}
${h.length ? `<section class="r-hl"><h3>標記重點（${h.length}）</h3>${h.map((x) => `<blockquote>${esc(x.text)}<button class="x" data-hldel="${x.id}" aria-label="刪除標記">×</button></blockquote>`).join("")}<p class="meta">收藏入知識庫後，標記會一齊匯出去 Obsidian。</p></section>` : ""}
${a.fallback ? `<div class="r-fb"><p class="err">${esc(a.fallback.note)}</p><p>${esc(a.fallback.excerpt)}</p></div>` : `<div class="r-text">${paras}</div>`}
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
  catch (e) { if (e.j?.article) R.article = e.j.article; R.err = msgOf(e); }
  R.busy = null; refreshCap(); paintR();
}
reader.addEventListener("click", async (ev) => {
  if (ev.target.closest("[data-rclose]")) return closeReader();
  const md = ev.target.closest("[data-rmode]"); if (md) { R.mode = md.dataset.rmode; return paintR(); }
  if (ev.target.closest("[data-rtr]")) return rAI("tr");
  if (ev.target.closest("[data-rsum]")) return rAI("sum");
  const hd = ev.target.closest("[data-hldel]"); if (hd) { await api(`/api/highlights/${hd.dataset.hldel}`, { method: "DELETE" }).catch(() => {}); R.highlights = R.highlights.filter((x) => x.id !== hd.dataset.hldel); return paintR(); }
  if (ev.target.id === "hl-pop") { const t = String(getSelection()).trim(); ev.target.hidden = true; if (t.length < 3) return;
    try { const d = await postJ(`/api/items/${R.id}/reader/highlights`, { text: t }); R.highlights.push({ id: d.highlight.id, text: t }); getSelection().removeAllRanges(); paintR(); } catch (e) { R.err = msgOf(e); paintR(); } }
});
document.addEventListener("selectionchange", () => { if (!R) return; const pop = document.getElementById("hl-pop"); if (!pop) return; const sel = getSelection();
  const ok = sel && !sel.isCollapsed && String(sel).trim().length >= 3 && sel.anchorNode && reader.querySelector(".r-text,.r-fb")?.contains(sel.anchorNode);
  if (!ok) { pop.hidden = true; return; } const rc = sel.getRangeAt(0).getBoundingClientRect(); pop.hidden = false;
  pop.style.top = `${Math.max(8, rc.top - 48)}px`; pop.style.left = `${Math.min(innerWidth - 150, Math.max(8, rc.left))}px`; });
view.addEventListener("click", (ev) => { const r = ev.target.closest("[data-read]"); if (r) { ev.preventDefault(); ev.stopPropagation(); openReader(r.dataset.read); } }, true);

// ---------- P1: Knowledge base (search, tags, bulk import, 整理) ----------
const KBT = { item: "文章", note: "筆記", synthesis: "整理" };
let KBQ = { q: "", tag: "", type: "" }; const KBSEL = new Set(); let KBNEW = null;
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
<textarea id="kb-imp-text" rows="7" placeholder="# 筆記標題&#10;https://…&#10;內容… #agents&#10;---&#10;# 第二篇…"></textarea><div class="row"><button data-kbimp="preview">預覽</button></div><div id="kb-imp-out" role="status"></div></details>
<p class="meta">共 ${d.entries.length} 篇${KBQ.q || KBQ.tag || KBQ.type ? "（已篩選）" : ""}</p>
${d.entries.length ? `<div class="grid kbgrid">${d.entries.map(kbCard).join("")}</div>` : "<p class='meta'>冇符合嘅筆記。喺「今日」撳「☆ 收藏」，或者用上面「批量匯入筆記」。</p>"}
<div class="selbar" ${KBSEL.size ? "" : "hidden"} role="region" aria-label="已揀選"><span>已揀 <b>${KBSEL.size}</b> 篇</span><button class="rej" data-selclear>清除</button><button data-synth ${KBSEL.size < 2 ? "disabled" : ""}>AI 整理（1 次額度）</button><span id="synth-msg" role="status"></span></div>`;
  if (KBNEW) document.getElementById("kb-" + KBNEW)?.scrollIntoView({ block: "start" });
}
const selbar = () => { const b = view.querySelector(".selbar"); if (!b) return; b.hidden = !KBSEL.size; b.querySelector("b").textContent = KBSEL.size; b.querySelector("[data-synth]").disabled = KBSEL.size < 2; };
view.addEventListener("submit", (ev) => { if (ev.target.id !== "kb-search") return; ev.preventDefault(); KBQ.q = new FormData(ev.target).get("q").trim(); KBNEW = null; renderKB(); });
view.addEventListener("change", (ev) => {
  const s = ev.target.closest("[data-sel]"); if (s) { s.checked ? KBSEL.add(s.dataset.sel) : KBSEL.delete(s.dataset.sel); return selbar(); }
  const t = ev.target.closest("[data-kbtype]"); if (t) { KBQ.type = t.value; renderKB(); } });
view.addEventListener("click", async (ev) => {
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
