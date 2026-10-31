// AI summarize/translate with per-provider daily caps. Gemini first (free-tier cap), Workers AI overflow (free 10k neurons/day). Never logs keys.
const PROMPT = `你是 AI PM Radar 的知識編輯。將以下內容整理為 JSON：{"title_original":string(原文標題),"title_zh":string(繁體中文標題),"summary":string(繁體中文,<=150字),"summary_en":string(English,<=80 words),"key_points_zh":string[3-5](繁體中文),"key_points_en":string[3-5](English),"score":number(0-10, 對 AI PM/證照/職涯/內容營運的知識轉化價值)}。只輸出 JSON，不要解釋。內容不足時輸出 {"error":"insufficient_content"}。`;

export function hktDay(nowMs = Date.now()) { return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10); }
// Usage counters use the UTC day: resets 00:00 UTC = 08:00 HKT, same as Workers AI free allocation.
export function usageDay(nowMs = Date.now()) { return new Date(nowMs).toISOString().slice(0, 10); }
export const caps = (env) => ({ gemini: Number(env.AI_DAILY_CAP || 10), "workers-ai": env.AI_FALLBACK_PROVIDER === "workers-ai" ? Number(env.WORKERS_AI_DAILY_CAP || 100) : 0 });

export async function reserve(db, provider, cap, nowMs) {
  if (!(cap > 0)) return false;
  const day = usageDay(nowMs);
  await db.prepare("INSERT OR IGNORE INTO ai_usage_provider(day, provider, calls) VALUES(?, ?, 0)").bind(day, provider).run();
  const res = await db.prepare("UPDATE ai_usage_provider SET calls = calls + 1 WHERE day = ? AND provider = ? AND calls < ?").bind(day, provider, cap).run();
  return (res.meta?.changes ?? 0) > 0;
}
export async function usage(env, nowMs = Date.now()) {
  const c = caps(env); const r = await env.DB.prepare("SELECT provider, calls FROM ai_usage_provider WHERE day = ?").bind(usageDay(nowMs)).all();
  const used = Object.fromEntries((r.results || []).map((x) => [x.provider, x.calls]));
  return { gemini: { used: used.gemini || 0, cap: c.gemini }, workersAi: { used: used["workers-ai"] || 0, cap: c["workers-ai"], model: env.WORKERS_AI_MODEL || null } };
}

const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []);
export function parseAiJson(text) {
  const s = String(text ?? "").replace(/<think>[\s\S]*?<\/think>/gu, "");
  const m = s.match(/\{[\s\S]*\}/u);
  if (!m) throw new Error("ai_bad_output");
  let j; try { j = JSON.parse(m[0]); } catch { throw new Error("ai_bad_output"); }
  if (j.error) throw new Error(j.error);
  const kz = arr(j.key_points_zh ?? j.key_points);
  if (typeof j.summary !== "string" || !kz.length) throw new Error("ai_bad_output");
  const titleZh = String(j.title_zh ?? j.title ?? "").slice(0, 200);
  return { title: titleZh, title_zh: titleZh, title_original: String(j.title_original ?? "").slice(0, 300),
    summary: j.summary.slice(0, 2000), summary_en: typeof j.summary_en === "string" ? j.summary_en.slice(0, 2000) : null,
    key_points: kz, key_points_en: arr(j.key_points_en), score: Math.max(0, Math.min(10, Number(j.score) || 0)) };
}

async function gemini(env, text, fetchImpl) {
  if (!env.GEMINI_API_KEY) { const e = new Error("gemini_key_missing"); e.fallback = true; throw e; }
  const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(25_000),
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${PROMPT}\n\n---\n${text.slice(0, 12000)}` }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 } }),
  });
  if (!r.ok) { const e = new Error(`gemini_http_${r.status}`); e.fallback = r.status === 429 || r.status >= 500; throw e; }
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function workersAi(env, text) {
  if (!env.AI) throw new Error("workers_ai_unbound");
  const out = await env.AI.run(env.WORKERS_AI_MODEL || "@cf/qwen/qwen3-30b-a3b-fp8", {
    messages: [{ role: "system", content: `${PROMPT} /no_think` }, { role: "user", content: text.slice(0, 6000) }], max_tokens: 1200, temperature: 0.3 });
  if (typeof out?.response === "string") return out.response;
  if (out?.response && typeof out.response === "object") return JSON.stringify(out.response);
  return out?.choices?.[0]?.message?.content ?? "";
}

// Gemini while under its cap; on cap reached / 429 / 5xx / timeout / missing key -> Workers AI under its own cap.
export async function summarize(env, text, { fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const c = caps(env); let gemErr = null;
  if (await reserve(env.DB, "gemini", c.gemini, nowMs)) {
    try { return { ...parseAiJson(await gemini(env, text, fetchImpl)), provider: "gemini" }; }
    catch (err) {
      if (/insufficient_content/u.test(err.message)) throw err;
      const fb = err.fallback || err.name === "TimeoutError" || err.name === "AbortError" || err.message === "ai_bad_output";
      if (!fb) throw err;
      gemErr = err;
    }
  }
  if (env.AI_FALLBACK_PROVIDER !== "workers-ai") throw gemErr ?? new Error("ai_daily_cap_reached");
  if (!(await reserve(env.DB, "workers-ai", c["workers-ai"], nowMs))) throw new Error("ai_daily_cap_reached");
  return { ...parseAiJson(await workersAi(env, text)), provider: "workers-ai" };
}
