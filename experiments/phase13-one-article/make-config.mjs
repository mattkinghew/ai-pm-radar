import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
const sha=x=>createHash("sha256").update(x).digest("hex");
const dir="experiments/phase13-one-article";
const src=JSON.parse(readFileSync(dir+"/fixtures/clean-room-public-article.json","utf8"));
const alternate={...src,summary:"修訂版：為跨裝置協作增加明確備份與人工衝突處理。"};
const oldConfig=JSON.parse(readFileSync("experiments/cloudflare-sync-spike/wrangler-preview-next-cloud-access.jsonc","utf8"));
const id=process.argv[2];
if(!id||!/^[0-9a-f-]{36}$/.test(id))throw Error("D1 database id required");
const shared={
 name:"radar-phase13-one-article-dark",
 main:"./worker.mjs",compatibility_date:"2026-09-01",
 workers_dev:false,preview_urls:false,
 vars:{
  CLOUD_ACCESS_REQUIRED:"true",
  OWNER_EMAIL_SHA256:oldConfig.vars.OWNER_EMAIL_SHA256,
  PILOT_REAL_UPLOAD_ENABLED:"false",
  PINNED_ARTICLE_ID:src.id,
  PINNED_ARTICLE_SHA256:sha(JSON.stringify(src)),
  PINNED_UPDATE_SHA256:sha(JSON.stringify(alternate)),
  PURGE_JOB_ENABLED:"true",
 },
 d1_databases:[{binding:"DB",database_name:"radar-phase13-one-article-20261015",database_id:id}],
 triggers:{crons:["0 * * * *"]},
};
const path=dir+"/wrangler-dark.jsonc";
writeFileSync(path,JSON.stringify(shared,null,2)+"\n");
console.log("DARK_WORKER_CONFIG_READY",JSON.stringify({
 name:shared.name,workers_dev:false,preview_urls:false,routes:0,
 real_upload_enabled:false,owner_identity_guard:true,
 pinned_clean_room_id:src.id,daily_expiry_cron:true,d1_count:1,
}));
