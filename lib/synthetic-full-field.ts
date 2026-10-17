/**
 * Phase 1.2C-4 full-field structured sync SAFE PROFILE.
 *
 * The real SourceRecord v2 object is transferred, but each user-editable
 * field can only take one of a finite set of canonical fictional values.
 * DO NOT expand to arbitrary text/URLs or use for real records.
 */
import type { SourceRecord } from "./source-inbox.ts";
import { validateSourceRecord } from "./source-inbox.ts";
import { findAnalysisEvidence, sourceTextForAnalysis } from "./ai-analysis.ts";

export const SYNTHETIC_FULL_FIELD_VERSION = 1 as const;
export const SYNTHETIC_TEXT = "Synthetic AI PM Radar practice: Nine students requested additional practice. A human reviewer checked the source evidence. No actual commercial results were measured.";
export const SYNTHETIC_URL = "https://example.invalid/synthetic";
export const SYNTHETIC_QUOTE = "Nine students requested additional practice.";

const EXTRA_CLAIM = "A human reviewer checked the source evidence.";
const evidence = (quote: string) => ({source:SYNTHETIC_URL,timestamp:null,text_reference:quote});
const ALTERNATES = {
  summary: "Synthetic revised source: student requests remained unverified in a real study.",
  key_points: ["Human review remains required before any reuse."],
  key_claims: [{claim:"Human review was documented in the synthetic record.",evidence:[evidence(EXTRA_CLAIM)]}],
  evidence: [evidence(EXTRA_CLAIM)],
  why_it_matters: "Synthetic practice illustrates why evidence review is necessary.",
  business_implication: "Synthetic exercise: no verified client value or measured return.",
  ai_pm_implication: "Use explicit review and versioned approvals for each synthetic source.",
  video_implication: "Synthetic clip only; no live media is generated.",
  content_ideas: ["Write a fictional human-in-the-loop learning scenario."],
  uncertainties: ["No real students or customers participated."],
  trend_tags: ["synthetic-governance"],
  topic_tags: ["ai-pm-training"],
  confidence: 0.5,
  evidence_grade: "C",
  case_candidate: true,
  library_targets: ["case"],
  analysis_source_facts: ["Nine students requested additional practice."],
  analysis_inferences: ["No actual commercial outcomes are known."],
  analysis_methods: ["Require manual verification before recommendation."],
} as const;

export type SyntheticMutableKey =
  | "summary" | "key_points" | "key_claims" | "evidence"
  | "why_it_matters" | "business_implication" | "ai_pm_implication"
  | "video_implication" | "content_ideas" | "uncertainties" | "trend_tags"
  | "topic_tags" | "confidence" | "evidence_grade" | "case_candidate" | "library_targets";
export const SYNTHETIC_MUTABLE_FIELDS: readonly SyntheticMutableKey[] = Object.freeze([
  "summary","key_points","key_claims","evidence","why_it_matters","business_implication",
  "ai_pm_implication","video_implication","content_ideas","uncertainties","trend_tags",
  "topic_tags","confidence","evidence_grade","case_candidate","library_targets",
]);
const ANALYSIS_FIELDS = ["source_facts","inferences","method_or_teaching_points"] as const;
const deepSame = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const exactObject = (a:Record<string,unknown>,b:Record<string,unknown>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => k in b && deepSame(a[k],b[k]));

export function syntheticAlternateValues() { return structuredClone(ALTERNATES); }

function safeQuote(record: SourceRecord): boolean {
  const items = [...record.evidence, ...record.key_claims.flatMap(item=>item.evidence)];
  const text=sourceTextForAnalysis(record);
  return items.every(item=>
    item.source === SYNTHETIC_URL && item.timestamp === null
    && [SYNTHETIC_QUOTE,EXTRA_CLAIM].includes(item.text_reference)
    && Boolean(findAnalysisEvidence(text,item.text_reference))
  );
}

function alternateFor(field: SyntheticMutableKey): unknown {
  return ALTERNATES[field as keyof typeof ALTERNATES];
}
function allowed(field: SyntheticMutableKey, actual: unknown, base: unknown): boolean {
  return deepSame(actual,base) || deepSame(actual,alternateFor(field));
}
function allowedAnalysis(field: typeof ANALYSIS_FIELDS[number], actual:unknown,base:unknown):boolean{
  const alt=field==="source_facts"?ALTERNATES.analysis_source_facts
    :field==="inferences"?ALTERNATES.analysis_inferences:ALTERNATES.analysis_methods;
  return deepSame(actual,base) || deepSame(actual,alt);
}

/** 
 * Entire record must match a server-owned canonical fixture except the
 * finite allowed editable fields. Unknown fields, real source bodies,
 * forged Access metadata, provider claims and arbitrary strings are denied.
 */
