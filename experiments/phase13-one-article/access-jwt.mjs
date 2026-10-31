const MAX_TOKEN_CHARS = 20_000;
const MAX_JWKS_BYTES = 64_000;
const JWKS_TIMEOUT_MS = 5_000;
const CLOCK_SKEW_SECONDS = 60;
const encoder = new TextEncoder();
const jwksCache = new Map();

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid_base64url");
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Url(value)));
}

function accessIssuer(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/"
      || url.search || url.hash || !url.hostname.endsWith(".cloudflareaccess.com")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function signingKeys(issuer, fetchImpl, nowMs, refresh = false, onDiagnostic = () => {}) {
  const cached = jwksCache.get(issuer);
  if (!refresh && cached && cached.expiresAt > nowMs) return cached.keys;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: controller.signal,
    });
    const statedLength = Number(response.headers.get("content-length"));
    if (response.status >= 300 && response.status < 400) {
      onDiagnostic("access_jwks_redirect_rejected");
      return null;
    }
    if (!response.ok) {
      onDiagnostic(`access_jwks_http_${Math.floor(response.status / 100)}xx`);
      return null;
    }
    if (Number.isFinite(statedLength) && statedLength > MAX_JWKS_BYTES) {
      onDiagnostic("access_jwks_too_large");
      return null;
    }
    if (!response.body) {
      onDiagnostic("access_jwks_body_missing");
      return null;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_JWKS_BYTES) {
        await reader.cancel().catch(() => {});
        onDiagnostic("access_jwks_too_large");
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      onDiagnostic("access_jwks_invalid_payload");
      return null;
    }
    if (!Array.isArray(payload?.keys)) {
      onDiagnostic("access_jwks_invalid_payload");
      return null;
    }
    jwksCache.set(issuer, { keys: payload.keys, expiresAt: nowMs + 5 * 60_000 });
    return payload.keys;
  } catch {
    onDiagnostic("access_jwks_request_failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyCloudflareAccessOwner(request, env, options = {}) {
  const fail = (stage) => {
    options.onDiagnostic?.(stage);
    return null;
  };
  if (env.CLOUD_ACCESS_REQUIRED !== "true" || !/^[0-9a-f]{64}$/u.test(env.OWNER_EMAIL_SHA256 ?? "")) return fail("owner_auth_not_configured");
  const issuer = accessIssuer(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = typeof env.CF_ACCESS_AUD === "string" ? env.CF_ACCESS_AUD.trim() : "";
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!issuer || !audience) return fail("access_issuer_or_audience_missing");
  if (!token) return fail("access_assertion_missing");
  if (token.length > MAX_TOKEN_CHARS) return fail("access_assertion_too_large");

  const parts = token.split(".");
  if (parts.length !== 3) return fail("access_assertion_malformed");
  let header;
  let claims;
  let signature;
  try {
    header = decodeJsonPart(parts[0]);
    claims = decodeJsonPart(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch {
    return fail("access_assertion_decode_failed");
  }
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid
    || header.jku || header.x5u || header.crit) return fail("access_assertion_header_invalid");

  const nowMs = options.nowMs ?? Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  let jwksFailure = "access_jwks_unavailable";
  const onJwksDiagnostic = (stage) => {
    jwksFailure = stage;
    options.onDiagnostic?.(stage);
  };
  let keys = await signingKeys(issuer, fetchImpl, nowMs, false, onJwksDiagnostic);
  let jwk = keys?.find((candidate) => candidate?.kid === header.kid && candidate?.kty === "RSA"
    && (!candidate.alg || candidate.alg === "RS256") && (!candidate.use || candidate.use === "sig"));
  if (!jwk && jwksCache.has(issuer)) {
    keys = await signingKeys(issuer, fetchImpl, nowMs, true, onJwksDiagnostic);
    jwk = keys?.find((candidate) => candidate?.kid === header.kid && candidate?.kty === "RSA"
      && (!candidate.alg || candidate.alg === "RS256") && (!candidate.use || candidate.use === "sig"));
  }
  if (!keys) return fail(jwksFailure);
  if (!jwk) return fail("access_signing_key_id_not_found");

  let valid;
  try {
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, signature, encoder.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return fail("access_signature_check_failed");
  }
  if (!valid) return fail("access_signature_invalid");

  const now = Math.floor(nowMs / 1000);
  const audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (claims?.iss !== issuer) return fail("access_issuer_mismatch");
  if (claims?.type !== "app") return fail("access_token_type_invalid");
  if (!audiences.includes(audience)) return fail("access_audience_mismatch");
  if (!Number.isFinite(claims.iat) || claims.iat > now + CLOCK_SKEW_SECONDS
    || !Number.isFinite(claims.exp) || claims.exp <= now - CLOCK_SKEW_SECONDS || claims.exp <= claims.iat
    || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + CLOCK_SKEW_SECONDS))) return fail("access_token_time_invalid");

  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) return fail("access_identity_missing");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(email))),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== env.OWNER_EMAIL_SHA256) return fail("access_owner_not_allowed");
  return { sub: `cf_${hash}` };
}
