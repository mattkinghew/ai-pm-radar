import { parseSubtitle } from "./source-inbox.ts";

export type EvidenceChunk = { chunkId: string; exactQuote: string; locator: string };

export function chunkTranscript(transcript: string, maxChunkMs = 300_000, locatorPrefix = "YouTube"): EvidenceChunk[] {
  const cues = parseSubtitle(transcript).cues.map((cue) => ({
    startMs: timestampMs(cue.start), endMs: timestampMs(cue.end), text: cue.text,
  }));
  if (!cues.length || !Number.isSafeInteger(maxChunkMs) || maxChunkMs < 60_000) return [];
  const chunks: EvidenceChunk[] = [];
  let start = cues[0].startMs;
  let end = cues[0].endMs;
  let lines: string[] = [];
  const flush = () => {
    const quote = lines.join(" ").replace(/\s+/g, " ").trim();
    if (quote) chunks.push({ chunkId: `video-${chunks.length + 1}`, exactQuote: quote, locator: `${locatorPrefix} ${formatTime(start)}-${formatTime(end)}` });
    lines = [];
  };
  for (const cue of cues) {
    if (lines.length && cue.endMs - start > maxChunkMs) { flush(); start = cue.startMs; }
    end = cue.endMs;
    lines.push(cue.text);
  }
  flush();
  return chunks;
}

export function chunkBookChapter(text: string, sourceName: string): EvidenceChunk[] {
  const pages = text.split(/\n\s*\[page\s*:?\s*(\d+)\s*\]\s*\n/i);
  let currentPage: string | null = null;
  const sections: Array<{ title: string; page: string | null; text: string }> = [];
  for (const segment of pages) {
    const pageMarker = /^\d+$/.test(segment.trim());
    if (pageMarker) { currentPage = segment.trim(); continue; }
    const headingSections = segment.split(/\n(?=#{1,3}\s)/);
    for (const section of headingSections) {
      const heading = section.match(/^(#{1,3})\s+(.+?)\s*\n/);
      const title = heading?.[2]?.trim() || sourceName.trim() || "Untitled chapter";
      const body = (heading ? section.slice(heading[0].length) : section).trim();
      if (body) sections.push({ title, page: currentPage, text: body });
    }
  }
  return sections.map((section, index) => ({
    chunkId: `book-${index + 1}`, exactQuote: section.text,
    locator: `${section.title}${section.page ? `, p.${section.page}` : ""}`,
  }));
}

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function timestampMs(value: string) {
  const parts = value.replace(",", ".").split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  const seconds = parts.pop() ?? 0;
  const minutes = parts.pop() ?? 0;
  const hours = parts.pop() ?? 0;
  return Math.round(((hours * 3600 + minutes * 60 + seconds) * 1000));
}
