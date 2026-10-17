import { createApprovalSeal, toCanonicalBytes } from "./approval-integrity.ts";
import type { EvidenceChunk } from "./universal-ingestor.ts";

export const OMNI_SOURCE_CATEGORIES = [
  "AI_TECH_NEWS", "FREEBIE_CERT_DEAL", "SOCIAL_VIRAL_STRATEGY", "VIDEO_COURSE_TRANSCRIPT", "BOOK_CHAPTER_EXTRACT",
] as const;
export type OmniSourceCategory = (typeof OMNI_SOURCE_CATEGORIES)[number];

export type OmniResourceBundle = {
  bundleId: string;
  createdAtIso: string;
  sourceCategory: OmniSourceCategory;
  sourceUrlOrFileName: string;
  canonicalSha256: string;
  humanApproved: true;
  dailyDigestCard: {
    headline: string;
    threeBulletTakeaways: [string, string, string];
    actionUrgency: "IMMEDIATE_DEAL" | "HIGH_TRAFFIC_TOPIC" | "DEEP_STUDY";
    dealExpirationIso?: string;
  };
  exactEvidenceChunks: EvidenceChunk[];
  contentOpsPayload: {
    targetBusinessLine: "DIAGNOSTIC_CONSULTING" | "TONGYITANG_CULTURE" | "PERSONAL_AI_BRAND";
    coreHookAngle: string;
    platformAngles: { linkedinConsultingPost: string; threadsIgViralCarousel: string };
    suggestedVisualEvidenceDesc: string;
  };
  cyberKumaPayload: {
    domainTag: string;
    tacticalEncounters: Array<{
      conceptId: string; evidenceChunkId: string; enemyTelegraphAttack: string;
      correctTacticalCounter: string; distractorActions: [string, string]; explanationAfterCombat: string;
    }>;
  };
};

export async function createOmniResourceBundle(input: {
  sourceCategory: OmniSourceCategory;
  sourceUrlOrFileName: string;
  sourcePayload: unknown;
  approved: boolean;
  dailyDigestCard: OmniResourceBundle["dailyDigestCard"];
  evidenceChunks: EvidenceChunk[];
  contentOpsPayload: OmniResourceBundle["contentOpsPayload"];
  cyberKumaPayload: OmniResourceBundle["cyberKumaPayload"];
  createdAtIso?: string;
}): Promise<OmniResourceBundle> {
  if (input.approved !== true) throw new Error("Human approval is required before OmniResourceBundle export.");
  if (!input.sourceUrlOrFileName.trim() || !input.evidenceChunks.length) throw new Error("Source identity and evidence chunks are required.");
  if (input.evidenceChunks.some((chunk) => !chunk.chunkId || !chunk.exactQuote.trim() || !chunk.locator.trim())) {
    throw new Error("Every evidence chunk must retain an exact quote and locator.");
  }
  const canonicalSha256 = await createApprovalSeal(input.sourcePayload);
  return {
    bundleId: `omni_${canonicalSha256.slice(0, 20)}`,
    createdAtIso: new Date(input.createdAtIso ?? new Date().toISOString()).toISOString(),
    sourceCategory: input.sourceCategory,
    sourceUrlOrFileName: input.sourceUrlOrFileName,
    canonicalSha256,
    humanApproved: true,
    dailyDigestCard: structuredClone(input.dailyDigestCard),
    exactEvidenceChunks: structuredClone(input.evidenceChunks),
    contentOpsPayload: structuredClone(input.contentOpsPayload),
    cyberKumaPayload: structuredClone(input.cyberKumaPayload),
  };
}

export function omniBundleCanonicalBytes(bundle: OmniResourceBundle) {
  return toCanonicalBytes(bundle);
}
