import { detectInputKind, parseSubtitle, type SourceInputKind } from "./source-inbox.ts";
import { chunkBookChapter, chunkTranscript, type EvidenceChunk } from "./universal-ingestor.ts";

export const MAX_INTAKE_TEXT_BYTES = 1_048_576;
export const MAX_VISIBLE_EVIDENCE_CHUNKS = 80;

export type IntakeEvidenceSelection = {
  chunkId: string;
  exactQuote: string;
  locator: string;
  evidenceSource: string;
  evidenceTimestamp: string;
};

export type ValidatedTextMaterial = {
  kind: "txt" | "markdown" | "srt" | "vtt";
  fileName: string;
  title: string;
  body: string;
};

/**
 * File import is an explicit manual action: no network fetch, no review and no approval.
 * Reject accidental binary input or unparseable subtitle files instead of presenting
 * fabricated time locations. The original text stays intact as SourceRecord.raw_text.
 */
export function validateUploadedTextMaterial(value: string, fileName: string): ValidatedTextMaterial {
  const safeFileName = fileName.trim().split(/[\\/]/).pop()?.trim() ?? "";
  const extension = safeFileName.toLowerCase().split(".").pop();
  if (!safeFileName || !["txt", "md", "markdown", "srt", "vtt"].includes(extension ?? "")) {
    throw new Error("Please upload a .txt, .md, .markdown, .srt or .vtt file.");
  }
  if (new TextEncoder().encode(value).byteLength > MAX_INTAKE_TEXT_BYTES) {
    throw new Error("The text file exceeds the 1 MiB import limit; paste a shorter excerpt instead.");
  }
  if (!value.trim()) throw new Error("The uploaded file is empty; paste source text instead.");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/u.test(value)) {
    throw new Error("The file contains binary/control bytes or invalid UTF-8; provide a UTF-8 text excerpt.");
  }
  const kind = detectInputKind(value, safeFileName);
  if (!["txt", "markdown", "srt", "vtt"].includes(kind)) {
    throw new Error("Unsupported text file format.");
  }
  if (kind === "srt" || kind === "vtt") {
    const cues = parseSubtitle(value, kind).cues;
    if (!cues.length) throw new Error("No valid subtitle cues found; paste transcript text as a fallback.");
    const toMs = (timestamp: string): number | null => {
      const match = timestamp.match(/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)[,.](\d{3})$/);
      if (!match) return null;
      return ((Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000) + Number(match[4]);
    };
    for (const cue of cues) {
      const start = toMs(cue.start);
      const end = toMs(cue.end);
      if (start === null || end === null || end <= start) {
        throw new Error("Subtitle timestamps are invalid; correct the file or paste a transcript.");
      }
    }
  }
  const markdownHeading = kind === "markdown" ? value.match(/^\s*#\s+([^\r\n]+)/m)?.[1]?.trim() : null;
  return {
    kind: kind as ValidatedTextMaterial["kind"],
    fileName: safeFileName,
    title: markdownHeading || safeFileName.replace(/\.(?:txt|md|markdown|srt|vtt)$/i, ""),
    body: value,
  };
}

/**
 * Evidence candidates are navigation hints, not fact verification.
 * A reviewer must select a quote, check it, then independently approve the record.
 * For subtitle quotes, use the parsed transcript that SourceRecord actually retains;
 * for Markdown, use only text appearing in the captured raw file.
 */
export function importedEvidenceCandidates(
  body: string,
  kind: SourceInputKind,
  sourceLabel: string,
): IntakeEvidenceSelection[] {
  if (!body.trim() || new TextEncoder().encode(body).byteLength > MAX_INTAKE_TEXT_BYTES) return [];
  let chunks: EvidenceChunk[] = [];
  if (kind === "srt" || kind === "vtt") {
    chunks = chunkTranscript(body, 300_000, "Subtitle");
    const parsedTranscript = parseSubtitle(body, kind).text;
    chunks = chunks.filter((chunk) => parsedTranscript.includes(chunk.exactQuote));
  } else if (kind === "markdown") {
    chunks = chunkBookChapter(body, sourceLabel);
    chunks = chunks.filter((chunk) => body.includes(chunk.exactQuote));
  }
  return chunks.slice(0, MAX_VISIBLE_EVIDENCE_CHUNKS).map((chunk) => ({
    chunkId: chunk.chunkId,
    exactQuote: chunk.exactQuote,
    locator: chunk.locator,
    evidenceSource: kind === "markdown" ? `${sourceLabel || "Uploaded Markdown"} · ${chunk.locator}` : (sourceLabel || "Uploaded subtitle"),
    evidenceTimestamp: kind === "srt" || kind === "vtt" ? chunk.locator : "",
  }));
}
