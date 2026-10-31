const view = document.getElementById("view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (p, o) => { const r = await fetch(p, { credentials: "same-origin", ...o }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { j }); return j; };
const MSG = { ai_daily_cap_reached: "今日 AI 額度已用完（08:00 重設）", insufficient_content: "內容太短，請打開原文貼上正文（用「＋擷取」）",
  ai_bad_output: "AI 回覆格式有誤，請稍後再試", workers_ai_error: "後備 AI 暫時出錯，請稍後再試", workers_ai_unbound: "後備 AI 未設定",
  gemini_key_missing: "Gemini key 未設定", unauthorized: "登入已過期，請重新整理頁面", not_found: "找不到此文章" };
const msgOf = (e) => e.j?.hint || MSG[e.message] || (/^gemini_http_/.test(e.message) ? "Gemini 暫時出錯，請稍後再試" : "處理失敗，請稍後再試") + "";
let lang = localStorage.getItem("radar-lang") || "zh";
const PV = { gemini: "Gemini", "workers-ai": "Workers AI" };
const ul = (a) => (a || []).length ? "<ul>" + a.map((k) => `<li>${esc(k)}</li>`).join("") + "</ul>" : "";
function body(it) {
  const zhT = it.title_zh || it.title, orT = it.title_original || it.title, zhS = it.summary || "（未有 AI 摘要，可撳「轉中文」）";
  if (lang === "orig") return `<h3>${esc(orT)}</h3><p>${esc(it.summary_en || it.raw_excerpt || it.summary || "")}</p>${ul(it.key_points_en?.length ? it.key_points_en : it.key_points)}`;
  if (lang === "both") return `<h3>${esc(zhT)}</h3>${orT !== zhT ? `<div class="orig">${esc(orT)}</div>` : ""}<p>${esc(zhS)}</p>${it.summary_en ? `<p class="orig">${esc(it.summary_en)}</p>` : ""}${ul(it.key_points)}${ul(it.key_points_en)}`;
  return `<h3>${esc(zhT)}</h3><p>${esc(zhS)}</p>${ul(it.key_points)}`;
}
const size = (it, i) => i === 0 ? "feat" : (i < 3 || (it.score ?? 0) >= 8) ? "wide" : "";
const card = (it, i = 9) => `<article class="card ${size(it, i)}">${it.category || it.source ? `<div class="kicker">${esc(it.category || it.source)}</div>` : ""}${body(it)}<div class="meta">${esc(it.source || "")} · ${esc(it.status)}${it.score != null ? " · 評分 " + esc(it.score) : ""}${it.ai_provider ? " · " + esc(PV[it.ai_provider] || it.ai_provider) : ""}</div>
${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}
<div class="acts">${!it.title_zh ? `<button class="sec" data-act="translate" data-id="${it.id}">轉中文</button>` : ""}${it.status === "draft" ? `<button data-act="review" data-id="${it.id}">已審核</button>` : ""}${it.status === "reviewed" ? `<button data-act="approve" data-id="${it.id}">批准重用</button>` : ""}${["draft", "reviewed"].includes(it.status) ? `<button class="rej" data-act="reject" data-id="${it.id}">拒絕</button>` : ""}</div></article>`;
const list = (items) => items.length ? `<div class="grid">${items.map(card).join("")}</div>` : "<p class='meta'>暫時冇內容</p>";
async function show(tab) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  try {
    if (tab === "capture") { view.innerHTML = ""; view.append(document.getElementById("capture-tpl").content.cloneNode(true)); return bindCapture(); }
    if (tab === "daily") { const d = await api("/api/daily"); view.innerHTML = `<p class="dateline">${esc(d.date || "未有")} · 今日焦點 ${d.items.length} 則</p>` + list(d.items); }
    else { const d = await api(tab === "draft" ? "/api/library?status=all" : "/api/library?status=approved"); view.innerHTML = list(tab === "draft" ? d.items.filter((i) => ["draft", "reviewed"].includes(i.status)) : d.items); }
  } catch (e) { view.innerHTML = `<p>載入失敗：${esc(e.message)}</p>`; }
}
function bindCapture() {
  document.getElementById("cap-form").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target); const msg = document.getElementById("cap-msg"); msg.textContent = "AI 整理中…";
    try { await api("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: f.get("url"), text: f.get("text") }) }); msg.textContent = "已存為草稿，請到「待審核」核對。"; ev.target.reset(); }
    catch (e) { msg.textContent = "失敗：" + msgOf(e); }
  });
}
view.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-act]"); if (!b) return; b.disabled = true;
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
