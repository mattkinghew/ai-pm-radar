import assert from "node:assert/strict";
import test from "node:test";

import { generatePublicGemini } from "../cloud/src/ai.mjs";
import { fakeD1 } from "./helpers/cloud-fakes.mjs";

const makeEnv = (overrides = {}) => ({
  DB: fakeD1(),
  GEMINI_API_KEY: "synthetic-key",
  PUBLIC_HTTP_AI_ENABLED: "true",
  PUBLIC_HTTP_AI_DAILY_CAP: "1",
  PUBLIC_HTTP_AI_MODEL: "gemini-test-model",
  ...overrides,
});
const input = { scope: "synthetic", prompt: "Return a short JSON object.", text: "Synthetic public test text.", parse: (value) => JSON.parse(value) };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

test("official HTTP adapter is default-off and sends no request", async () => {
  let calls = 0;
  await assert.rejects(generatePublicGemini(makeEnv({ PUBLIC_HTTP_AI_ENABLED: undefined }), {
    ...input, fetchImpl: async () => { calls++; return response({}); },
  }), /public_http_ai_disabled/u);
  assert.equal(calls, 0);
});

test("adapter rejects private scope, missing explicit budget, and overlong text before fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response({}); };
  await assert.rejects(generatePublicGemini(makeEnv(), { ...input, scope: "private", fetchImpl }), /public_http_ai_scope_required/u);
  await assert.rejects(generatePublicGemini(makeEnv({ PUBLIC_HTTP_AI_DAILY_CAP: "0" }), { ...input, fetchImpl }), /public_http_ai_budget_required/u);
  await assert.rejects(generatePublicGemini(makeEnv(), { ...input, text: "x".repeat(12001), fetchImpl }), /public_http_ai_input_too_long/u);
  assert.equal(calls, 0);
});

test("adapter calls only the fixed Gemini endpoint with explicit budget and output cap", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return response({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ok: true }) }] } }] });
  };
  const env = makeEnv();
  const result = await generatePublicGemini(env, { ...input, fetchImpl, nowMs: Date.UTC(2026, 10, 21) });

  assert.deepEqual(result, { ok: true, provider: "gemini", model: "gemini-test-model" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent");
  assert.equal(requests[0].init.redirect, "manual");
  assert.equal(requests[0].init.headers["x-goog-api-key"], "synthetic-key");
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.contents[0].parts[0].text, `${input.prompt}\n\n---\n${input.text}`);
  assert.equal(body.generationConfig.maxOutputTokens, 1024);
  assert.equal(requests[0].url.includes("synthetic-key"), false);

  await assert.rejects(generatePublicGemini(env, { ...input, fetchImpl, nowMs: Date.UTC(2026, 10, 21) }), /ai_daily_cap_reached/u);
  assert.equal(requests.length, 1);
});

test("adapter rejects redirect responses without following their destination", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  };
  await assert.rejects(generatePublicGemini(makeEnv(), { ...input, fetchImpl }), /gemini_http_302/u);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.redirect, "manual");
  assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent");
});

test("provider failure is returned without fallback or leaking provider response", async () => {
  let calls = 0;
  await assert.rejects(generatePublicGemini(makeEnv({ AI_FALLBACK_PROVIDER: "workers-ai" }), {
    ...input,
    fetchImpl: async () => { calls++; return new Response("SYNTHETIC_PROVIDER_DETAIL", { status: 503 }); },
  }), /gemini_http_503/u);
  assert.equal(calls, 1);
});
