const view = document.getElementById("view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (p, o) => { const r = await fetch(p, { credentials: "same-origin", ...o }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { j }); return j; };
const card = (it) => `<div class="card"><h3>${esc(it.title)}</h3><div class="meta">${esc(it.source || "")} · ${esc(it.status)}${it.score != null ? " · 評分 " + esc(it.score) : ""}</div>
<p>${esc(it.summary || "（未有 AI 摘要）")}</p>${(it.key_points || []).length ? "<ul>" + it.key_points.map((k) => `<li>${esc(k)}</li>`).join("") + "</ul>" : ""}
${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}
<div class="acts">${it.status === "draft" ? `<button data-act="review" data-id="${it.id}">已審核</button>` : ""}${it.status === "reviewed" ? `<button data-act="approve" data-id="${it.id}">批准重用</button>` : ""}${["draft", "reviewed"].includes(it.status) ? `<button class="rej" data-act="reject" data-id="${it.id}">拒絕</button>` : ""}</div></div>`;
const list = (items) => items.length ? items.map(card).join("") : "<p class='meta'>暫時冇內容</p>";
async function show(tab) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  try {
    if (tab === "capture") { view.innerHTML = ""; view.append(document.getElementById("capture-tpl").content.cloneNode(true)); return bindCapture(); }
    if (tab === "daily") { const d = await api("/api/daily"); view.innerHTML = `<p class="meta">日期：${esc(d.date || "未有")}</p>` + list(d.items); }
    else { const d = await api(tab === "draft" ? "/api/library?status=all" : "/api/library?status=approved"); view.innerHTML = list(tab === "draft" ? d.items.filter((i) => ["draft", "reviewed"].includes(i.status)) : d.items); }
  } catch (e) { view.innerHTML = `<p>載入失敗：${esc(e.message)}</p>`; }
}
function bindCapture() {
  document.getElementById("cap-form").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target); const msg = document.getElementById("cap-msg"); msg.textContent = "AI 整理中…";
    try { await api("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: f.get("url"), text: f.get("text") }) }); msg.textContent = "已存為草稿，請到「待審核」核對。"; ev.target.reset(); }
    catch (e) { msg.textContent = "失敗：" + (e.j?.hint || e.message); }
  });
}
view.addEventListener("click", async (ev) => { const b = ev.target.closest("[data-act]"); if (!b) return; b.disabled = true;
  try { await api(`/api/items/${b.dataset.id}/${b.dataset.act}`, { method: "POST" }); } catch (e) { alert(e.message); }
  show(document.querySelector("nav button.on").dataset.tab); });
document.querySelector("nav").addEventListener("click", (ev) => { const t = ev.target.dataset.tab; if (t) show(t); });
api("/api/cloud/capabilities").then((c) => { document.getElementById("cap").textContent = `AI 上限 ${c.ai.dailyCap}/日`; }).catch(() => {});
show("daily");
