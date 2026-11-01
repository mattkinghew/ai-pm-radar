// P1 routes: reader view (full text, chunked translation, AI summary), highlights, bulk sources, bulk notes, KB search/synthesis.
import { generate } from "./ai.mjs";
import { safeFetchUrl, extractArticle, chunkParagraphs, TRANSLATE_PROMPT, parseTranslation, READER_SUMMARY_PROMPT, parseReaderSummary,
  SYNTH_PROMPT, parseSynthesis, synthesisMarkdown, parseSourceLines, looksLikeFeed, discoverFeed, parseNotes } from "./reader.mjs";

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC } });
const pj = (v, d = null) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };
const AIERR = { ai_daily_cap_reached: [429, "今日 AI 額度已用完（08:00 HKT 重設）；已翻譯/摘要嘅部分已保存"], insufficient_content: [422, "全文太短，AI 未能處理"],
  ai_bad_output: [502, "AI 回覆格式有誤，請稍後再試"], workers_ai_error: [502, "後備 AI 暫時出錯"], gemini_key_missing: [502, "Gemini key 未設定"] };
const aiFail = (e) => { const [st, hint] = AIERR[e.message] || [502, "AI 處理失敗，請稍後再試"]; return json({ error: AIERR[e.message] ? e.message : "ai_error", hint }, st); };
const CHUNK = 2500, PER_CALL = 2;
const KB = "id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,kb_type,source_ids,created_at,updated_at";
const kbShape = (r) => r && ({ ...r, key_points: pj(r.key_points, []), tags: pj(r.tags, []), source_ids: pj(r.source_ids, []) });
export { KB as KB_COLS, kbShape };

function articleView(a, item) {
  const paragraphs = pj(a.paragraphs, []); const translation = pj(a.translation, []);
  return { item_id: a.item_id, url: a.url, status: a.status, title: a.title || item?.title, byline: a.byline, site: a.site, chars: a.chars, error: a.error,
    paragraphs, translation, translated_chunks: a.translated_chunks, total_chunks: a.total_chunks, summary: pj(a.summary), ai_provider: a.ai_provider,
    fallback: a.status !== "ok" ? { excerpt: item?.raw_excerpt || item?.summary || "", note: a.status === "paywall" ? "呢篇似乎有付費牆，只顯示 RSS 摘錄；請撳原文閱讀。" : "未能擷取全文，只顯示 RSS 摘錄；請撳原文閱讀。" } : null };
}

