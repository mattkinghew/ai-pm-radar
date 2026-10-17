import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import {
  extractArticleFromHtml,
  createPinnedLookup,
  getAIProviderConfig,
  ANALYSIS_TIMEOUT_MS,
  GEMINI_ANALYSIS_TIMEOUT_MS,
  isPublicAddress,
  loadProjectEnv,
  requestGeminiAnalysis,
  readLimitedBody,
  resolvePublicTarget,
} from "../scripts/source-fetch-helper.mjs";

function validAnalysis(textReference = "The rollout reduced review time from five days to two days.") {
  return {
    summary: "A synthetic rollout improved review speed.",
    why_it_matters: "It shows a measurable workflow signal.",
    source_facts: ["The rollout reduced review time from five days to two days."],
    key_points: ["Review time decreased."],
    method_or_teaching_points: [],
    key_claims: [{
      claim: "The rollout reduced review time.",
      evidence: [{ source: "https://example.com/rollout", timestamp: "", text_reference: textReference }],
    }],
    business_implication: "Teams may spend less time on manual review.",
    ai_pm_implication: "An AI PM should define the workflow metric before scaling.",
    use_cases: ["Prioritising review workflow experiments."],
    content_ideas: ["A short case note on review-time measurement."],
    uncertainties: ["The source does not measure satisfaction or revenue impact."],
    suggested_title: "Synthetic review workflow signal",
    question_title: "What changed review speed?",
    short_title: "Review speed signal",
    category: "AI PM",
    daily_tags: ["workflow"],
    tags: ["evaluation"],
    confidence: 0.7,
    impact_score: { value: 5, rationale: "The result is limited to a synthetic test." },
    relevance_score: { value: 6, rationale: "It relates to AI workflow measurement." },
    trust_score: { value: 4, rationale: "The source is synthetic and needs human review." },
  };
}

test("Gemini gets a bounded 60-second allowance without increasing the unrelated OpenAI timeout", () => {
  assert.equal(GEMINI_ANALYSIS_TIMEOUT_MS, 60_000);
  assert.equal(ANALYSIS_TIMEOUT_MS, 30_000);
});

