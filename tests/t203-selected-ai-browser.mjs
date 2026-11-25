// Host-only fixture E2E. Loads the real cloud public app and Worker handler.
// Run outside the restricted Codex sandbox: node tests/t203-selected-ai-browser.mjs
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm, writeFile, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../cloud/src/worker.mjs";
import { fakeD1, accessKit, TEAM, AUD, ownerHash } from "./helpers/cloud-fakes.mjs";

const root = fileURLToPath(new URL("../cloud/public/", import.meta.url));
const chromeBin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mode = process.env.RADAR_TEST_MODE === "neutral" ? "neutral" : "actual";
const kit = accessKit();
const db = fakeD1();
const env = { DB: db, CLOUD_ACCESS_REQUIRED: "true", CF_ACCESS_TEAM_DOMAIN: TEAM,
  CF_ACCESS_AUD: AUD, OWNER_EMAIL_SHA256: ownerHash, GEMINI_API_KEY: "fixture-only-key",
  AI_DAILY_CAP: "4", AI_ANALYSIS_ENABLED: "false" };
const state = { providerCalls: 0, articleFetches: 0, cases: [], articleMode: "initial", recoveryFetches: 0, failProvider: false, authFailure: false };
const long = "Product teams use evidence and explicit review before publishing AI research. ".repeat(8);
const html = `<html lang="en"><head><title>Fixture English article</title></head><body><article>${Array.from({ length: 8 }, (_, i) => `<p>Evidence paragraph ${i}. ${long.slice(0, 75)}</p>`).join("")}</article></body></html>`;
const fixtureFetch = async (target, init = {}) => {
  const url = String(target);
  if (url.includes("generativelanguage.googleapis.com")) {
    state.providerCalls++;
    if (state.failProvider) return new Response("fixture provider failure", { status: 503 });
    const input = JSON.parse(init.body).contents[0].parts[0].text;
    let result;
    if (input.startsWith("你是專業科技譯者")) {
      const paragraphs = JSON.parse(input.split("\n---\n")[1]).paragraphs;
      result = { paragraphs: paragraphs.map((_, i) => `繁體中文翻譯 ${i + 1}`) };
    } else if (input.startsWith("你是 AI PM Radar 的知識編輯")) {
      result = { title_zh: "測試英文文章", tldr: "注入式繁中摘要，供人工核對。", key_points: ["測試重點一", "測試重點二"],
        why_ai_pm: "測試推論", why_side_income: "暫無", actions: ["人工核對"] };
    } else throw new Error("unexpected_fixture_prompt");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }));
  }
  state.articleFetches++;
  if (url === "https://news.example.com/english") {
    if (state.articleMode === "fail") return new Response("denied", { status: 403, headers: { "content-type": "text/html" } });
    if (state.articleMode === "success") return new Response(null, { status: 302, headers: { location: "https://news.example.com/updated" } });
    return new Response(html, { headers: { "content-type": "text/html" } });
  }
  if (url === "https://news.example.com/updated") return new Response(html.replace(' lang="en"', "").replace("Fixture English article", "Fixture updated article"), { headers: { "content-type": "text/html" } });
  if (url === "https://news.example.com/recovery") return ++state.recoveryFetches === 1
    ? new Response("denied", { status: 403, headers: { "content-type": "text/html" } })
    : new Response(html, { headers: { "content-type": "text/html" } });
  if (url === "https://empty.example.com/article") return new Response("<html><body></body></html>", { headers: { "content-type": "text/html" } });
  if (url === "https://timeout.example.com/article") throw Object.assign(new Error("fixture timeout"), { name: "TimeoutError" });
  if (url === "https://large.example.com/article") return new Response("x".repeat(1_000_001), { headers: { "content-type": "text/html" } });
  if (url === "https://pdf.example.com/article") return new Response("%PDF", { headers: { "content-type": "application/pdf" } });
  if (url === "https://blocked.example.com/article") return new Response("denied", { status: 403, headers: { "content-type": "text/html" } });
  throw new Error(`unexpected_fixture_url:${url}`);
};
const authFetch = async () => new Response(kit.jwks, { headers: { "content-type": "application/json" } });
const assets = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"],
  "/app.css": ["app.css", "text/css"], "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json"] };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (mode === "neutral" && path === "/") { response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); response.end("<!doctype html><html><body><main id=neutral-ready>Fixture ready</main></body></html>"); return; }
    if (path.startsWith("/api/")) {
      if (state.authFailure && path.includes("/reader")) { state.authFailure = false; response.writeHead(401, { "content-type": "application/json", "x-radar-fixture": "1" }); response.end(JSON.stringify({ error: "unauthorized" })); return; }
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const headers = new Headers(request.headers); headers.set("Cf-Access-Jwt-Assertion", kit.token());
      const workerRequest = new Request(`https://radar.fixture${request.url}`, { method: request.method, headers,
        ...(body.length ? { body } : {}) });
      const result = await handle(workerRequest, env, { authFetch, fetchImpl: fixtureFetch });
      response.writeHead(result.status, { "content-type": "application/json", "cache-control": "no-store", "x-radar-fixture": "1" });
      response.end(Buffer.from(await result.arrayBuffer())); return;
    }
    const asset = assets[path]; if (!asset) { response.writeHead(404); response.end(); return; }
    const bytes = await readFile(join(root, asset[0]));
    response.writeHead(200, { "content-type": `${asset[1]}; charset=utf-8`, "cache-control": "no-store" }); response.end(bytes);
  } catch (error) { response.writeHead(500); response.end(String(error?.message || "fixture_error")); }
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ownedTree = (pid) => {
  const tree = [{ pid, ppid: process.pid }];
  for (let i = 0; i < tree.length && i < 30; i++) {
    let children = []; try { children = execFileSync("/usr/bin/pgrep", ["-P", String(tree[i].pid)], { encoding: "utf8" }).trim().split(/\s+/u).filter(Boolean); } catch { /* No children. */ }
    for (const child of children) tree.push({ pid: Number(child), ppid: tree[i].pid });
  }
  return tree;
};
const deadline = (promise, label, ms = 5000) => Promise.race([promise, delay(ms).then(() => { throw new Error(`timeout:${label}`); })]);
async function waitFor(check, label, timeout = 10000) {
  const start = Date.now(); while (Date.now() - start < timeout) { const result = await deadline(Promise.resolve().then(check), label, Math.min(2000, timeout)); if (result) return result; await delay(80); }
  throw new Error(`timeout:${label}`);
}
async function connectCdp(url) {
  const ws = new WebSocket(url); const pending = new Map(); let nextId = 0;
  await deadline(new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }), "cdp_connect");
  ws.onmessage = ({ data }) => { const msg = JSON.parse(data); const task = pending.get(msg.id); if (!task) return;
    pending.delete(msg.id); msg.error ? task.reject(new Error(msg.error.message)) : task.resolve(msg.result); };
  const send = (method, params = {}) => deadline(new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }), `cdp_${method}`);
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser_exception"); return result.result?.value; };
  return { ws, send, evaluate };
}
async function main() {
  const temp = await mkdtemp(join(tmpdir(), "radar-t203-")); let chrome, cdp, stderr;
  const report = { status: "Unknown", surface: "cloud/public/index.html + app.js + cloud/src/worker.mjs", fixture: true,
    mode, origin: null, provider_calls: 0, article_fetches: 0, cases: state.cases, stages: {}, build_identity: {} };
  try {
    for (const path of ["index.html", "app.js"]) report.build_identity[path] = createHash("sha256").update(await readFile(join(root, path))).digest("hex");
    report.build_identity["worker.mjs"] = createHash("sha256").update(await readFile(fileURLToPath(new URL("../cloud/src/worker.mjs", import.meta.url)))).digest("hex");
    await deadline(new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); }), "server_listen");
    const origin = `http://127.0.0.1:${server.address().port}`; report.origin = origin;
    const ready = await deadline(fetch(origin), "server_http");
    if (ready.status !== 200) throw new Error(`server_http_${ready.status}`);
    report.stages.server_http = 200;
    stderr = await open(join(temp, "chrome-stderr.log"), "w");
    const argv = [`--user-data-dir=${temp}`, "--use-mock-keychain", "--headless=new", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-extensions", "--remote-debugging-port=0", origin];
    chrome = spawn(chromeBin, argv, { stdio: ["ignore", "ignore", stderr.fd], env: { HOME: temp, TMPDIR: temp, PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" } });
    chrome.on("error", (error) => { report.browser_spawn_error = String(error.message); });
    report.browser = { pid: chrome.pid, parent_pid: process.pid, executable: chromeBin, argv, profile: temp, stderr: join(temp, "chrome-stderr.log") };
    const portFile = join(temp, "DevToolsActivePort");
    const port = await waitFor(async () => { try { return Number((await readFile(portFile, "utf8")).split("\n")[0]) || null; } catch { return null; } }, "chrome_debug_port");
    report.stages.cdp_port = port;
    const page = await waitFor(async () => { try { const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      return pages.find((x) => x.type === "page" && x.url.startsWith(origin)); } catch { return null; } }, "approved_app_tab");
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    report.stages.cdp_connected = true;
    report.page_errors = [];
    cdp.ws.addEventListener("message", ({ data }) => { try { const message = JSON.parse(data);
      if (message.method === "Runtime.exceptionThrown" && report.page_errors.length < 10)
        report.page_errors.push(String(message.params?.exceptionDetails?.text || "browser_exception").slice(0, 300));
    } catch { /* CDP diagnostics are best effort. */ } });
    try {
      await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
      const evalJs = cdp.evaluate;
      const until = (expr, label) => waitFor(() => evalJs(expr), label);
      await until(mode === "neutral" ? 'Boolean(document.querySelector("#neutral-ready"))' : 'Boolean(document.querySelector("nav [data-tab=capture]") && document.querySelector("#view") && document.querySelector("#reader"))', mode === "neutral" ? "neutral_dom_loaded" : "real_app_loaded");
      report.stages[mode === "neutral" ? "neutral_dom_loaded" : "real_app_loaded"] = true;
      report.stages.document_url = await evalJs("location.href");
      if (report.stages.document_url.startsWith("chrome-error:")) throw new Error("chrome_error_page");
      if (process.env.RADAR_TEST_REPORT) { const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
        report.ready_screenshot = `${process.env.RADAR_TEST_REPORT}.ready.png`; await writeFile(report.ready_screenshot, Buffer.from(shot.data, "base64")); }
      if (mode === "neutral") { report.cases.push("neutral_http_cdp_dom_ready"); report.status = "Completed"; return; }
      const capture = async ({ url = "", text = "", language = "unknown" }) => {
        await evalJs('document.querySelector("nav [data-tab=capture]").click()');
        await until('document.querySelector("#cap-form") !== null', "capture_form");
        await evalJs(`(() => { const f=document.querySelector('#cap-form'); f.elements.url.value=${JSON.stringify(url)}; f.elements.text.value=${JSON.stringify(text)}; f.elements.source_language.value=${JSON.stringify(language)}; f.requestSubmit(); })()`);
        await until('document.querySelector("#reader") && !document.querySelector("#reader").hidden && document.querySelector(".r-body") && !document.querySelector(".r-body").textContent.includes("擷取全文中")', "reader_open");
      };
      const readerText = () => evalJs('document.querySelector("#reader").innerText');
      const click = (selector) => evalJs(`document.querySelector(${JSON.stringify(selector)}).click()`);
      const close = async () => { await click(".r-close"); await until('document.querySelector("#reader").hidden', "reader_closed"); };
      await capture({ text: long, language: "en" });
      let shown = await readerText(); assert.match(shown, /FIXTURE 測試資料/u); assert.match(shown, /原文語言：en（user_declared）/u);
      assert.match(shown, /來源摘錄（原文，未經 AI）/u); assert.match(shown, /擷取正文（原文）/u);
      assert.equal(state.providerCalls, 0); state.cases.push("manual_capture_no_ai");
      await click("[data-rsum]"); await until('document.querySelector(".r-sum") !== null', "manual_summary");
      await click("[data-rtr]"); await until('document.querySelector(".para .zh") !== null', "manual_translation");
      shown = await readerText(); assert.match(shown, /AI 繁中摘要/u); assert.match(shown, /繁體中文翻譯/u);
      assert.equal(state.providerCalls, 2); state.cases.push("manual_selected_summary_translation");
      await cdp.send("Page.reload", { ignoreCache: true });
      await until('document.querySelector("nav [data-tab=draft]") !== null', "reload");
      await click("nav [data-tab=draft]"); await until('document.querySelector("[data-read]") !== null', "draft_reload");
      await click("[data-read]"); await until('document.querySelector(".r-sum") !== null', "stored_summary_reload");
      shown = await readerText(); assert.match(shown, /繁體中文翻譯/u); assert.match(shown, /FIXTURE 測試資料/u);
      assert.equal(state.providerCalls, 2); state.cases.push("reload_keeps_distinct_layers"); await close();
      await capture({ url: "https://news.example.com/english" });
      shown = await readerText(); assert.match(shown, /原文語言：en（html_lang）/u); assert.match(shown, /原始 URL：https:\/\/news.example.com\/english/u);
      assert.equal(state.providerCalls, 2); await click("[data-rsum]"); await until('document.querySelector(".r-sum") !== null', "url_summary");
      await click("[data-rtr]"); await until('document.querySelector(".para .zh") !== null', "url_translation");
      assert.equal(state.providerCalls, 4); state.cases.push("url_selected_extract_summary_translation");
      state.articleMode = "fail"; const beforeFailure = state.articleFetches;
      await click("[data-rrefresh]"); await until('document.querySelector(".r-bar")?.textContent.includes("http_403")', "refresh_failure");
      shown = await readerText(); assert.match(shown, /付費牆/u); assert.doesNotMatch(shown, /注入式繁中摘要|繁體中文翻譯/u);
      assert.equal(state.articleFetches, beforeFailure + 1); assert.equal(state.providerCalls, 4);
      state.cases.push("refresh_failure_invalidates_old_ai");
      state.articleMode = "success";
      await click("[data-rrefresh]"); await until('document.querySelector(".r-body")?.textContent.includes("Fixture updated article")', "refresh_success");
      shown = await readerText(); assert.match(shown, /原文語言：unknown（unknown）/u);
      assert.match(shown, /最終 URL：https:\/\/news.example.com\/updated/u);
      assert.doesNotMatch(shown, /注入式繁中摘要|繁體中文翻譯/u);
      const afterSuccess = state.articleFetches; await close();
      await click("nav [data-tab=draft]"); await until('document.querySelector("[data-read]") !== null', "draft_cached");
      await click("[data-read]"); await until('document.querySelector(".r-body")?.textContent.includes("Fixture updated article")', "cached_reader");
      assert.equal(state.articleFetches, afterSuccess); assert.equal(state.providerCalls, 4);
      state.cases.push("refresh_success_provenance_and_cache_hit"); await close();
      await capture({ url: "https://news.example.com/recovery" });
      shown = await readerText(); assert.match(shown, /http_403/u); assert.equal(state.recoveryFetches, 1);
      await click("[data-rrefresh]"); await until('document.querySelector(".r-body")?.textContent.includes("Fixture English article")', "failed_capture_retry");
      assert.equal(state.recoveryFetches, 2); assert.equal(state.providerCalls, 4);
      state.cases.push("failed_capture_retry_success"); await close();
      await capture({ text: long, url: "https://news.example.com/english", language: "zh-Hant" });
      shown = await readerText(); assert.match(shown, /原文語言：zh-Hant（user_declared）/u);
      assert.match(shown, /手動提供正文（user_supplied/u);
      assert.match(shown, /原始 URL：https:\/\/news.example.com\/english/u);
      assert.match(shown, /先前來源與 AI 歷史（1）/u);
      assert.match(shown, /Product teams use evidence/u);
      assert.doesNotMatch(shown, /注入式繁中摘要|繁體中文翻譯/u);
      assert.equal(await evalJs('document.querySelector("[data-rrefresh]") === null'), true);
      assert.equal(state.articleFetches, afterSuccess + 2);
      state.cases.push("manual_text_authoritative_no_refresh"); await close();
      const duplicate = await evalJs(`(async () => { const body={url:"https://news.example.com/english",text:${JSON.stringify(long)},source_language:"zh-Hant"}; const r=await fetch("/api/capture",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}); return {status:r.status,body:await r.json()}; })()`);
      assert.equal(duplicate.status, 200); assert.equal(duplicate.body.result, "duplicate");
      assert.equal(duplicate.body.ai_calls, 0); state.cases.push("same_url_exact_replay_no_new_record");
      const enriched = await evalJs(`(async () => { const r=await fetch("/api/items/${duplicate.body.id}/reader"); return (await r.json()).article; })()`);
      assert.equal(enriched.capture_history.length, 1);
      assert.match(JSON.stringify(enriched.capture_history[0]), /Fixture updated article/u);
      assert.equal(enriched.summary, null); assert.deepEqual(enriched.translation, []);
      state.cases.push("manual_audit_and_old_ai_invalidation");
      const invalid = await evalJs(`(async () => { const r=await fetch("/api/capture",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"file:///private",text:"keep pasted text"})}); return {status:r.status,body:await r.json()}; })()`);
      assert.equal(invalid.status, 400); assert.equal(invalid.body.error, "bad_url");
      state.cases.push("capture_invalid_input_rejected");
      const concurrent = await evalJs(`(async () => { const body=JSON.stringify({url:"https://news.example.com/concurrent"}); return Promise.all(Array.from({length:6},async () => {const r=await fetch("/api/capture",{method:"POST",headers:{"content-type":"application/json"},body});return {status:r.status,body:await r.json()};})); })()`);
      assert.deepEqual(concurrent.map((x) => x.status).sort(), [200, 200, 200, 200, 200, 201]);
      assert.equal(new Set(concurrent.map((x) => x.body.id)).size, 1); assert.equal(state.providerCalls, 4);
      state.cases.push("concurrent_same_url_one_record");
      for (const [url, error] of [["http://127.0.0.1/admin", "unsafe_url"], ["https://large.example.com/article", "response_too_large"],
        ["https://pdf.example.com/article", "not_html"], ["https://blocked.example.com/article", "http_403"]]) {
        await capture({ url }); shown = await readerText(); assert.match(shown, new RegExp(error));
        await click("[data-rsum]"); await until('document.querySelector("#reader [role=alert]") !== null', `error_${error}`);
        assert.equal(state.providerCalls, 4, `provider called for ${error}`); await close();
      }
      state.cases.push("unsafe_oversize_nonhtml_403_zero_ai");
      for (const [url, error] of [["https://empty.example.com/article", "擷取失敗"], ["https://timeout.example.com/article", "timeout"]]) {
        await capture({ url }); shown = await readerText(); assert.match(shown, new RegExp(error));
        assert.equal(state.providerCalls, 4); await close();
      }
      state.cases.push("empty_timeout_zero_ai");
      await capture({ text: long, language: "en" });
      await click("[data-rsum]"); await until('document.querySelector("#reader [role=alert]") !== null', "quota_guard");
      shown = await readerText(); assert.match(shown, /額度已用完/u); assert.equal(state.providerCalls, 4);
      state.cases.push("quota_guard_zero_extra_ai");
      await close(); env.AI_DAILY_CAP = "5"; state.failProvider = true;
      await capture({ text: long, language: "en" }); await click("[data-rsum]");
      await until('document.querySelector("#reader [role=alert]") !== null', "provider_failure");
      shown = await readerText(); assert.match(shown, /AI 處理失敗|AI 暫時出錯/u);
      assert.equal(state.providerCalls, 5); state.failProvider = false;
      state.cases.push("provider_failure_fixture_only"); await close();
      await capture({ url: "https://news.example.com/recovery" }); state.authFailure = true;
      await click("[data-rrefresh]"); await until('document.querySelector("#reader [role=alert]") !== null', "auth_failure");
      shown = await readerText(); assert.match(shown, /登入已過期/u);
      assert.equal(state.providerCalls, 5); state.cases.push("auth_failure_fixture_only"); await close();
      report.status = "Completed";
      if (process.env.RADAR_TEST_REPORT) { const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
        report.complete_screenshot = `${process.env.RADAR_TEST_REPORT}.complete.png`; await writeFile(report.complete_screenshot, Buffer.from(shot.data, "base64")); }
    } finally { cdp.ws.close(); }
  } catch (error) { report.status = "Partial"; report.error = String(error?.stack || error); process.exitCode = 1;
    if (cdp) {
      try {
        report.failure_dom = await deadline(cdp.evaluate("document.documentElement?.outerHTML?.slice(0, 12000) || ''"), "failure_dom", 3000);
        const shot = await deadline(cdp.send("Page.captureScreenshot", { format: "png" }), "failure_screenshot", 3000);
        if (shot?.data && process.env.RADAR_TEST_REPORT) { report.failure_screenshot = `${process.env.RADAR_TEST_REPORT}.png`; await deadline(writeFile(report.failure_screenshot, Buffer.from(shot.data, "base64")), "failure_screenshot_write", 3000); }
      } catch (diagnosticError) { report.failure_collection_error = String(diagnosticError?.message || diagnosticError); }
    }
  }
  finally {
    report.provider_calls = state.providerCalls; report.article_fetches = state.articleFetches;
    if (chrome?.pid) report.browser_tree_before_cleanup = ownedTree(chrome.pid);
    if (chrome && chrome.exitCode === null && chrome.signalCode === null) { chrome.kill("SIGTERM");
      await deadline(new Promise((resolve) => chrome.once("exit", resolve)), "browser_reap", 5000).catch((e) => { report.cleanup_error = String(e.message); report.remaining_owned_pid = chrome.pid; process.exitCode = 1; }); }
    report.browser_exit = chrome ? { code: chrome.exitCode, signal: chrome.signalCode } : null;
    if (report.browser_tree_before_cleanup?.length > 1) { await delay(300);
      report.children_still_present = report.browser_tree_before_cleanup.slice(1).filter(({ pid }) => { try { process.kill(pid, 0); return true; } catch { return false; } });
      if (report.children_still_present.length) { report.cleanup_error = "owned_browser_children_still_present"; process.exitCode = 1; } }
    if (server.listening) await deadline(new Promise((resolve) => server.close(resolve)), "server_close", 5000).catch((e) => { report.server_cleanup_error = String(e.message); process.exitCode = 1; });
    if (stderr) await stderr.close();
    if (process.env.RADAR_TEST_REPORT && stderr) { const path = `${process.env.RADAR_TEST_REPORT}.stderr.log`;
      if (report.browser) report.browser.stderr_artifact = path;
      await writeFile(path, await readFile(join(temp, "chrome-stderr.log"))); }
    if (process.env.RADAR_TEST_REPORT) await writeFile(process.env.RADAR_TEST_REPORT, JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.remaining_owned_pid && !report.children_still_present?.length) await rm(temp, { recursive: true, force: true });
  }
}
await main();
