export type ResearchImportMetadata = {
  source_version: string;
  result_version: number;
  imported_fingerprint: string;
};

export type ResearchImportDecision = "new" | "adopt_metadata" | "unchanged" | "auto_update" | "conflict" | "stale";

export function researchFormFingerprint(value: unknown) {
  return JSON.stringify(value);
}

export function decideResearchImport(input: {
  hasExisting: boolean;
  metadata: ResearchImportMetadata | null;
  currentFingerprint: string | null;
  incomingFingerprint: string;
  incomingSourceVersion: string;
  incomingResultVersion: number;
}): ResearchImportDecision {
  if (!input.hasExisting) return "new";
  if (!input.metadata) {
    return input.currentFingerprint === input.incomingFingerprint ? "adopt_metadata" : "conflict";
  }
  const sameSource = input.metadata.source_version === input.incomingSourceVersion;
  if (sameSource && input.incomingResultVersion < input.metadata.result_version) return "stale";
  if (sameSource && input.incomingResultVersion === input.metadata.result_version) return "unchanged";
  if (input.currentFingerprint !== input.metadata.imported_fingerprint) return "conflict";
  return "auto_update";
}
