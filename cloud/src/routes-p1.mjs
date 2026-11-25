// P1 routes: reader view (full text, chunked translation, AI summary), highlights, bulk sources, bulk notes, KB search/synthesis.
import { generate, classifyAiFailure, targetLanguageFor } from "./ai.mjs";
import { canonicalSourceValue, parseSourceImport, validateSourceImportRow } from "./source-import.mjs";
import { safeFetchUrl, extractArticle, chunkParagraphs, TRANSLATE_PROMPT, parseTranslation, READER_SUMMARY_PROMPT, parseReaderSummary,
  SYNTH_PROMPT, parseSynthesis, synthesisMarkdown, parseSourceLines, looksLikeFeed, discoverFeed, parseNotes } from "./reader.mjs";
import { fetchRestricted, RADAR_FETCH_HOSTS } from "./safe-fetch.mjs";

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC } });
const pj = (v, d = null) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };
const aiFail = (e) => { const failure = classifyAiFailure(e); const status = failure.code === "cap_reached" ? 429 : failure.code === "insufficient_content" || failure.code === "no_full_text" ? 422 : failure.code === "stale_source" ? 409 : 502; return json({ error: failure.code, code: failure.code, provider: failure.provider, provider_status: failure.status, retryable: failure.retryable, hint: failure.hint }, status); };
const sourceErrorCode = (error) => error === "unsafe_redirect" || error === "unsafe_url" ? "unsafe_redirect" : error === "timeout" ? "timeout" : error ? "no_full_text" : null;
const CHUNK = 2500, PER_CALL = 2;
const MAX_ARTICLE_BYTES = 1_000_000;
const MAX_ARTICLE_REDIRECTS = 3;
const SOURCE_IMPORT_BATCH = 10;
const staleArticle = () => json({ error: "stale_source", code: "stale_source", hint: "來源正文已更新，請重新載入後再試" }, 409);

async function sourceImportPreview(db, parsed) {
  const existingRows = (await db.prepare("SELECT type,adapter_type,value,canonical_value FROM sources").all()).results || [];
  const existing = new Set();
  for (const source of existingRows) {
    const type = source.type === "x" || source.adapter_type === "x" ? "x" : source.adapter_type || source.type;
    existing.add(`${type}:${canonicalSourceValue(type, source.value)}`);
    if (source.canonical_value) existing.add(`${type}:${source.canonical_value}`);
  }
  const seen = new Set();
  const rows = parsed.rows.map((row) => {
    if (row.status === "needs_map") return { ...row, canonical_value: null, status: "needs_map", error: "needs_map" };
    if (row.status === "invalid") return { ...row, canonical_value: null, status: "invalid", error: row.error || "invalid_source" };
    const valid = validateSourceImportRow(row);
    if (valid.error) return { ...row, ...valid, status: "invalid", error: valid.error };
    if (row.status === "duplicate_in_batch") return { ...valid, line: row.line, status: "duplicate_in_batch" };
    const key = `${valid.type}:${valid.canonical_value}`;
    if (seen.has(key)) return { ...valid, line: row.line, status: "duplicate_in_batch" };
    seen.add(key);
    return { ...valid, line: row.line, status: existing.has(key) ? "exists" : "new" };
  });
  return rows;
}

async function sourceImportJobView(db, id) {
  const job = await db.prepare("SELECT * FROM source_import_jobs WHERE id=?").bind(id).first();
  if (!job) return null;
  const rows = (await db.prepare("SELECT id,position,adapter_type,value,label,opml_category,status,error_code FROM source_import_rows WHERE job_id=? ORDER BY position").bind(id).all()).results || [];
  const counts = Object.fromEntries(["pending", "added", "exists", "duplicate_in_batch", "invalid", "failed"].map((status) => [status, rows.filter((row) => row.status === status).length]));
  return { ...job, processed: job.total - counts.pending, counts, rows };
}

