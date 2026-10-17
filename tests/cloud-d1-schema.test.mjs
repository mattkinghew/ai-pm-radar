import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";

const sql=readFileSync(new URL("../experiments/cloudflare-sync-spike/schema-v12.sql",import.meta.url),"utf8");
const at="2026-10-15T00:00:00.000Z";
const hash="b".repeat(64);

function database(){
 const db=new DatabaseSync(":memory:");
 db.exec("PRAGMA foreign_keys = ON;");
 db.exec(sql);
 return db;
}
function add(db,owner,id="src_a",revision=1){
 db.prepare("INSERT INTO cloud_source_heads VALUES (?, ?, ?, ?, ?, ?)").run(owner,id,revision,hash,at,at);
 db.prepare("INSERT INTO cloud_source_revisions VALUES (?,?,?,?,?,?)").run(owner,id,revision,hash,JSON.stringify({record_version:2,id,raw_text:"Synthetic only"}),at);
}
test("D1 candidate schema creates four normalized owner-scoped tables",()=>{
 const db=database();
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cloud_%'").all().map(x=>x.name);
 for(const name of ["cloud_source_heads","cloud_source_revisions","cloud_source_review_events","cloud_library_snapshots"])
  assert.ok(names.includes(name),name);
 db.close();
});

test("source head compare-and-swap rejects stale revisions",()=>{
 const db=database();
 add(db,"owner_a");
 const sql="UPDATE cloud_source_heads SET current_revision = current_revision+1,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=?";
 assert.equal(db.prepare(sql).run(at,"owner_a","src_a",1).changes,1);
 assert.equal(db.prepare(sql).run(at,"owner_a","src_a",1).changes,0);
 assert.equal(db.prepare(sql).run(at,"owner_b","src_a",2).changes,0);
 assert.equal(db.prepare("SELECT current_revision FROM cloud_source_heads WHERE owner_sub=? AND source_id=?").get("owner_a","src_a").current_revision,2);
 db.close();
});

test("same source ID for different owners is isolated by composite primary keys",()=>{
 const db=database();
 add(db,"owner_a","src_a");
 add(db,"owner_b","src_a");
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cloud_source_heads").get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cloud_source_revisions WHERE owner_sub=?").get("owner_b").n,1);
 assert.throws(()=>db.prepare("INSERT INTO cloud_source_heads VALUES(?,?,?,?,?,?)").run("owner_a","src_a",1,hash,at,at),/UNIQUE/);
 db.close();
});

test("immutable SourceRecord revisions cannot be updated or deleted",()=>{
 const db=database();add(db,"owner_a");
 assert.throws(()=>db.prepare("UPDATE cloud_source_revisions SET source_record_json=? WHERE owner_sub=?").run("{}","owner_a"),/immutable revision/);
 assert.throws(()=>db.prepare("DELETE FROM cloud_source_revisions WHERE owner_sub=?").run("owner_a"),/immutable revision/);
 db.close();
});

test("review events are append-only and tied to valid revision under same owner",()=>{
 const db=database();add(db,"owner_a");
 const addEvent=db.prepare("INSERT INTO cloud_source_review_events VALUES(?,?,?,?,?,?,?)");
 addEvent.run("event_1","owner_a","src_a",1,hash,"captured",at);
 assert.throws(()=>addEvent.run("event_2","owner_b","src_a",1,hash,"reviewed",at),/FOREIGN KEY/);
 assert.throws(()=>addEvent.run("event_3","owner_a","src_a",99,hash,"reviewed",at),/FOREIGN KEY/);
 assert.throws(()=>addEvent.run("event_4","owner_a","src_a",1,hash,"auto_approved",at),/CHECK/);
 assert.throws(()=>db.prepare("DELETE FROM cloud_source_review_events").run(),/immutable event/);
 assert.throws(()=>db.prepare("UPDATE cloud_source_review_events SET action='rejected'").run(),/immutable event/);
 db.close();
});

test("library snapshots require matching historical SourceRecord revision and are immutable",()=>{
 const db=database();add(db,"owner_a");
 const put=db.prepare("INSERT INTO cloud_library_snapshots VALUES(?,?,?,?,?,?)");
 put.run("owner_a","src_a",1,hash,JSON.stringify({version:4,sanitized:true}),at);
 assert.throws(()=>put.run("owner_b","src_a",1,hash,"{}",at),/FOREIGN KEY/);
 assert.throws(()=>put.run("owner_a","src_a",3,hash,"{}",at),/FOREIGN KEY/);
 assert.throws(()=>db.prepare("DELETE FROM cloud_library_snapshots").run(),/immutable library/);
 db.close();
});

test("non JSON SourceRecord or library payload rejected by database constraints",()=>{
 const db=database();add(db,"owner_a");
 assert.throws(()=>db.prepare("INSERT INTO cloud_source_revisions VALUES(?,?,?,?,?,?)").run("owner_a","src_a",2,hash,"unparseable",at),/CHECK/);
 assert.throws(()=>db.prepare("INSERT INTO cloud_library_snapshots VALUES(?,?,?,?,?,?)").run("owner_a","src_a",1,hash,"{broken",at),/CHECK/);
 db.close();
});
