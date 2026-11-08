// AI summarize/translate with per-provider daily caps. Gemini first (free-tier cap), Workers AI overflow (free 10k neurons/day). Never logs keys.
const PROMPT = `你是 AI PM Radar 的知識編輯。將以下內容整理為 JSON：{"title_original":string(原文標題),"title_zh":string(繁體中文標題),"summary":string(繁體中文,<=150字),"summary_en":string(English,<=80 words),"key_points_zh":string[3-5](繁體中文),"key_points_en":string[3-5](English),"score":number(0-10, 對 AI PM/顧問/職涯/內容營運的知識轉化價值),"score_reason":string(繁體中文,<=60字,說明為何打這個分數),"reco_score":number(0-10, 對讀者的「資訊優勢」),"reco_reason":string(繁體中文,<=60字,說明對讀者具體有何用處),"side_income_new":boolean,"side_income_reason":string(繁體中文,<=60字；side_income_new=false 時給空字串)}。讀者方向：一人公司、低成本變現、訊息差、AI 資訊、前端科技學習（React/CSS/workflow），並支援 AI PM 與顧問研究。reco_score 高 = 可用於工作決策、顧問服務或學習實作的新資訊；泛泛新聞給低分。社交短帖不要改寫成新聞文章：summary 用一句話說明「點解值得收藏」，並在 key_points 加上精簡標籤。side_income_new=true 只限真正新穎、低成本、合法、可試行且不屬於讀者現有方向的變現方法；否則 false 並令 side_income_reason 為空字串。只輸出 JSON，不要解釋。內容不足時輸出 {"error":"insufficient_content"}。`;

export function hktDay(nowMs = Date.now()) { return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10); }
// Usage counters use the UTC day: resets 00:00 UTC = 08:00 HKT, same as Workers AI free allocation.
export function usageDay(nowMs = Date.now()) { return new Date(nowMs).toISOString().slice(0, 10); }
export const caps = (env) => ({ gemini: Number(env.AI_DAILY_CAP || 10), "workers-ai": env.AI_FALLBACK_PROVIDER === "workers-ai" ? Number(env.WORKERS_AI_DAILY_CAP || 100) : 0 });

export async function reserve(db, provider, cap, nowMs, quota = "manual") {
  if (!(cap > 0)) return false;
  const day = usageDay(nowMs);
  await db.prepare("INSERT OR IGNORE INTO ai_usage_provider(day, provider, calls) VALUES(?, ?, 0)").bind(day, provider).run();
  const res = await db.prepare("UPDATE ai_usage_provider SET calls = calls + 1, manual_calls=manual_calls+? WHERE day = ? AND provider = ? AND calls < ?").bind(quota === "manual" ? 1 : 0, day, provider, cap).run();
  return (res.meta?.changes ?? 0) > 0;
}
export async function refund(db, provider, nowMs, quota = "manual") {
  await db.prepare("UPDATE ai_usage_provider SET calls=MAX(0,calls-1), manual_calls=MAX(0,manual_calls-?) WHERE day=? AND provider=?").bind(quota === "manual" ? 1 : 0, usageDay(nowMs), provider).run();
}
export async function reserveAutoItem(db, limit, nowMs) {
  const day = usageDay(nowMs);
  await db.prepare("INSERT OR IGNORE INTO ai_auto_usage(day,items) VALUES(?,0)").bind(day).run();
  const r = await db.prepare("UPDATE ai_auto_usage SET items=items+1 WHERE day=? AND items<?").bind(day, limit).run();
  return (r.meta?.changes ?? 0) > 0;
}
export async function usage(env, nowMs = Date.now()) {
  const c = caps(env); const day = usageDay(nowMs); const r = await env.DB.prepare("SELECT provider, calls, manual_calls FROM ai_usage_provider WHERE day = ?").bind(day).all();
  const used = Object.fromEntries((r.results || []).map((x) => [x.provider, x]));
  const au = await env.DB.prepare("SELECT items FROM ai_auto_usage WHERE day=?").bind(day).first();
  const limit = Number(env.AI_AUTO_ANALYZE_LIMIT || 5);
  const reserveGemini = Number(env.AI_MANUAL_RESERVE_GEMINI || 5), reserveWorkers = Number(env.AI_MANUAL_RESERVE_WORKERS || 20);
  const auto = { used: au?.items || 0, cap: limit, remaining: Math.max(0, limit - (au?.items || 0)) };
  const providerUsage = (provider, cap, floor, model) => {
    const x = used[provider] || { calls: 0, manual_calls: 0 };
    return { used: x.calls, cap, autoCap: Math.max(0, cap - floor), autoUsed: Math.max(0, x.calls - x.manual_calls), manualReserveRemaining: Math.max(0, floor - x.manual_calls), ...(model ? { model } : {}) };
  };
  return { gemini: providerUsage("gemini", c.gemini, reserveGemini), workersAi: providerUsage("workers-ai", c["workers-ai"], reserveWorkers, env.WORKERS_AI_MODEL || null), auto };
}

