import {isIP} from 'node:net';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {normalizeNickname} from './nicknames.mjs';
const derive=promisify(scrypt),DAY=86400000;
export const tokenHash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const cookieToken=req=>{const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ft_session='));return raw?.slice(11)||'';};
const usernameFor=value=>{
 const name=typeof value==='string'?value.trim().toLowerCase():'';
 if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(name))fail(400,'아이디는 영문 소문자·숫자·밑줄·하이픈으로 3~32자 입력하세요.');
 return name;
};
export function nicknameFor(value){
 const name=typeof value==='string'?value.trim().normalize('NFKC'):'';
 if(name.length<2||name.length>24||normalizeNickname(name).length<2||/[\u0000-\u001f\u007f]/.test(name))fail(400,'닉네임은 보이는 글자로 2~24자 입력하세요.');
 return {name,key:normalizeNickname(name)};
}
function validatePassword(value){if(typeof value!=='string'||value.length<10||value.length>128)fail(400,'비밀번호는 10~128자로 입력하세요.');return value;}
export async function hashPassword(password){
 validatePassword(password);const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return `scrypt$16384$8$1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password,encoded){
 if(typeof password!=='string'||password.length>128||typeof encoded!=='string')return false;
 const [kind,n,r,p,salt,hash]=encoded.split('$');
 if(kind!=='scrypt'||n!=='16384'||r!=='8'||p!=='1'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{64}$/.test(hash||''))return false;
 const key=await derive(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(key,Buffer.from(hash,'hex'));
}
export function issueInvitation(store,{createdBy=null,role='member',days=7,now=Date.now(),code=randomBytes(24).toString('base64url')}={}){
 const item={id:randomUUID(),role,createdBy,createdAt:now,expiresAt:now+days*DAY};
 store.db.prepare('INSERT INTO invitations(id,token_hash,role,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?)').run(item.id,tokenHash(code),role,createdBy,now,item.expiresAt);
 return {invitation:item,code};
}

export class Accounts {
 constructor(store,{adminInviteCode='',secure=false,trustProxy=false,now=()=>Date.now()}={}){
  this.store=store;this.secure=secure;this.trustProxy=trustProxy;this.now=now;this.attempts=new Map();
  // Bootstrap is never "first visitor wins". An operator must supply a secret.
  if(adminInviteCode){
   if(typeof adminInviteCode!=='string'||adminInviteCode.length<24||adminInviteCode.length>128)throw new Error('FIRST_TEAM_ADMIN_INVITE는 24~128자로 설정하세요.');
   if(!store.db.prepare("SELECT 1 FROM accounts WHERE role='admin'").get()&&!store.db.prepare('SELECT 1 FROM invitations WHERE token_hash=?').get(tokenHash(adminInviteCode)))issueInvitation(store,{role:'admin',code:adminInviteCode,now:now()});
  }
 }
 account(userId){return this.store.db.prepare('SELECT * FROM accounts WHERE user_id=?').get(userId)||null;}
 current(req){
  const token=cookieToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
  const session=this.store.db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?').get(tokenHash(token),this.now());
  if(!session)return null;const user=this.store.user(session.user_id),account=this.account(session.user_id);return user&&account?{user,account}:null;
 }
 require(req){const current=this.current(req);if(!current)fail(401,'로그인 후 이용해 주세요.');return current;}
 admin(req){const current=this.require(req);if(current.account.role!=='admin')fail(403,'관리자만 초대장을 관리할 수 있습니다.');return current;}
 legacy(req){const token=cookieToken(req);if(!token||token.length>128)return null;const user=this.store.userByToken(tokenHash(token));return user&&!this.account(user.id)?user:null;}
 status(req){return {authenticated:false,user:null,slots:[],rooms:[],auth:{invitationOnly:true,setupReady:Boolean(this.store.db.prepare("SELECT 1 FROM accounts WHERE role='admin' UNION SELECT 1 FROM invitations WHERE role='admin' AND used_by IS NULL AND revoked_at IS NULL AND expires_at>?").get(this.now())),hasLegacySave:Boolean(this.legacy(req))}};}
 address(req){const peer=req.socket?.remoteAddress||'unknown',forwarded=String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim();return this.trustProxy&&isIP(forwarded||'')?forwarded:peer;}
 limit(key,max,minutes=15){
  const now=this.now();for(const [k,v]of this.attempts)if(v.until<=now)this.attempts.delete(k);
  if(this.attempts.size>=10000&&!this.attempts.has(key))fail(429,'요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  const item=this.attempts.get(key)||{count:0,until:now+minutes*60000};item.count++;this.attempts.set(key,item);
  if(item.count>max)fail(429,'시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요.');
 }
 setSession(req,res,userId){
  const now=this.now(),token=randomBytes(32).toString('hex');
  this.store.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=? OR token_hash=?').run(now,tokenHash(cookieToken(req)));
  this.store.db.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(tokenHash(token),userId,now+30*DAY,now);
  // Keep at most ten active devices per account.
  this.store.db.prepare('DELETE FROM auth_sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM auth_sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 10)').run(userId,userId);
  res.setHeader('Set-Cookie',`ft_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${this.secure?'; Secure':''}`);
 }
 async register(req,res,input){
  if(this.current(req))fail(409,'이미 로그인되어 있습니다.');this.limit('register:'+this.address(req),20);
  const username=usernameFor(input.username),nick=nicknameFor(input.nickname),password=validatePassword(input.password);
  const invitation=typeof input.invitation==='string'?input.invitation.trim():'';if(invitation.length<24||invitation.length>128)fail(400,'사용 가능한 사이트 초대코드를 입력하세요.');
  const inviteHash=tokenHash(invitation),validInvite=()=>this.store.db.prepare('SELECT * FROM invitations WHERE token_hash=? AND used_by IS NULL AND revoked_at IS NULL AND expires_at>?').get(inviteHash,this.now());
  if(!validInvite())fail(400,'만료되었거나 사용된 초대장입니다. 새 초대장을 요청해 주세요.');
  const passwordHash=await hashPassword(password),legacy=this.legacy(req);
  return this.store.transaction(()=>{
   const invite=validInvite();if(!invite)fail(400,'만료되었거나 사용된 초대장입니다. 새 초대장을 요청해 주세요.');
   if(this.store.db.prepare('SELECT 1 FROM accounts WHERE username=?').get(username))fail(409,'이미 사용 중인 아이디입니다.');
   if(this.store.db.prepare('SELECT 1 FROM accounts WHERE nickname_key=?').get(nick.key))fail(409,'이미 사용 중인 닉네임입니다.');
   const now=this.now(),user=legacy||{id:randomUUID(),name:nick.name,slots:Array(5).fill(null),createdAt:new Date(now).toISOString()};user.name=nick.name;
   if(legacy){this.store.saveUser(user);this.store.db.prepare('UPDATE users SET token_hash=? WHERE id=?').run(tokenHash(randomBytes(32)),user.id);}else this.store.createUser(user,tokenHash(randomBytes(32)));
   this.store.db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)').run(user.id,username,nick.key,passwordHash,invite.role,now);
   this.store.db.prepare('UPDATE invitations SET used_by=?,used_at=? WHERE id=?').run(user.id,now,invite.id);
   this.syncNickname(user);this.setSession(req,res,user.id);return user;
  });
 }
 async login(req,res,input){
  const raw=typeof input.username==='string'?input.username.trim().toLowerCase():'';this.limit('login-ip:'+this.address(req),60);this.limit('login:'+this.address(req)+':'+raw.slice(0,32),10);
  const account=/^[a-z0-9][a-z0-9_-]{2,31}$/.test(raw)?this.store.db.prepare('SELECT * FROM accounts WHERE username=?').get(raw):null;
  const password=typeof input.password==='string'&&input.password.length<=128?input.password:'';
  const valid=account?await verifyPassword(password,account.password_hash):(await hashPassword(password.length>=10?password:'unknown-account-password'),false);
  if(!valid)fail(401,'아이디 또는 비밀번호를 확인해 주세요.');
  const user=this.store.user(account.user_id);this.store.transaction(()=>{if(this.account(user.id)?.password_hash!==account.password_hash)fail(401,'아이디 또는 비밀번호를 확인해 주세요.');this.setSession(req,res,user.id);});this.attempts.delete('login:'+this.address(req)+':'+raw);return user;
 }
 logout(req,res){this.store.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(tokenHash(cookieToken(req)));res.setHeader('Set-Cookie',`ft_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${this.secure?'; Secure':''}`);return {authenticated:false};}
 syncNickname(user){
  for(const room of this.store.roomsFor(user.id)){const player=room.players.find(p=>p.userId===user.id);player.ownerName=user.name;room.revision=(room.revision||0)+1;this.store.saveRoom(room);}
 }
 rename(user,value){
  const nick=nicknameFor(value);return this.store.transaction(()=>{
   if(this.store.db.prepare('SELECT 1 FROM accounts WHERE nickname_key=? AND user_id!=?').get(nick.key,user.id))fail(409,'이미 사용 중인 닉네임입니다.');
   user.name=nick.name;this.store.db.prepare('UPDATE accounts SET nickname_key=? WHERE user_id=?').run(nick.key,user.id);this.store.saveUser(user);this.syncNickname(user);return user;
  });
 }
 async changePassword(req,res,input){
  const {user,account}=this.require(req);this.limit('password:'+user.id,10);
  if(!await verifyPassword(input.currentPassword,account.password_hash))fail(400,'현재 비밀번호를 확인해 주세요.');
  const encoded=await hashPassword(input.newPassword);this.store.transaction(()=>{if(this.account(user.id)?.password_hash!==account.password_hash)fail(409,'비밀번호가 변경되었습니다. 다시 로그인해 주세요.');this.store.db.prepare('UPDATE accounts SET password_hash=? WHERE user_id=?').run(encoded,user.id);this.store.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(user.id);this.setSession(req,res,user.id);});return {ok:true};
 }
 invitations(req){this.admin(req);return {invitations:this.store.db.prepare("SELECT id,created_at AS createdAt,expires_at AS expiresAt,used_at AS usedAt,revoked_at AS revokedAt FROM invitations WHERE role='member' ORDER BY created_at DESC,rowid DESC LIMIT 100").all()};}
 issue(req,input){
  const {user}=this.admin(req);this.limit('invite:'+user.id,30,1);const days=Number(input.days??7);
  if(!Number.isInteger(days)||days<1||days>30)fail(400,'초대장 유효기간은 1~30일로 선택하세요.');
  const count=this.store.db.prepare('SELECT count(*) AS n FROM invitations WHERE used_by IS NULL AND revoked_at IS NULL AND expires_at>?').get(this.now()).n;if(count>=100)fail(409,'사용 대기 중인 초대장이 너무 많습니다. 기존 초대장을 먼저 취소해 주세요.');
  return issueInvitation(this.store,{createdBy:user.id,days,now:this.now()});
 }
 revoke(req,id){this.admin(req);const result=this.store.db.prepare("UPDATE invitations SET revoked_at=? WHERE id=? AND role='member' AND used_by IS NULL AND revoked_at IS NULL").run(this.now(),id);if(!result.changes)fail(409,'이미 사용되었거나 취소된 초대장입니다.');return {ok:true};}
}
