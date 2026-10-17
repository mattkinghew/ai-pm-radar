import assert from "node:assert/strict";
import test from "node:test";

import {
  CompanionApiError,
  companionApiUrl,
  parseCompanionJsonResponse,
} from "../lib/companion-api.ts";

function withNodeEnv<T>(nodeEnv: string, run: () => T): T {
  const originalNodeEnv = process.env.NODE_ENV;
  Reflect.set(process.env, "NODE_ENV", nodeEnv);
  try {
    return run();
  } finally {
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
  }
}

test("remote HTTPS pages use the protected same-origin API", () => {
  assert.equal(
    companionApiUrl("/analyze", {
      protocol: "https:",
      hostname: "radar.lamlab.cc",
    }),
    "/api/analyze",
  );
});

test("local development keeps using the loopback companion helper", () => {
  withNodeEnv("development", () => {
    assert.equal(
      companionApiUrl("/status", {
        protocol: "http:",
        hostname: "localhost",
      }, "4318"),
      "http://127.0.0.1:4318/status",
    );
  });
});

test("production pages never target loopback, even when opened on a local hostname", () => {
  withNodeEnv("production", () => {
    assert.equal(
      companionApiUrl("/analyze", { protocol: "http:", hostname: "localhost" }),
      "/api/analyze",
    );
  });
});

test("Access login HTML is classified as an expired login instead of JSON", async () => {
  const response = new Response("<!doctype html><title>Cloudflare Access</title>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  await assert.rejects(
    () => parseCompanionJsonResponse(response),
    (error: unknown) => error instanceof CompanionApiError && error.code === "access_session_expired",
  );
});

test("service unavailable JSON keeps its actionable error code", async () => {
  const response = new Response(JSON.stringify({
    code: "companion_service_unavailable",
    error: "The companion helper is unavailable.",
  }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

  await assert.rejects(
    () => parseCompanionJsonResponse(response),
    (error: unknown) => error instanceof CompanionApiError
      && error.code === "companion_service_unavailable"
      && error.status === 503,
  );
});
