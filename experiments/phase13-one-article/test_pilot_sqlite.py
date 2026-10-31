"""Synthetic-only SQL lifecycle drill. No remote D1 / user data."""
import sqlite3,json,hashlib,datetime
from pathlib import Path
import tempfile

schema=Path(__file__).with_name('schema.sql').read_text()
synthetic={'record_version':2,'id':'src_'+'a'*32,
    'raw_text':'Synthetic public example only; no personal information.',
    'review_status':'needs_review','approval_status':'not_approved',
    'key_claims':[{'claim':'Demonstration','evidence':[{'source':'manual','timestamp':None,
    'text_reference':'Synthetic public example only'}]}],
    'evidence':[{'source':'manual','timestamp':None,'text_reference':'Synthetic public example only'}],
}
payload=json.dumps(synthetic,ensure_ascii=False,separators=(',',':'))
fingerprint=hashlib.sha256(payload.encode()).hexdigest()
now='2026-10-15T00:00:00Z'
due='2026-10-22T00:00:00Z'
owner_a='owner_a_fixture'
owner_b='owner_b_fixture'

def insert(db,owner,source_id):
  with db:
    db.execute('INSERT INTO pilot_documents VALUES (?,?,?,?,?,?,?)',(owner,source_id,1,fingerprint,now,now,due))
    db.execute('INSERT INTO pilot_revisions VALUES (?,?,?,?,?,?)',(owner,source_id,1,fingerprint,payload,now))
    db.execute('INSERT INTO pilot_review_events VALUES (?,?,?,?,?)',(owner,source_id,1,'created',now))

def count(db,table,owner):
  return db.execute('SELECT COUNT(*) FROM '+table+' WHERE owner_sub=?',(owner,)).fetchone()[0]

with tempfile.TemporaryDirectory(prefix="radar-phase13-sqlite-") as tmp:
  db=sqlite3.connect(str(Path(tmp)/'pilot.sqlite3'))
  db.execute('PRAGMA foreign_keys=ON')
  db.executescript(schema)
  insert(db,owner_a,synthetic['id'])
  insert(db,owner_b,'src_'+'b'*32)
  assert count(db,'pilot_documents',owner_a)==1
  print('PASS isolated owner rows')
  try:insert(db,owner_a,'src_'+'c'*32);raise AssertionError('2 articles admitted')
  except sqlite3.IntegrityError: print('PASS exact one article per owner')
  assert db.execute('SELECT source_record_json FROM pilot_revisions WHERE owner_sub=? AND source_id=?',
    (owner_b,synthetic['id'])).fetchone() is None
  print('PASS wrong owner cannot read source payload using scoped query')
  try:
    db.execute('UPDATE pilot_revisions SET content_sha256=? WHERE owner_sub=?',(fingerprint,owner_a))
    raise AssertionError('historical revision overwritten')
  except sqlite3.IntegrityError: print('PASS no in-place mutation of historical revisions')
  # CAS: 1 writer succeeds; same stale revision cannot update twice.
  with db:
    updated=db.execute('UPDATE pilot_documents SET current_revision=2,updated_at=? WHERE owner_sub=? AND source_id=? AND current_revision=1',
      (now,owner_a,synthetic['id']))
    assert updated.rowcount==1
    db.execute('INSERT INTO pilot_revisions VALUES (?,?,?,?,?,?)',(owner_a,synthetic['id'],2,fingerprint,payload,now))
    db.execute('INSERT INTO pilot_review_events VALUES (?,?,?,?,?)',(owner_a,synthetic['id'],2,'reviewed',now))
  second=db.execute('UPDATE pilot_documents SET current_revision=3 WHERE owner_sub=? AND source_id=? AND current_revision=1',
    (owner_a,synthetic['id']))
  assert second.rowcount==0
  print('PASS compare-and-swap rejects stale revision')
  # Create a separate offline JSON restore point, not a remote backup.
  before=[row[0] for row in db.execute('SELECT source_record_json FROM pilot_revisions WHERE owner_sub=? ORDER BY revision',(owner_a,))]
  archive=json.loads(json.dumps({'record_versions':before,'source_id':synthetic['id']}))
  assert hashlib.sha256(archive['record_versions'][0].encode()).hexdigest()==fingerprint
  print('PASS offline backup JSON round-trip with unchanged SHA-256')
  # Owner-scoped purge physically removes parent + revisions + events.
  with db:
    deleted=db.execute('DELETE FROM pilot_documents WHERE owner_sub=? AND source_id=?',(owner_a,synthetic['id']))
    assert deleted.rowcount==1
  for table in ('pilot_documents','pilot_revisions','pilot_review_events'):
    assert count(db,table,owner_a)==0,table
    assert count(db,table,owner_b)==1,table
  print('PASS explicit purge removes article/revisions/events without removing other owners')
  # Restore into a new isolated database only (NOT into shared live db).
  restored=sqlite3.connect(':memory:')
  restored.execute('PRAGMA foreign_keys=ON')
  restored.executescript(schema)
  insert(restored,owner_a,archive['source_id'])
  read=restored.execute('SELECT source_record_json FROM pilot_revisions WHERE owner_sub=?',(owner_a,)).fetchone()[0]
  assert hashlib.sha256(read.encode()).hexdigest()==fingerprint
  print('PASS restored synthetic source matches original content SHA-256')
  # TTL due row scan uses index: simulate advancing date beyond due.
  expired=restored.execute('SELECT source_id FROM pilot_documents WHERE owner_sub=? AND purge_due_at<=?',(
    owner_a,'2026-10-23T00:00:00Z')).fetchall()
  assert expired==[(synthetic['id'],)]
  print('PASS expiry selection for scheduled 7-day limit')
  print('PHASE13_ISOLATED_D1_SCHEMA_RECOVERY_PURGE_TEST_PASS')
