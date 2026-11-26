const lanes = { "": "全部", AI_LEARNING_PATH: "AI 學習", MONETIZATION_GAP: "商業機會", TECH_NEWS: "科技動態", GITHUB_PROJECT: "開源專案", APPLY_NOW: "即時機會", FREE_RESOURCE: "免費資源", AGENT_GOVERNANCE: "Agent 治理", CONTENT_WORKFLOW: "內容工作流", OTHER: "其他" };
const cards = document.querySelector("#cards"), status = document.querySelector("#status");
let selected = "", pending;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
const date = (value) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat("zh-Hant", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Hong_Kong" }).format(new Date(value)) : "日期未提供";
function card(item) {
  const article = node("article", null, "brief");
  article.append(node("p", lanes[item.lane] || item.category || "精選", "kicker"), node("h3", item.title), node("p", item.summary || "摘要未提供，請閱讀原始來源。", "summary"));
  const points = node("ul"); for (const point of item.key_points) points.append(node("li", point));
  if (points.childElementCount) article.append(points);
  const tags = node("div", null, "tags"); for (const tag of item.tags) tags.append(node("span", tag)); article.append(tags);
  article.append(node("div", `${item.source || "來源未提供"} · ${date(item.published_at)}${Number.isFinite(item.score) ? ` · 編輯分數 ${item.score}` : ""}`, "meta"));
  try {
    const url = new URL(item.url);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
      const link = node("a", "閱讀原始來源 ↗", "source"); link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer"; article.append(link);
    }
  } catch { /* Missing source links stay non-interactive. */ }
  return article;
}
async function load() {
  pending?.abort(); const controller = new AbortController(); pending = controller;
  cards.replaceChildren(); cards.setAttribute("aria-busy", "true"); status.textContent = "正在載入精選簡報…";
  try {
    const response = await fetch(`/api/public/showcase${selected ? `?lane=${encodeURIComponent(selected)}` : ""}`, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error("unavailable");
    const { items, stats } = await response.json();
    document.querySelector("#stat-items").textContent = stats.approved_items;
    document.querySelector("#stat-sources").textContent = stats.sources;
    document.querySelector("#stat-lanes").textContent = stats.lanes;
    document.querySelector("#freshness").textContent = `最新來源：${date(stats.latest_published_at)} · 資料快取 5 分鐘`;
    cards.replaceChildren(...items.map(card));
    status.textContent = `顯示 ${items.length} 筆${selected ? ` · ${lanes[selected]}` : "公開精選"}（依來源日期排序）`;
    if (!items.length) cards.append(node("p", "此方向暫無已批准的公開簡報，請選擇其他方向。", "empty"));
  } catch (error) {
    if (error.name === "AbortError") return;
    status.textContent = "公開簡報暫時無法載入，請稍後重新整理。";
    for (const id of ["stat-items", "stat-sources", "stat-lanes"]) document.getElementById(id).textContent = "—";
    document.querySelector("#freshness").textContent = "公開資料狀態未知";
  } finally { if (pending === controller) cards.setAttribute("aria-busy", "false"); }
}
for (const [lane, label] of Object.entries(lanes)) {
  const button = node("button", label); button.type = "button"; button.setAttribute("aria-pressed", String(lane === selected));
  button.addEventListener("click", () => {
    selected = lane;
    for (const pill of document.querySelectorAll("#lanes button")) pill.setAttribute("aria-pressed", String(pill === button));
    load();
  });
  document.querySelector("#lanes").append(button);
}
load();
