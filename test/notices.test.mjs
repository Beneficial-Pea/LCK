import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import {listNotices,saveNotice,deleteNotice,initializeNotices} from '../lib/notices.mjs';
import {backupDatabase,inspectDatabase} from '../lib/storage-backup.mjs';
test('notices persist edits and deletions across restarts and backups without re-seeding',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'notices-')),file=path.join(dir,'game.sqlite');let store;
 try{
  store=new Store(file);const initialCount=listNotices(store).length;assert(initialCount>=2);
  const welcome=listNotices(store).find(n=>n.id==='welcome');saveNotice(store,{...welcome,title:'운영자가 수정한 안내'},'운영자',welcome.id);
  const update=listNotices(store).find(n=>n.id==='update-media-day');deleteNotice(store,update.id,update.revision);
  const added=saveNotice(store,{title:'점검 안내',body:'첫 줄\n둘째 줄',category:'점검',pinned:true},'운영자');
  assert.throws(()=>saveNotice(store,{...added,title:'오래된 수정',revision:0},'다른 관리자',added.id),/변경되었/);
  assert.throws(()=>deleteNotice(store,added.id,0),/변경되었/);
  await backupDatabase(file,path.join(dir,'snapshot.sqlite'));assert.equal(inspectDatabase(path.join(dir,'snapshot.sqlite')).counts.notices,initialCount);
  store.close();store=new Store(file);const notices=listNotices(store);assert.equal(notices.length,initialCount);assert.equal(notices.find(n=>n.id==='welcome').title,'운영자가 수정한 안내');assert(!notices.some(n=>n.id==='update-media-day'));assert.equal(notices.find(n=>n.id===added.id).body,'첫 줄\n둘째 줄');
  for(const invalid of [{title:' '},{body:' '},{title:'a'.repeat(101)},{body:'a'.repeat(10001)},{category:'other'},{pinned:'true'}])assert.throws(()=>saveNotice(store,{...added,...invalid},'운영자'),e=>e.status===400);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('an existing deployment receives the release notice once while later admin edits and deletion survive restarts',()=>{
 const store=new Store(':memory:');try{
  const id='update-krx-display',key='notice_release_krx_display_v1';
  // Model the database before this release while retaining an edited older notice.
  store.db.prepare('DELETE FROM notices WHERE id=?').run(id);store.db.prepare('DELETE FROM app_settings WHERE key=?').run(key);
  const welcome=listNotices(store).find(n=>n.id==='welcome');saveNotice(store,{...welcome,title:'보존할 운영 공지'},'관리자',welcome.id);
  initializeNotices(store);const release=listNotices(store).find(n=>n.id===id);assert(release);assert.equal(release.category,'업데이트');assert(release.body.includes('KRX로 통일'));assert.equal(listNotices(store).find(n=>n.id==='welcome').title,'보존할 운영 공지');
  saveNotice(store,{...release,body:'관리자가 수정한 내용'},'관리자',id);initializeNotices(store);assert.equal(listNotices(store).find(n=>n.id===id).body,'관리자가 수정한 내용');
  const edited=listNotices(store).find(n=>n.id===id);deleteNotice(store,id,edited.revision);initializeNotices(store);assert(!listNotices(store).some(n=>n.id===id));
 }finally{store.close();}
});

test('the KRX correction removes only the untouched mistaken automatic notice',()=>{
 for(const revision of [1,2]){const store=new Store(':memory:');try{
  store.db.prepare('DELETE FROM notices WHERE id=?').run('update-krx-display');store.db.prepare('DELETE FROM app_settings WHERE key=?').run('notice_release_krx_display_v1');
  store.db.prepare('INSERT INTO notices VALUES(?,?,?,?,?,?,?,?,?)').run('update-drx-display','업데이트 · DRX 팀 이름 표기 통일',revision===1?'이전 자동 안내':'관리자가 수정한 내용','업데이트',0,1,1,'운영팀',revision);
  initializeNotices(store);assert(listNotices(store).some(n=>n.id==='update-krx-display'));assert.equal(listNotices(store).some(n=>n.id==='update-drx-display'),revision===2);
  initializeNotices(store);assert.equal(listNotices(store).filter(n=>n.id==='update-krx-display').length,1);
 }finally{store.close();}}
});
