export const QUICK_CAPTURE_SESSION_KEY = "ai-pm-radar.quick-capture.v1";

export type QuickCaptureHandoff = {
  version: 1;
  value: string;
  fileName: string | null;
  /** When true, Source Inbox runs AI analysis automatically once the draft has source text. */
  autoAnalyze?: boolean;
};

export function serializeQuickCapture(value: string, fileName: string | null = null, autoAnalyze = false) {
  const handoff: QuickCaptureHandoff = { version: 1, value, fileName };
  if (autoAnalyze) handoff.autoAnalyze = true;
  return JSON.stringify(handoff);
}

export function parseQuickCapture(value: string): QuickCaptureHandoff {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid quick capture handoff.");
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== 1 || typeof candidate.value !== "string"
    || !(candidate.fileName === null || typeof candidate.fileName === "string")
    || !(candidate.autoAnalyze === undefined || typeof candidate.autoAnalyze === "boolean")) {
    throw new Error("Unsupported quick capture handoff.");
  }
  return candidate as QuickCaptureHandoff;
}

/** Video / social hosts whose pages usually need login or have no article text. */
export function isVideoOrSocialLink(value: string) {
  return /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|threads\.net|x\.com|twitter\.com|bilibili\.com|vimeo\.com|xiaohongshu\.com)\b/i.test(value.trim());
}