async function loadArticle(db, item, fetchImpl, now, refresh = false) {
  let a = await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first();
  if (a && !refresh) return a;
  const target = safeFetchUrl(item.url); let ex, error = null;
  if (!target || /^https?:\/\/(x|twitter)\.com\//u.test(item.url || "")) { ex = { title: item.title, paragraphs: [], chars: 0, status: "failed" }; error = target ? "x_post" : "unsafe_url"; }
  else {
    try {
      const r = await fetchImpl(target, { headers: { "user-agent": "Mozilla/5.0 (compatible; ai-pm-radar-reader/1)", accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
      const ct = r.headers.get("content-type") || "";
      if (!r.ok) { ex = { paragraphs: [], chars: 0, status: r.status === 402 || r.status === 403 ? "paywall" : "failed" }; error = `http_${r.status}`; }
      else if (!/html|xml/iu.test(ct)) { ex = { paragraphs: [], chars: 0, status: "failed" }; error = "not_html"; }
      else ex = extractArticle(await r.text(), target);
    } catch (e) { ex = { paragraphs: [], chars: 0, status: "failed" }; error = e.name === "TimeoutError" ? "timeout" : "fetch_error"; }
  }
  // Fallback: use RSS excerpt as the "full text" when extraction failed but excerpt is decent.
  const total = ex.status === "ok" ? chunkParagraphs(ex.paragraphs, CHUNK).length : 0;
  await db.prepare(`INSERT INTO articles(item_id,url,status,title,byline,site,paragraphs,chars,error,translation,translated_chunks,total_chunks,summary,ai_provider,fetched_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,'[]',0,?,NULL,NULL,?,?) ON CONFLICT(item_id) DO UPDATE SET status=excluded.status,title=excluded.title,byline=excluded.byline,site=excluded.site,paragraphs=excluded.paragraphs,
    chars=excluded.chars,error=excluded.error,translation='[]',translated_chunks=0,total_chunks=excluded.total_chunks,summary=NULL,updated_at=excluded.updated_at`)
    .bind(item.id, item.url, ex.status, ex.title || null, ex.byline || null, ex.site || null, JSON.stringify(ex.paragraphs), ex.chars, error, total, now, now).run();
  return db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first();
}

export async function handleP1(request, env, deps, url, m, db, now) {
  const fetchImpl = deps.fetchImpl ?? fetch; const p = url.pathname;
  const rd = p.match(/^\/api\/items\/([0-9a-f-]{36})\/reader(?:\/(translate|summary|highlights))?$/u);
  if (rd) {
    const item = await db.prepare("SELECT id,title,url,raw_excerpt,summary,source FROM items WHERE id=?").bind(rd[1]).first(); if (!item) return json({ error: "not_found" }, 404);
    if (!rd[2] && m === "GET") {
      const a = await loadArticle(db, item, fetchImpl, now, url.searchParams.get("refresh") === "1");
      const hl = (await db.prepare("SELECT id,text,note,created_at FROM highlights WHERE item_id=? ORDER BY created_at").bind(item.id).all()).results;
      return json({ article: articleView(a, item), highlights: hl });
    }
    if (rd[2] === "translate" && m === "POST") {
      const a = await loadArticle(db, item, fetchImpl, now); if (a.status !== "ok") return json({ error: "no_full_text", hint: "冇全文可翻譯（付費牆或擷取失敗）" }, 422);
      const paras = pj(a.paragraphs, []); const chunks = chunkParagraphs(paras, CHUNK); const tr = pj(a.translation, []);
      let done = a.translated_chunks, provider = a.ai_provider, err = null;
      for (let k = 0; k < PER_CALL && done < chunks.length; k++) {
        const ch = chunks[done];
        try { const r = await generate(env, TRANSLATE_PROMPT, JSON.stringify({ paragraphs: ch.map((x) => x.text) }), parseTranslation(ch.length), { fetchImpl, maxOut: 3000 }); tr.push(...r.paragraphs); provider = r.provider; done++; }
        catch (e) { err = e; break; }
        await db.prepare("UPDATE articles SET translation=?, translated_chunks=?, ai_provider=?, updated_at=? WHERE item_id=?").bind(JSON.stringify(tr), done, provider, now, item.id).run();
      }
      const view = articleView(await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first(), item);
      if (err) { const r = aiFail(err); const b = await r.json(); return json({ ...b, article: view }, r.status); }
      return json({ article: view });
    }
    if (rd[2] === "summary" && m === "POST") {
      const a = await loadArticle(db, item, fetchImpl, now);
      if (a.summary && url.searchParams.get("refresh") !== "1") return json({ article: articleView(a, item), cached: true });
      const text = a.status === "ok" ? pj(a.paragraphs, []).map((x) => x.text).join("\n\n") : (item.raw_excerpt || item.summary || "");
      if (text.length < 200) return json({ error: "insufficient_content", hint: "內容太短，AI 未能總結；請撳原文閱讀" }, 422);
      try { const s = await generate(env, READER_SUMMARY_PROMPT, `${a.title || item.title}\n${item.url}\n\n${text.slice(0, 11000)}`, parseReaderSummary, { fetchImpl });
        await db.prepare("UPDATE articles SET summary=?, ai_provider=?, updated_at=? WHERE item_id=?").bind(JSON.stringify({ ...s, provider: undefined, partial: text.length > 11000, from_excerpt: a.status !== "ok" }), s.provider, now, item.id).run();
      } catch (e) { return aiFail(e); }
      return json({ article: articleView(await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first(), item) });
    }
    if (rd[2] === "highlights" && m === "POST") {
      const b = await request.json().catch(() => ({})); const text = String(b?.text ?? "").trim().slice(0, 2000); if (text.length < 3) return json({ error: "bad_highlight" }, 400);
      const id = crypto.randomUUID(); await db.prepare("INSERT INTO highlights(id,item_id,text,note,created_at) VALUES(?,?,?,?,?)").bind(id, item.id, text, b?.note ? String(b.note).slice(0, 2000) : null, now).run();
      return json({ highlight: { id, text } }, 201);
    }
  }
  const hd = p.match(/^\/api\/highlights\/([0-9a-f-]{36})$/u);
  if (hd && m === "DELETE") { const r = await db.prepare("DELETE FROM highlights WHERE id=?").bind(hd[1]).run(); return r.meta.changes ? json({ ok: true }) : json({ error: "not_found" }, 404); }

  if (p === "/api/sources/bulk" && m === "POST") {
    const b = await request.json().catch(() => ({})); const rows = parseSourceLines(b?.text);
    if (!rows.length) return json({ error: "empty", hint: "每行一個 https 網址或 @handle" }, 400);
    const existing = new Set((await db.prepare("SELECT type,value FROM sources").all()).results.map((r) => `${r.type}:${r.type === "x" ? r.value.toLowerCase() : r.value}`));
    let checks = 0;
    for (const r of rows) {
      if (r.status !== "pending") continue;
      if (r.type === "rss" && checks < 25) { // validate feed; auto-discover from HTML pages
        checks++;
        const t = safeFetchUrl(r.value);
        if (!t) { r.status = "invalid"; r.error = "網址不允許"; continue; }
        try {
          const res = await fetchImpl(t, { headers: { "user-agent": "ai-pm-radar-cloud/1" }, signal: AbortSignal.timeout(8000) }); const body = res.ok ? await res.text() : "";
          if (res.ok && looksLikeFeed(body)) { /* ok */ }
          else if (res.ok && discoverFeed(body, t)) { r.discovered_from = r.value; r.value = discoverFeed(body, t); }
          else { r.status = "not_feed"; r.error = res.ok ? "唔係 RSS/Atom，亦搵唔到 feed 連結" : `HTTP ${res.status}`; continue; }
        } catch { r.status = "not_feed"; r.error = "連線失敗/逾時"; continue; }
      }
      const key = `${r.type}:${r.type === "x" ? r.value.toLowerCase() : r.value}`;
      r.status = existing.has(key) ? "exists" : "new";
    }
    const seen = new Set(); for (const r of rows) if (r.status === "new") { const k = `${r.type}:${r.value.toLowerCase()}`; if (seen.has(k)) r.status = "duplicate_in_batch"; seen.add(k); }
    if (b?.commit !== true) return json({ preview: rows, counts: rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}) });
    let added = 0; for (const r of rows.filter((x) => x.status === "new")) {
      const res = await db.prepare("INSERT OR IGNORE INTO sources(id,type,value,label,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)").bind(crypto.randomUUID(), r.type, r.value, null, now, now).run();
      if (res.meta.changes) { added++; r.status = "added"; }
    }
    return json({ added, preview: rows }, 201);
  }

  if (p === "/api/kb/import" && m === "POST") {
    const b = await request.json().catch(() => ({})); const notes = parseNotes(b?.text);
    if (!notes.length) return json({ error: "empty", hint: "貼上筆記（用 --- 分隔，或每篇以 # 標題開頭，或每行一條網址）" }, 400);
    if (b?.commit !== true) return json({ preview: notes });
    const ids = []; for (const n of notes) {
      const id = crypto.randomUUID(); ids.push(id);
      await db.prepare(`INSERT INTO kb_entries(id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,kb_type,created_at,updated_at)
        VALUES(?,NULL,?,?,'import','NOTE',NULL,'[]',?,?,NULL,'manual','note',?,?)`).bind(id, n.title, n.url, JSON.stringify(n.tags), n.note, now, now).run();
    }
    return json({ added: ids.length, ids }, 201);
  }
  if (p === "/api/kb" && m === "GET") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100); const tag = (url.searchParams.get("tag") || "").trim().slice(0, 40); const type = url.searchParams.get("type");
    const where = [], args = [];
    if (q) { where.push("(title LIKE ? OR summary LIKE ? OR note LIKE ? OR key_points LIKE ? OR url LIKE ?)"); const l = `%${q.replace(/[%_]/gu, "")}%`; args.push(l, l, l, l, l); }
    if (tag) { where.push("tags LIKE ?"); args.push(`%${JSON.stringify(tag).slice(0, -1)}"%`); }
    if (["item", "note", "synthesis"].includes(type)) { where.push("kb_type=?"); args.push(type); }
    const rows = (await db.prepare(`SELECT ${KB} FROM kb_entries ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY updated_at DESC LIMIT 500`).bind(...args).all()).results.map(kbShape);
    const tags = {}; for (const r of (await db.prepare("SELECT tags FROM kb_entries").all()).results) for (const t of pj(r.tags, [])) tags[t] = (tags[t] || 0) + 1;
    return json({ entries: rows, tags });
  }
  if (p === "/api/kb/synthesize" && m === "POST") {
    const b = await request.json().catch(() => ({})); const ids = Array.isArray(b?.ids) ? [...new Set(b.ids.map(String))].filter((x) => /^[0-9a-f-]{32,36}$/u.test(x)).slice(0, 20) : [];
    if (ids.length < 2) return json({ error: "need_two", hint: "揀最少 2 篇筆記先可以整理" }, 400);
    const rows = (await db.prepare(`SELECT ${KB} FROM kb_entries WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results.map(kbShape).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    if (rows.length < 2) return json({ error: "not_found" }, 404);
    const input = JSON.stringify(rows.map((r, i) => ({ n: i + 1, title: r.title, url: r.url, content: [r.summary, ...(r.key_points || []), r.note].filter(Boolean).join("\n").slice(0, Math.floor(10000 / rows.length)) })));
    let s; try { s = await generate(env, SYNTH_PROMPT, input, parseSynthesis, { fetchImpl, maxOut: 2000 }); } catch (e) { return aiFail(e); }
    const id = crypto.randomUUID(); const tags = [...new Set(rows.flatMap((r) => r.tags || []))].slice(0, 10).concat(["整理"]);
    await db.prepare(`INSERT INTO kb_entries(id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,kb_type,source_ids,created_at,updated_at)
      VALUES(?,NULL,?,NULL,'synthesis','SYNTHESIS',?,?,?,?,NULL,'manual','synthesis',?,?,?)`)
      .bind(id, s.title, s.summary, JSON.stringify(s.insights), JSON.stringify(tags), synthesisMarkdown(s, rows), JSON.stringify(rows.map((r) => r.id)), now, now).run();
    return json({ entry: kbShape(await db.prepare(`SELECT ${KB} FROM kb_entries WHERE id=?`).bind(id).first()), synthesis: s, provider: s.provider }, 201);
  }
  return null;
}
