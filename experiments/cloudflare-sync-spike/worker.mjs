/**
 * ISOLATED EXPERIMENT: JWT + D1 + independent revision/approval PoC.
 * Not wired to the Radar app; NEVER deploy without further security and schema review.
 */
import { PREVIEW_HTML, PREVIEW_SCRIPT } from "./preview-ui.mjs";
import { handleCloudApi } from "./cloud-api.mjs";
import { CLOUD_SYNC_HTML, CLOUD_SYNC_SCRIPT } from "./cloud-sync-ui.mjs";
import { GATEWAY_WORKBENCH_HTML, GATEWAY_WORKBENCH_SCRIPT } from "./gateway-workbench-ui.mjs";

const MAX_JSON_BYTES = 120_000;
const ID = /^[a-zA-Z0-9_-]{1,120}$/;

function decode64url(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("bad_base64");
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
function parsePart(part) { return JSON.parse(new TextDecoder().decode(decode64url(part))); }
function json(value, status=200) {
  return new Response(JSON.stringify(value), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}

async function authenticate(request, env, ctx) {
  // Cloud-only mode: trust ONLY the Access-authenticated request context
  // provided by Cloudflare; never a client-supplied email/JWT header.
  if (env.CLOUD_ACCESS_REQUIRED === "true") {
    if (!ctx?.access || !env.OWNER_EMAIL_SHA256 || !/^[0-9a-f]{64}$/.test(env.OWNER_EMAIL_SHA256)) return null;
    try {
      const identity = await ctx.access.getIdentity();
      const email = typeof identity?.email === "string" ? identity.email.trim().toLowerCase() : "";
      if (!email) return null;
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email))),
        byte => byte.toString(16).padStart(2, "0")
      ).join("");
      if (digest !== env.OWNER_EMAIL_SHA256) return null;
      // Owner id is stable, opaque, and bound to the authenticated identity.
      return {sub: "cf_" + digest, email};
    } catch { return null; }
  }
  // Synthetic local-only fallback for the pre-existing 20 JWT fixture tests.
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || !env.ACCESS_AUD || !env.ACCESS_ISSUER || !env.ACCESS_JWKS_JSON || !env.ALLOWED_EMAILS) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const header=parsePart(parts[0]), claims=parsePart(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    const now = Math.floor(Date.now()/1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== env.ACCESS_ISSUER || !audiences.includes(env.ACCESS_AUD)
      || typeof claims.exp !== "number" || claims.exp <= now
      || (typeof claims.nbf === "number" && claims.nbf > now)
      || typeof claims.sub !== "string" || claims.sub.length > 200
      || !ID.test(claims.sub.replace(/-/g, "_"))) return null;
    const allow = new Set(env.ALLOWED_EMAILS.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean));
    if (typeof claims.email !== "string" || !allow.has(claims.email.toLowerCase())) return null;
    const jwks=JSON.parse(env.ACCESS_JWKS_JSON);
    const jwk=jwks.keys?.find(k=>k.kid===header.kid && k.kty==="RSA" && k.alg==="RS256");
    if (!jwk) return null;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const signed=new TextEncoder().encode(parts[0]+"."+parts[1]);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode64url(parts[2]),signed)) return null;
    return {sub:claims.sub,email:claims.email};
  } catch { return null; }
}

