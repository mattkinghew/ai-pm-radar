import type {SourceRecord} from "./source-inbox.ts";
import {PHASE14_PINNED_CLOUD_ID,PHASE14_PINNED_TITLE} from "./pilot-source-reconciliation.ts";

/**
 * Phase 1.4B: pre-authorized educational UPDATE CANDIDATE, not upload authority.
 * The candidate is built from the ORIGINAL CLOUD record, never by serializing a
 * lossy editable Source Inbox projection. Only summary can be changed.
 */
export const PILOT_ALLOWED_ALTERNATE_SUMMARY =
 "修訂版：為跨裝置協作增加明確備份與人工衝突處理。";
export const PILOT_BASE_RECORD_REVISION = 1;
export type PilotProposedUpdate = {
 ready:boolean;
 blockers:string[];
 touched_fields:readonly ["summary"]|readonly [];
 record:SourceRecord|null;
 allowed_to_write_cloud:false;
 owner_reapproval_required:true;
};
export function proposeControlledSummaryUpdate(
 cloudRecord:SourceRecord,
 materialId:string|null,
 proposedSummary:string,
):PilotProposedUpdate{
 const blockers:string[]=[];
 if(materialId!==PHASE14_PINNED_CLOUD_ID || cloudRecord.id!==PHASE14_PINNED_CLOUD_ID
    ||cloudRecord.title!==PHASE14_PINNED_TITLE)
  blockers.push("source_identity_mismatch");
 if(cloudRecord.record_version!==2 || cloudRecord.material_status!=="captured")
  blockers.push("source_record_invalid");
 if(cloudRecord.review_status!=="needs_review" || cloudRecord.approval_status!=="not_approved")
  blockers.push("cloud_approval_must_be_separate");
 if(proposedSummary!==PILOT_ALLOWED_ALTERNATE_SUMMARY)
  blockers.push("summary_outside_single_clean_room_allowlist");
 if(proposedSummary===cloudRecord.summary)blockers.push("no_change");
 if(blockers.length)return {ready:false,blockers,touched_fields:[],record:null,
  allowed_to_write_cloud:false,owner_reapproval_required:true};
 const record={...cloudRecord,summary:proposedSummary,review_status:"needs_review" as const,
  approval_status:"not_approved" as const};
 return {ready:true,blockers:[],touched_fields:["summary"],record,
  allowed_to_write_cloud:false,owner_reapproval_required:true};
}
