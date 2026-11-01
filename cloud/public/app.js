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
${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}
<div class="acts">${!it.title_zh ? `<button class="sec" data-act="translate" data-id="${it.id}">轉中文</button>` : ""}${it.status === "draft" ? `<button data-act="review" data-id="${it.id}">已審核</button>` : ""}${it.status === "reviewed" ? `<button data-act="approve" data-id="${it.id}">批准重用</button>` : ""}${["draft", "reviewed"].includes(it.status) ? `<button class="rej" data-act="reject" data-id="${it.id}">拒絕</button>` : ""}</div>
<div class="acts acts2"><button class="sec" data-do="${it.starred ? "unstar" : "star"}" data-id="${it.id}" aria-pressed="${!!it.starred}">${it.starred ? "★ 已收藏" : "☆ 收藏入知識庫"}</button><button class="sec" data-do="${it.read_later ? "unread_later" : "read_later"}" data-id="${it.id}" aria-pressed="${!!it.read_later}">${it.read_later ? "✓ 稍後讀" : "稍後讀"}</button>${it.dismissed_reason ? `<button class="sec" data-do="restore" data-id="${it.id}">取消唔感興趣</button>` : `<select data-ni="${it.id}" aria-label="唔感興趣原因"><option value="">唔感興趣…</option>${Object.entries(NI).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`}${(it.source || "").startsWith("x:@") ? `<button class="sec" data-mute="handle" data-v="${esc(it.source.slice(2))}">靜音 ${esc(it.source.slice(2))}</button>` : it.category ? `<button class="sec" data-mute="topic" data-v="${esc(it.category)}">靜音題材</button>` : ""}</div>${it.dup_count ? `<div class="meta">另有 ${esc(it.dup_count)} 個來源報道同一件事</div>` : ""}</article>`;
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
    else if (tab === "kb") { const d = await api("/api/kb");
      view.innerHTML = `<div class="filters"><a class="btn" href="/api/kb/export" download="radar-kb.md">匯出 Markdown（Obsidian）</a><span class="meta">共 ${d.entries.length} 篇</span></div>` + (d.entries.length ? `<div class="grid">${d.entries.map((e) => `<article class="card"><div class="kicker">${esc(e.category || e.source || "")} · ${esc(e.origin === "star" ? "收藏" : e.origin === "approved" ? "批准" : "手動")}</div><h3>${esc(e.title)}</h3><p>${esc(e.summary || "")}</p>${ul(e.key_points)}${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}<div class="acts"><button class="sec" data-kbnote="${e.id}">${e.note ? "改筆記" : "加筆記"}</button><button class="rej" data-kbdel="${e.id}">移除</button></div>${e.note ? `<p class="why"><b>筆記</b>${esc(e.note)}</p>` : ""}</article>`).join("")}</div>` : "<p class='meta'>未有收藏。喺「今日」撳「☆ 收藏入知識庫」。</p>"); }
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
view.addEventListener("click", async (ev) => { const r = ev.target.closest("[data-reco]"); if (r) { localStorage.setItem("radar-reco", r.dataset.reco); return show("daily"); }
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
show("daily");
