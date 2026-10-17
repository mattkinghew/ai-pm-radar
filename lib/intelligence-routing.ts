import { findAnalysisEvidence, sourceTextForAnalysis } from "./ai-analysis.ts";
import { validateSourceRecord } from "./source-inbox.ts";
import type { SourceLibraryEntry } from "./source-library.ts";

export const INTELLIGENCE_ASSESSMENT_SCHEMA_VERSION = 1 as const;
export const INTELLIGENCE_RULESET_VERSION = "radar-intelligence-rules-v4" as const;
const SUPPORTED_INTELLIGENCE_RULESET_VERSIONS = [
  "radar-intelligence-rules-v1",
  "radar-intelligence-rules-v2",
  "radar-intelligence-rules-v3",
  INTELLIGENCE_RULESET_VERSION,
] as const;

export const INTELLIGENCE_ROUTES = [
  "research_brief",
  "learning_pack",
  "content_candidate",
  "creative_reference",
  "case_reference",
] as const;

export type IntelligenceRoute = (typeof INTELLIGENCE_ROUTES)[number];
export type IntelligenceDimensionName = "source_quality" | "relevance" | "evidence_strength" | "actionability" | "reuse_potential";

export type IntelligenceDimension = {
  score: number;
  explanation: string;
  signals: string[];
};

export type IntelligenceRouteRecommendation = {
  id: string;
  route: IntelligenceRoute;
  score: number;
  explanation: string;
  signals: string[];
  decision: {
    status: "pending" | "accepted" | "rejected" | "overridden";
    selectedRoute: IntelligenceRoute | null;
    reason: string | null;
    decidedAt: string | null;
    createdArtifactId: string | null;
  };
};

export type IntelligenceAssessment = {
  id: string;
  schemaVersion: typeof INTELLIGENCE_ASSESSMENT_SCHEMA_VERSION;
  sourceRecordId: string;
  sourceFingerprint: string;
  createdAt: string;
  updatedAt: string;
  status: "needs_review" | "reviewed";
  dimensions: Record<IntelligenceDimensionName, IntelligenceDimension>;
  explanation: string;
  confidence: number;
  routeRecommendations: IntelligenceRouteRecommendation[];
  method: { kind: "rules"; version: (typeof SUPPORTED_INTELLIGENCE_RULESET_VERSIONS)[number] };
};

type AssessmentOptions = { now?: string; id?: string };

const RADAR_FOCUS_GROUPS = [
  ["ai", "artificial intelligence", "generative ai", "llm", "machine learning", "人工智能", "生成式人工智能", "大型語言模型", "機器學習"],
  ["product management", "ai product manager", "product", "人工智能產品經理", "AI產品經理", "產品管理"],
  ["workflow", "automation", "工作流程", "流程自動化", "自動化"],
  ["digital transformation", "數碼轉型", "數位轉型"],
  ["business", "商業", "業務"],
  ["education", "教育"],
  ["ngo", "sme", "非牟利", "非營利", "中小企", "中小企業"],
  ["governance", "治理"],
  ["evaluation", "評估"],
  ["human review", "human oversight", "manual review", "人工審核", "人手審核"],
] as const;

function compactUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function recordText(entry: SourceLibraryEntry) {
  const record = entry.source_record;
  return [
    record.title, record.description, record.summary, record.why_it_matters,
    record.business_implication, record.ai_pm_implication, record.video_implication,
    sourceTextForAnalysis(record),
    ...record.key_points, ...record.trend_tags, ...record.topic_tags,
    ...record.analysis.source_facts, ...record.analysis.inferences, ...record.analysis.use_cases,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function matchesFocusTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}

function dimension(score: number, explanation: string, signals: string[]): IntelligenceDimension {
  return { score: Math.max(0, Math.min(100, Math.round(score))), explanation, signals };
}

function scoreDimensions(entry: SourceLibraryEntry): Record<IntelligenceDimensionName, IntelligenceDimension> {
  const record = entry.source_record;
  const body = sourceTextForAnalysis(record).trim();
  const sourceSignals = compactUnique([
    "SourceRecord passed human review and reuse approval",
    record.source_url ? "source URL is present" : "source URL is unknown",
    record.source_url_original && record.source_url_final ? "requested and final URLs are retained" : "requested/final URL provenance is incomplete",
    record.creator ? "creator attribution is present" : "creator attribution is unknown",
    record.published_at ? "publication date is present" : "publication date is unknown",
    body ? "captured source text is present" : "captured source text is missing",
    record.access_method ? "access method is recorded" : "access method is unknown",
    record.evidence_grade !== "ungraded" ? "human evidence grade is recorded" : "evidence grade is ungraded",
  ]);
  const sourceQualityScore = 20 + (record.source_url ? 15 : 0)
    + (record.source_url_original && record.source_url_final ? 15 : 0)
    + (record.creator ? 10 : 0) + (record.published_at ? 10 : 0)
    + (body ? 15 : 0) + (record.access_method ? 5 : 0)
    + (record.evidence_grade !== "ungraded" ? 10 : 0);

  const searchable = recordText(entry);
  const matchedTerms = RADAR_FOCUS_GROUPS.flatMap((terms) => {
    const matched = terms.find((term) => matchesFocusTerm(searchable, term));
    return matched ? [matched] : [];
  });
  const relevanceSignals = matchedTerms.slice(0, 8);
  const relevanceScore = matchedTerms.length ? Math.min(100, 20 + matchedTerms.length * 12) : 0;

  const claims = record.key_claims;
  const locatedClaims = claims.filter((claim) => claim.evidence.some((item) => findAnalysisEvidence(body, item.text_reference)));
  const evidenceSignals = compactUnique([
    record.evidence.length ? `${record.evidence.length} source evidence item(s)` : null,
    claims.length ? `${locatedClaims.length}/${claims.length} claims have locatable evidence` : null,
    record.evidence_grade !== "ungraded" ? `human evidence grade ${record.evidence_grade}` : null,
  ]);
  const evidenceScore = Math.min(100, (record.evidence.length ? 20 : 0)
    + (claims.length ? Math.round(60 * locatedClaims.length / claims.length) : 0)
    + (record.evidence_grade !== "ungraded" ? 20 : 0));

  const actionabilitySignals = compactUnique([
    record.business_implication ? "business implication is recorded" : null,
    record.ai_pm_implication ? "AI PM implication is recorded" : null,
    record.analysis.use_cases.length ? `${record.analysis.use_cases.length} use case(s) recorded` : null,
    record.content_ideas.length ? `${record.content_ideas.length} content idea(s) recorded` : null,
  ]);
  const actionabilityScore = Math.min(100, (record.business_implication ? 25 : 0)
    + (record.ai_pm_implication ? 25 : 0) + Math.min(25, record.analysis.use_cases.length * 12)
    + Math.min(25, record.content_ideas.length * 12));

  const reuseSignals = compactUnique([
    record.case_candidate ? "marked as a case candidate" : null,
    record.library_targets.length ? `${record.library_targets.length} existing library target(s)` : null,
    record.visual_moments.length || record.story_patterns.length || record.style_features.length ? "creative/video reference material is present" : null,
    record.analysis.method_or_teaching_points?.length ? "teaching or method points are present" : null,
  ]);
  const reuseScore = Math.min(100, (record.case_candidate ? 20 : 0)
    + Math.min(25, record.library_targets.length * 8)
    + (record.visual_moments.length || record.story_patterns.length || record.style_features.length ? 20 : 0)
    + (record.analysis.method_or_teaching_points?.length ? 20 : 0));

  return {
    source_quality: dimension(sourceQualityScore, "Rule-based source-attribution, completeness, and provenance cues. Unknown metadata is shown; none independently verifies source credibility.", sourceSignals),
    relevance: dimension(relevanceScore, "Keyword overlap with the documented Radar focus (AI PM, business/workflow, education/NGO/SME); update this profile when priorities change.", relevanceSignals),
    evidence_strength: dimension(evidenceScore, "Measures whether existing SourceRecord evidence can be located in its captured text; it does not judge whether evidence proves a claim.", evidenceSignals),
    actionability: dimension(actionabilityScore, "Measures presence of recorded implications, use cases, and content ideas; it does not validate their usefulness.", actionabilitySignals),
    reuse_potential: dimension(reuseScore, "Measures existing case, library, teaching, and creative/video signals for downstream reuse.", reuseSignals),
  };
}

function routeRecommendation(route: IntelligenceRoute, score: number, signals: string[]): IntelligenceRouteRecommendation {
  const cleanSignals = compactUnique(signals);
  return {
    id: `route-${route}`,
    route,
    score: Math.max(0, Math.min(100, Math.round(score))),
    explanation: cleanSignals.length ? cleanSignals.join("; ") : "No strong matching source signal; review before routing.",
    signals: cleanSignals,
    decision: { status: "pending", selectedRoute: null, reason: null, decidedAt: null, createdArtifactId: null },
  };
}

function recommendRoutes(entry: SourceLibraryEntry, dimensions: Record<IntelligenceDimensionName, IntelligenceDimension>) {
  const record = entry.source_record;
  const teaching = record.analysis.method_or_teaching_points ?? [];
  const routes = [
    routeRecommendation("research_brief", (dimensions.relevance.score + dimensions.evidence_strength.score) / 2,
      [dimensions.relevance.signals.length ? "matches Radar focus" : "approved source is available for research review", record.evidence.length ? "has source evidence" : "evidence is limited"]),
    routeRecommendation("learning_pack", (teaching.length ? 55 : 20) + (record.analysis.use_cases.length ? 15 : 0) + (record.topic_tags.some((tag) => /learn|educat|teach/i.test(tag)) ? 20 : 0),
      [teaching.length ? "teaching/method points are present" : "teaching/method points are not recorded", record.analysis.use_cases.length ? "use cases are present" : "use cases are not recorded"]),
    routeRecommendation("content_candidate", 25 + Math.min(45, record.content_ideas.length * 20) + Math.min(20, record.key_points.length * 5) + (record.evidence.length ? 10 : 0),
      [record.content_ideas.length ? `${record.content_ideas.length} content idea(s) are present` : "content ideas are not recorded", record.evidence.length ? "source evidence is available for review" : "source evidence is missing"]),
    routeRecommendation("creative_reference", 20 + (record.visual_moments.length ? 35 : 0) + (record.story_patterns.length ? 25 : 0) + (record.style_features.length ? 20 : 0),
      [record.visual_moments.length ? "visual moments are present" : "visual moments are not recorded", record.story_patterns.length || record.style_features.length ? "story/style signals are present" : "story/style signals are not recorded"]),
    routeRecommendation("case_reference", 20 + (record.case_candidate ? 25 : 0) + (record.business_implication ? 20 : 0) + Math.min(20, record.analysis.use_cases.length * 10) + (record.key_claims.length ? 15 : 0),
      [record.case_candidate ? "marked as a case candidate" : "not marked as a case candidate", record.business_implication ? "business implication is recorded" : "business implication is not recorded", record.key_claims.length ? "source-backed claims are present" : "claims are not recorded"]),
  ];
  return routes.sort((left, right) => right.score - left.score || left.route.localeCompare(right.route));
}

function assessmentId(entry: SourceLibraryEntry, createdAt: string) {
  let hash = 2166136261;
  for (const character of `${entry.source_record.id}:${entry.fingerprint}:${createdAt}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `assessment_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createIntelligenceAssessment(entry: SourceLibraryEntry, options: AssessmentOptions = {}): IntelligenceAssessment {
  const record = entry?.source_record;
  const sourceText = record ? sourceTextForAnalysis(record) : "";
  const sourceFingerprint = record
    ? (() => {
      const { review_status: _reviewStatus, approval_status: _approvalStatus, ...content } = record;
      return JSON.stringify(content);
    })()
    : "";
  const invalidEvidence = record && [...record.evidence, ...record.key_claims.flatMap((claim) => claim.evidence)]
    .some((item) => !findAnalysisEvidence(sourceText, item.text_reference));
  if (!entry || !record || !validateSourceRecord(record) || record.review_status !== "reviewed"
    || record.approval_status !== "approved" || entry.fingerprint !== sourceFingerprint
    || record.analysis.status === "processing" || record.material_status !== "captured" || !sourceText.trim() || record.evidence.length === 0
    || record.key_claims.length === 0 || record.key_claims.some((claim) => claim.evidence.length === 0)
    || invalidEvidence) {
    throw new Error("Intelligence assessment requires a valid approved SourceRecord.");
  }
  const createdAt = options.now ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Assessment timestamp must be a valid date.");
  const dimensions = scoreDimensions(entry);
  const dimensionsWithSignals = Object.values(dimensions).filter((item) => item.signals.length > 0).length;
  return {
    id: options.id ?? assessmentId(entry, createdAt),
    schemaVersion: INTELLIGENCE_ASSESSMENT_SCHEMA_VERSION,
    sourceRecordId: entry.source_record.id,
    sourceFingerprint: entry.fingerprint,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(createdAt).toISOString(),
    status: "needs_review",
    dimensions,
    explanation: "Advisory, rule-based assessment derived from saved SourceRecord fields. Scores are not facts, verification, or approval.",
    confidence: Number((dimensionsWithSignals / Object.keys(dimensions).length).toFixed(2)),
    routeRecommendations: recommendRoutes(entry, dimensions),
    method: { kind: "rules", version: INTELLIGENCE_RULESET_VERSION },
  };
}

export type RouteDecisionInput =
  | { action: "accept"; reason?: string }
  | { action: "reject"; reason: string }
  | { action: "override"; route: IntelligenceRoute; reason: string };

export function decideIntelligenceRoute(
  assessment: IntelligenceAssessment,
  recommendationId: string,
  input: RouteDecisionInput,
  decidedAt = new Date().toISOString(),
): IntelligenceAssessment {
  if (Number.isNaN(Date.parse(decidedAt))) throw new Error("Route decision timestamp must be a valid date.");
  const recommendation = assessment.routeRecommendations.find((item) => item.id === recommendationId);
  if (!recommendation) throw new Error("Route recommendation does not exist.");
  if (recommendation.decision.status !== "pending") throw new Error("Route recommendation already has a human decision.");
  if ((input.action === "reject" || input.action === "override") && !input.reason.trim()) {
    throw new Error(input.action === "override" ? "An override reason is required." : "A rejection reason is required.");
  }
  if (input.action === "override" && (!INTELLIGENCE_ROUTES.includes(input.route) || input.route === recommendation.route)) {
    throw new Error("Override must select a different supported route.");
  }
  const selectedRoute = input.action === "accept" ? recommendation.route
    : input.action === "override" ? input.route : null;
  const updated: IntelligenceAssessment = {
    ...assessment,
    updatedAt: new Date(decidedAt).toISOString(),
    routeRecommendations: assessment.routeRecommendations.map((item) => item.id !== recommendationId ? item : {
      ...item,
      decision: {
        status: input.action === "accept" ? "accepted" : input.action === "reject" ? "rejected" : "overridden",
        selectedRoute,
        reason: input.action === "accept" ? input.reason?.trim() || null : input.reason.trim(),
        decidedAt: new Date(decidedAt).toISOString(),
        createdArtifactId: null,
      },
    }),
  };
  updated.status = updated.routeRecommendations.every((item) => item.decision.status !== "pending") ? "reviewed" : "needs_review";
  return updated;
}

export function markIntelligenceRouteCreated(
  assessment: IntelligenceAssessment,
  recommendationId: string,
  artifactId: string,
  updatedAt = new Date().toISOString(),
) {
  if (!artifactId.trim() || Number.isNaN(Date.parse(updatedAt))) throw new Error("Created route artifact metadata is invalid.");
  const recommendation = assessment.routeRecommendations.find((item) => item.id === recommendationId);
  if (!recommendation || !["accepted", "overridden"].includes(recommendation.decision.status)
    || !recommendation.decision.selectedRoute) throw new Error("A route must be explicitly accepted before creating its draft.");
  if (recommendation.decision.createdArtifactId && recommendation.decision.createdArtifactId !== artifactId) {
    throw new Error("This route already references a created draft.");
  }
  return {
    ...assessment,
    updatedAt: new Date(updatedAt).toISOString(),
    routeRecommendations: assessment.routeRecommendations.map((item) => item.id === recommendationId
      ? { ...item, decision: { ...item.decision, createdArtifactId: artifactId } }
      : item),
  };
}

export function validateIntelligenceAssessment(value: unknown, sourceRecordId: string, sourceFingerprint: string): value is IntelligenceAssessment {
  if (!value || typeof value !== "object") return false;
  const assessment = value as Partial<IntelligenceAssessment>;
  const dimensionNames: IntelligenceDimensionName[] = ["source_quality", "relevance", "evidence_strength", "actionability", "reuse_potential"];
  if (assessment.schemaVersion !== INTELLIGENCE_ASSESSMENT_SCHEMA_VERSION
    || assessment.sourceRecordId !== sourceRecordId || assessment.sourceFingerprint !== sourceFingerprint
    || typeof assessment.id !== "string" || !assessment.id
    || Number.isNaN(Date.parse(assessment.createdAt ?? "")) || Number.isNaN(Date.parse(assessment.updatedAt ?? ""))
    || !["needs_review", "reviewed"].includes(assessment.status as string)
    || typeof assessment.explanation !== "string" || typeof assessment.confidence !== "number" || !Number.isFinite(assessment.confidence)
    || assessment.confidence < 0 || assessment.confidence > 1
    || assessment.method?.kind !== "rules" || !SUPPORTED_INTELLIGENCE_RULESET_VERSIONS.includes(assessment.method.version)
    || !assessment.dimensions || !assessment.routeRecommendations) return false;
  if (dimensionNames.some((name) => {
    const item = assessment.dimensions?.[name];
    return !item || !Number.isInteger(item.score) || item.score < 0 || item.score > 100
      || typeof item.explanation !== "string" || !Array.isArray(item.signals) || item.signals.some((signal) => typeof signal !== "string");
  })) return false;
  if (!Array.isArray(assessment.routeRecommendations) || assessment.routeRecommendations.some((item) => !item || typeof item !== "object")
    || assessment.routeRecommendations.length !== INTELLIGENCE_ROUTES.length
    || new Set(assessment.routeRecommendations.map((item) => item.route)).size !== INTELLIGENCE_ROUTES.length
    || new Set(assessment.routeRecommendations.map((item) => item.id)).size !== INTELLIGENCE_ROUTES.length) return false;
  if (assessment.routeRecommendations.some((item) => !item || typeof item.id !== "string"
    || !INTELLIGENCE_ROUTES.includes(item.route) || item.id !== `route-${item.route}`
    || !Number.isInteger(item.score) || item.score < 0 || item.score > 100
    || typeof item.explanation !== "string" || !Array.isArray(item.signals) || item.signals.some((signal) => typeof signal !== "string")
    || !item.decision || !["pending", "accepted", "rejected", "overridden"].includes(item.decision.status)
    || (item.decision.selectedRoute !== null && !INTELLIGENCE_ROUTES.includes(item.decision.selectedRoute))
    || (item.decision.reason !== null && typeof item.decision.reason !== "string")
    || (item.decision.decidedAt !== null && Number.isNaN(Date.parse(item.decision.decidedAt)))
    || (item.decision.createdArtifactId !== null && (typeof item.decision.createdArtifactId !== "string" || !item.decision.createdArtifactId))
    || (item.decision.status === "pending" && (item.decision.selectedRoute !== null || item.decision.reason !== null || item.decision.decidedAt !== null || item.decision.createdArtifactId !== null))
    || (item.decision.status === "accepted" && (item.decision.selectedRoute !== item.route || !item.decision.decidedAt))
    || (item.decision.status === "rejected" && (item.decision.selectedRoute !== null || !item.decision.reason?.trim() || !item.decision.decidedAt || item.decision.createdArtifactId !== null))
    || (item.decision.status === "overridden" && (item.decision.selectedRoute === null || item.decision.selectedRoute === item.route || !item.decision.reason?.trim() || !item.decision.decidedAt)))) return false;
  const allDecided = assessment.routeRecommendations.every((item) => item.decision.status !== "pending");
  return assessment.status === (allDecided ? "reviewed" : "needs_review");
}