const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []);
export function parseAiJson(text) {
  const s = String(text ?? "").replace(/<think>[\s\S]*?(<\/think>|$)/gu, "").replace(/```(?:json)?/giu, "");
  const m = s.match(/\{[\s\S]*\}/u);
  if (!m) throw new Error("ai_bad_output");
  let j; try { j = JSON.parse(m[0]); } catch { throw new Error("ai_bad_output"); }
  if (j.error) throw new Error(j.error);
  const kz = arr(j.key_points_zh ?? j.key_points);
  if (typeof j.summary !== "string" || !kz.length) throw new Error("ai_bad_output");
  const titleZh = String(j.title_zh ?? j.title ?? "").slice(0, 200);
  return { title: titleZh, title_zh: titleZh, title_original: String(j.title_original ?? "").slice(0, 300),
    summary: j.summary.slice(0, 2000), summary_en: typeof j.summary_en === "string" ? j.summary_en.slice(0, 2000) : null,
    key_points: kz, key_points_en: arr(j.key_points_en), score: Math.max(0, Math.min(10, Number(j.score) || 0)),
    reco_score: j.reco_score == null ? null : Math.max(0, Math.min(10, Number(j.reco_score) || 0)), reco_reason: typeof j.reco_reason === "string" ? j.reco_reason.slice(0, 200) : null,
    score_reason: typeof j.score_reason === "string" ? j.score_reason.slice(0, 200) : (typeof j.reco_reason === "string" ? j.reco_reason.slice(0, 200) : null),
    side_income_new: j.side_income_new === true || j.side_income_new === "true" ? 1 : 0,
    side_income_reason: (j.side_income_new === true || j.side_income_new === "true") && typeof j.side_income_reason === "string" ? j.side_income_reason.slice(0, 200) : null };
}

async function gemini(env, text, fetchImpl, prompt = PROMPT, maxIn = 12000) {
  if (!env.GEMINI_API_KEY) throw new Error("gemini_key_missing");
  const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(25_000),
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\n\n---\n${text.slice(0, maxIn)}` }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 } }),
  });
  if (!r.ok) throw new Error(`gemini_http_${r.status}`);
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function workersAi(env, text, prompt = PROMPT, maxIn = 6000, maxOut = 1200) {
  if (!env.AI) throw new Error("workers_ai_unbound");
  const out = await env.AI.run(env.WORKERS_AI_MODEL || "@cf/qwen/qwen3-30b-a3b-fp8", {
    messages: [{ role: "system", content: `${prompt} /no_think` }, { role: "user", content: text.slice(0, maxIn) }], max_tokens: maxOut, temperature: 0.3 });
  if (typeof out?.response === "string") return out.response;
  if (out?.response && typeof out.response === "object") return JSON.stringify(out.response);
  return out?.choices?.[0]?.message?.content ?? "";
}

