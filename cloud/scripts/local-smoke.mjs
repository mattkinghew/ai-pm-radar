#!/usr/bin/env node
// Local-only smoke: wrangler dev --local (Miniflare) + local D1 + mocked Access JWT + __scheduled. No remote calls to Cloudflare APIs.
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { accessKit, TEAM, AUD, ownerHash } from "../../tests/helpers/cloud-fakes.mjs";
const cwd = new URL("..", import.meta.url).pathname; const PORT = 8799; const base = `http://127.0.0.1:${PORT}`;
const kit = accessKit(); const devVars = `${cwd}.dev.vars`; const backup = existsSync(devVars) ? readFileSync(devVars) : null;
writeFileSync(devVars, [`ENVIRONMENT=local`, `CF_ACCESS_TEAM_DOMAIN=${TEAM}`, `CF_ACCESS_AUD=${AUD}`, `OWNER_EMAIL_SHA256=${ownerHash}`,
  `ACCESS_TEST_JWKS=${kit.jwks}`, `AI_ANALYSIS_ENABLED=false`].join("\n"));
const wr = (a) => execFileSync("npx", ["wrangler", ...a], { cwd, stdio: "pipe" }).toString();
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${info}`); };
let dev;
try {
  wr(["d1", "migrations", "apply", "ai-pm-radar", "--local"]);
  wr(["d1", "execute", "ai-pm-radar", "--local", "--file", ".import/import.sql"]);
  dev = spawn("npx", ["wrangler", "dev", "--local", "--port", String(PORT), "--test-scheduled"], { cwd, stdio: "pipe" });
  for (let i = 0; i < 60; i++) { try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
  const H = { "Cf-Access-Jwt-Assertion": kit.token() };
  check("no JWT -> 401", (await fetch(`${base}/api/library`)).status === 401);
  check("forged owner -> 401", (await fetch(`${base}/api/library`, { headers: { "Cf-Access-Jwt-Assertion": kit.token({ email: "x@evil.test" }) } })).status === 401);
  const cap = await fetch(`${base}/api/cloud/capabilities`, { headers: H }); check("capabilities 200", cap.status === 200, JSON.stringify(await cap.json()));
  const lib = await (await fetch(`${base}/api/library`, { headers: H })).json(); check("imported library rows", lib.items.length > 0, `n=${lib.items.length}`);
  const html = await fetch(`${base}/`, { headers: H }); check("static UI served", html.status === 200 && (await html.text()).includes("AI PM Radar"));
  const s = await fetch(`${base}/__scheduled?cron=0+0+*+*+*`); check("__scheduled cron", s.ok);
  let daily = { items: [] };
  for (let i = 0; i < 45 && !daily.items.length; i++) { await new Promise((r) => setTimeout(r, 1000)); daily = await (await fetch(`${base}/api/daily`, { headers: H })).json(); } check("cron collected daily items (AI off)", daily.items.length > 0, `n=${daily.items.length} date=${daily.date}`);
  const c = await fetch(`${base}/api/capture`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(100) }) });
  check("capture w/o GEMINI key -> 502 (no fake summary)", c.status === 502);
} finally {
  dev?.kill(); if (backup) writeFileSync(devVars, backup); else rmSync(devVars, { force: true });
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
