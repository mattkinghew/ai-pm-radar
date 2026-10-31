import {readFileSync,mkdirSync,writeFileSync,chmodSync} from "node:fs";
import {createHash} from "node:crypto";
import {homedir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
import {FIXTURE_RECORDS,FIXTURE_ALTERNATE_RECORDS} from "./fixtures.mjs";
const config=JSON.parse(readFileSync("experiments/phase13-one-article/wrangler-phase15b-synthetic-protected.jsonc"));
assert.equal(config.vars.CLOUD_ACCESS_REQUIRED,"true");
assert.equal(config.vars.SOURCE_SYNC_ENABLED,"true");
assert.equal(config.vars.SOURCE_SYNC_SYNTHETIC_ONLY,"true");
assert.equal(config.vars.PILOT_REAL_UPLOAD_ENABLED,"false");
assert.equal(config.vars.PILOT_CONTROLLED_COMMIT_ENABLED,"false");
assert.equal(config.d1_databases.find(x=>x.binding==="SYNC_DB").database_name,"radar-phase15b-synthetic-20261015");
const owner="cf_"+config.vars.OWNER_EMAIL_SHA256;
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const hash=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const date=new Date(),created=date.toISOString(),expires=new Date(date.getTime()+7*86400_000).toISOString();
const makeInsert=record=>{
 const id=record.id,sha=hash(record),payload=JSON.stringify(record);
 assert.ok(record.title.startsWith("SYNTHETIC "));
 return [
  "INSERT INTO sync_documents VALUES ("+[owner,id,1,sha,created,created,expires].map(quote).join(",")+");",
  "INSERT INTO sync_revisions VALUES ("+[owner,id,1,sha,payload,created].map(quote).join(",")+");",
  "INSERT INTO sync_events VALUES ("+[owner,id,1,"created",created].map(quote).join(",")+");"
 ];
};
const scripts={
 create:["PRAGMA foreign_keys=ON;",...FIXTURE_RECORDS.slice(0,2).flatMap(makeInsert)],
 update:["PRAGMA foreign_keys=ON;",
  "UPDATE sync_documents SET current_revision=2,content_sha256="+quote(hash(FIXTURE_ALTERNATE_RECORDS[0]))+
  ",updated_at="+quote(created)+" WHERE owner_sub="+quote(owner)+
  " AND source_id="+quote(FIXTURE_RECORDS[0].id)+
  " AND current_revision=1 AND content_sha256="+quote(hash(FIXTURE_RECORDS[0]))+";",
  "INSERT INTO sync_revisions VALUES ("+[owner,FIXTURE_RECORDS[0].id,2,hash(FIXTURE_ALTERNATE_RECORDS[0]),
   JSON.stringify(FIXTURE_ALTERNATE_RECORDS[0]),created].map(quote).join(",")+");",
  "INSERT INTO sync_events VALUES ("+[owner,FIXTURE_RECORDS[0].id,2,"edited",created].map(quote).join(",")+");",
 ],
 delete_one:["PRAGMA foreign_keys=ON;",
  "DELETE FROM sync_documents WHERE owner_sub="+quote(owner)+
  " AND source_id="+quote(FIXTURE_RECORDS[1].id)+";"],
 cleanup:["PRAGMA foreign_keys=ON;",
  ...FIXTURE_RECORDS.slice(0,2).map(r=>"DELETE FROM sync_documents WHERE owner_sub="+quote(owner)+
   " AND source_id="+quote(r.id)+";")]
};
const base=join(homedir(),"Library/Application Support/AI PM Radar/phase15b-private");
mkdirSync(base,{recursive:true,mode:0o700});chmodSync(base,0o700);
for(const [name,statements] of Object.entries(scripts)){
 const file=join(base,"phase15b-smoke-"+name+".sql");
 writeFileSync(file,statements.join("\n")+"\n",{mode:0o600});
 chmodSync(file,0o600);
}
console.log("FOUR_OWNER_SCOPED_SYNTHETIC_ONLY_PRIVATE_SMOKE_SQL_FILES_READY");
console.log("TWO_FIXED_ARTICLES,ONE_ALT_SUMMARY,NO_REAL_D1_SQL");
