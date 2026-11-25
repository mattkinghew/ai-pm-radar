import { safeFetchUrl } from "./reader.mjs";

export const RADAR_FETCH_HOSTS = new Set([
  "openai.com", "www.anthropic.com", "techcrunch.com", "blog.coursera.org", "huggingface.co",
  "www.technologyreview.com", "blog.google", "www.theverge.com", "simonwillison.net", "www.therundown.ai",
  "hn.algolia.com", "api.github.com", "www.youtube.com",
]);

const MAX_REDIRECTS = 3;
const hasAllowedMime = (response, allowedMime) => {
  const contentType = response.headers?.get?.("content-type")?.split(";", 1)[0].trim().toLowerCase();
  return Boolean(contentType && allowedMime.includes(contentType));
};

async function boundedResponse(response, maxBytes) {
  const advertised = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(advertised) && advertised > maxBytes) return { error: "response_too_large" };
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > maxBytes ? { error: "response_too_large" } : { response: new Response(bytes, { status: response.status, headers: response.headers }) };
  }
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return { error: "response_too_large" }; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return { response: new Response(body, { status: response.status, headers: response.headers }) };
}

export async function fetchRestricted(fetchImpl, rawUrl, { allowedHosts = RADAR_FETCH_HOSTS, allowedMime, maxBytes = 1_000_000, timeoutMs = 10_000, headers = {} } = {}) {
  let target = safeFetchUrl(rawUrl);
  if (!target || new URL(target).protocol !== "https:" || !allowedHosts.has(new URL(target).hostname.toLowerCase())) return { error: "unsupported_host" };
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    let response;
    try { response = await fetchImpl(target, { headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) }); }
    catch (error) { return { error: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "fetch_failed" }; }
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers?.get?.("location");
      let next = null;
      try { next = location && safeFetchUrl(new URL(location, target).toString()); } catch { /* invalid redirect */ }
      if (!next || redirects === MAX_REDIRECTS || new URL(next).protocol !== "https:" || !allowedHosts.has(new URL(next).hostname.toLowerCase()) || new URL(next).hostname !== new URL(target).hostname) return { error: "unsafe_redirect" };
      target = next;
      continue;
    }
    if (response.status === 304) return { response, url: target };
    if (!response.ok) return { error: `http_${response.status}`, status: response.status };
    if (allowedMime && !hasAllowedMime(response, allowedMime)) return { error: "unsupported_content_type" };
    const bounded = await boundedResponse(response, maxBytes);
    return bounded.error ? bounded : { ...bounded, url: target };
  }
  return { error: "unsafe_redirect" };
}
