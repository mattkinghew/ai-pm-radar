import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash, generateKeyPairSync, createSign } from "node:crypto";

export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0001_init.sql", "0002_bilingual_provider_usage.sql", "0003_sources_x_reco.sql"]) db.exec(readFileSync(new URL(`../../cloud/migrations/${f}`, import.meta.url), "utf8"));
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    run: async () => { const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
  });
  return { prepare: (sql) => stmt(sql), raw: db };
}

export const TEAM = "https://matt-test.cloudflareaccess.com";
export const AUD = "aud-test";
export const OWNER = "owner@example.test";
const b64u = (b) => Buffer.from(b).toString("base64url");
export function accessKit() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const jwks = JSON.stringify({ keys: [jwk] });
  const sign = (claims) => {
    const h = b64u(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" })); const p = b64u(JSON.stringify(claims));
    const s = createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey);
    return `${h}.${p}.${b64u(s)}`;
  };
  const now = Math.floor(Date.now() / 1000);
  const token = (over = {}) => sign({ iss: TEAM, aud: [AUD], type: "app", email: OWNER, iat: now - 10, exp: now + 600, ...over });
  return { jwks, token };
}
export const ownerHash = createHash("sha256").update(OWNER).digest("hex");