export function assertSyntheticFullRecord(record: SourceRecord, canonical: SourceRecord): string[] {
  const reasons:string[]=[];
  if(!record || typeof record!=="object" || Array.isArray(record))return ["record_malformed"];
  if(!record.id || record.id!==canonical.id)return ["identity_mismatch"];
  if(record.record_version!==2)return ["wrong_record_version"];
  if(record.raw_text!==SYNTHETIC_TEXT||record.source_url!==SYNTHETIC_URL)return ["non_synthetic_source"];
  // Real HTTP JSON omits undefined optional SourceRecord properties.
  // Normalize BOTH canonical fixture and incoming payload through JSON before
  // exact schema/key comparison, avoiding local-only vs wire-format mismatch.
  const expected={...JSON.parse(JSON.stringify(canonical)) as SourceRecord,
    review_status:"needs_review" as const,approval_status:"not_approved" as const};
  const normalized={...JSON.parse(JSON.stringify(record)) as SourceRecord,
    review_status:"needs_review" as const,approval_status:"not_approved" as const};
  const wireRecord=normalized as SourceRecord;
  const actualFields=Object.keys(normalized);
  if(actualFields.length!==Object.keys(expected).length || actualFields.some(k=>!(k in expected))){
    reasons.push("record_keys_changed");
  }
  for(const field of Object.keys(expected) as Array<keyof SourceRecord>){
    if(field==="review_status"||field==="approval_status")continue;
    if(field==="analysis"){
      const a=wireRecord.analysis,b=expected.analysis;
      if(!a||!b||Object.keys(a).length!==Object.keys(b).length)reasons.push("analysis_schema_changed");
      if(a&&b)for(const k of Object.keys(b) as Array<keyof typeof b>){
        if((ANALYSIS_FIELDS as readonly string[]).includes(k)){
          if(!allowedAnalysis(k as typeof ANALYSIS_FIELDS[number],a[k],b[k]))reasons.push("analysis_field_not_synthetic:"+k);
        }else if(!deepSame(a[k],b[k]))reasons.push("analysis_provider_or_metadata_changed:"+k);
      }
    }else if((SYNTHETIC_MUTABLE_FIELDS as readonly string[]).includes(field)){
      if(!allowed(field as SyntheticMutableKey,wireRecord[field],expected[field]))reasons.push("non_synthetic_field:"+field);
    }else if(!deepSame(wireRecord[field],expected[field]))reasons.push("immutable_provenance_changed:"+field);
  }
  if(!safeQuote(wireRecord))reasons.push("evidence_missing_in_original_text");
  try { if(validateSourceRecord(record).length)reasons.push("source_record_invalid"); }
  catch{reasons.push("source_record_invalid")}
  return [...new Set(reasons)];
}

/**
 * Prevent silent loss of original Workbench metadata. Changes to these
 * fields are not eligible for this finite synthetic-only pilot; the upload
 * must be BLOCKED rather than replacing altered inputs with canned defaults.
 */
const SYNTHETIC_IMMUTABLE_WORKBENCH_FIELDS = [
  "platform", "source_type", "source_url", "source_url_original", "source_url_final",
  "creator", "title", "description", "published_at", "captured_at", "language",
  "raw_text", "transcript", "transcript_origin", "access_method",
  "rights_note", "material_status",
] as const satisfies readonly (keyof SourceRecord)[];
export function syntheticWorkbenchImmutableIssues(
  workbench: SourceRecord,canonical: SourceRecord,
):string[]{
  const problems:string[]=[];
  for(const field of SYNTHETIC_IMMUTABLE_WORKBENCH_FIELDS){
    if(!deepSame(workbench[field],canonical[field])){
      problems.push("immutable_workbench_field_changed:"+field);
    }
  }
  for(const key of ["version","status","provider","model","analyzed_at","usage","error_code"] as const){
    if(!deepSame(workbench.analysis[key],canonical.analysis[key])){
      problems.push("immutable_analysis_field_changed:"+key);
    }
  }
  return problems;
}

/** Construct the actual full v2 payload from the live React form, fail closed. */
export function prepareSyntheticFullRecord(
  workbench: SourceRecord,canonical: SourceRecord,stableCloudId: string,
): {record:SourceRecord;blockers:string[]} {
  const full=structuredClone(canonical);
  full.id=stableCloudId;
  for(const field of SYNTHETIC_MUTABLE_FIELDS){
    // Reading the real Form's computed record, never replacing with a hidden
    // hardcoded summary-only payload.
    (full as unknown as Record<string,unknown>)[field]=structuredClone(workbench[field]);
  }
  for(const field of ANALYSIS_FIELDS){
    (full.analysis as unknown as Record<string,unknown>)[field]=
      structuredClone(workbench.analysis[field]??[]);
  }
  full.review_status="needs_review";
  full.approval_status="not_approved";
  const blockers=[
    ...syntheticWorkbenchImmutableIssues(workbench,canonical),
    ...assertSyntheticFullRecord(full,{...canonical,id:stableCloudId}),
  ];
  return {record:full,blockers};
}
