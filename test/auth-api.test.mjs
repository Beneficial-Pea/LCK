import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../lib/store.mjs';
import {issueInvitation,tokenHash} from '../lib/accounts.mjs';
import {createSeason} from '../lib/season.mjs';
const bootstrap='operator-bootstrap-invite-for-tests-2026',password='valid-password-for-tests-2026';
async function launch(file,env={}){
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',COOKIE_SECURE:'0',DATA_FILE:file,FIRST_TEAM_ADMIN_INVITE:bootstrap,...env},stdio:['ignore','pipe','pipe']});let output='';
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Auth server startup timeout')),10000);child.stdout.on('data',chunk=>{output+=chunk;const port=output.match(/listening on port (\d+)/)?.[1];if(port){clearTimeout(timer);resolve('http://127.0.0.1:'+port);}});child.stderr.on('data',chunk=>{output+=chunk;});child.once('exit',()=>{clearTimeout(timer);reject(new Error(output));});child.once('error',reject);});
 return {base,async stop(){if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}}};
}
function actor(server,cookie=''){return {cookie,async request(route,method='GET',data,headers={}){const response=await fetch(server.base+route,{method,headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(data?{'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];return {status:response.status,data:await response.json(),setCookie,headers:response.headers};}};}
const registration=(username,nickname,invitation)=>({username,nickname,invitation,password});
const player={name:'계정선수',nickname:'AccountPlayer',age:21,position:'MID',team:'T1',mainChampion:'아리',pool:['아리','오리아나']};

test('invite-only authentication gates APIs, preserves accounts across devices, and enforces invitation privileges',async t=>{
 const folder=await mkdtemp(path.join(tmpdir(),'auth-api-')),file=path.join(folder,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const anonymous=actor(server),admin=actor(server),member=actor(server),secondDevice=actor(server),outsider=actor(server);
  await t.test('anonymous visitors never receive a guest identity and cannot access game or invitation APIs',async()=>{
   const session=await anonymous.request('/api/session');assert.equal(session.data.authenticated,false);assert.equal(session.data.user,null);assert.equal(session.setCookie,null);assert.equal(session.data.auth.setupReady,true);
   const malformed=await fetch(server.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'});assert.equal(malformed.status,400);
   for(const [route,method,data]of [['/api/meta','GET'],['/api/slots/0','PUT',{character:player}],['/api/rooms','POST',{slot:0}],['/api/invitations','GET']])assert.equal((await anonymous.request(route,method,data)).status,401);
   assert.equal((await anonymous.request('/api/auth/register','POST',registration('owner','운영자',bootstrap),{Origin:'https://another-site.example'})).status,403);
   assert.equal((await anonymous.request('/api/auth/register','POST',registration('owner','운영자','invalid-invitation-code-2026'))).status,400);
   const db=new Store(file);assert.equal(db.db.prepare('SELECT count(*) AS n FROM users').get().n,0);db.close();
  });
  await t.test('the operator invitation creates the first administrator once and sessions omit credentials',async()=>{
   const response=await admin.request('/api/auth/register','POST',registration('OWNER','운영자',bootstrap));assert.equal(response.status,200);assert.equal(response.data.user.role,'admin');assert.equal(response.data.user.username,'owner');assert(response.setCookie.includes('HttpOnly'));assert(response.setCookie.includes('SameSite=Strict'));
   assert(!JSON.stringify(response.data).includes('scrypt'));assert(!JSON.stringify(response.data).includes(password));assert.equal((await outsider.request('/api/auth/register','POST',registration('hijack','운영자사칭',bootstrap))).status,400);
   assert.deepEqual((await admin.request('/api/invitations')).data.invitations,[]);
  });
  let invite;
  await t.test('member invitations cannot grant admin rights, and cannot be replayed',async()=>{
   const created=await admin.request('/api/invitations','POST',{days:7,role:'admin'});assert.equal(created.status,200);invite=created.data;
   assert.equal(created.data.invitation.role,'member');const response=await member.request('/api/auth/register','POST',{...registration('member','초대회원',invite.code),role:'admin'});assert.equal(response.status,200);assert.equal(response.data.user.role,'member');
   assert.equal((await outsider.request('/api/auth/register','POST',registration('replay','재사용시도',invite.code))).status,400);
   assert.equal((await member.request('/api/invitations')).status,403);assert.equal((await member.request('/api/invitations','POST',{})).status,403);assert.equal((await member.request('/api/invitations/'+invite.invitation.id,'DELETE')).status,403);
   assert.equal((await admin.request('/api/invitations/'+invite.invitation.id,'DELETE')).status,409);
   const listed=await admin.request('/api/invitations');assert(!JSON.stringify(listed.data).includes(invite.code));assert(!JSON.stringify(listed.data).includes('token_hash'));
  });
  await t.test('nickname uniqueness and invite revocation work without consuming invites on failed registration',async()=>{
   const created=(await admin.request('/api/invitations','POST',{days:7})).data;
   assert.equal((await outsider.request('/api/auth/register','POST',registration('member','다른닉네임',created.code))).status,409);
   assert.equal((await outsider.request('/api/auth/register','POST',registration('different','초 대 회 원',created.code))).status,409);
   assert.equal((await admin.request('/api/invitations/'+created.invitation.id,'DELETE')).status,200);
   assert.equal((await outsider.request('/api/auth/register','POST',registration('different','다른회원',created.code))).status,400);
  });
  let code,userId;
  await t.test('the same account restores character slots across isolated browsers and nickname changes reach room rosters',async()=>{
   await member.request('/api/slots/0','PUT',{character:player});const created=await member.request('/api/rooms','POST',{slot:0,year:2026});assert.equal(created.status,200);code=created.data.room.code;userId=created.data.room.players[0].userId;
   const logged=await secondDevice.request('/api/auth/login','POST',{username:'MEMBER',password});assert.equal(logged.status,200);assert.equal(logged.data.user.id,userId);assert.equal(logged.data.slots[0].nickname,player.nickname);assert.equal(logged.data.rooms[0].code,code);
   assert.equal((await admin.request('/api/rooms/'+code)).status,403,'site administrator cannot bypass room membership');
   const renamed=await member.request('/api/profile','POST',{name:'새회원이름'});assert.equal(renamed.status,200);assert.equal((await secondDevice.request('/api/session')).data.user.name,'새회원이름');assert.equal((await secondDevice.request('/api/rooms/'+code)).data.room.players[0].ownerName,'새회원이름');
  });
  await t.test('password changes revoke other devices and old cookies; logout revokes the current session',async()=>{
   const prior=member.cookie;assert.equal((await member.request('/api/auth/password','POST',{currentPassword:'wrong',newPassword:'replacement-password-2026'})).status,400);
   const changed=await member.request('/api/auth/password','POST',{currentPassword:password,newPassword:'replacement-password-2026'});assert.equal(changed.status,200);assert.notEqual(member.cookie,prior);
   assert.equal((await actor(server,prior).request('/api/session')).data.authenticated,false);assert.equal((await secondDevice.request('/api/session')).data.authenticated,false);
   assert.equal((await secondDevice.request('/api/auth/login','POST',{username:'member',password})).status,401);
   assert.equal((await secondDevice.request('/api/auth/login','POST',{username:'member',password:'replacement-password-2026'})).status,200);
   const cookie=secondDevice.cookie;await secondDevice.request('/api/auth/logout','POST',{});assert.equal((await actor(server,cookie).request('/api/meta')).status,401);assert.equal((await secondDevice.request('/api/session')).data.authenticated,false);
  });
  await t.test('restarting retains accounts, active sessions and gameplay without reopening bootstrap registration',async()=>{
   await running.stop();running=null;running=await launch(file,{FIRST_TEAM_ADMIN_INVITE:''});server.base=running.base;
   assert.equal((await member.request('/api/session')).data.user.id,userId);assert.equal((await member.request('/api/rooms/'+code)).data.room.players[0].character.nickname,player.nickname);assert.equal((await admin.request('/api/session')).data.user.role,'admin');
   const database=new Store(file),account=database.db.prepare('SELECT password_hash FROM accounts WHERE user_id=?').get(userId);assert(account.password_hash.startsWith('scrypt$'));assert(!account.password_hash.includes('replacement-password'));database.close();
  });
 }finally{await running?.stop();await rm(folder,{recursive:true,force:true});}
});

test('a valid invitation claims only the current legacy device records and invalidates the old anonymous cookie',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'auth-legacy-')),file=path.join(folder,'game.sqlite'),legacyToken='ab'.repeat(32),legacyId='legacy-user',db=new Store(file);
 const character={...player,id:'kept-character',stats:{mechanics:77},condition:85,fatigue:10,stress:10};
 db.createUser({id:legacyId,name:'기존오너',slots:[character,null,null,null,null],createdAt:'2025-01-01'},tokenHash(legacyToken));
 const room={id:'legacy-room',code:'LEGACY01',hostId:legacyId,players:[{userId:legacyId,ownerName:'기존오너',character}],season:createSeason({year:2026,team:'T1',seed:'preserved'}),submissions:{},revision:0};db.saveRoom(room);const invitation=issueInvitation(db).code;db.close();
 let running;try{
  running=await launch(file);const server={base:running.base},legacy=actor(server,'ft_session='+legacyToken);
  const status=await legacy.request('/api/session');assert.equal(status.data.auth.hasLegacySave,true);assert.equal(status.data.slots.length,0);assert.equal((await legacy.request('/api/rooms/LEGACY01')).status,401);
  const registered=await legacy.request('/api/auth/register','POST',registration('legacy','이어하는회원',invitation));assert.equal(registered.status,200);assert.equal(registered.data.user.id,legacyId);assert.equal(registered.data.slots[0].id,'kept-character');assert.equal(registered.data.slots[0].stats.mechanics,77);assert.equal(registered.data.rooms[0].code,'LEGACY01');
  assert.equal((await legacy.request('/api/rooms/LEGACY01')).data.room.players[0].ownerName,'이어하는회원');assert.equal((await actor(server,'ft_session='+legacyToken).request('/api/meta')).status,401);
  const fresh=actor(server);assert.equal((await fresh.request('/api/auth/login','POST',{username:'legacy',password})).data.user.id,legacyId);assert.equal((await fresh.request('/api/session')).data.slots[0].id,'kept-character');
 }finally{await running?.stop();await rm(folder,{recursive:true,force:true});}
});