const retryable = (e) => /^gemini_http_(429|5\d\d)$/u.test(e?.message || "") || /^(TimeoutError|AbortError)$/u.test(e?.name || "");
const extractive = (text) => {
  const s = String(text ?? "").replace(/https?:\/\/\S+/gu, " ").replace(/\s+/gu, " ").trim();
  const han = (s.match(/\p{Script=Han}/gu) || []).length;
  if (!s || s.length >= 400 || han / s.length < 0.25) return null;
  const lines = String(text ?? "").split(/\n/u).map((x) => x.trim()).filter((x) => x && !/^https?:\/\//u.test(x));
  return { title: (lines[0] || s).slice(0, 200), title_zh: (lines[0] || s).slice(0, 200), title_original: (lines[0] || s).slice(0, 300), summary: s.slice(0, 150), summary_en: null, key_points: [], key_points_en: [], score: 0, reco_score: null, reco_reason: null, score_reason: null, side_income_new: 0, side_income_reason: null, provider: "extractive" };
};
async function runProvider(env, provider, cap, text, invoke, parse, nowMs, quota, beforeModel) {
  if (!(await reserve(env.DB, provider, cap, nowMs, quota))) return null;
  try {
    if (beforeModel) await beforeModel();
    return { ...parse(await invoke()), provider };
  } catch (e) { await refund(env.DB, provider, nowMs, quota); throw e; }
}
const providerCap = (env, provider, auto) => {
  const c = caps(env)[provider];
  return auto ? Math.max(0, c - Number(provider === "gemini" ? env.AI_MANUAL_RESERVE_GEMINI || 5 : env.AI_MANUAL_RESERVE_WORKERS || 20)) : c;
};
export async function summarize(env, text, { fetchImpl = fetch, nowMs = Date.now(), quota = "manual", beforeModel } = {}) {
  const simple = extractive(text); if (simple) return simple;
  const auto = quota === "auto"; let gemErr = null;
  const gcap = providerCap(env, "gemini", auto);
  let g; try { g = await runProvider(env, "gemini", gcap, text, () => gemini(env, text, fetchImpl), parseAiJson, nowMs, quota, beforeModel); }
  catch (err) { gemErr = err; if (!retryable(err)) throw err; }
  if (g) return g;
  if (gemErr && !retryable(gemErr)) throw gemErr;
  if (!gemErr || env.AI_FALLBACK_PROVIDER !== "workers-ai") throw gemErr ?? new Error("ai_daily_cap_reached");
  try {
    const w = await runProvider(env, "workers-ai", providerCap(env, "workers-ai", auto), text, () => workersAi(env, text), parseAiJson, nowMs, quota, beforeModel);
    if (w) return w;
  } catch (e) {
    if (!/^(ai_bad_output|insufficient_content|workers_ai_unbound)$/u.test(e.message || "")) throw Object.assign(new Error("workers_ai_error"), { cause: e });
    throw e;
  }
  throw gemErr ?? new Error("ai_daily_cap_reached");
}

// Generic JSON task (reader translate/summary, KB synthesis) with the same caps + Gemini -> Workers AI fallback.
export async function generate(env, prompt, text, parse, { fetchImpl = fetch, nowMs = Date.now(), maxOut = 2000, quota = "manual", beforeModel } = {}) {
  const auto = quota === "auto"; let gemErr = null;
  const json = (t) => { const m = String(t ?? "").replace(/<think>[\s\S]*?(<\/think>|$)/gu, "").replace(/```(?:json)?/giu, "").match(/\{[\s\S]*\}/u); if (!m) throw new Error("ai_bad_output"); let j; try { j = JSON.parse(m[0]); } catch { throw new Error("ai_bad_output"); } if (j.error) throw new Error(String(j.error)); return parse(j); };
  let g; try { g = await runProvider(env, "gemini", providerCap(env, "gemini", auto), text, () => gemini(env, text, fetchImpl, prompt, 12000), json, nowMs, quota, beforeModel); }
  catch (err) { gemErr = err; if (!retryable(err)) throw err; }
  if (g) return g;
  if (gemErr && !retryable(gemErr)) throw gemErr;
  if (!gemErr || env.AI_FALLBACK_PROVIDER !== "workers-ai") throw gemErr ?? new Error("ai_daily_cap_reached");
  try {
    const w = await runProvider(env, "workers-ai", providerCap(env, "workers-ai", auto), text, () => workersAi(env, text, prompt, 6000, maxOut), json, nowMs, quota, beforeModel);
    if (w) return w;
  } catch (err) { if (!/^(ai_bad_output|insufficient_content|workers_ai_unbound)$/u.test(err.message || "")) throw Object.assign(new Error("workers_ai_error"), { cause: err }); throw err; }
  throw gemErr ?? new Error("ai_daily_cap_reached");
}
