import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import {listNotices,saveNotice,deleteNotice} from '../lib/notices.mjs';
import {backupDatabase,inspectDatabase} from '../lib/storage-backup.mjs';
test('notices persist edits and deletions across restarts and backups without re-seeding',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'notices-')),file=path.join(dir,'game.sqlite');let store;
 try{
  store=new Store(file);assert.equal(listNotices(store).length,2);
  const welcome=listNotices(store).find(n=>n.id==='welcome');saveNotice(store,{...welcome,title:'운영자가 수정한 안내'},'운영자',welcome.id);
  const update=listNotices(store).find(n=>n.id==='update-media-day');deleteNotice(store,update.id,update.revision);
  const added=saveNotice(store,{title:'점검 안내',body:'첫 줄\n둘째 줄',category:'점검',pinned:true},'운영자');
  assert.throws(()=>saveNotice(store,{...added,title:'오래된 수정',revision:0},'다른 관리자',added.id),/변경되었/);
  assert.throws(()=>deleteNotice(store,added.id,0),/변경되었/);
  await backupDatabase(file,path.join(dir,'snapshot.sqlite'));assert.equal(inspectDatabase(path.join(dir,'snapshot.sqlite')).counts.notices,2);
  store.close();store=new Store(file);const notices=listNotices(store);assert.equal(notices.length,2);assert.equal(notices.find(n=>n.id==='welcome').title,'운영자가 수정한 안내');assert(!notices.some(n=>n.id==='update-media-day'));assert.equal(notices.find(n=>n.id===added.id).body,'첫 줄\n둘째 줄');
  for(const invalid of [{title:' '},{body:' '},{title:'a'.repeat(101)},{body:'a'.repeat(10001)},{category:'other'},{pinned:'true'}])assert.throws(()=>saveNotice(store,{...added,...invalid},'운영자'),e=>e.status===400);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
