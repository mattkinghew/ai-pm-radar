import assert from "node:assert/strict";
import test from "node:test";

import { getAIFallbackConfig, getProviderConfigFor, isFallbackEligible, requestAIAnalysis } from "../scripts/source-fetch-helper.mjs";
import { isVideoOrSocialLink, parseQuickCapture, serializeQuickCapture } from "../lib/quick-capture.ts";

const SOURCE = "The rollout reduced review time from five days to two days.";
function validAnalysis() {
  return {
    summary: "A synthetic rollout improved review speed.", why_it_matters: "Signal.", source_facts: [SOURCE], key_points: ["Review time decreased."],
    method_or_teaching_points: [], key_claims: [{ claim: "The rollout reduced review time.", evidence: [{ source: "https://example.com/r", timestamp: "", text_reference: SOURCE }] }],
    business_implication: "Less review.", ai_pm_implication: "Define metrics.", use_cases: ["x"], content_ideas: ["y"], uncertainties: ["z"],
    suggested_title: "T", question_title: "Q?", short_title: "S", category: "AI PM", daily_tags: ["workflow"], tags: ["evaluation"], confidence: 0.7,
    impact_score: { value: 5, rationale: "r" }, relevance_score: { value: 6, rationale: "r" }, trust_score: { value: 4, rationale: "r" },
  };
}
const geminiOk = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(validAnalysis()) }] }, finishReason: "STOP" }] }), { status: 200 });
const chatOk = () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAnalysis()) } }], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }), { status: 200 });
const input = { sourceText: SOURCE, title: "t", sourceUrl: "https://example.com/r", language: "en", maxAttempts: 1 };

async function withFetch(impl, fn) {
  const prev = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = prev; }
}

test("fallback is disabled when AI_FALLBACK_PROVIDER is unset", async () => {
  assert.equal(getAIFallbackConfig({}), null);
  const urls = [];
  await assert.rejects(withFetch(async (url) => { urls.push(String(url)); return new Response("{}", { status: 429 }); },
    () => requestAIAnalysis(input, { AI_PROVIDER: "gemini", GEMINI_API_KEY: "placeholder" })), (e) => e.code === "rate_limited");
  assert.equal(urls.length, 1);
});

test("gemini 429 falls back once to ollama and records actual provider", async () => {
  const urls = [];
  const attempts = [];
  const result = await withFetch(async (url) => {
    urls.push(String(url));
    return String(url).includes("generativelanguage") ? new Response("{}", { status: 429 }) : chatOk();
  }, () => requestAIAnalysis({ ...input, onAttempt: async (_n, meta) => { attempts.push(meta.provider); } }, { AI_PROVIDER: "gemini", GEMINI_API_KEY: "placeholder", AI_FALLBACK_PROVIDER: "ollama", AI_FALLBACK_MODEL: "tiny" }));
  assert.equal(result.provider, "ollama");
  assert.equal(result.model, "tiny");
  assert.equal(result.fallback_from.provider, "gemini");
  assert.equal(result.fallback_from.code, "rate_limited");
  assert.deepEqual(attempts, ["gemini", "ollama"]);
  assert.equal(urls[1], "http://localhost:11434/v1/chat/completions");
});

test("auth errors do not trigger fallback", async () => {
  await assert.rejects(withFetch(async () => new Response("{}", { status: 401 }),
    () => requestAIAnalysis(input, { AI_PROVIDER: "gemini", GEMINI_API_KEY: "placeholder", AI_FALLBACK_PROVIDER: "ollama" })), (e) => e.code === "provider_auth_failed");
});

test("missing primary key falls back to openrouter with bearer header", async () => {
  let auth = null;
  const result = await withFetch(async (url, init) => { auth = init.headers.authorization; assert.match(String(url), /openrouter\.ai/); return chatOk(); },
    () => requestAIAnalysis(input, { AI_PROVIDER: "gemini", AI_FALLBACK_PROVIDER: "openrouter", OPENROUTER_API_KEY: "placeholder" }));
  assert.equal(result.provider, "openrouter");
  assert.equal(auth, "Bearer placeholder");
});

test("primary success is unchanged", async () => {
  const result = await withFetch(async () => geminiOk(), () => requestAIAnalysis(input, { AI_PROVIDER: "gemini", GEMINI_API_KEY: "placeholder", AI_FALLBACK_PROVIDER: "ollama" }));
  assert.equal(result.provider, "gemini");
  assert.equal(result.fallback_from, undefined);
});

test("provider config and eligibility helpers", () => {
  assert.equal(getProviderConfigFor("ollama", "", { OLLAMA_BASE_URL: "http://127.0.0.1:1/v1/" }).baseUrl, "http://127.0.0.1:1/v1");
  assert.equal(getProviderConfigFor("openrouter", "", {}).configured, false);
  assert.equal(isFallbackEligible({ code: "provider_service_unavailable" }), true);
  assert.equal(isFallbackEligible({ code: "provider_auth_failed", details: { status: 401 } }), false);
});

test("quick capture handoff carries autoAnalyze and stays backward compatible", () => {
  assert.equal(parseQuickCapture(serializeQuickCapture("hi", null, true)).autoAnalyze, true);
  assert.equal(parseQuickCapture(serializeQuickCapture("hi")).autoAnalyze, undefined);
  assert.equal(parseQuickCapture(JSON.stringify({ version: 1, value: "x", fileName: null })).value, "x");
  assert.throws(() => parseQuickCapture(JSON.stringify({ version: 1, value: "x", fileName: null, autoAnalyze: "yes" })));
  assert.equal(isVideoOrSocialLink("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(isVideoOrSocialLink("https://example.com/post"), false);
});
