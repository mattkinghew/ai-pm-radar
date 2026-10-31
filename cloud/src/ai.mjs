// AI summarize with daily cap + optional Workers AI fallback. Never logs keys.
const PROMPT = `你是 AI PM Radar 的知識編輯。將以下內容整理為 JSON：{"title":string,"summary":string(繁體中文,<=120字),"key_points":string[3-5],"score":number(0-10, 對 AI PM/證照/職涯/內容營運的知識轉化價值)}。只輸出 JSON。內容不足時輸出 {"error":"insufficient_content"}。`;

export function hktDay(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
}

export async function reserveAiCall(db, cap, nowMs) {
  const day = hktDay(nowMs);
  await db.prepare("INSERT OR IGNORE INTO ai_usage(day, calls) VALUES(?, 0)").bind(day).run();
  const res = await db.prepare("UPDATE ai_usage SET calls = calls + 1 WHERE day = ? AND calls < ?").bind(day, cap).run();
  return (res.meta?.changes ?? 0) > 0;
}

export function parseAiJson(text) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/u);
  if (!m) throw new Error("ai_bad_output");
  const j = JSON.parse(m[0]);
  if (j.error) throw new Error(j.error);
  if (typeof j.summary !== "string" || !Array.isArray(j.key_points)) throw new Error("ai_bad_output");
  return { title: String(j.title ?? "").slice(0, 200), summary: j.summary.slice(0, 2000),
    key_points: j.key_points.map(String).slice(0, 8), score: Math.max(0, Math.min(10, Number(j.score) || 0)) };
}

async function gemini(env, text, fetchImpl) {
  if (!env.GEMINI_API_KEY) { const e = new Error("gemini_key_missing"); e.noFallback = true; throw e; }
  const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const ctrl = AbortSignal.timeout(25_000);
  const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal: ctrl,
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${PROMPT}\n\n---\n${text.slice(0, 12000)}` }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 } }),
  });
  if (!r.ok) { const e = new Error(`gemini_http_${r.status}`); e.noFallback = r.status === 401 || r.status === 403 || r.status === 400; throw e; }
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function workersAi(env, text) {
  if (!env.AI) throw new Error("workers_ai_unbound");
  const out = await env.AI.run(env.WORKERS_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", {
    messages: [{ role: "system", content: PROMPT }, { role: "user", content: text.slice(0, 8000) }], max_tokens: 800 });
  return out?.response ?? "";
}

export async function summarize(env, text, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const cap = Number(env.AI_DAILY_CAP || 10);
  if (!(await reserveAiCall(env.DB, cap, nowMs))) throw new Error("ai_daily_cap_reached");
  try {
    return { ...parseAiJson(await gemini(env, text, fetchImpl)), provider: "gemini" };
  } catch (err) {
    if (err.noFallback || env.AI_FALLBACK_PROVIDER !== "workers-ai" || /insufficient_content/u.test(err.message)) throw err;
    if (!(await reserveAiCall(env.DB, cap, nowMs))) throw new Error("ai_daily_cap_reached");
    return { ...parseAiJson(await workersAi(env, text)), provider: "workers-ai" };
  }
}
