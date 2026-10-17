import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  AccessAuthError,
  getCloudflareAccessConfig,
  verifyCloudflareAccessToken,
} from "../lib/cloudflare-access.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });
publicJwk.kid = "radar-test-key";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

const config = {
  audience: "radar-audience",
  issuer: "https://lamlab.cloudflareaccess.com",
  allowedEmail: "owner@example.com",
};

function token(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: publicJwk.kid, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url");
  return `${header}.${body}.${signature}`;
}

function validPayload(overrides = {}) {
  return {
    iss: config.issuer,
    aud: [config.audience],
    email: config.allowedEmail,
    exp: 2_000_000_000,
    nbf: 1_700_000_000,
    ...overrides,
  };
}

test("validates the Cloudflare signature, issuer, audience, expiry and exact email", async () => {
  const payload = await verifyCloudflareAccessToken(token(validPayload()), config, {
    nowMs: 1_800_000_000_000,
    getJwks: async () => ({ keys: [publicJwk] }),
  });

  assert.equal(payload.email, config.allowedEmail);
});

test("rejects expired Access tokens", async () => {
  await assert.rejects(
    () => verifyCloudflareAccessToken(token(validPayload({ exp: 1_700_000_001 })), config, {
      nowMs: 1_800_000_000_000,
      getJwks: async () => ({ keys: [publicJwk] }),
    }),
    (error) => error instanceof AccessAuthError && error.code === "access_token_expired",
  );
});

test("rejects a token for another Access application or identity", async () => {
  await assert.rejects(
    () => verifyCloudflareAccessToken(token(validPayload({ aud: ["another-app"] })), config, {
      nowMs: 1_800_000_000_000,
      getJwks: async () => ({ keys: [publicJwk] }),
    }),
    (error) => error instanceof AccessAuthError && error.code === "access_token_invalid",
  );

  await assert.rejects(
    () => verifyCloudflareAccessToken(token(validPayload({ email: "other@example.com" })), config, {
      nowMs: 1_800_000_000_000,
      getJwks: async () => ({ keys: [publicJwk] }),
    }),
    (error) => error instanceof AccessAuthError && error.code === "access_identity_forbidden",
  );
});

test("production Access configuration fails closed when any required value is absent", () => {
  assert.throws(
    () => getCloudflareAccessConfig({
      AI_PM_RADAR_PUBLIC_ORIGIN: "https://radar.lamlab.cc",
      CF_ACCESS_TEAM_DOMAIN: "https://lamlab.cloudflareaccess.com",
      CF_ACCESS_AUD: "",
      CF_ACCESS_ALLOWED_EMAIL: "owner@example.com",
    }),
    /CF_ACCESS_AUD/u,
  );
});
