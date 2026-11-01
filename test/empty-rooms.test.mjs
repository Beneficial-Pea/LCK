import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import {issueInvitation} from '../lib/accounts.mjs';
const message=(channel='team')=>({channel,senderId:'u',to:channel==='dm'?'friend':null,text:'fixture message'});
test('purge deletes only explicitly empty rooms and their messages, preserving occupied and ambiguous saves',()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'purge-empty-')),store=new Store(path.join(folder,'game.sqlite'));
 try{
  const user={id:'u',name:'회원',slots:[{id:'saved-player',nickname:'Saved',stats:{macro:80}}]};store.createUser(user,'token-hash');issueInvitation(store);
  for(const r of [{code:'EMPTY001',players:[]},{code:'EMPTY002',players:[],liveMatch:{pendingRoom:{players:[{userId:'u'}]}}},{code:'EMPTY003',players:[],season:{finished:true}},{code:'KEEP0001',players:[{userId:'u'}]},{code:'PARTIAL1',season:{date:'2026-01-12'}}])store.saveRoom(r);
  store.db.prepare('INSERT INTO rooms VALUES (?,?)').run('BROKEN01','{bad json');
  for(const channel of ['team','owner','dm'])store.addMessage('EMPTY001',message(channel));store.addMessage('EMPTY002',message('owner'));store.addMessage('KEEP0001',message());store.addMessage('KEEP0001',message('dm'));store.addMessage('PARTIAL1',message('owner'));
  const kept=store.room('KEEP0001'),partial=store.room('PARTIAL1'),notices=store.db.prepare('SELECT * FROM notices ORDER BY id').all(),invites=store.db.prepare('SELECT * FROM invitations').all();
  assert.deepEqual(store.deleteEmptyRoom('KEEP0001'),{rooms:0,messages:0});
  assert.deepEqual(store.purgeEmptyRooms(),{rooms:3,messages:4});
  for(const code of ['EMPTY001','EMPTY002','EMPTY003']){assert.equal(store.room(code),null);assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages WHERE room_code=?').get(code).n,0);}
  assert.deepEqual(store.room('KEEP0001'),kept);assert.deepEqual(store.room('PARTIAL1'),partial);assert.equal(store.db.prepare('SELECT data FROM rooms WHERE code=?').get('BROKEN01').data,'{bad json');assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get().n,3);
  assert.deepEqual(store.user('u'),user);assert.deepEqual(store.db.prepare('SELECT * FROM notices ORDER BY id').all(),notices);assert.deepEqual(store.db.prepare('SELECT * FROM invitations').all(),invites);assert.deepEqual(store.purgeEmptyRooms(),{rooms:0,messages:0});
 }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});
test('cleanup rolls back room and message deletion together if storage rejects a delete',()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'purge-atomic-')),store=new Store(path.join(folder,'game.sqlite'));
 try{
  store.saveRoom({code:'EMPTY001',players:[]});store.addMessage('EMPTY001',message());store.db.exec("CREATE TRIGGER prevent_room_delete BEFORE DELETE ON rooms BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
  assert.throws(()=>store.purgeEmptyRooms(),/fixture failure/);assert(store.room('EMPTY001'));assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get().n,1);
 }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});
