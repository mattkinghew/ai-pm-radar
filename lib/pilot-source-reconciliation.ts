/**
 * Phase 1.4A: safe projection/diff between the actual local Workbench's
 * computed SourceRecord and the Access-protected approved one-article D1.
 * No network writes; this report NEVER represents approval for cloud sync.
 */
import type {SourceRecord} from "./source-inbox.ts";

export const PHASE14_PINNED_CLOUD_ID="src_b374361cee7c6e132205267306a1e82b";
export const PHASE14_PINNED_TITLE="AI PM Radar：以可追溯證據與人工審核提高 AI 研究資料的可信度";
export type PilotProjection={
  status:"no_local"|"different_source_blocked"|"matches_checked_fields"|"local_fields_differ";
  unchanged_fields:string[];
  changed_fields:string[];
  ignored_cloud_fields:string[];
  cloud_write_allowed:false;
  local_approval_carries_to_cloud:false;
};
const fields = [
 "raw_text","title","summary","key_points","key_claims","evidence",
 "why_it_matters","business_implication","ai_pm_implication",
 "video_implication","content_ideas","uncertainties","topic_tags",
 "trend_tags","evidence_grade","confidence","case_candidate",
 "library_targets",
] as const satisfies readonly (keyof SourceRecord)[];
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
export function reconcileLocalWithPinnedCloud(
 local:SourceRecord|null, materialId:string|null, cloud:SourceRecord,
):PilotProjection{
 const common={cloud_write_allowed:false as const,local_approval_carries_to_cloud:false as const,
   ignored_cloud_fields:["source provenance, rights metadata, original revisions",
     "analysis provider metadata, full historical cloud Review / Approval"]};
 if(!local || !materialId)return{...common,status:"no_local",unchanged_fields:[],changed_fields:[]};
 if(materialId!==PHASE14_PINNED_CLOUD_ID
   ||cloud.id!==PHASE14_PINNED_CLOUD_ID
   ||cloud.title!==PHASE14_PINNED_TITLE
   ||local.raw_text!==cloud.raw_text)return{
   ...common,status:"different_source_blocked",unchanged_fields:[],changed_fields:[]
 };
 const unchanged:string[]=[],changed:string[]=[];
 for(const field of fields){
  (same(local[field],cloud[field])?unchanged:changed).push(field);
 }
 return{...common,status:changed.length?"local_fields_differ":"matches_checked_fields",
  unchanged_fields:unchanged,changed_fields:changed};
}
