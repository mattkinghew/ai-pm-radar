/** Fail-closed local preflight only. Does NOT prove real Cloudflare Access is configured. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = new URL("./wrangler-preview-locked.jsonc", import.meta.url);
const config = JSON.parse(readFileSync(file, "utf8"));
assert.equal(config.workers_dev, false, "workers.dev must stay disabled before Access protection");
assert.equal(config.preview_urls, false, "Workers preview URLs must stay disabled before Access protection");
assert.equal(config.routes, undefined, "No public routes allowed before Access is verified");
assert.equal(config.route, undefined, "No public route allowed before Access is verified");
assert.equal(config.triggers, undefined, "No scheduled triggers allowed");
assert.equal(config.d1_databases, undefined, "No remote D1 binding until user authorized and DB provisioned");
assert.ok(config.name.startsWith("radar-phase11-"), "Not the existing Radar Worker");
console.log("PASS preview configuration is private, unexposed, and unbound; this is NOT an accessible Preview.");
