import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,statSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../lib/store.mjs';
import {Accounts,issueInvitation} from '../lib/accounts.mjs';
import {backupDatabase,restoreDatabase,inspectDatabase} from '../lib/storage-backup.mjs';
import {createSeason} from '../lib/season.mjs';
const request=cookie=>({headers:{cookie},socket:{remoteAddress:'127.0.0.1'}});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;}});

test('an online SQLite snapshot includes current WAL data and restores accounts, invitations, rooms and private chat',async()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'storage-backup-')),source=path.join(folder,'old','game.sqlite'),snapshot=path.join(folder,'private','backup.sqlite'),target=path.join(folder,'persistent','game.sqlite');
 let original,restored;
 try{
  original=new Store(source);const accounts=new Accounts(original),invitation=issueInvitation(original,{role:'admin'}),res=response();
  const user=await accounts.register(request(''),res,{username:'saveduser',nickname:'저장회원',password:'eight123',invitation:invitation.code});
  user.slots[0]={id:'kept-character',nickname:'SavedPlayer',stats:{mechanics:83}};original.saveUser(user);
  original.saveRoom({id:'kept-room',code:'PERSIST1',players:[{userId:user.id,ownerName:user.name,character:user.slots[0]}],season:createSeason({year:2026,team:'T1',seed:'retained'}),revision:5,submissions:{}});
  original.addMessage('PERSIST1',{channel:'dm',senderId:user.id,to:'friend',text:'private message remains private',at:'2026-11-01'});
  issueInvitation(original);assert(existsSync(source+'-wal'));assert(statSync(source+'-wal').size>0);
  const backed=await backupDatabase(source,snapshot);assert.equal(backed.counts.users,1);assert.equal(backed.counts.accounts,1);assert.equal(backed.counts.rooms,1);assert.equal(backed.counts.messages,1);assert.equal(backed.counts.invitations,2);assert.equal(backed.counts.auth_sessions,1);
  assert.equal(statSync(snapshot).mode&0o777,0o600);assert(!existsSync(snapshot+'-wal'));assert(!existsSync(snapshot+'-shm'));assert(!JSON.stringify(backed).includes('SavedPlayer'));assert(!JSON.stringify(backed).includes('private message'));
  original.close();original=null;rmSync(path.dirname(source),{recursive:true,force:true});
  await restoreDatabase(snapshot,target);restored=new Store(target);const recovered=new Accounts(restored),cookie=res.headers['Set-Cookie'].split(';')[0];
  assert.equal(recovered.current(request(cookie)).user.id,user.id);assert.equal(restored.user(user.id).slots[0].stats.mechanics,83);assert.equal(restored.room('PERSIST1').season.seed,'retained');assert.equal(restored.messages('PERSIST1',user.id)[0].text,'private message remains private');assert.equal(restored.messages('PERSIST1','outsider').length,0);
  const login=response();assert.equal((await recovered.login(request(''),login,{username:'saveduser',password:'eight123'})).id,user.id);
  restored.close();restored=null;const reopened=new Store(target);assert.equal(reopened.user(user.id).slots[0].id,'kept-character');reopened.close();assert.equal(inspectDatabase(target).counts.accounts,1);
 }finally{original?.close();restored?.close();rmSync(folder,{recursive:true,force:true});}
});
test('backup and restore refuse to overwrite files or leftover WAL and reject invalid sources',async()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'storage-refusal-'));let store;
 try{
  const source=path.join(folder,'game.sqlite'),existing=path.join(folder,'kept.sqlite');store=new Store(source);writeFileSync(existing,'keep this exact file');
  await assert.rejects(()=>backupDatabase(source,existing),/이미/);assert.equal(readFileSync(existing,'utf8'),'keep this exact file');
  await assert.rejects(()=>restoreDatabase(source,source),/덮어쓰지/);writeFileSync(path.join(folder,'target.sqlite-wal'),'existing WAL');await assert.rejects(()=>restoreDatabase(source,path.join(folder,'target.sqlite')),/WAL/);
  await assert.rejects(()=>backupDatabase(path.join(folder,'missing.sqlite'),path.join(folder,'out.sqlite')),/원본/);assert(!existsSync(path.join(folder,'missing.sqlite')));
  const unrelated=path.join(folder,'other.sqlite'),db=new DatabaseSync(unrelated);db.exec('CREATE TABLE other(value TEXT)');db.close();await assert.rejects(()=>backupDatabase(unrelated,path.join(folder,'out.sqlite')),/FIRST TEAM/);assert(!existsSync(path.join(folder,'out.sqlite')));
  writeFileSync(path.join(folder,'not-sqlite'),'not a database');assert.throws(()=>inspectDatabase(path.join(folder,'not-sqlite')));
 }finally{store?.close();rmSync(folder,{recursive:true,force:true});}
});
