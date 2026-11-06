export const INTEL_NOTE_MAX_CHARS = 2000;

export type IntelNoteSource = {
  id: string;
  label: string;
  useCase: string;
  /** Official page the owner opens themselves. Never fetched by Radar. */
  bookmarkUrl: string | null;
};

export const INTEL_NOTE_SOURCES: readonly IntelNoteSource[] = [
  { id: "mkt1", label: "MKT1", useCase: "Diagnostic、Content Ops、獲客", bookmarkUrl: null },
  { id: "growth-unhinged", label: "Growth Unhinged", useCase: "Productized Service、SaaS", bookmarkUrl: null },
  { id: "lenny", label: "Lenny's Newsletter", useCase: "AI PM 職涯與作品集", bookmarkUrl: null },
  { id: "hkpc", label: "HKPC Digital Transformation", useCase: "香港中小企需求、AI 採用場景", bookmarkUrl: "https://ddiy.hkpc.org/en" },
  { id: "lemlist", label: "Lemlist Blog", useCase: "B2B Outbound、Cold Email、Lead Qualification", bookmarkUrl: "https://www.lemlist.com/blog" },
];

export type IntelNoteInput = {
  sourceId: string;
  title: string;
  url: string;
  note: string;
  useCase: string;
};

export type IntelNoteDraft = {
  sourceId: string;
  sourceLabel: string;
  title: string;
  url: string | null;
  useCase: string;
  bookmarkUrl: string | null;
  body: string;
  evidenceReference: string;
};

export type IntelNoteFailure = "unknown_source" | "empty_title" | "empty_note" | "note_too_long" | "bad_url";

export type IntelNoteResult =
  | { ok: true; draft: IntelNoteDraft }
  | { ok: false; reason: IntelNoteFailure };

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Turn an owner-typed research note into one unapproved draft.
 * Stores the title, optional URL, and the owner's own note. Does not fetch the URL or read email.
 */
export function buildIntelNoteDraft(input: IntelNoteInput): IntelNoteResult {
  const source = INTEL_NOTE_SOURCES.find((item) => item.id === input.sourceId);
  if (!source) return { ok: false, reason: "unknown_source" };
  const title = input.title.trim();
  const note = input.note.trim();
  const useCase = input.useCase.trim() || source.useCase;
  const url = input.url.trim();
  if (!title) return { ok: false, reason: "empty_title" };
  if (!note) return { ok: false, reason: "empty_note" };
  if (note.length > INTEL_NOTE_MAX_CHARS) return { ok: false, reason: "note_too_long" };
  if (url && !isHttpUrl(url)) return { ok: false, reason: "bad_url" };
  const body = `來源：${source.label}\n使用場景：${useCase}\n\n${note}`;
  return {
    ok: true,
    draft: {
      sourceId: source.id,
      sourceLabel: source.label,
      title,
      url: url || null,
      useCase,
      bookmarkUrl: source.bookmarkUrl,
      body,
      evidenceReference: note.slice(0, 140),
    },
  };
}