async function bodyJson(request) {
  const raw=await request.text();
  if (new TextEncoder().encode(raw).length > MAX_JSON_BYTES) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function fingerprint(record) {
  const bytes=new TextEncoder().encode(JSON.stringify(record));
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  return Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
}
function validRecord(record,id) {
  // Minimal PoC contract. Full SourceRecord validators MUST be reused at Phase 1.2.
  return record && typeof record==="object" && !Array.isArray(record)
    && record.record_version===2 && record.id===id
    && typeof record.raw_text==="string" && record.raw_text.trim().length>0
    && record.raw_text.length<100_000
    && Array.isArray(record.key_claims);
}
function allowSyntheticInput(env,record,id) {
  if (env.SYNTHETIC_ONLY !== "true") return true;
  return typeof id === "string" && id.startsWith("qa_")
    && record?.source_url === "https://example.invalid/synthetic"
    && typeof record?.raw_text === "string" && record.raw_text.includes("Synthetic");
}
function evidenceValid(record) {
  return record.key_claims.length>0 && record.key_claims.every(claim =>
    typeof claim.claim==="string" && claim.claim.trim()
    && Array.isArray(claim.evidence) && claim.evidence.length>0
    && claim.evidence.every(e=>typeof e.text_reference==="string"
      && !!e.text_reference.trim()
      && record.raw_text.replace(/\s+/g," ").includes(e.text_reference.replace(/\s+/g," ").trim())));
}
function stripApproval(record) {
  return {...record,review_status:"needs_review",approval_status:"not_approved"};
}
function expose(row) {
  const record=JSON.parse(row.record_json);
  return {
    source_id:row.source_id,revision:row.revision,fingerprint:row.fingerprint,
    review_status:row.review_state,approved:row.approved_fingerprint===row.fingerprint,
    record:{...record,review_status:row.review_state,approval_status:row.approved_fingerprint===row.fingerprint?"approved":"not_approved"},
    updated_at:row.updated_at,
  };
}

export default {
 async fetch(request,env,ctx) {
  const auth=await authenticate(request,env,ctx);
  if (!auth) return json({code:"unauthenticated"},401);
  if (!env.DB) return json({code:"misconfigured_db"},503);
  const url=new URL(request.url);
  if (request.method==="GET" && ["/gateway-workbench","/gateway-workbench/"].includes(url.pathname)) {
    return new Response(GATEWAY_WORKBENCH_HTML,{headers:{
      "content-type":"text/html; charset=utf-8","cache-control":"no-store",
      "content-security-policy":"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"
    }});
  }
  if (request.method==="GET" && url.pathname==="/gateway-workbench/app.js") {
    return new Response(GATEWAY_WORKBENCH_SCRIPT,{headers:{
      "content-type":"text/javascript; charset=utf-8","cache-control":"no-store",
      "x-content-type-options":"nosniff","referrer-policy":"no-referrer"
    }});
  }
  if (request.method==="GET" && ["/cloud-sync","/cloud-sync/"].includes(url.pathname)) {
    return new Response(CLOUD_SYNC_HTML, {headers:{
      "content-type":"text/html; charset=utf-8","cache-control":"no-store",
      "content-security-policy":"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"
    }});
  }
  if (request.method==="GET" && url.pathname==="/cloud-sync/app.js") {
    return new Response(CLOUD_SYNC_SCRIPT, {headers:{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
  }
  if (url.pathname.startsWith("/api/cloud/")) {
    try { return await handleCloudApi(request,env,auth,url.pathname); }
    catch { return json({code:"cloud_internal_error"},500); }
  }
  // Phase 1.2C-3: real Next.js SourceInboxWorkbench static assets, behind
  // verified Access identity. The asset binding can NEVER serve before this
  // Worker thanks to assets.run_worker_first=true in preview config.
  if (request.method==="GET" && (
      ["/preview-source-inbox","/preview-source-inbox/"].includes(url.pathname)
      || url.pathname.startsWith("/preview-source-inbox/")
      || url.pathname.startsWith("/_next/static/"))) {
    if (env.SYNTHETIC_ONLY!=="true" || env.CLOUD_ACCESS_REQUIRED!=="true" || !env.ASSETS) {
      return json({code:"synthetic_preview_assets_disabled"},503);
    }
    const path=url.pathname;
    if(path.includes("%") || path.includes("\\") || path.split("/").some(part=>part.startsWith(".")||part==="..")) {
      return json({code:"not_found"},404);
    }
    const assetRequest = new Request(request.url, {method:"GET",headers:{
      accept:request.headers.get("accept")||"*/*",
    }});
    const result=await env.ASSETS.fetch(assetRequest);
    const headers=new Headers(result.headers);
    headers.set("cache-control","no-store");
    headers.set("x-content-type-options","nosniff");
    headers.set("referrer-policy","no-referrer");
    headers.set("x-frame-options","DENY");
    // Next.js hydration bootstraps via same-origin scripts only.
    headers.set("content-security-policy",
      "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; form-action 'none'; base-uri 'self'");
    return new Response(result.body,{status:result.status,headers});
  }
  if (request.method === "GET" && url.pathname === "/") {
    return new Response(PREVIEW_HTML, {headers: {
      "content-type":"text/html; charset=utf-8","cache-control":"no-store",
      "content-security-policy":"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "referrer-policy":"no-referrer","x-content-type-options":"nosniff","x-frame-options":"DENY"
    }});
  }
  if (request.method === "GET" && url.pathname === "/preview.js") {
    return new Response(PREVIEW_SCRIPT, {headers:{
      "content-type":"text/javascript; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"
    }});
  }
  const parts=url.pathname.split("/").filter(Boolean);
  if (parts[0]!=="api" || parts[1]!=="records" || parts.length>4) return json({code:"not_found"},404);
  const id=parts[2]??null;
  if (id && !ID.test(id)) return json({code:"bad_id"},400);
  if (request.method==="GET" && !id) {
    const res=await env.DB.prepare("SELECT * FROM source_items WHERE owner_sub=? ORDER BY updated_at DESC").bind(auth.sub).all();
    return json({records:res.results.map(expose)});
  }
  if (request.method==="GET" && id && parts.length===3) {
    const row=await env.DB.prepare("SELECT * FROM source_items WHERE owner_sub=? AND source_id=?").bind(auth.sub,id).first();
    return row?json(expose(row)):json({code:"not_found"},404);
  }
  if (!["POST","PUT"].includes(request.method)) return json({code:"not_found"},404);
  const body=await bodyJson(request);
  if (!body) return json({code:"invalid_json"},400);
  if (request.method==="POST" && !id && parts.length===2) {
    if (!ID.test(body.source_id??"") || !validRecord(body.record,body.source_id) || !allowSyntheticInput(env,body.record,body.source_id)) return json({code:"bad_record"},422);
    const record=stripApproval(body.record);
    const hash=await fingerprint(record);
    const result=await env.DB.prepare("INSERT OR IGNORE INTO source_items (owner_sub,source_id,record_json,fingerprint,updated_at) VALUES (?,?,?,?,?)")
      .bind(auth.sub,body.source_id,JSON.stringify(record),hash,new Date().toISOString()).run();
    if (result.meta.changes!==1) return json({code:"duplicate"},409);
    return json({source_id:body.source_id,revision:1,review_status:"needs_review",approved:false},201);
  }
  if (!id || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision<1) return json({code:"missing_revision"},400);
  const existing=await env.DB.prepare("SELECT * FROM source_items WHERE owner_sub=? AND source_id=?").bind(auth.sub,id).first();
  if (!existing) return json({code:"not_found"},404);
  if (existing.revision!==body.expectedRevision) return json({code:"revision_conflict",currentRevision:existing.revision},409);
  let query;
  if(request.method==="PUT" && parts.length===3) {
    if(!validRecord(body.record,id) || !allowSyntheticInput(env,body.record,id)) return json({code:"bad_record"},422);
    const record=stripApproval(body.record);
    query=env.DB.prepare("UPDATE source_items SET record_json=?, fingerprint=?, review_state='needs_review', reviewed_fingerprint=NULL, approved_fingerprint=NULL, revision=revision+1, updated_at=? WHERE owner_sub=? AND source_id=? AND revision=?")
      .bind(JSON.stringify(record),await fingerprint(record),new Date().toISOString(),auth.sub,id,body.expectedRevision);
  } else if (request.method==="POST" && parts[3]==="review" && parts.length===4) {
    if (!evidenceValid(JSON.parse(existing.record_json))) return json({code:"evidence_missing"},422);
    query=env.DB.prepare("UPDATE source_items SET review_state='reviewed',reviewed_fingerprint=fingerprint,approved_fingerprint=NULL,revision=revision+1,updated_at=? WHERE owner_sub=? AND source_id=? AND revision=?")
      .bind(new Date().toISOString(),auth.sub,id,body.expectedRevision);
  } else if (request.method==="POST" && parts[3]==="approve" && parts.length===4) {
    if (existing.review_state!=="reviewed" || existing.reviewed_fingerprint!==existing.fingerprint)
      return json({code:"review_required"},422);
    query=env.DB.prepare("UPDATE source_items SET approved_fingerprint=fingerprint,revision=revision+1,updated_at=? WHERE owner_sub=? AND source_id=? AND revision=? AND review_state='reviewed'")
      .bind(new Date().toISOString(),auth.sub,id,body.expectedRevision);
  } else return json({code:"not_found"},404);
  const result=await query.run();
  if(result.meta.changes!==1) return json({code:"revision_conflict"},409);
  const updated=await env.DB.prepare("SELECT * FROM source_items WHERE owner_sub=? AND source_id=?").bind(auth.sub,id).first();
  return json(expose(updated));
 }
};
