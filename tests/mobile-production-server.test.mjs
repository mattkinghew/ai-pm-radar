import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AccessAuthError } from "../lib/cloudflare-access.mjs";
import { createMobileProductionServer, PROXY_TIMEOUT_MS } from "../scripts/mobile-production-server.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function request(origin, pathname, { headers = {}, method = "GET", body } = {}) {
  const target = new URL(pathname, origin);
  return new Promise((resolve, reject) => {
    const outgoing = http.request({
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method,
      headers,
    }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      incoming.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: incoming.statusCode,
          headers: incoming.headers,
          text: async () => text,
          json: async () => JSON.parse(text),
        });
      });
    });
    outgoing.on("error", reject);
    if (body) outgoing.write(body);
    outgoing.end();
  });
}

async function makeStaticOutput() {
  const output = await mkdtemp(path.join(os.tmpdir(), "radar-mobile-static-"));
  await writeFile(path.join(output, "index.html"), "<!doctype html><h1>Radar</h1><script>window.radarInlineFixture = true;</script>");
  await writeFile(path.join(output, ".env"), "SHOULD_NOT_BE_SERVED=1");
  return output;
}

function authorize(request) {
  if (request.headers["cf-access-jwt-assertion"] !== "valid") {
    throw new AccessAuthError("access_session_expired", "Login required.", 401);
  }
  return { email: "owner@example.com" };
}

test("protected proxy allows the 60-second Gemini window plus 10 seconds for response transport", () => {
  assert.equal(PROXY_TIMEOUT_MS, 70_000);
});

test("blocks unauthorised static and API requests before reading protected data", async (t) => {
  const outDir = await makeStaticOutput();
  const server = createMobileProductionServer({
    outDir,
    helperOrigin: "http://127.0.0.1:9",
    publicOrigin: "https://radar.lamlab.cc",
    verifyAccess: authorize,
  });
  const origin = await listen(server);
  t.after(() => server.close());

  const page = await request(origin, "/", { headers: { host: "radar.lamlab.cc", "x-forwarded-proto": "https" } });
  const api = await request(origin, "/api/status", { headers: { host: "radar.lamlab.cc", "x-forwarded-proto": "https" } });

  assert.equal(page.status, 401);
  assert.match(page.headers["content-type"] ?? "", /text\/html/u);
  assert.equal(api.status, 401);
  assert.deepEqual(await api.json(), { code: "access_session_expired", error: "Login required." });
});

test("serves only exported files and proxies the allowlisted same-origin API", async (t) => {
  const outDir = await makeStaticOutput();
  const helper = http.createServer((request, response) => {
    assert.equal(request.headers.origin, "http://127.0.0.1:4320");
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ provider: "gemini", configured: true }));
  });
  const helperOrigin = await listen(helper);
  const server = createMobileProductionServer({
    outDir,
    helperOrigin,
    helperAllowedOrigin: "http://127.0.0.1:4320",
    publicOrigin: "https://radar.lamlab.cc",
    verifyAccess: authorize,
  });
  const origin = await listen(server);
  t.after(() => { server.close(); helper.close(); });
  const headers = {
    host: "radar.lamlab.cc",
    "x-forwarded-proto": "https",
    "cf-access-jwt-assertion": "valid",
  };

  const page = await request(origin, "/", { headers });
  const api = await request(origin, "/api/status", { headers });
  const apiRoot = await request(origin, "/api", { headers });
  const secret = await request(origin, "/.env", { headers });
  const unknownApi = await request(origin, "/api/not-real", { headers });

  assert.equal(page.status, 200);
  assert.match(await page.text(), /<h1>Radar<\/h1>/u);
  const fixtureHash = createHash("sha256").update("window.radarInlineFixture = true;").digest("base64");
  assert.match(page.headers["content-security-policy"] ?? "", new RegExp(`'sha256-${fixtureHash}'`, "u"));
  assert.doesNotMatch(page.headers["content-security-policy"] ?? "", /script-src[^;]*unsafe-inline/u);
  assert.deepEqual(await api.json(), { provider: "gemini", configured: true });
  assert.equal(apiRoot.status, 404);
  assert.match(apiRoot.headers["content-type"] ?? "", /application\/json/u);
  assert.deepEqual(await apiRoot.json(), { code: "api_route_not_found", error: "Unknown API route." });
  assert.equal(secret.status, 404);
  assert.equal(unknownApi.status, 404);
  assert.match(unknownApi.headers["content-type"] ?? "", /application\/json/u);
  assert.deepEqual(await unknownApi.json(), { code: "api_route_not_found", error: "Unknown API route." });
});

test("returns JSON service-unavailable when the loopback helper is down", async (t) => {
  const outDir = await makeStaticOutput();
  const server = createMobileProductionServer({
    outDir,
    helperOrigin: "http://127.0.0.1:9",
    publicOrigin: "https://radar.lamlab.cc",
    verifyAccess: authorize,
  });
  const origin = await listen(server);
  t.after(() => server.close());

  const response = await request(origin, "/api/status", {
    headers: {
      host: "radar.lamlab.cc",
      "x-forwarded-proto": "https",
      "cf-access-jwt-assertion": "valid",
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    code: "companion_service_unavailable",
    error: "The local companion service is unavailable.",
  });
});

test("rejects requests for the wrong host or insecure forwarded protocol", async (t) => {
  const outDir = await makeStaticOutput();
  const server = createMobileProductionServer({
    outDir,
    helperOrigin: "http://127.0.0.1:9",
    publicOrigin: "https://radar.lamlab.cc",
    verifyAccess: authorize,
  });
  const origin = await listen(server);
  t.after(() => server.close());
  const common = { "cf-access-jwt-assertion": "valid" };

  const wrongHost = await request(origin, "/", { headers: { ...common, host: "other.lamlab.cc", "x-forwarded-proto": "https" } });
  const insecure = await request(origin, "/", { headers: { ...common, host: "radar.lamlab.cc", "x-forwarded-proto": "http" } });

  assert.equal(wrongHost.status, 421);
  assert.equal(insecure.status, 400);
});
