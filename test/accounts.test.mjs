import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import {Accounts,hashPassword,verifyPassword,issueInvitation,nicknameFor} from '../lib/accounts.mjs';

const request=(cookie='')=>({headers:{cookie},socket:{remoteAddress:'127.0.0.1'}});
function response(){return {headers:{},setHeader(key,value){this.headers[key]=value;}};}
function fixture(options={}){const folder=mkdtempSync(path.join(tmpdir(),'accounts-unit-')),store=new Store(path.join(folder,'game.sqlite'));return {store,accounts:new Accounts(store,options),close(){store.close();rmSync(folder,{recursive:true,force:true});}};}

test('passwords use independent scrypt salts, reject wrong passwords, and never store plaintext',async()=>{
 const password='test-password-with-spaces 2026',first=await hashPassword(password),second=await hashPassword(password);
 assert.notEqual(first,second);assert(first.startsWith('scrypt$'));assert(!first.includes(password));assert(await verifyPassword(password,first));assert(!await verifyPassword('wrong-password',first));assert(!await verifyPassword(password,'malformed'));
 await assert.rejects(()=>hashPassword('short'),/10~128/);
});
test('bootstrap requires an operator secret; an ordinary invitation cannot promote an account',async()=>{
 const f=fixture();try{
  assert.equal(f.accounts.status(request()).auth.setupReady,false);assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM users').get().n,0);
  const {code}=issueInvitation(f.store),res=response(),user=await f.accounts.register(request(),res,{username:'member',nickname:'일반회원',password:'valid-password-2026',invitation:code,role:'admin'});
  assert.equal(f.accounts.account(user.id).role,'member');assert(res.headers['Set-Cookie'].includes('HttpOnly'));assert(res.headers['Set-Cookie'].includes('SameSite=Strict'));
  const req=request(res.headers['Set-Cookie'].split(';')[0]);assert.equal(f.accounts.current(req).user.id,user.id);assert.throws(()=>f.accounts.admin(req),/관리자/);
  const publicData=JSON.stringify(f.store.user(user.id));assert(!publicData.includes('password'));assert(!publicData.includes('scrypt'));
 }finally{f.close();}
});
test('invites expire, revoke and redeem only once, including simultaneous registration',async()=>{
 let now=1000000000000;const f=fixture({now:()=>now});try{
  const expired=issueInvitation(f.store,{now:now-8*86400000}),revoked=issueInvitation(f.store,{now});f.store.db.prepare('UPDATE invitations SET revoked_at=? WHERE id=?').run(now,revoked.invitation.id);
  const input={username:'friend',nickname:'친구이름',password:'valid-password-2026'};
  await assert.rejects(()=>f.accounts.register(request(),response(),{...input,invitation:expired.code}),/초대장/);await assert.rejects(()=>f.accounts.register(request(),response(),{...input,invitation:revoked.code}),/초대장/);
  const valid=issueInvitation(f.store,{now}),out=await Promise.allSettled([f.accounts.register(request(),response(),{...input,invitation:valid.code}),f.accounts.register(request(),response(),{...input,username:'friend2',nickname:'다른친구',invitation:valid.code})]);
  assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM accounts').get().n,1);
  assert(!JSON.stringify(f.store.db.prepare('SELECT * FROM invitations').all()).includes(valid.code));
 }finally{f.close();}
});
test('session expiry, logout and login throttling are enforced by server state',async()=>{
 let now=1000000000000;const f=fixture({now:()=>now,secure:true});try{
  const invite=issueInvitation(f.store,{now}),res=response();await f.accounts.register(request(),res,{username:'secure',nickname:'로그인유저',password:'valid-password-2026',invitation:invite.code});
  assert(res.headers['Set-Cookie'].includes('; Secure'));const req=request(res.headers['Set-Cookie'].split(';')[0]);assert(f.accounts.current(req));
  now+=31*86400000;assert.equal(f.accounts.current(req),null);
  for(let i=0;i<10;i++)await assert.rejects(()=>f.accounts.login(request(),response(),{username:'secure',password:'wrong-password'}),e=>e.status===401);
  await assert.rejects(()=>f.accounts.login(request(),response(),{username:'secure',password:'valid-password-2026'}),e=>e.status===429);
  now+=16*60000;const logged=response();await f.accounts.login(request(),logged,{username:'SECURE',password:'valid-password-2026'});const active=request(logged.headers['Set-Cookie'].split(';')[0]);assert(f.accounts.current(active));f.accounts.logout(active,response());assert.equal(f.accounts.current(active),null);
 }finally{f.close();}
});
test('nickname normalization prevents duplicate display identities and bootstrap stays consumed across restarts',async()=>{
 assert.equal(nicknameFor('ＡＢ').key,nicknameFor('ab').key);assert.throws(()=>nicknameFor(' \u200b '),/닉네임/);
 const code='operator-bootstrap-test-invite-2026',f=fixture({adminInviteCode:code});try{
  const res=response(),user=await f.accounts.register(request(),res,{username:'owner',nickname:'관리자계정',password:'valid-password-2026',invitation:code});assert.equal(f.accounts.account(user.id).role,'admin');
  const restarted=new Accounts(f.store,{adminInviteCode:code});assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM invitations WHERE role='admin'").get().n,1);
  await assert.rejects(()=>restarted.register(request(),response(),{username:'hijack',nickname:'관리자사칭',password:'valid-password-2026',invitation:code}),/초대장/);
  assert(!JSON.stringify(f.store.db.prepare('SELECT * FROM auth_sessions').all()).includes(res.headers['Set-Cookie'].split(';')[0].split('=')[1]));
 }finally{f.close();}
});
