import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AccessAuthError,
  createCloudflareAccessVerifier,
  getCloudflareAccessConfig,
} from "../lib/cloudflare-access.mjs";
import { loadProjectEnv } from "../lib/project-env.mjs";

const API_ROUTES = new Map([
  ["GET /api/status", "/status"],
  ["GET /api/fetch", "/fetch"],
  ["POST /api/analyze", "/analyze"],
  ["POST /api/feed", "/feed"],
  ["GET /api/automation/status", "/automation/status"],
  ["GET /api/automation/state", "/automation/state"],
  ["GET /api/automation/export", "/automation/export"],
  ["POST /api/automation/config", "/automation/config"],
  ["POST /api/automation/run", "/automation/run"],
  ["POST /api/automation/feedback", "/automation/feedback"],
]);
const MAX_PROXY_REQUEST_BYTES = 200_000;
const MAX_PROXY_RESPONSE_BYTES = 2_000_000;
export const PROXY_TIMEOUT_MS = 70_000;

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function inlineScriptHashes(html) {
  const hashes = [];
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu);
  for (const match of scripts) {
    if (/\bsrc\s*=/iu.test(match[1])) continue;
    const digest = createHash("sha256").update(match[2]).digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

function securityHeaders(contentType, allowedInlineScriptHashes = []) {
  const scriptPolicy = ["'self'", ...allowedInlineScriptHashes].join(" ");
  return {
    "content-security-policy": `default-src 'self'; connect-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src ${scriptPolicy}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
    "cross-origin-opener-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-type": contentType,
  };
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function forwardedProtocol(request) {
  const forwarded = request.headers["x-forwarded-proto"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  const visitor = request.headers["cf-visitor"];
  if (typeof visitor === "string") {
    try { return JSON.parse(visitor).scheme ?? ""; } catch { return ""; }
  }
  return "";
}

async function readRequestBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_PROXY_REQUEST_BYTES) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function proxyApi(request, response, requestUrl, options) {
  const helperPath = API_ROUTES.get(`${request.method} ${requestUrl.pathname}`);
  if (!helperPath) {
    writeJson(response, 404, { code: "api_route_not_found", error: "Unknown API route." });
    return;
  }
  let body;
  try {
    body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
  } catch {
    writeJson(response, 413, { code: "request_too_large", error: "The API request is too large." });
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  timer.unref?.();
  try {
    const target = new URL(helperPath, options.helperOrigin);
    target.search = requestUrl.search;
    const helperResponse = await fetch(target, {
      method: request.method,
      headers: {
        accept: "application/json",
        ...(request.headers["content-type"] ? { "content-type": request.headers["content-type"] } : {}),
        origin: options.helperAllowedOrigin,
      },
      body,
      redirect: "error",
      signal: controller.signal,
    });
    const contentType = helperResponse.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      writeJson(response, 502, { code: "companion_invalid_response", error: "The local companion service returned an invalid response." });
      return;
    }
    const bytes = Buffer.from(await helperResponse.arrayBuffer());
    if (bytes.length > MAX_PROXY_RESPONSE_BYTES) {
      writeJson(response, 502, { code: "companion_response_too_large", error: "The local companion response exceeded the limit." });
      return;
    }
    response.writeHead(helperResponse.status, {
      ...securityHeaders("application/json; charset=utf-8"),
      "cache-control": "no-store",
    });
    response.end(bytes);
  } catch (error) {
    if (error?.name === "AbortError") {
      writeJson(response, 504, { code: "companion_timeout", error: "The local companion service timed out." });
    } else {
      writeJson(response, 503, { code: "companion_service_unavailable", error: "The local companion service is unavailable." });
    }
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(request, response, requestUrl, outDir) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { ...securityHeaders("text/plain; charset=utf-8"), allow: "GET, HEAD" });
    response.end("Method not allowed.");
    return;
  }
  let decoded;
  try { decoded = decodeURIComponent(requestUrl.pathname); } catch {
    response.writeHead(400, securityHeaders("text/plain; charset=utf-8"));
    response.end("Invalid path.");
    return;
  }
  const segments = decoded.split("/").filter(Boolean);
  if (decoded.includes("\0") || segments.some((segment) => segment === ".." || segment.startsWith("."))) {
    response.writeHead(404, securityHeaders("text/plain; charset=utf-8"));
    response.end("Not found.");
    return;
  }
  const relative = segments.length === 0
    ? "index.html"
    : path.extname(segments.at(-1))
      ? segments.join("/")
      : path.join(...segments, "index.html");
  const root = path.resolve(outDir);
  const filePath = path.resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404, securityHeaders("text/plain; charset=utf-8"));
    response.end("Not found.");
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not_file");
    const bytes = await readFile(filePath);
    const contentType = CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
    const inlineHashes = contentType.startsWith("text/html")
      ? inlineScriptHashes(bytes.toString("utf8"))
      : [];
    response.writeHead(200, {
      ...securityHeaders(contentType, inlineHashes),
      "cache-control": contentType.startsWith("text/html") ? "no-store" : "public, max-age=3600",
      "content-length": bytes.length,
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(404, securityHeaders("text/plain; charset=utf-8"));
    response.end("Not found.");
  }
}

export function createMobileProductionServer({
  outDir,
  helperOrigin,
  helperAllowedOrigin = "http://127.0.0.1:4320",
  publicOrigin,
  verifyAccess,
}) {
  const expected = new URL(publicOrigin);
  return http.createServer(async (request, response) => {
    const host = (request.headers.host ?? "").split(":")[0].toLowerCase();
    if (host !== expected.hostname.toLowerCase()) {
      response.writeHead(421, securityHeaders("text/plain; charset=utf-8"));
      response.end("Misdirected request.");
      return;
    }
    if (forwardedProtocol(request) !== "https") {
      response.writeHead(400, securityHeaders("text/plain; charset=utf-8"));
      response.end("HTTPS is required.");
      return;
    }

    let requestUrl;
    try { requestUrl = new URL(request.url ?? "/", publicOrigin); } catch {
      response.writeHead(400, securityHeaders("text/plain; charset=utf-8"));
      response.end("Invalid request URL.");
      return;
    }
    try {
      await verifyAccess(request);
    } catch (error) {
      const authError = error instanceof AccessAuthError
        ? error
        : new AccessAuthError("access_token_invalid", "Login required.", 401);
      if (isApiPath(requestUrl.pathname)) {
        writeJson(response, authError.status, { code: authError.code, error: authError.message });
      } else {
        response.writeHead(authError.status, {
          ...securityHeaders("text/html; charset=utf-8"),
          "cache-control": "no-store",
          "www-authenticate": "Cloudflare-Access",
        });
        response.end("<!doctype html><html lang=\"zh-Hant\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>需要重新登入</title><body><main><h1>登入已失效</h1><p>請重新整理並再次通過 Cloudflare Access 登入。</p></main></body></html>");
      }
      return;
    }

    if (isApiPath(requestUrl.pathname)) {
      await proxyApi(request, response, requestUrl, { helperOrigin, helperAllowedOrigin });
      return;
    }
    await serveStatic(request, response, requestUrl, outDir);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  loadProjectEnv(process.env, path.join(root, ".env.local"));
  let config;
  try {
    config = getCloudflareAccessConfig();
  } catch (error) {
    console.error(`Protected mobile origin refused to start: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  const port = Number(process.env.AI_PM_RADAR_PRODUCTION_PORT ?? 4320);
  const helperPort = Number(process.env.AI_PM_RADAR_FETCH_PORT ?? 4310);
  const helperAllowedOrigin = `http://127.0.0.1:${port}`;
  const server = createMobileProductionServer({
    outDir: path.join(root, "out"),
    helperOrigin: `http://127.0.0.1:${helperPort}`,
    helperAllowedOrigin,
    publicOrigin: config.publicOrigin,
    verifyAccess: createCloudflareAccessVerifier(config),
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Protected AI PM Radar origin listening at http://127.0.0.1:${port}`);
    console.log(`Public origin configured for ${config.publicOrigin}; Cloudflare Access JWT verification is required.`);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