test("loads .env.local values without overriding existing process environment", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pm-radar-env-"));
  const envPath = join(directory, ".env.local");
  writeFileSync(envPath, "AI_PROVIDER=gemini\nGEMINI_API_KEY=fixture-placeholder\nGEMINI_MODEL=gemini-test\n");
  try {
    const env = { AI_PROVIDER: "openai", GEMINI_API_KEY: "process-placeholder" };
    loadProjectEnv(env, envPath);
    assert.equal(env.AI_PROVIDER, "openai");
    assert.equal(env.GEMINI_API_KEY, "process-placeholder");
    assert.equal(env.GEMINI_MODEL, "gemini-test");
    assert.deepEqual(getAIProviderConfig(env), {
      provider: "openai_responses",
      model: "gpt-4.1-mini",
      configured: false,
      apiKey: null,
    });
    assert.match(readFileSync(envPath, "utf8"), /fixture-placeholder/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("selects Gemini explicitly and never falls back when its key is missing", () => {
  assert.deepEqual(getAIProviderConfig({ AI_PROVIDER: "gemini", GEMINI_MODEL: "gemini-2.5-flash-lite" }), {
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    configured: false,
    apiKey: null,
  });
  assert.deepEqual(getAIProviderConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "fixture-placeholder" }), {
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    configured: true,
    apiKey: "fixture-placeholder",
  });
});

test("maps a Gemini structured response and usage without weakening evidence checks", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  let requestBody = null;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(validAnalysis(calls++ === 0 ? undefined : "Not in source")) }] },
        finishReason: "STOP",
      }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34, totalTokenCount: 46 },
    }), { status: 200, headers: { "x-request-id": "synthetic-gemini-request" } });
  };
  try {
    const result = await requestGeminiAnalysis({
      sourceText: "The rollout reduced review time from five days to two days.",
      title: "Synthetic source",
      sourceUrl: "https://example.com/rollout",
      language: "en",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    });
    assert.equal(result.provider, "gemini");
    assert.equal(result.model, "gemini-test");
    assert.deepEqual(result.usage, { input_tokens: 12, output_tokens: 34, total_tokens: 46 });
    assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
    assert.ok(requestBody.generationConfig.responseJsonSchema);
    assert.match(requestBody.contents[0].parts[0].text, /Traditional Chinese \(zh-Hant\)/);
    assert.match(requestBody.contents[0].parts[0].text, /ENTIRE supplied article body/);
    assert.match(requestBody.contents[0].parts[0].text, /NOT as a substitute for article reporting/);
    assert.match(requestBody.contents[0].parts[0].text, /If the supplied body is mostly a headline/);
    assert.match(requestBody.contents[0].parts[0].text, /evidence\[\]\.text_reference and method_or_teaching_points\[\] MUST remain exact verbatim/);
    assert.equal(requestBody.generationConfig.response_mime_type, undefined);
    assert.equal(requestBody.generationConfig.response_schema, undefined);
    assert.equal(requestBody.generationConfig.responseSchema, undefined);
    await assert.rejects(
      requestGeminiAnalysis({
        sourceText: "The rollout reduced review time from five days to two days.",
        title: "Synthetic source",
        sourceUrl: "https://example.com/rollout",
        language: "en",
        config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
      }).then(() => { throw new Error("expected evidence validation failure"); }),
      (error) => error.code === "evidence_not_found" && error.details.stage === "evidence_validation",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("canonicalises a whitespace-only evidence difference to the original source text", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{
      content: { parts: [{ text: JSON.stringify(validAnalysis(["The rollout reduced review time", "from five days to two days."].join("\n"))) }] },
      finishReason: "STOP",
    }],
  }), { status: 200 });
  try {
    const result = await requestGeminiAnalysis({
      sourceText: "The rollout reduced review time from five days to two days.",
      title: "Synthetic source",
      sourceUrl: "https://example.com/rollout",
      language: "zh-Hant",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    });
    assert.equal(result.analysis.key_claims[0].evidence[0].text_reference, "The rollout reduced review time from five days to two days.");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("accepts only verbatim source-backed method points", async () => {
  const previousFetch = globalThis.fetch;
  const sourceText = "First label the sample tickets. Then compare every predicted category with the labels.";
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      ...validAnalysis("First label the sample tickets."),
      method_or_teaching_points: ["Then compare every predicted category with the labels."],
    }) }] }, finishReason: "STOP" }],
  }), { status: 200 });
  try {
    const result = await requestGeminiAnalysis({
      sourceText,
      title: "Synthetic method",
      sourceUrl: "https://example.com/method",
      language: "en",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    });
    assert.deepEqual(result.analysis.method_or_teaching_points, ["Then compare every predicted category with the labels."]);

    globalThis.fetch = async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        ...validAnalysis("First label the sample tickets."),
        method_or_teaching_points: ["Compare model output with the truth."],
      }) }] }, finishReason: "STOP" }],
    }), { status: 200 });
    const partiallyVerified = await requestGeminiAnalysis({
      sourceText,
      title: "Synthetic method",
      sourceUrl: "https://example.com/method",
      language: "en",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    });
    assert.deepEqual(partiallyVerified.analysis.method_or_teaching_points, []);
    assert.equal(partiallyVerified.diagnostics.stage, "completed_with_omissions");
    assert.deepEqual(partiallyVerified.diagnostics.omitted_method_points, ["$.method_or_teaching_points[0]"]);
    assert.equal(partiallyVerified.analysis.key_claims[0].evidence[0].text_reference, "First label the sample tickets.");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("drops only unmatched optional method excerpts, keeping exact ones and the original source-backed claims", async () => {
  const previousFetch = globalThis.fetch;
  const sourceText = "First label the sample tickets. Then compare every predicted category with the labels.";
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      ...validAnalysis("First label the sample tickets."),
      method_or_teaching_points: [
        "First label the sample tickets.",
        "Paraphrase that does not exist in the input.",
        "Then compare every predicted category with the labels.",
      ],
    }) }] }, finishReason: "STOP" }],
  }), { status: 200 });
  try {
    const result = await requestGeminiAnalysis({
      sourceText, title: "Synthetic method", sourceUrl: "https://example.com/method", language: "en",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    });
    assert.deepEqual(result.analysis.method_or_teaching_points, [
      "First label the sample tickets.", "Then compare every predicted category with the labels.",
    ]);
    assert.deepEqual(result.diagnostics.omitted_method_points, ["$.method_or_teaching_points[1]"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("an invalid claim citation still blocks the entire AI response, even when an optional method is invalid", async () => {
  const previousFetch = globalThis.fetch;
  const sourceText = "First label the sample tickets.";
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      ...validAnalysis("Claim evidence was fabricated."),
      method_or_teaching_points: ["Method not in source either."],
    }) }] }, finishReason: "STOP" }],
  }), { status: 200 });
  try {
    await assert.rejects(requestGeminiAnalysis({
      sourceText, title: "Synthetic method", sourceUrl: "https://example.com/method", language: "en",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    }), (error) => error.code === "evidence_not_found"
      && error.details.validation_issues.some((issue) => issue.path === "$.key_claims[0].evidence[0].text_reference")
      && error.details.validation_issues.some((issue) => issue.path === "$.method_or_teaching_points[0]"));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("rejects translated evidence even when the analysis summary is not English", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{
      content: { parts: [{ text: JSON.stringify({ ...validAnalysis("試點把審核時間由五天減至兩天。"), summary: "試點縮短了審核時間。" }) }] },
      finishReason: "STOP",
    }],
  }), { status: 200 });
  try {
    await assert.rejects(
      requestGeminiAnalysis({
        sourceText: "The rollout reduced review time from five days to two days.",
        title: "Synthetic source",
        sourceUrl: "https://example.com/rollout",
        language: "zh-Hant",
        config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
      }),
      (error) => error.code === "evidence_not_found" && error.details.stage === "evidence_validation",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("classifies empty candidates, truncation, invalid JSON, and schema mismatch", async () => {
  const previousFetch = globalThis.fetch;
  const responses = [
    { candidates: [], promptFeedback: {}, usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 0, totalTokenCount: 3 } },
    { candidates: [{ content: { parts: [{ text: "{\"summary\":\"partial" }] }, finishReason: "MAX_TOKENS" }] },
    { candidates: [{ content: { parts: [{ text: "not-json" }] }, finishReason: "STOP" }] },
    { candidates: [{ content: { parts: [{ text: JSON.stringify({ ...validAnalysis(), extra: true }) }] }, finishReason: "STOP" }] },
  ];
  globalThis.fetch = async () => new Response(JSON.stringify(responses.shift()), { status: 200 });
  const input = {
    sourceText: "The rollout reduced review time from five days to two days.",
    title: "Synthetic source",
    sourceUrl: "https://example.com/rollout",
    language: "en",
    config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
  };
  try {
    await assert.rejects(requestGeminiAnalysis(input), (error) => error.code === "model_no_candidate" && error.details.candidate_count === 0);
    await assert.rejects(requestGeminiAnalysis(input), (error) => error.code === "model_incomplete" && error.details.finish_reason === "MAX_TOKENS");
    await assert.rejects(requestGeminiAnalysis(input), (error) => error.code === "model_invalid_json" && error.details.stage === "json_parse");
    await assert.rejects(requestGeminiAnalysis(input), (error) => error.code === "model_schema_mismatch"
      && error.details.stage === "schema_validation"
      && error.details.validation_issues.some((issue) => issue.path === "$.extra"));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("classifies Gemini unsupported-location precondition without retrying or switching provider", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      error: { code: 400, status: "FAILED_PRECONDITION", message: "User location is not supported for the API use." },
    }), { status: 400 });
  };
  try {
    await assert.rejects(requestGeminiAnalysis({
      sourceText: "Synthetic source for regional availability.",
      title: "Regional fixture",
      sourceUrl: "https://example.com/fixture",
      language: "zh-Hant",
      config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
    }), (error) => error.code === "provider_region_unsupported" && error.details.provider_error_status === "FAILED_PRECONDITION");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("distinguishes account-level model retirement from a generic missing resource", async () => {
  const previousFetch = globalThis.fetch;
  const input = {
    sourceText: "A short synthetic source sentence for model diagnostics.",
    title: "Synthetic source",
    sourceUrl: "https://example.com/diagnostics",
    language: "en",
    config: { provider: "gemini", model: "gemini-test", configured: true, apiKey: "fixture-placeholder" },
  };
  const responses = [
    {
      error: {
        code: 404,
        status: "NOT_FOUND",
        message: "This model models/gemini-test is no longer available to new users. Please update your code.",
      },
    },
    {
      error: {
        code: 404,
        status: "NOT_FOUND",
        message: "The requested resource was not found.",
      },
    },
  ];
  globalThis.fetch = async () => new Response(JSON.stringify(responses.shift()), { status: 404 });
  try {
    await assert.rejects(requestGeminiAnalysis(input), (error) => error.code === "model_unavailable_for_account"
      && error.details.provider_error_status === "NOT_FOUND"
      && /no longer available to new users/.test(error.details.provider_error_message));
    await assert.rejects(requestGeminiAnalysis(input), (error) => error.code === "provider_resource_not_found");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("blocks private, loopback, link-local, metadata, and reserved IPv6 targets", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.8",
    "169.254.169.254",
    "192.168.1.4",
    "::1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("93.184.216.34"), true);
});

test("rejects private IPv4 and IPv6 URLs before any request is made", async () => {
  await assert.rejects(resolvePublicTarget(new URL("http://127.0.0.1/article")), /private|local/);
  await assert.rejects(resolvePublicTarget(new URL("http://[::1]/article")), /private|local|ENOTFOUND/);
});

test("extracts article text and leaves missing metadata unknown", () => {
  const result = extractArticleFromHtml(
    "<html><head><title>Public note</title></head><body><article><p>" +
      "A public article body with enough synthetic text to pass the minimum length check and remain reviewable for a human reviewer." +
      "</p></article></body></html>",
    "https://example.com/article",
  );
  assert.equal(result.title, "Public note");
  assert.equal(result.creator, null);
  assert.equal(result.publishedAt, null);
  assert.match(result.body, /public article body/);
});

test("does not reject an article because its navigation includes sign-in options", () => {
  const result = extractArticleFromHtml(
    "<html><head><title>Research note</title></head><body>" +
      "<nav><a>Sign in</a><a>Subscribe</a></nav>" +
      "<article><p>This is a complete public article body with enough details for a reviewer to verify the source claims and business context without needing an account.</p></article>" +
      "</body></html>",
    "https://example.com/research-note",
  );
  assert.equal(result.completeness, "complete");
  assert.match(result.body, /complete public article body/);
});

test("rejects a genuine sign-in interstitial instead of treating it as source text", () => {
  assert.throws(
    () => extractArticleFromHtml(
      "<html><head><title>Sign in to continue</title></head><body>" +
        "<main><h1>Sign in to continue</h1><p>Please log in to read this page.</p><p>Authentication is required before the content can be displayed.</p></main>" +
        "</body></html>",
      "https://example.com/account/login",
    ),
    /login|verification|access-denied/i,
  );
});

test("marks teaser or paywall previews as incomplete without inventing the missing body", () => {
  const result = extractArticleFromHtml(
    "<html><head><title>Member article</title></head><body>" +
      "<article><p>This short public preview explains the opening context. Subscribe to continue reading the full article.</p></article>" +
      "</body></html>",
    "https://example.com/member-article",
  );
  assert.equal(result.completeness, "partial");
  assert.equal(result.warnings.length, 1);
});

test("keeps the DNS-pinned address when Node requests all lookup results", () => {
  const lookup = createPinnedLookup({ address: "93.184.216.34", family: 4 });
  lookup("example.com", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: "93.184.216.34", family: 4 }]);
  });
  lookup("example.com", { all: false }, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, "93.184.216.34");
    assert.equal(family, 4);
  });
});

test("rejects a homepage or verification page instead of treating it as an article", () => {
  assert.throws(
    () => extractArticleFromHtml(
      "<html><head><title>Example home</title></head><body><p>" +
        "A generic home page with enough synthetic text but no article markers and no article path, so it must remain a recovery case for the operator." +
        "</p></body></html>",
      "https://example.com/",
    ),
    /homepage/,
  );
  assert.throws(
    () => extractArticleFromHtml(
      "<html><head><title>Verify you are human</title></head><body><article><p>" +
        "Security check content that must never be treated as a source article, even when the response contains enough visible text to look superficially complete." +
        "</p></article></body></html>",
      "https://example.com/article",
    ),
    /login|verification|access-denied/i,
  );
});

test("enforces response size and timeout limits", async () => {
  await assert.rejects(
    readLimitedBody(Readable.from(["123456"]), { maxBytes: 5, timeoutMs: 100 }),
    /larger than the allowed limit/,
  );
  const delayed = Readable.from((async function* () {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield "late";
  })());
  await assert.rejects(
    readLimitedBody(delayed, { maxBytes: 100, timeoutMs: 5 }),
    /timed out/,
  );
});