async function fetchArticleHtml(initialUrl, fetchImpl) {
  let target = initialUrl;
  for (let redirects = 0; redirects <= MAX_ARTICLE_REDIRECTS; redirects++) {
    const response = await fetchImpl(target, { headers: { "user-agent": "Mozilla/5.0 (compatible; ai-pm-radar-reader/1)", accept: "text/html,application/xhtml+xml" }, redirect: "manual", signal: AbortSignal.timeout(12000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next = location && safeFetchUrl(new URL(location, target).toString());
      if (!next || redirects === MAX_ARTICLE_REDIRECTS) return { error: "unsafe_redirect" };
      target = next;
      continue;
    }
    if (!response.ok) return { error: `http_${response.status}`, status: response.status === 402 || response.status === 403 ? "paywall" : "failed" };
    if (!/^text\/html(?:;|$)|^application\/xhtml\+xml(?:;|$)/iu.test(response.headers.get("content-type") || "")) return { error: "not_html" };
    if (Number(response.headers.get("content-length")) > MAX_ARTICLE_BYTES) return { error: "response_too_large" };
    const reader = response.body?.getReader();
    if (!reader) return { error: "empty_body" };
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_ARTICLE_BYTES) { await reader.cancel(); return { error: "response_too_large" }; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return { html: new TextDecoder().decode(body), url: target };
  }
  return { error: "unsafe_redirect" };
}
const KB = "id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,kb_type,source_ids,created_at,updated_at";
const kbShape = (r) => r && ({ ...r, key_points: pj(r.key_points, []), tags: pj(r.tags, []), source_ids: pj(r.source_ids, []) });
export { KB as KB_COLS, kbShape };

function sourceTypeForArticle(a, item) {
  return item?.source_type || (a.site === "manual_text" ? "manual_text" : item?.kind === "capture" ? "selected_url" : "unknown");
}

function articleView(a, item, targetLanguage = "zh-Hant") {
  const paragraphs = pj(a.paragraphs, []); const translation = pj(a.translation, []);
  const language = pj(item?.metrics, {});
  return { item_id: a.item_id, url: a.url, original_url: item?.url || null, source_excerpt: item?.raw_excerpt || null, title_source: a.title_source || null,
    source_type: sourceTypeForArticle(a, item), captured_at: a.fetched_at,
    source_language: language.source_language || "unknown", language_provenance: language.language_provenance || "unknown",
    capture_history: Array.isArray(language.capture_history) ? language.capture_history : [],
    translation_target: "body", translation_language: language.target_language || targetLanguage, translation_provider: language.translation_provider || null,
    translation_model: language.translation_model || a.translation_model || null,
    status: a.status, title: a.title || item?.title, byline: a.byline, site: a.site, chars: a.chars, error: a.error, error_code: a.error_code || sourceErrorCode(a.error),
    content_basis: a.content_basis || (a.status === "ok" ? "full_text" : "insufficient"), ai_model: a.ai_model || null,
    paragraphs, translation, translated_chunks: a.translated_chunks, total_chunks: a.total_chunks, summary: pj(a.summary), ai_provider: a.ai_provider,
    fallback: a.status !== "ok" ? { excerpt: item?.raw_excerpt || "", note: a.status === "paywall" ? "呢篇似乎有付費牆，只顯示 RSS 摘錄；請撳原文閱讀。" : "未能擷取全文，只顯示 RSS 摘錄；請撳原文閱讀。" } : null };
}

async function loadArticle(db, item, fetchImpl, now, refresh = false) {
  let a = await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first();
  if (a && (!refresh || a.site === "manual_text")) return a;
  const originalMetrics = item.metrics;
  const sourceSnapshot = { title: item.title, url: item.url, raw_excerpt: item.raw_excerpt, updated_at: item.updated_at };
  const target = safeFetchUrl(item.url); let ex, error = null;
  if (!target || /^https?:\/\/(x|twitter)\.com\//u.test(item.url || "")) { ex = { title: item.title, title_source: item.title_source || null, paragraphs: [], chars: 0, status: "failed" }; error = target ? "x_post" : "unsafe_url"; }
  else {
    try {
      const result = await fetchArticleHtml(target, fetchImpl);
      if (result.error) { ex = { title: item.title, title_source: item.title_source || null, paragraphs: [], chars: 0, status: result.status || "failed" }; error = result.error; }
      else {
        ex = { ...extractArticle(result.html, result.url), finalUrl: result.url };
        const declared = pj(item.metrics, {});
        if (!declared.source_language || declared.source_language === "unknown" || declared.language_provenance === "html_lang") {
          const htmlLang = result.html.match(/<html\b[^>]*\blang=["']([^"']+)["']/iu)?.[1]?.trim();
          if (htmlLang && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu.test(htmlLang)) {
            item.metrics = JSON.stringify({ ...declared, source_language: htmlLang, language_provenance: "html_lang" });
          } else if (a && refresh && declared.language_provenance === "html_lang") {
            item.metrics = JSON.stringify({ ...declared, source_language: "unknown", language_provenance: "unknown" });
          }
        }
      }
    } catch (e) { ex = { paragraphs: [], chars: 0, status: "failed" }; error = e.name === "TimeoutError" ? "timeout" : "fetch_error"; }
  }
  if (a && refresh) {
    const metadata = pj(item.metrics, {});
    delete metadata.translation_provider;
    if (ex.status !== "ok" && metadata.language_provenance === "html_lang") {
      metadata.source_language = "unknown";
      metadata.language_provenance = "unknown";
    }
    item.metrics = JSON.stringify(metadata);
  }
  // Fallback: use RSS excerpt as the "full text" when extraction failed but excerpt is decent.
  const total = ex.status === "ok" ? chunkParagraphs(ex.paragraphs, CHUNK).length : 0;
  const contentBasis = ex.status === "ok" ? "full_text" : "insufficient";
  const [articleWrite] = await db.batch([
    db.prepare(`INSERT INTO articles(item_id,url,status,title,byline,site,paragraphs,chars,error,translation,translated_chunks,total_chunks,summary,ai_provider,fetched_at,updated_at,title_source,error_code,content_basis)
      SELECT id,?,?,?,?,?,?,?,?,'[]',0,?,NULL,NULL,?,?,?,?,? FROM items WHERE id=? AND metrics IS ? AND title IS ? AND url IS ? AND raw_excerpt IS ? AND updated_at IS ?
      ON CONFLICT(item_id) DO UPDATE SET url=excluded.url,status=excluded.status,title=excluded.title,byline=excluded.byline,site=excluded.site,paragraphs=excluded.paragraphs,
      title_source=excluded.title_source,
      chars=excluded.chars,error=excluded.error,error_code=excluded.error_code,content_basis=excluded.content_basis,ai_model=NULL,translation_model=NULL,translation='[]',translated_chunks=0,total_chunks=excluded.total_chunks,summary=NULL,ai_provider=NULL,fetched_at=excluded.fetched_at,updated_at=excluded.updated_at
      WHERE articles.updated_at IS ? AND articles.paragraphs IS ? AND EXISTS(SELECT 1 FROM items WHERE id=? AND metrics IS ? AND title IS ? AND url IS ? AND raw_excerpt IS ? AND updated_at IS ?)`)
      .bind(ex.finalUrl || item.url, ex.status, ex.title || null, ex.byline || null, ex.site || null, JSON.stringify(ex.paragraphs), ex.chars, error, total, now, now, ex.title_source || null,
        sourceErrorCode(error), contentBasis, item.id, originalMetrics, sourceSnapshot.title, sourceSnapshot.url, sourceSnapshot.raw_excerpt, sourceSnapshot.updated_at,
        a?.updated_at || null, a?.paragraphs || null, item.id, originalMetrics, sourceSnapshot.title, sourceSnapshot.url, sourceSnapshot.raw_excerpt, sourceSnapshot.updated_at),
    db.prepare("UPDATE items SET metrics=? WHERE id=? AND metrics IS ? AND title IS ? AND url IS ? AND raw_excerpt IS ? AND updated_at IS ? AND EXISTS(SELECT 1 FROM articles WHERE item_id=? AND paragraphs IS ? AND updated_at IS ?)")
      .bind(item.metrics, item.id, originalMetrics, sourceSnapshot.title, sourceSnapshot.url, sourceSnapshot.raw_excerpt, sourceSnapshot.updated_at, item.id, JSON.stringify(ex.paragraphs), now),
  ]);
  if (!articleWrite.meta.changes) throw new Error("stale_source");
  return db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first();
}

export async function handleP1(request, env, deps, url, m, db, now) {
  const fetchImpl = deps.fetchImpl ?? fetch; const p = url.pathname;
  const rd = p.match(/^\/api\/items\/([0-9a-f-]{36})\/reader(?:\/(translate|summary|highlights))?$/u);
  if (rd) {
    const item = await db.prepare("SELECT id,kind,title,url,raw_excerpt,summary,source,source_type,metrics,updated_at FROM items WHERE id=?").bind(rd[1]).first(); if (!item) return json({ error: "not_found" }, 404);
    if (!rd[2] && m === "GET") {
      const a = await loadArticle(db, item, fetchImpl, now, url.searchParams.get("refresh") === "1").catch((e) => { if (e.message === "stale_source") return null; throw e; });
      if (!a) return staleArticle();
      const hl = (await db.prepare("SELECT id,text,note,created_at FROM highlights WHERE item_id=? ORDER BY created_at").bind(item.id).all()).results;
      return json({ article: articleView(a, item, targetLanguageFor(env)), highlights: hl });
    }
    if (rd[2] === "translate" && m === "POST") {
      const a = await loadArticle(db, item, fetchImpl, now).catch((e) => { if (e.message === "stale_source") return null; throw e; }); if (!a) return staleArticle();
      if (a.status !== "ok") return json({ error: "no_full_text", code: "no_full_text", hint: "冇全文可翻譯（付費牆或擷取失敗）" }, 422);
      const paras = pj(a.paragraphs, []); if (paras.map((x) => x.text).join("\n").length < 200) return json({ error: "insufficient_content", code: "insufficient_content", hint: "正文太短，請補充可核對內容" }, 422);
      const chunks = chunkParagraphs(paras, CHUNK); const tr = pj(a.translation, []);
      let done = a.translated_chunks, provider = a.ai_provider, translationModel = a.translation_model || null, err = null;
      for (let k = 0; k < PER_CALL && done < chunks.length; k++) {
        const ch = chunks[done];
        try { const r = await generate(env, TRANSLATE_PROMPT, JSON.stringify({ paragraphs: ch.map((x) => x.text) }), parseTranslation(ch.length), { fetchImpl, maxOut: 3000 }); tr.push(...r.paragraphs); provider = r.provider; translationModel = r.model || null; done++; }
        catch (e) { err = e; break; }
        const metadata = JSON.stringify({ ...pj(item.metrics, {}), translation_provider: provider, translation_model: translationModel || null, target_language: targetLanguageFor(env) });
        const [itemWrite, articleWrite] = await db.batch([
          db.prepare("UPDATE items SET metrics=? WHERE id=? AND metrics IS ? AND title IS ? AND url IS ? AND raw_excerpt IS ? AND updated_at IS ? AND EXISTS(SELECT 1 FROM articles WHERE item_id=? AND updated_at IS ? AND paragraphs IS ? AND translation IS ?)")
            .bind(metadata, item.id, item.metrics, item.title, item.url, item.raw_excerpt, item.updated_at, item.id, a.updated_at, a.paragraphs, a.translation),
          db.prepare("UPDATE articles SET translation=?, translated_chunks=?, ai_provider=?, translation_model=?, content_basis='full_text',error_code=NULL,updated_at=? WHERE item_id=? AND updated_at IS ? AND paragraphs IS ? AND translation IS ? AND EXISTS(SELECT 1 FROM items WHERE id=? AND metrics=? AND title IS ? AND url IS ? AND raw_excerpt IS ? AND updated_at IS ?)")
            .bind(JSON.stringify(tr), done, provider, translationModel || null, now, item.id, a.updated_at, a.paragraphs, a.translation, item.id, metadata, item.title, item.url, item.raw_excerpt, item.updated_at),
        ]);
        if (!itemWrite.meta.changes || !articleWrite.meta.changes) return staleArticle();
        item.metrics = metadata; a.translation = JSON.stringify(tr); a.updated_at = now;
      }
      const view = articleView(await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first(), item, targetLanguageFor(env));
      if (err) { const r = aiFail(err); const b = await r.json(); return json({ ...b, article: view }, r.status); }
      return json({ article: view });
    }
    if (rd[2] === "summary" && m === "POST") {
      const a = await loadArticle(db, item, fetchImpl, now).catch((e) => { if (e.message === "stale_source") return null; throw e; });
      if (!a) return staleArticle();
      if (a.summary && url.searchParams.get("refresh") !== "1") return json({ article: articleView(a, item, targetLanguageFor(env)), cached: true });
      if (a.status !== "ok") return json({ error: "no_full_text", code: "no_full_text", hint: "未擷取到可核對正文；RSS 摘錄不能當作全文做 AI 總結" }, 422);
      const text = pj(a.paragraphs, []).map((x) => x.text).join("\n\n");
      if (text.length < 200) return json({ error: "insufficient_content", code: "insufficient_content", hint: "內容太短，AI 未能總結；請撳原文閱讀" }, 422);
      try { const s = await generate(env, READER_SUMMARY_PROMPT, `${a.title || item.title}\n${item.url}\n\n${text.slice(0, 11000)}`, parseReaderSummary, { fetchImpl });
        const enrichedSummary = { ...s, provider: s.provider, model: s.model || null, source_type: sourceTypeForArticle(a, item), content_basis: "full_text", partial: text.length > 11000, from_excerpt: false };
        const changed = await db.prepare("UPDATE articles SET summary=?, ai_provider=?, ai_model=?,content_basis='full_text',error_code=NULL,updated_at=? WHERE item_id=? AND updated_at IS ? AND paragraphs IS ? AND summary IS ? AND EXISTS(SELECT 1 FROM items WHERE id=? AND metrics IS ? AND title IS ? AND url IS ? AND raw_excerpt IS ? AND updated_at IS ?)")
          .bind(JSON.stringify(enrichedSummary), s.provider, s.model || null, now, item.id, a.updated_at, a.paragraphs, a.summary, item.id, item.metrics, item.title, item.url, item.raw_excerpt, item.updated_at).run();
        if (!changed.meta.changes) return staleArticle();
      } catch (e) { return aiFail(e); }
      return json({ article: articleView(await db.prepare("SELECT * FROM articles WHERE item_id=?").bind(item.id).first(), item, targetLanguageFor(env)) });
    }
    if (rd[2] === "highlights" && m === "POST") {
      const b = await request.json().catch(() => ({})); const text = String(b?.text ?? "").trim().slice(0, 2000); if (text.length < 3) return json({ error: "bad_highlight" }, 400);
      const id = crypto.randomUUID(); await db.prepare("INSERT INTO highlights(id,item_id,text,note,created_at) VALUES(?,?,?,?,?)").bind(id, item.id, text, b?.note ? String(b.note).slice(0, 2000) : null, now).run();
      return json({ highlight: { id, text } }, 201);
    }
  }
  const hd = p.match(/^\/api\/highlights\/([0-9a-f-]{36})$/u);
  if (hd && m === "DELETE") { const r = await db.prepare("DELETE FROM highlights WHERE id=?").bind(hd[1]).run(); return r.meta.changes ? json({ ok: true }) : json({ error: "not_found" }, 404); }

  if (p === "/api/source-imports/preview" && m === "POST") {
    const body = await request.json().catch(() => ({}));
    const parsed = parseSourceImport({ format: body?.format, content: body?.content, mapping: body?.mapping });
    if (parsed.error) return json({ error: parsed.error, headers: parsed.headers || [], suggested: parsed.suggested || null, ai_calls: 0 }, 422);
    if (parsed.mapping_required) return json({ mapping_required: true, headers: parsed.headers, suggested: parsed.suggested, ai_calls: 0 });
    const rows = await sourceImportPreview(db, parsed);
    return json({ headers: parsed.headers || [], suggested: parsed.suggested || null, preview: rows, counts: rows.reduce((out, row) => { out[row.status] = (out[row.status] || 0) + 1; return out; }, {}), ai_calls: 0 });
  }

  if (p === "/api/source-imports" && m === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true) return json({ error: "confirmation_required", hint: "先預覽並明確確認匯入；匯入不會呼叫 AI。" }, 400);
    const parsed = parseSourceImport({ format: body?.format, content: body?.content, mapping: body?.mapping });
    if (parsed.error || parsed.mapping_required) return json({ error: parsed.error || "mapping_required", headers: parsed.headers || [], suggested: parsed.suggested || null }, 422);
    if (!parsed.rows.length) return json({ error: "empty_import", hint: "沒有可匯入項目。" }, 400);
    const jobId = /^[0-9a-f-]{36}$/iu.test(body?.job_id || "") ? body.job_id : crypto.randomUUID();
    const prior = await sourceImportJobView(db, jobId);
    if (prior) return json({ job: prior, ai_calls: 0 }, 200);
    const preview = await sourceImportPreview(db, parsed);
    const now = new Date().toISOString();
    const statements = [db.prepare("INSERT INTO source_import_jobs(id,format,status,total,created_at,updated_at) VALUES(?,?,'queued',?,?,?)").bind(jobId, body.format, preview.length, now, now)];
    preview.forEach((row, position) => {
      const invalid = row.status === "invalid" || row.status === "needs_map";
      statements.push(db.prepare("INSERT INTO source_import_rows(id,job_id,position,adapter_type,value,label,opml_category,canonical_value,status,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), jobId, position, !invalid ? row.type : "rss", String(row.value || `invalid-${position + 1}`).slice(0, 2048), row.label || null, row.category || null,
          row.canonical_value || `invalid:${position}`, invalid ? "invalid" : row.status === "new" ? "pending" : row.status, row.error || null, now, now));
    });
    await db.batch(statements);
    const job = await sourceImportJobView(db, jobId);
    if (!job.counts.pending) await db.prepare("UPDATE source_import_jobs SET status='completed',updated_at=? WHERE id=?").bind(now, jobId).run();
    return json({ job: await sourceImportJobView(db, jobId), ai_calls: 0 }, 201);
  }

  const sourceImportMatch = p.match(/^\/api\/source-imports\/([0-9a-f-]{36})(?:\/(run|cancel|retry|revalidate))?$/iu);
  if (sourceImportMatch) {
    const [, jobId, action] = sourceImportMatch;
    if (!action && m === "GET") { const job = await sourceImportJobView(db, jobId); return job ? json({ job }) : json({ error: "not_found" }, 404); }
    if (action === "cancel" && m === "POST") {
      const result = await db.prepare("UPDATE source_import_jobs SET status='cancelled',updated_at=? WHERE id=? AND status IN ('queued','running','partial')").bind(now, jobId).run();
      return result.meta.changes ? json({ job: await sourceImportJobView(db, jobId), ai_calls: 0 }) : json({ error: "not_found_or_finished" }, 409);
    }
    if (action === "retry" && m === "POST") {
      const job = await sourceImportJobView(db, jobId);
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "cancelled" || job.status === "completed") return json({ error: "job_finished" }, 409);
      const body = await request.json().catch(() => ({})); const ids = Array.isArray(body?.row_ids) ? [...new Set(body.row_ids.map(String))].slice(0, 20) : [];
      if (!ids.length) return json({ error: "retry_rows_required" }, 400);
      const stmts = ids.map((id) => db.prepare("UPDATE source_import_rows SET status='pending',error_code=NULL,updated_at=? WHERE id=? AND job_id=? AND status='failed'").bind(now, id, jobId));
      const changed = await db.batch(stmts); const retried = changed.reduce((n, result) => n + Number(result.meta?.changes || 0), 0);
      if (!retried) return json({ error: "no_failed_rows_selected" }, 409);
      await db.prepare("UPDATE source_import_jobs SET status='queued',updated_at=? WHERE id=? AND status!='cancelled'").bind(now, jobId).run();
      return json({ job: await sourceImportJobView(db, jobId), retried, ai_calls: 0 });
    }
    if (action === "revalidate" && m === "POST") {
      const job = await sourceImportJobView(db, jobId);
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "cancelled") return json({ error: "job_cancelled" }, 409);
      const body = await request.json().catch(() => ({}));
      const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 20) : [];
      if (!rows.length) return json({ error: "revalidation_rows_required" }, 400);
      const now = new Date().toISOString(), allowedTypes = new Set(["rss", "x", "github_search", "github_releases", "youtube_channel"]);
      let revalidated = 0;
      for (const candidate of rows) {
        const current = job.rows.find((row) => row.id === candidate?.id && row.status === "invalid");
        if (!current) continue;
        const type = String(candidate?.type || ""), value = String(candidate?.value || "").trim();
        const valid = allowedTypes.has(type) ? validateSourceImportRow({ type, value, label: String(candidate?.label || "").slice(0, 200), category: String(candidate?.category || "").slice(0, 100) }) : { error: "invalid_source_type" };
        const status = valid.error ? "invalid" : "pending";
        const result = await db.prepare("UPDATE source_import_rows SET adapter_type=?,value=?,label=?,opml_category=?,canonical_value=?,status=?,error_code=?,updated_at=? WHERE id=? AND job_id=? AND status='invalid'")
          .bind(valid.type || (allowedTypes.has(type) ? type : current.adapter_type), value || current.value, String(candidate?.label || current.label || "").slice(0, 200) || null, String(candidate?.category || current.opml_category || "").slice(0, 100) || null,
            valid.canonical_value || `invalid:${current.position}`, status, valid.error || null, now, current.id, jobId).run();
        revalidated += Number(result.meta?.changes || 0);
      }
      if (!revalidated) return json({ error: "no_invalid_rows_selected" }, 409);
      const refreshed = await sourceImportJobView(db, jobId);
      if (refreshed.counts.pending) await db.prepare("UPDATE source_import_jobs SET status='queued',updated_at=? WHERE id=? AND status!='cancelled'").bind(now, jobId).run();
      return json({ job: await sourceImportJobView(db, jobId), revalidated, ai_calls: 0 });
    }
    if (action === "run" && m === "POST") {
      const job = await sourceImportJobView(db, jobId);
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "cancelled" || job.status === "completed") return json({ job, ai_calls: 0 });
      const started = await db.prepare("UPDATE source_import_jobs SET status='running',updated_at=? WHERE id=? AND status IN ('queued','partial','running')").bind(now, jobId).run();
      if (!started.meta?.changes) return json({ job: await sourceImportJobView(db, jobId), ai_calls: 0 });
      const pending = (await db.prepare("SELECT * FROM source_import_rows WHERE job_id=? AND status='pending' ORDER BY position LIMIT ?").bind(jobId, SOURCE_IMPORT_BATCH).all()).results || [];
      const existingRows = (await db.prepare("SELECT type,adapter_type,value,canonical_value FROM sources").all()).results || [];
      const existing = new Set(existingRows.flatMap((source) => { const type = source.type === "x" || source.adapter_type === "x" ? "x" : source.adapter_type || source.type; return [`${type}:${canonicalSourceValue(type, source.value)}`, source.canonical_value ? `${type}:${source.canonical_value}` : ""]; }));
      for (const row of pending) {
        const current = await db.prepare("SELECT status FROM source_import_jobs WHERE id=?").bind(jobId).first();
        if (current?.status !== "running") break;
        const key = `${row.adapter_type}:${row.canonical_value}`;
        if (existing.has(key)) {
          await db.prepare("UPDATE source_import_rows SET status='exists',error_code=NULL,updated_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM source_import_jobs WHERE id=? AND status='running')").bind(now, row.id, jobId).run();
          continue;
        }
        const sourceId = crypto.randomUUID();
        try {
          const results = await db.batch([
            db.prepare("INSERT OR IGNORE INTO sources(id,type,adapter_type,value,label,canonical_value,opml_category,enabled,created_at,updated_at) SELECT ?,?,?,?,?,?,?,1,?,? WHERE EXISTS(SELECT 1 FROM source_import_jobs WHERE id=? AND status='running')")
              .bind(sourceId, row.adapter_type, row.adapter_type, row.value, row.label, row.canonical_value, row.opml_category, now, now, jobId),
            db.prepare("UPDATE source_import_rows SET status=CASE WHEN EXISTS(SELECT 1 FROM sources WHERE id=?) THEN 'added' ELSE 'exists' END,error_code=NULL,updated_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM source_import_jobs WHERE id=? AND status='running')")
              .bind(sourceId, now, row.id, jobId),
          ]);
          if (!results[1].meta?.changes) break;
          existing.add(key);
        } catch {
          const failed = await db.prepare("UPDATE source_import_rows SET status='failed',error_code='storage_error',updated_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM source_import_jobs WHERE id=? AND status='running')").bind(now, row.id, jobId).run();
          if (!failed.meta?.changes) break;
        }
      }
      const counts = (await sourceImportJobView(db, jobId)).counts;
      const nextStatus = counts.pending || counts.failed ? "partial" : "completed";
      await db.prepare("UPDATE source_import_jobs SET status=?,updated_at=? WHERE id=? AND status!='cancelled'").bind(nextStatus, now, jobId).run();
      return json({ job: await sourceImportJobView(db, jobId), ai_calls: 0 });
    }
  }

  if (p === "/api/sources/bulk" && m === "POST") {
    const b = await request.json().catch(() => ({})); const rows = parseSourceLines(b?.text);
    if (!rows.length) return json({ error: "empty", hint: "每行一個 https 網址或 @handle" }, 400);
    const existingRows = (await db.prepare("SELECT type,adapter_type,value,canonical_value FROM sources").all()).results;
    const existing = new Set(existingRows.flatMap((r) => { const type = r.type === "x" || r.adapter_type === "x" ? "x" : r.adapter_type || r.type; return [`${type}:${canonicalSourceValue(type, r.value)}`, r.canonical_value ? `${type}:${r.canonical_value}` : ""]; }));
    let checks = 0;
    for (const r of rows) {
      if (r.status !== "pending") continue;
      if (r.type === "rss" && checks < 25) { // validate feed; auto-discover from HTML pages
        checks++;
        const t = safeFetchUrl(r.value);
        if (!t) { r.status = "invalid"; r.error = "網址不允許"; continue; }
        const fetched = await fetchRestricted(fetchImpl, t, { allowedHosts: RADAR_FETCH_HOSTS, allowedMime: ["text/html", "application/xhtml+xml", "application/rss+xml", "application/atom+xml", "application/xml", "text/xml", "text/plain"], maxBytes: 1_000_000, timeoutMs: 8000, headers: { "user-agent": "ai-pm-radar-cloud/1" } });
        if (fetched.error) { r.status = "not_feed"; r.error = fetched.error === "unsupported_host" ? "此網域未在安全擷取 allowlist；請手動加入已核對的 RSS feed" : fetched.error === "unsafe_redirect" ? "重新導向目的地不在安全 allowlist" : fetched.error === "timeout" ? "連線逾時" : fetched.error === "unsupported_content_type" ? "回應不是允許的 HTML／RSS 格式" : fetched.error; continue; }
        const res = fetched.response, body = res.status === 304 ? "" : await res.text();
        if (res.status === 304) { r.status = "not_feed"; r.error = "來源沒有提供可驗證的新內容"; continue; }
        if (looksLikeFeed(body)) { /* ok */ }
        else if (res.ok && discoverFeed(body, fetched.url) && RADAR_FETCH_HOSTS.has(new URL(discoverFeed(body, fetched.url)).hostname.toLowerCase())) { r.discovered_from = r.value; r.value = discoverFeed(body, fetched.url); }
        else { r.status = "not_feed"; r.error = res.ok ? "唔係 RSS/Atom，亦搵唔到安全 allowlist 內的 feed 連結" : `HTTP ${res.status}`; continue; }
      }
      const key = `${r.type}:${canonicalSourceValue(r.type, r.value)}`;
      r.status = existing.has(key) ? "exists" : "new";
    }
    const seen = new Set(); for (const r of rows) if (r.status === "new") { const k = `${r.type}:${canonicalSourceValue(r.type, r.value)}`; if (seen.has(k)) r.status = "duplicate_in_batch"; seen.add(k); }
    if (b?.commit !== true) return json({ preview: rows, counts: rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}) });
    let added = 0; for (const r of rows.filter((x) => x.status === "new")) {
      const res = await db.prepare("INSERT OR IGNORE INTO sources(id,type,adapter_type,value,label,canonical_value,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)").bind(crypto.randomUUID(), r.type, r.type, r.value, null, canonicalSourceValue(r.type, r.value), now, now).run();
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
