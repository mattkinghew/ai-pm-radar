import { createPublicKey, verify as verifySignature } from "node:crypto";

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TIMEOUT_MS = 5_000;

export class AccessAuthError extends Error {
  constructor(code, message, status = 401) {
    super(message);
    this.name = "AccessAuthError";
    this.code = code;
    this.status = status;
  }
}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the protected mobile origin.`);
  return value;
}

function httpsOrigin(value, name, expectedSuffix = null) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }
  if (expectedSuffix && !url.hostname.endsWith(expectedSuffix)) {
    throw new Error(`${name} must use ${expectedSuffix}.`);
  }
  return url.origin;
}

export function getCloudflareAccessConfig(env = process.env) {
  const publicOrigin = httpsOrigin(required(env, "AI_PM_RADAR_PUBLIC_ORIGIN"), "AI_PM_RADAR_PUBLIC_ORIGIN");
  const issuer = httpsOrigin(required(env, "CF_ACCESS_TEAM_DOMAIN"), "CF_ACCESS_TEAM_DOMAIN", ".cloudflareaccess.com");
  const audience = required(env, "CF_ACCESS_AUD");
  const allowedEmail = required(env, "CF_ACCESS_ALLOWED_EMAIL").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(allowedEmail)) {
    throw new Error("CF_ACCESS_ALLOWED_EMAIL must be one exact email address.");
  }
  return {
    publicOrigin,
    issuer,
    audience,
    allowedEmail,
    certsUrl: `${issuer}/cdn-cgi/access/certs`,
  };
}

function decodeJsonPart(value, label) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new AccessAuthError("access_token_invalid", `The Access token ${label} is invalid.`);
  }
}

async function fetchJwks(config, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);
  timeout.unref?.();
  try {
    const response = await fetchImpl(config.certsUrl, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Cloudflare Access signing keys were unavailable.");
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.keys)) throw new Error("Cloudflare Access signing keys were invalid.");
    return payload;
  } catch {
    throw new AccessAuthError("access_keys_unavailable", "Cloudflare Access signing keys are temporarily unavailable.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyCloudflareAccessToken(token, config, options = {}) {
  if (typeof token !== "string" || token.length === 0 || token.length > 20_000) {
    throw new AccessAuthError("access_session_expired", "Login required.", 401);
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new AccessAuthError("access_token_invalid", "The Access token is invalid.", 401);
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader, "header");
  const payload = decodeJsonPart(encodedPayload, "payload");
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new AccessAuthError("access_token_invalid", "The Access token signing method is invalid.", 401);
  }

  const getJwks = options.getJwks ?? (() => fetchJwks(config, options.fetchImpl));
  const jwks = await getJwks();
  const jwk = Array.isArray(jwks?.keys) ? jwks.keys.find((candidate) => candidate?.kid === header.kid) : null;
  if (!jwk) throw new AccessAuthError("access_token_invalid", "The Access token signing key is unknown.", 401);

  let validSignature = false;
  try {
    validSignature = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch {
    validSignature = false;
  }
  if (!validSignature) throw new AccessAuthError("access_token_invalid", "The Access token signature is invalid.", 401);

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (payload.iss !== config.issuer) throw new AccessAuthError("access_token_invalid", "The Access token issuer is invalid.", 401);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) throw new AccessAuthError("access_token_invalid", "The Access token audience is invalid.", 401);
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new AccessAuthError("access_token_expired", "Your login expired. Sign in again, then retry.", 401);
  }
  if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > nowSeconds + CLOCK_SKEW_SECONDS)) {
    throw new AccessAuthError("access_token_invalid", "The Access token is not active yet.", 401);
  }
  if (typeof payload.email !== "string" || payload.email.toLowerCase() !== config.allowedEmail) {
    throw new AccessAuthError("access_identity_forbidden", "This identity is not allowed to use Radar.", 403);
  }
  return payload;
}

export function createCloudflareAccessVerifier(config, options = {}) {
  let cachedJwks = null;
  let cachedUntil = 0;
  const cacheMs = options.cacheMs ?? 5 * 60_000;
  const getJwks = async () => {
    if (cachedJwks && Date.now() < cachedUntil) return cachedJwks;
    cachedJwks = await fetchJwks(config, options.fetchImpl);
    cachedUntil = Date.now() + cacheMs;
    return cachedJwks;
  };
  return (request) => verifyCloudflareAccessToken(request.headers["cf-access-jwt-assertion"], config, { getJwks });
}
