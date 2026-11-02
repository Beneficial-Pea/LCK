import {beginLiveMatch,advanceLiveMatch} from '../lib/live-match.mjs';
import {mergeLiveRoom} from '../public/live-updates.js';
import { registerTestServer, ensureTestAccount } from './helpers/accounts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { Store } from '../lib/store.mjs';
import { updateDemacia } from '../lib/demacia.mjs';
import { settleDay } from '../lib/season.mjs';
import { qualifierNodes } from '../lib/ewc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function launch(dataFile,overrides={}) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_FILE: dataFile,...overrides },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10_000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  registerTestServer(base,dataFile);
  return {
    base,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  };
}

function actor(server) {
  return {
    cookie: '',
    async request(route, method = 'GET', body) {
      await ensureTestAccount(server,this);
      const headers = {};
      if (this.cookie) headers.Cookie = this.cookie;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(server.base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, data: response.status === 304 ? null : await response.json() };
    }
  };
}

const character = (position, nickname) => ({
  name: `선수 ${nickname}`, nickname, age: 21, appearance: '검은 재킷', personality: '짧게 말한다', memo: 'API 시험 캐릭터',
  team: 'T1', position, mainChampion: '아지르', pool: ['아지르', '오리아나', '신드라'], style: '균형 운영', tier: '연습생'
});

test('background bonuses are server-owned, do not stack on edits, and leave active character snapshots intact',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'background-api-')),server={base:''};let running;
 try{
  running=await launch(path.join(temp,'game.sqlite'));server.base=running.base;const user=actor(server);
  await user.request('/api/session');
  const meta=(await user.request('/api/meta')).data;assert(meta.characterBackgrounds.some(b=>b.id==='former_all_pro'));
  const input={...character('MID','PriorAllPro'),background:'former_all_pro',stats:{mechanics:999},bonuses:{mechanics:999}};
  let result=await user.request('/api/slots/0','PUT',{character:input});assert.equal(result.status,200);const saved=result.data.slots[0];
  assert(Object.values(saved.stats).every(v=>v===66));assert.equal(saved.background,'former_all_pro');
  result=await user.request('/api/rooms','POST',{slot:0,year:2026,seed:'background-api'});assert.equal(result.status,200);const code=result.data.room.code;
  result=await user.request('/api/slots/0','PUT',{character:{...saved,background:'veteran'}});assert.equal(result.data.slots[0].stats.mechanics,65);assert.equal(result.data.slots[0].stats.communication,67);
  const room=(await user.request('/api/rooms/'+code)).data.room;assert.equal(room.players[0].character.background,'former_all_pro');assert.deepEqual(room.players[0].character.stats,saved.stats);assert(room.players[0].character.readiness);
  assert.equal((await user.request('/api/slots/0','PUT',{character:{...input,background:'invented'}})).status,400);
  await user.request('/api/slots/1','PUT',{character:character('SUP','LegacyBase')});assert(Object.values((await user.request('/api/session')).data.slots[1].stats).every(v=>v===65));
  for(const file of ['/honors.js','/tournament-board.js'])assert.equal((await fetch(server.base+file)).status,200);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('automatic champion pools follow position/style on the server and manual edits preserve active snapshots',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'champion-suggestions-')),server={base:''};let running;
 try{
  running=await launch(path.join(temp,'game.sqlite'));server.base=running.base;const user=actor(server);await user.request('/api/session');
  const meta=(await user.request('/api/meta')).data;assert.equal(Object.keys(meta.championRecommendations).length,5);
  const input={...character('SUP','SuggestionPlayer'),style:'한타',autoChampions:true,mainChampion:'',pool:['아리']};
  let response=await user.request('/api/slots/0','PUT',{character:input});assert.equal(response.status,200);const support=response.data.slots[0];
  assert.equal(support.mainChampion,'렐');assert.deepEqual(support.pool,meta.championRecommendations.SUP['한타'].pool);assert.equal(support.autoChampions,true);
  const room=(await user.request('/api/rooms','POST',{slot:0,year:2026})).data.room;
  response=await user.request('/api/slots/0','PUT',{character:{...input,position:'MID',style:'사이드 운영',mainChampion:'제이스'}});
  assert.equal(response.data.slots[0].mainChampion,'트위스티드 페이트');assert.deepEqual(response.data.slots[0].pool,meta.championRecommendations.MID['사이드 운영'].pool);
  const active=(await user.request('/api/rooms/'+room.code)).data.room.players[0].character;assert.equal(active.position,'SUP');assert.equal(active.mainChampion,'렐');assert.deepEqual(active.pool,support.pool);
  response=await user.request('/api/slots/0','PUT',{character:{...input,autoChampions:false,position:'TOP',mainChampion:'갱플랭크',pool:['그웬']}});
  assert.equal(response.data.slots[0].mainChampion,'갱플랭크');assert.deepEqual(response.data.slots[0].pool,['갱플랭크','그웬']);assert.equal(response.data.slots[0].autoChampions,false);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('room seeds are random and client-independent, shared by peers, and stable through reloads and restarts',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'random-seed-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server),peer=actor(server);
  await host.request('/api/session');await peer.request('/api/session');
  await host.request('/api/slots/0','PUT',{character:character('MID','RandomHost')});await peer.request('/api/slots/0','PUT',{character:character('JGL','RandomPeer')});
  const settings={slot:0,year:2026,seed:'cannot-force-this-seed'},first=(await host.request('/api/rooms','POST',settings)).data.room,second=(await host.request('/api/rooms','POST',settings)).data.room;
  assert.match(first.season.seed,/^[a-f0-9]{48}$/);assert.notEqual(first.season.seed,settings.seed);assert.notEqual(first.season.seed,second.season.seed);
  const route='/api/rooms/'+first.code;
  const joined=await peer.request('/api/rooms/join','POST',{slot:0,code:first.code});assert.equal(joined.data.room.season.seed,first.season.seed);
  let room=first;while(room.season.date<'2026-01-17'){
   const practice=room.scrimSchedule?.find(e=>e.date===room.season.date&&e.status==='scheduled');if(practice){assert.equal((await host.request(route+'/scrim','POST',{turn:room.season.turn,id:practice.id,focus:'balanced'})).status,200);}
   const settled=await host.request(route+'/settle','POST',{turn:room.season.turn,npcTakeover:true});assert.equal(settled.status,200);room=settled.data.room;
  }
  assert(room.season.results.length>=2);assert.equal(new Set(room.season.results.map(m=>m.result.seed)).size,room.season.results.length);
  for(const m of room.season.results)assert.equal(m.result.seed,first.season.seed+':'+m.id);
  assert.equal((await host.request(route)).data.room.season.seed,first.season.seed);assert.deepEqual((await peer.request(route)).data.room.season.results,room.season.results);
  await running.stop();running=null;
  const store=new Store(file),legacy=store.room(second.code);legacy.season.seed='previously-saved-seed';store.saveRoom(legacy);store.close();
  running=await launch(file);server.base=running.base;
  assert.equal((await host.request(route)).data.room.season.seed,first.season.seed);
  assert.equal((await host.request('/api/rooms/'+second.code)).data.room.season.seed,'previously-saved-seed');
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('2026 auto preparation passes club events and stops only at own games or detailed scrims',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'club-api-')),dataFile=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(dataFile);server.base=running.base;const user=actor(server);await user.request('/api/slots/0','PUT',{character:character('MID','ClubPlayer')});
  let response=await user.request('/api/rooms','POST',{slot:0,year:2026});const route='/api/rooms/'+response.data.room.code;
  response=await user.request(route+'/auto','POST',{turn:1});assert.equal(response.status,200);assert(response.data.days>=2);assert(response.data.decisions.length);assert(response.data.decisions[0].reason);
  const r=response.data.room;assert(r.season.clubDiary.length);assert.equal(r.season.cupDraft.status,'completed');assert.equal(new Set(r.season.clubDiary.map(e=>e.id)).size,r.season.clubDiary.length);
  assert(r.season.schedule.some(m=>m.date===r.season.date&&m.status==='scheduled'&&[m.teamA,m.teamB].includes(r.season.team))||r.scrimSchedule.some(e=>e.date===r.season.date&&e.status==='scheduled'));
  assert.equal((await user.request(route+'/auto','POST',{turn:r.season.turn})).status,409);
  await running.stop();running=await launch(dataFile);server.base=running.base;const restored=(await user.request(route)).data.room;assert.deepEqual(restored.season.clubDiary,r.season.clubDiary);assert.equal(restored.season.turn,r.season.turn);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('Demacia invitations enforce host authority and persist refusal; own games use the shared live broadcast',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'demacia-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 const start=async()=>{running=await launch(file,{LIVE_STEP_MS:'30'});server.base=running.base;};
 try{
  await start();const host=actor(server),peer=actor(server);
  await host.request('/api/session');await peer.request('/api/session');
  await host.request('/api/slots/0','PUT',{character:{...character('MID','DemaHost'),team:'KT'}});
  await peer.request('/api/slots/0','PUT',{character:{...character('JGL','DemaPeer'),team:'KT'}});
  const created=(await host.request('/api/rooms','POST',{slot:0,year:2026,seed:'demacia-api'})).data.room;
  await peer.request('/api/rooms/join','POST',{slot:0,code:created.code});
  await running.stop();
  const db=new Store(file),r=db.room(created.code),s=r.season;
  const order=['T1','Gen.G','HLE','DK','KT','BNK','DRX','NS','DNF','BRO'];
  s.date='2026-09-14';s.turn=246;s.standings.sort((a,b)=>order.indexOf(a.team)-order.indexOf(b.team));s.groups={legend:order.slice(0,5),rise:order.slice(5)};
  s.flags.worldsSeeded=true;s.qualifications.worlds.teams=order.slice(0,4);
  s.results.push({id:'msi-final',stage:'MSI',teamA:'T1',teamB:'BLG',result:{winner:'T1',scoreA:3,scoreB:1}});updateDemacia(s);db.saveRoom(r);
  const liveRoom=structuredClone(r);liveRoom.code='D3AC1A01';liveRoom.id+='-live';liveRoom.season.date='2026-10-03';liveRoom.season.turn=265;db.saveRoom(liveRoom);db.close();await start();
  const route='/api/rooms/'+created.code;
  assert.equal((await peer.request(route+'/demacia-decline','POST',{})).status,403);
  const declined=await host.request(route+'/demacia-decline','POST',{});assert.equal(declined.status,200);assert.deepEqual(declined.data.room.season.qualifications.demacia.teams,['BNK','DRX','NS']);
  assert.equal(declined.data.room.season.qualifications.demacia.status,'declined');
  assert.equal((await host.request(route+'/demacia-decline','POST',{})).status,409);
  await running.stop();await start();assert.deepEqual((await host.request(route)).data.room.season.demacia.declined,['KT']);
  const liveRoute='/api/rooms/'+liveRoom.code;
  assert.equal((await host.request(liveRoute+'/demacia-decline','POST',{})).status,409);
  await host.request(liveRoute+'/action','POST',{turn:265,action:'rest'});await peer.request(liveRoute+'/action','POST',{turn:265,action:'rest'});
  const live=await host.request(liveRoute+'/settle','POST',{turn:265,live:true});assert.equal(live.status,200);
  assert.equal(live.data.room.broadcast.stage,'데마시아컵');assert.equal(live.data.room.season.date,'2026-10-03');assert(!live.data.room.liveMatch);
  assert.equal(live.data.room.season.demacia.online.reduce((n,r)=>n+r.wins,0),0,'Upcoming online results stay private');
  let after;
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,30));after=(await host.request(liveRoute)).data.room;if(after.broadcast?.intermission){const p=after.broadcast.intermission;await host.request(liveRoute+'/set-strategy','POST',{turn:after.season.turn,...p,strategy:'balanced'});}if(!after.broadcast)break;}
  assert(!after.broadcast);assert.equal(after.season.date,'2026-10-04');assert.equal(after.season.turn,266);
  assert.equal(after.season.results.filter(m=>m.id.startsWith('demacia-')).length,6);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('vacations skip shared days without choices and the selected Gen.G still plays a live Road to EWC qualification match',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'ewc-vac-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 const start=async()=>{running=await launch(file,{LIVE_STEP_MS:'10'});server.base=running.base;};
 try{
  await start();const host=actor(server),peer=actor(server);await host.request('/api/session');await peer.request('/api/session');
  await host.request('/api/slots/0','PUT',{character:{...character('MID','RoadHost'),team:'Gen.G'}});await peer.request('/api/slots/0','PUT',{character:{...character('JGL','RoadPeer'),team:'Gen.G'}});
  const teams=['T1','Gen.G','HLE','DK','KT','BNK','DRX','NS','DNF','BRO'];
  const created=(await host.request('/api/rooms','POST',{slot:0,year:2026,seed:'ewc-strong-api',npcPower:95,difficulty:'easy',opponents:teams.map(name=>({name,power:35,style:'균형 운영'}))})).data.room;
  await peer.request('/api/rooms/join','POST',{slot:0,code:created.code});await running.stop();
  const db=new Store(file),r=db.room(created.code);
  for(const p of r.players)for(const key of Object.keys(p.character.stats))p.character.stats[key]=95;
  while(r.season.date<'2026-03-03')settleDay(r,{npcTakeover:true});
  const holiday=structuredClone(r);holiday.code='VACAA001';holiday.id+='-holiday';db.saveRoom(holiday);
  while(r.season.date<'2026-05-25')settleDay(r,{npcTakeover:true});
  const n=qualifierNodes(r.season),qualification=r.season.schedule.find(m=>m.id==='ewc-kr-'+n.upperFinal);
  assert([qualification.teamA,qualification.teamB].includes('Gen.G'),'The selected club reaches the BO5 fixture');
  const background=structuredClone(r.season.ewc.previousChampion),r1=structuredClone(r.season.ewc.r1Standings);assert.notEqual(background.team,'Gen.G');db.saveRoom(r);db.close();await start();
  const vacationRoute='/api/rooms/'+holiday.code;
  assert.equal((await host.request(vacationRoute)).data.room.vacation.remainingDays,5);
  assert.equal((await host.request(vacationRoute+'/action','POST',{turn:holiday.season.turn,action:'mechanics'})).status,409);
  assert.equal((await host.request(vacationRoute+'/life','POST',{entryId:'x',choice:'join'})).status,409);
  assert.equal((await peer.request(vacationRoute+'/vacation','POST',{turn:holiday.season.turn,untilEnd:true})).status,403);
  const skipped=await host.request(vacationRoute+'/vacation','POST',{turn:holiday.season.turn,untilEnd:true});assert.equal(skipped.status,200);assert.equal(skipped.data.days,5);
  const after=skipped.data.room;assert.equal(after.season.date,'2026-03-08');assert.equal(after.vacation,null);assert.equal(after.season.vacations.entries.length,10);
  assert.deepEqual(after.players.map(p=>p.character.stats),holiday.players.map(p=>p.character.stats));
  assert.equal((await host.request(vacationRoute+'/vacation','POST',{turn:holiday.season.turn,untilEnd:true})).status,409);
  const route='/api/rooms/'+r.code;const before=(await host.request(route)).data.room;assert.deepEqual(before.season.ewc.previousChampion,background);assert(before.season.ewc.qualifierTeams.includes('Gen.G'));
  for(const user of [host,peer])assert.equal((await user.request(route+'/action','POST',{turn:r.season.turn,action:'rest'})).status,200);
  const live=await host.request(route+'/settle','POST',{turn:r.season.turn,live:true});assert.equal(live.status,200);assert.equal(live.data.room.broadcast.stage,'EWC 한국 예선');assert.equal(live.data.room.broadcast.bestOf,5);
  assert(!live.data.room.season.results.some(m=>m.id===qualification.id),'The qualification winner is not public before the live match finishes');
  let completed;
  for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,15));completed=(await host.request(route)).data.room;if(completed.broadcast?.intermission){const p=completed.broadcast.intermission;await host.request(route+'/set-strategy','POST',{turn:completed.season.turn,...p,strategy:'balanced'});}if(!completed.broadcast)break;}
  assert(!completed.broadcast);assert.equal(completed.season.date,'2026-05-26');assert.equal(completed.season.qualifications.ewc.status,'qualified');assert(completed.season.qualifications.ewc.teams.includes('Gen.G'));
  assert.deepEqual(completed.season.ewc.r1Standings,r1);assert.deepEqual(completed.season.ewc.previousChampion,background);
  await running.stop();await start();assert.deepEqual((await host.request(route)).data.room.season.ewc.previousChampion,background);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('persistent multiplayer HTTP workflow enforces turn ownership and message privacy', { timeout: 90_000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-api-'));
  const dataFile = path.join(temp, 'game.sqlite');
  let running;
  const server = { base: '' };
  try {
    running = await launch(dataFile); server.base = running.base;
    const users = Array.from({ length: 6 }, () => actor(server));
    const sessions = [];
    for (let i = 0; i < users.length; i++) {
      const session = await users[i].request('/api/session');
      assert.equal(session.status, 200);
      assert.equal(session.data.slots.length, 5);
      assert.match(users[i].cookie, /^ft_session=/);
      sessions.push(session.data);
      await users[i].request('/api/profile', 'POST', { name: `오너${i}` });
    }
    assert.equal(new Set(sessions.map(s => s.user.id)).size, 6);
    const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'TOP'];
    for (let i = 0; i < users.length; i++) {
      const saved = await users[i].request('/api/slots/0', 'PUT', { character: character(positions[i], `P${i}`) });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.slots[0].tier, '1군');
      assert.equal(saved.data.slots[1], null);
    }
    const created = await users[0].request('/api/rooms', 'POST', { slot: 0, name: '동기화 테스트', seed: 'api-2025', npcPower: 65 });
    assert.equal(created.status, 200);
    const code = created.data.room.code;
    const route = `/api/rooms/${code}`;
    let room = created.data.room;

    await t.test('membership, private slots, duplicate positions and five-player limit', async () => {
      assert.equal((await users[5].request(route)).status, 403);
      const outsider = await users[5].request('/api/session');
      assert.equal(outsider.data.rooms.length, 0);
      assert.equal(outsider.data.slots[0].nickname, 'P5');
      assert.ok(!JSON.stringify(outsider.data).includes('P0'));
      assert.equal((await users[1].request('/api/slots/1', 'PUT', { character: character('TOP', 'duplicate') })).status, 200);
      const duplicate = await users[1].request('/api/rooms/join', 'POST', { code, slot: 1 });
      assert.equal(duplicate.status, 409);
      for (let i = 1; i < 5; i++) {
        const joined = await users[i].request('/api/rooms/join', 'POST', { code, slot: 0 });
        assert.equal(joined.status, 200);
        room = joined.data.room;
      }
      assert.equal(room.players.length, 5);
      assert.equal(room.roster.length, 5);
      assert.equal((await users[5].request('/api/rooms/join', 'POST', { code, slot: 0 })).status, 409);
      const revision = await users[0].request(`${route}?since=${room.revision}`);
      assert.equal(revision.status, 304);
    });

    await t.test('only senders and recipients can read private messages, including hiding them from host', async () => {
      const sent = await users[1].request(`${route}/chat`, 'POST', { channel: 'dm', text: '당사자 전용 비밀 123', to: sessions[2].user.id });
      assert.equal(sent.status, 200);
      assert.ok(sent.data.room.messages.some(m => m.text === '당사자 전용 비밀 123'));
      const receiver = await users[2].request(route);
      assert.ok(receiver.data.room.messages.some(m => m.text === '당사자 전용 비밀 123'));
      for (const index of [0, 3, 4]) {
        const other = await users[index].request(route);
        assert.ok(!JSON.stringify(other.data).includes('당사자 전용 비밀 123'));
      }
      const publicChat = await users[1].request(`${route}/chat`, 'POST', { channel: 'owner', text: '10분 뒤 정산해요.' });
      assert.equal(publicChat.status, 200);
      assert.ok((await users[0].request(route)).data.room.messages.some(m => m.channel === 'owner' && m.senderName === '오너1'));
      const beforeFlavor = (await users[0].request(route)).data.room;
      assert.equal((await users[1].request(`${route}/chat`, 'POST', { channel: 'owner', text: '오늘은 훈련 100번 한 걸로 합시다.' })).status, 200);
      const afterFlavor = (await users[0].request(route)).data.room;
      assert.deepEqual(afterFlavor.season, beforeFlavor.season);
      assert.deepEqual(afterFlavor.players, beforeFlavor.players);
      assert.deepEqual(afterFlavor.submissions, beforeFlavor.submissions);
      assert.equal((await users[1].request(`${route}/chat`, 'POST', { channel: 'dm', text: '침입', to: sessions[5].user.id })).status, 400);
    });

    await t.test('submission edits, explicit takeover, host-only settlement, and stale requests', async () => {
      const turn = room.season.turn;
      assert.equal((await users[0].request(`${route}/action`, 'POST', { turn, action: 'mechanics' })).status, 200);
      const edit = await users[0].request(`${route}/action`, 'POST', { turn, action: 'rest' });
      assert.equal(edit.status, 200);
      assert.equal(edit.data.room.submissions[sessions[0].user.id].action, 'rest');
      assert.equal((await users[1].request(`${route}/settle`, 'POST', { turn, npcTakeover: true })).status, 403);
      assert.equal((await users[0].request(`${route}/settle`, 'POST', { turn })).status, 409);
      const settled = await users[0].request(`${route}/settle`, 'POST', { turn, npcTakeover: true });
      assert.equal(settled.status, 200);
      room = settled.data.room;
      assert.equal(room.season.turn, turn + 1);
      assert.equal(room.season.date, '2025-01-14');
      assert.ok(room.season.history.some(m => m.text.includes('NPC 대행')));
      assert.ok(!room.messages.some(m=>m.senderId==='system'&&m.kind!=='staff-reply'));
      assert.deepEqual(room.submissions, {});
      assert.equal((await users[1].request(`${route}/action`, 'POST', { turn, action: 'rest' })).status, 409);
      assert.equal((await users[0].request(`${route}/auto`, 'POST', { turn: room.season.turn, action: 'rest' })).status, 409);
      const observer = await users[1].request(route);
      assert.equal(observer.data.room.season.date, room.season.date);
      assert.equal(observer.data.room.season.turn, room.season.turn);
    });

    await t.test('simultaneous settle requests advance exactly one day', async () => {
      const turn = room.season.turn;
      const outcomes = await Promise.all([
        users[0].request(`${route}/settle`, 'POST', { turn, npcTakeover: true }),
        users[0].request(`${route}/settle`, 'POST', { turn, npcTakeover: true })
      ]);
      assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 409]);
      room = (await users[0].request(route)).data.room;
      assert.equal(room.season.turn, turn + 1);
    });

    await t.test('two real sessions observe the same simulated match result', async () => {
      const nextGame = room.season.schedule.filter(g => g.date >= room.season.date && [g.teamA, g.teamB].includes(room.season.team) && g.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0];
      assert.ok(nextGame, 'a scheduled own-team game must exist');
      let days = 0;
      while (room.season.date <= nextGame.date && days++ < 30) {
        const settled = await users[0].request(`${route}/settle`, 'POST', { turn: room.season.turn, npcTakeover: true });
        assert.equal(settled.status, 200);
        room = settled.data.room;
      }
      assert.ok(days < 30, 'must reach first own game in bounded days');
      const played = room.season.schedule.find(g => g.id === nextGame.id);
      assert.equal(played.status, 'completed');
      assert.ok(played.result.sets.length >= 1);
      const other = (await users[1].request(route)).data.room;
      assert.equal(other.season.date, room.season.date);
      assert.deepEqual(other.season.schedule.find(g => g.id === nextGame.id).result, played.result);
    });

    await t.test('editing a character slot never swaps a live season character', async () => {
      const original = room.players.find(p => p.userId === sessions[0].user.id).character;
      const changed = await users[0].request('/api/slots/0', 'PUT', { character: character('SUP', '다른시즌선수') });
      assert.equal(changed.status, 200);
      assert.equal(changed.data.slots[0].nickname, '다른시즌선수');
      room = (await users[0].request(route)).data.room;
      assert.deepEqual(room.players.find(p => p.userId === sessions[0].user.id).character, original);
      const exported = await users[0].request(`${route}/export`);
      assert.equal(exported.status, 200);
      assert.equal(exported.data.format, 'first-team-season-v1');
      assert.ok(!JSON.stringify(exported.data).includes('당사자 전용 비밀 123'));
    });

    await t.test('solo auto-advance stops on or before the next own-team game', async () => {
      const solo = await users[5].request('/api/rooms', 'POST', { slot: 0, seed: 'solo-auto' });
      assert.equal(solo.status, 200);
      let soloRoom = solo.data.room, stopped = false;
      const soloRoute = `/api/rooms/${soloRoom.code}`;
      for (let i = 0; i < 8; i++) {
        const nextOwn = soloRoom.season.schedule.filter(g => g.date >= soloRoom.season.date && g.status === 'scheduled' && [g.teamA, g.teamB].includes(soloRoom.season.team)).sort((a, b) => a.date.localeCompare(b.date))[0];
        const advanced = await users[5].request(`${soloRoute}/auto`, 'POST', { turn: soloRoom.season.turn, action: 'rest' });
        if (advanced.status === 409) {
          assert.ok(soloRoom.season.schedule.some(g => g.date === soloRoom.season.date && g.status === 'scheduled' && [g.teamA, g.teamB].includes(soloRoom.season.team)));
          stopped = true; break;
        }
        assert.equal(advanced.status, 200);
        assert.ok(advanced.data.days >= 1 && advanced.data.days <= 7);
        assert.equal(advanced.data.room.season.turn - soloRoom.season.turn, advanced.data.days);
        if (nextOwn) assert.ok(advanced.data.room.season.date <= nextOwn.date);
        soloRoom = advanced.data.room;
      }
      assert.ok(stopped, 'auto flow reaches a game day and refuses to skip it');
    });

    await t.test('SQLite restores the exact shared season, private chat and slots after server restart', async () => {
      const before = (await users[2].request(route)).data.room;
      await running.stop();
      running = await launch(dataFile); server.base = running.base;
      const restored = await users[2].request(route);
      assert.equal(restored.status, 200);
      assert.deepEqual(restored.data.room, before);
      const privateSlots = await users[0].request('/api/session');
      assert.equal(privateSlots.data.slots[0].nickname, '다른시즌선수');
      assert.ok(!(await users[0].request(route)).data.room.messages.some(m => m.text === '당사자 전용 비밀 123'));
    });

    await t.test('host exit transfers authority and removes access while retaining NPC roster', async () => {
      assert.equal((await users[0].request(`${route}/leave`, 'POST', {})).status, 200);
      assert.equal((await users[0].request(route)).status, 403);
      const remaining = await users[1].request(route);
      assert.equal(remaining.data.room.hostId, sessions[1].user.id);
      assert.equal(remaining.data.room.players.length, 4);
      assert.equal(remaining.data.room.roster.length, 5);
      const settled = await users[1].request(`${route}/settle`, 'POST', { turn: remaining.data.room.season.turn, npcTakeover: true });
      assert.equal(settled.status, 200);
    });
  } finally {
    if (running) await running.stop();
    await rm(temp, { recursive: true, force: true });
  }
});

test('Cup media-day commands enforce captain turn and reject duplicate picks',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'cup-media-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const user=actor(server);
  await user.request('/api/slots/0','PUT',{character:character('MID','Captain')});
  const created=await user.request('/api/rooms','POST',{slot:0,year:2026}),code=created.data.room.code,route='/api/rooms/'+code;
  await running.stop();const db=new Store(file),room=db.room(code);room.lobby.status='started';room.season.draft=false;
  const d=room.season.cupDraft;room.season.team=d.previous.champion;room.season.date=d.date;room.players[0].character.team=room.season.team;db.saveRoom(room);db.close();
  running=await launch(file);server.base=running.base;
  const body={turn:room.season.turn,pickNumber:1,team:d.remaining[0]};
  assert.equal((await user.request(route+'/cup-draft','POST',{...body,turn:999})).status,409);
  assert.equal((await user.request(route+'/cup-draft','POST',{...body,team:d.previous.champion})).status,400);
  let response=await user.request(route+'/cup-draft','POST',body);assert.equal(response.status,200);assert.equal(response.data.room.season.cupDraft.picks.length,1);
  assert.equal((await user.request(route+'/cup-draft','POST',body)).status,409);
  assert.equal((await user.request(route+'/cup-draft','POST',{...body,pickNumber:2,team:d.remaining[1]})).status,403);
  response=await user.request(route+'/cup-draft','POST',{turn:room.season.turn,pickNumber:2,remaining:true});assert.equal(response.status,200);assert.equal(response.data.room.season.cupDraft.status,'completed');assert.equal(response.data.room.season.cupDraft.picks.length,8);
  assert.equal((await fetch(server.base+'/cup-draft.js')).status,200);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('notices require login to read and admin permissions to publish, edit and delete',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'notices-api-')),file=path.join(temp,'game.sqlite');let server;
 try{
  server=await launch(file);assert.equal((await fetch(server.base+'/api/notices')).status,401);
  const admin=actor(server),member=actor(server);await admin.request('/api/session');await member.request('/api/session');
  const adminId=(await admin.request('/api/session')).data.user.id,db=new Store(file);db.db.prepare("UPDATE accounts SET role='admin' WHERE user_id=?").run(adminId);db.close();
  const original=(await member.request('/api/notices')).data.notices;assert(original.some(n=>n.id==='welcome'));
  const input={title:'점검 공지',body:'<script>alert(1)</script>\n안내 둘째 줄',category:'점검',pinned:true};
  assert.equal((await member.request('/api/notices','POST',input)).status,403);
  assert.equal((await admin.request('/api/notices','POST',{...input,title:' '})).status,400);
  let result=await admin.request('/api/notices','POST',input);assert.equal(result.status,200);const created=result.data.notice;
  result=await member.request('/api/notices');assert.equal(result.data.notices[0].id,created.id);assert.equal(result.data.notices[0].body,input.body);
  const route='/api/notices/'+created.id,edit={...input,title:'수정한 공지',revision:created.revision};
  assert.equal((await member.request(route,'PUT',edit)).status,403);assert.equal((await member.request(route,'DELETE',{revision:1})).status,403);
  result=await admin.request(route,'PUT',edit);assert.equal(result.status,200);assert.equal(result.data.notice.revision,2);
  assert.equal((await admin.request(route,'PUT',edit)).status,409);assert.equal((await admin.request(route,'DELETE',{revision:1})).status,409);
  assert.equal((await admin.request(route,'DELETE',{revision:2})).status,200);
  assert.equal((await member.request('/api/notices')).data.notices.length,original.length);
  for(const asset of ['/notices.js','/notices.css'])assert.equal((await fetch(server.base+asset)).status,200);
 }finally{await server?.stop();await rm(temp,{recursive:true,force:true});}
});

test('detailed practice blocks skip, uses host choices and persists separately from official results',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'scrim-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server),peer=actor(server);await host.request('/api/slots/0','PUT',{character:character('MID','ScrimHost')});await peer.request('/api/slots/0','PUT',{character:character('JGL','ScrimPeer')});
  let r=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room;const route='/api/rooms/'+r.code;
  await host.request(route+'/cup-draft','POST',{turn:r.season.turn,pickNumber:1,remaining:true});r=(await host.request(route)).data.room;const event=r.scrimSchedule.find(e=>e.status==='scheduled');assert(event);
  await running.stop();let db=new Store(file);const saved=db.room(r.code);saved.season.date=event.date;db.saveRoom(saved);db.close();running=await launch(file);server.base=running.base;
  r=(await host.request(route)).data.room;assert.equal(r.scrimSchedule.find(e=>e.id===event.id).date,event.date);
  assert.equal((await host.request(route+'/auto','POST',{turn:r.season.turn})).status,409);
  assert.equal((await host.request(route+'/settle','POST',{turn:r.season.turn,npcTakeover:true})).status,409);
  await peer.request('/api/rooms/join','POST',{slot:0,code:r.code});assert.equal((await peer.request(route+'/scrim','POST',{turn:r.season.turn,id:event.id,focus:'early'})).status,403);
  assert.equal((await host.request(route+'/scrim','POST',{turn:r.season.turn,id:event.id,focus:'bad'})).status,400);
  const result=await host.request(route+'/scrim','POST',{turn:r.season.turn,id:event.id,focus:'teamfight'});assert.equal(result.status,200);assert.equal(result.data.room.season.results.length,r.season.results.length);assert.equal(result.data.room.season.scrimDiary.length,1);assert.equal(result.data.room.season.turn,r.season.turn);const npcGrown=result.data.room.roster.filter(p=>p.npc);assert.equal(npcGrown.length,3);for(const npc of npcGrown){const before=r.roster.find(p=>p.id===npc.id);assert(Math.abs(npc.stats.communication-before.stats.communication-.3)<1e-8);assert(Math.abs(npc.stats.mechanics-before.stats.mechanics-.2)<1e-8);}
  assert.equal((await host.request(route+'/scrim','POST',{turn:r.season.turn,id:event.id,focus:'side'})).status,409);
  await running.stop();running=await launch(file);server.base=running.base;assert.deepEqual((await host.request(route)).data.room.season.scrimDiary,result.data.room.season.scrimDiary);assert.deepEqual((await host.request(route)).data.room.roster.filter(p=>p.npc).map(p=>p.stats),npcGrown.map(p=>p.stats));
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('shared live strategy requires host and retired interviews cannot grant bonuses',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'strategy-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file,{LIVE_STEP_MS:'1'});server.base=running.base;const host=actor(server),peer=actor(server);await host.request('/api/slots/0','PUT',{character:character('MID','StrategyHost')});await peer.request('/api/slots/0','PUT',{character:character('JGL','StrategyPeer')});
  let room=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room;const route='/api/rooms/'+room.code;
  await host.request(route+'/cup-draft','POST',{turn:1,pickNumber:1,remaining:true});await peer.request('/api/rooms/join','POST',{slot:0,code:room.code});
  await running.stop();const db=new Store(file),r=db.room(room.code);
  r.season.interviews=[{id:'fixture-interview',status:'pending',userId:r.hostId,team:r.season.team,nickname:'StrategyHost',date:r.season.date,matchId:'fixture',question:'오늘 경기 소감은?'}];db.saveRoom(r);db.close();running=await launch(file,{LIVE_STEP_MS:'1'});server.base=running.base;
  const beforeRetired=(await host.request(route)).data.room.players[0].character.stats;
  assert.equal((await peer.request(route+'/pom-interview','POST',{turn:1,id:'fixture-interview',choice:'team'})).status,404);
  assert.equal((await host.request(route+'/pom-interview','POST',{turn:1,id:'fixture-interview',choice:'bad'})).status,404);
  assert.equal((await host.request(route+'/pom-interview','POST',{turn:1,id:'fixture-interview',choice:'review'})).status,404);
  assert.equal((await host.request(route+'/pom-interview','POST',{turn:1,id:'fixture-interview',choice:'team'})).status,404);
  assert.deepEqual((await host.request(route)).data.room.players[0].character.stats,beforeRetired);
  await running.stop();const data=new Store(file),prepared=data.room(room.code);for(let i=0;i<10&&!prepared.season.schedule.some(m=>m.date===prepared.season.date&&m.status==='scheduled'&&[m.teamA,m.teamB].includes(prepared.season.team));i++)settleDay(prepared,{npcTakeover:true});data.saveRoom(prepared);data.close();running=await launch(file,{LIVE_STEP_MS:'1'});server.base=running.base;
  const started=await host.request(route+'/settle','POST',{turn:prepared.season.turn,npcTakeover:true,live:true});assert.equal(started.status,200);
  for(let i=0;i<30;i++){room=(await host.request(route)).data.room;if(room.broadcast?.intermission)break;await new Promise(r=>setTimeout(r,10));}
  const pause=room.broadcast?.intermission;assert(pause);const request={turn:room.season.turn,...pause,strategy:'side'};
  assert.equal((await peer.request(route+'/set-strategy','POST',request)).status,403);assert.equal((await host.request(route+'/set-strategy','POST',{...request,nextSet:99})).status,409);
  const resumed=await host.request(route+'/set-strategy','POST',request);assert.equal(resumed.status,200);assert.equal(resumed.data.room.season.date,prepared.season.date);assert(!resumed.data.room.liveMatch);assert(!JSON.stringify(resumed.data.room.broadcast).includes('pendingRoom'));
  assert.equal((await host.request(route+'/set-strategy','POST',request)).status,409);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('host reset restarts only its room, keeps accounts, slots, party and chat, and rejects stale confirmations',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'room-reset-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server),peer=actor(server),outsider=actor(server);
  await host.request('/api/slots/0','PUT',{character:{...character('MID','ResetHost'),background:'franchise_star'}});await peer.request('/api/slots/0','PUT',{character:character('JGL','ResetPeer')});await outsider.request('/api/session');
  const slotBefore=(await host.request('/api/session')).data.slots;
  let room=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room;const route='/api/rooms/'+room.code,other=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room;
  await peer.request('/api/rooms/join','POST',{slot:0,code:room.code});await host.request(route+'/chat','POST',{channel:'owner',text:'초기화 후에도 남길 대화'});
  await running.stop();const db=new Store(file),changed=db.room(room.code);changed.season.date='2026-01-20';changed.season.turn=9;changed.season.history.push({text:'old season history'});changed.season.scrimDiary=[{id:'old-practice'}];changed.season.interviews=[{id:'old-interview'}];changed.players[0].character.stats.macro=95;changed.players[0].character.fatigue=77;changed.submissions[changed.hostId]={turn:9,action:'mechanics'};db.saveRoom(changed);db.close();running=await launch(file);server.base=running.base;
  room=(await host.request(route)).data.room;const confirm={seasonId:room.season.id,turn:room.season.turn,confirmation:'초기화'};
  assert.equal((await outsider.request(route+'/reset','POST',confirm)).status,403);assert.equal((await peer.request(route+'/reset','POST',confirm)).status,403);
  assert.equal((await host.request(route+'/reset','POST',{...confirm,confirmation:''})).status,400);assert.equal((await host.request(route+'/reset','POST',{...confirm,turn:1})).status,409);assert.equal((await host.request(route+'/reset','POST',{...confirm,seasonId:'old-season'})).status,409);
  assert.equal((await host.request(route)).data.room.season.id,room.season.id);
  const result=await host.request(route+'/reset','POST',confirm);assert.equal(result.status,200);const reset=result.data.room;
  assert.equal(reset.code,room.code);assert.equal(reset.hostId,room.hostId);assert.deepEqual(reset.players.map(p=>p.userId),room.players.map(p=>p.userId));assert.deepEqual(reset.players.map(p=>p.character.id),room.players.map(p=>p.character.id));assert.equal(reset.players[0].character.stats.macro,67);assert.equal(reset.players[0].character.fatigue,10);assert(reset.players.every(p=>p.character.team===null));
  assert.notEqual(reset.season.id,room.season.id);assert.notEqual(reset.season.seed,room.season.seed);assert.equal(reset.season.date,'2026-01-12');assert.equal(reset.season.turn,1);assert.equal(reset.season.results.length,0);assert.equal(reset.season.team,null);assert.equal(reset.season.draft,true);assert(!reset.season.scrimDiary);assert(!reset.season.interviews);assert.deepEqual(reset.submissions,{});assert.equal(reset.lobby.status,'waiting');assert.deepEqual(reset.lobby.ready,{});assert(reset.messages.some(m=>m.text==='초기화 후에도 남길 대화'));
  assert.deepEqual((await host.request('/api/session')).data.slots,slotBefore);assert.equal((await host.request('/api/rooms/'+other.code)).data.room.season.id,other.season.id);assert.equal((await host.request(route+'/reset','POST',confirm)).status,409);
  await running.stop();running=await launch(file);server.base=running.base;assert.equal((await peer.request(route)).data.room.season.id,reset.season.id);
  const left=await host.request(route+'/leave','POST',{});assert.equal(left.status,200);assert.equal((await host.request(route)).status,403);const remains=(await peer.request(route)).data.room;assert.equal(remains.hostId,remains.players[0].userId);assert.equal(remains.players.length,1);assert.equal(remains.season.id,reset.season.id);assert.deepEqual((await host.request('/api/session')).data.slots,slotBefore);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('startup purges old empty rooms and last-member departure deletes new ones without touching accounts or occupied rooms',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'empty-room-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server),peer=actor(server);await host.request('/api/slots/0','PUT',{character:character('MID','CleanupHost')});await peer.request('/api/slots/0','PUT',{character:character('JGL','CleanupPeer')});
  const original=(await host.request('/api/session')).data,peerSlots=(await peer.request('/api/session')).data.slots,room=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room,route='/api/rooms/'+room.code;
  await host.request(route+'/chat','POST',{channel:'owner',text:'남길 방의 채팅'});
  await running.stop();let db=new Store(file);const empty={...structuredClone(db.room(room.code)),code:'EMPTYOLD',players:[]};db.saveRoom(empty);db.addMessage(empty.code,{channel:'dm',senderId:original.user.id,to:'other',text:'빈 방의 개인 대화'});db.close();
  running=await launch(file);server.base=running.base;assert.equal((await host.request('/api/rooms/EMPTYOLD')).status,404);let kept=(await host.request(route)).data.room;assert.equal(kept.season.id,room.season.id);assert(kept.messages.some(m=>m.text==='남길 방의 채팅'));assert.deepEqual((await host.request('/api/session')).data.slots,original.slots);
  db=new Store(file);assert.equal(db.room('EMPTYOLD'),null);assert.equal(db.db.prepare('SELECT count(*) AS n FROM messages WHERE room_code=?').get('EMPTYOLD').n,0);db.close();
  await peer.request('/api/rooms/join','POST',{slot:0,code:room.code});const left=await host.request(route+'/leave','POST',{});assert.equal(left.status,200);assert.equal(left.data.deleted,false);kept=(await peer.request(route)).data.room;assert.equal(kept.players.length,1);assert(kept.messages.some(m=>m.text==='남길 방의 채팅'));
  const last=await peer.request(route+'/leave','POST',{});assert.equal(last.status,200);assert.equal(last.data.deleted,true);assert.equal((await peer.request(route)).status,404);assert.equal((await host.request('/api/rooms/join','POST',{slot:0,code:room.code})).status,404);
  db=new Store(file);assert.equal(db.room(room.code),null);assert.equal(db.db.prepare('SELECT count(*) AS n FROM messages WHERE room_code=?').get(room.code).n,0);db.close();assert.deepEqual((await peer.request('/api/session')).data.slots,peerSlots);assert.deepEqual((await host.request('/api/session')).data.slots,original.slots);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('life choice previews match actual player changes and reject other players, forged rewards and duplicate answers',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'life-effects-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server),peer=actor(server);await host.request('/api/slots/0','PUT',{character:character('MID','LifeHost')});await peer.request('/api/slots/0','PUT',{character:character('JGL','LifePeer')});let room=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room;const route='/api/rooms/'+room.code;
  await peer.request('/api/rooms/join','POST',{slot:0,code:room.code});room=(await host.request(route+'/settle','POST',{turn:1,npcTakeover:true})).data.room;
  const own=room.season.dailyLife.entries.find(e=>e.userId===room.hostId),choice=own.choices[0],before=room.players.find(p=>p.userId===room.hostId).character,body={turn:room.season.turn,seasonId:room.season.id,entryId:own.id,choice:choice.id};assert(choice.effects);assert(Object.keys(choice.effects).some(k=>['mechanics','laning','macro','communication','mental','mastery','condition','fatigue','stress'].includes(k)));
  assert.equal((await peer.request(route+'/life','POST',body)).status,409);assert.equal((await host.request(route+'/life','POST',{...body,seasonId:'previous-season'})).status,409);assert.equal((await host.request(route+'/life','POST',{...body,choice:'unknown'})).status,400);
  const result=await host.request(route+'/life','POST',{...body,effects:{mechanics:999},stats:{mechanics:999}});assert.equal(result.status,200);assert.deepEqual(result.data.interaction.effects,choice.effects);const after=result.data.room.players.find(p=>p.userId===room.hostId).character;
  for(const key of Object.keys(before.stats))assert.equal(Number((after.stats[key]-before.stats[key]).toFixed(3)),choice.effects[key]||0);
  for(const key of ['condition','fatigue','stress'])assert.equal(Number((after[key]-before[key]).toFixed(3)),choice.effects[key]||0);
  assert.equal((await host.request(route+'/life','POST',body)).status,409);
  await running.stop();running=await launch(file);server.base=running.base;const restored=(await host.request(route)).data.room;assert.deepEqual(restored.players.find(p=>p.userId===room.hostId).character.stats,after.stats);assert.deepEqual(restored.season.dailyLife.entries.find(e=>e.id===own.id).effects,choice.effects);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('an international strategy pause saved with former NPC aliases resumes through the API after restart',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'legacy-strategy-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server);
  await host.request('/api/slots/0','PUT',{character:character('MID','LegacyStrategyHost')});
  const room=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room,route='/api/rooms/'+room.code;
  await host.request(route+'/cup-draft','POST',{turn:1,pickNumber:1,remaining:true});await running.stop();
  const db=new Store(file);let prepared,pending,summary;
  try{
   const original=db.room(room.code);
   for(let i=0;i<30;i++){
    const r=structuredClone(original);r.season.seed+=':legacy-fixture:'+i;r.season.matchDraftVersions={'fst-final':0};r.season.matchPerformanceVersions={'fst-final':0};
    Object.assign(r.season.schedule.find(m=>m.id==='fst-final'),{date:r.season.date,teamA:'JDG',teamB:r.season.team,status:'scheduled',bestOf:5});
    const next=structuredClone(r),done=settleDay(next);
    if(next.season.results.find(m=>m.id==='fst-final').result.sets.length>=4){prepared=r;pending=next;summary=done;break;}
   }
   assert(prepared);
   const roles={TOP:'Top',JGL:'Jungle',MID:'Mid',ADC:'Carry',SUP:'Support'};
   for(const p of pending.season.results.find(m=>m.id==='fst-final').result.sets[0].scoreboard.filter(p=>p.team==='JDG'))pending=JSON.parse(JSON.stringify(pending).replaceAll(p.nickname,'JDG AsterJDG'+roles[p.position]));
   beginLiveMatch(prepared,pending,summary,{interactive:true,stepMs:100000});
   const live=prepared.liveMatch;live.cursor=live.frames.findLastIndex(f=>f.matchId==='fst-final'&&f.setIndex===2);live.intermission={matchId:'fst-final',nextSet:4};live.handledBreaks=['fst-final:2','fst-final:3'];db.saveRoom(prepared);
  }finally{db.close();}
  running=await launch(file);server.base=running.base;
  const prior=(await host.request(route)).data.room;assert.equal(prior.broadcast.activeSet,3);assert.equal(prior.broadcast.sets.length,3);
  const resumed=await host.request(route+'/set-strategy','POST',{turn:prior.season.turn,seasonId:prior.season.id,...prior.broadcast.intermission,strategy:'balanced'});
  assert.equal(resumed.status,200,JSON.stringify(resumed.data));assert.equal(resumed.data.room.broadcast.activeSet,4);assert(!resumed.data.room.broadcast.intermission);
  assert.deepEqual(resumed.data.room.broadcast.sets.slice(0,3),prior.broadcast.sets);
  assert.equal(resumed.data.room.season.date,prior.season.date);
  assert.equal((await host.request(route+'/set-strategy','POST',{turn:prior.season.turn,matchId:'fst-final',nextSet:4,strategy:'balanced'})).status,409);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('public recruiting directory restricts metadata, positions, membership and recruiting phase',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'public-api-'));let running;
 try{
  running=await launch(path.join(temp,'game.sqlite'));const server={base:running.base},host=actor(server),peer=actor(server),outsider=actor(server);
  assert.equal((await fetch(server.base+'/api/rooms/public')).status,401);
  for(const [user,pos,name] of [[host,'MID','PublicHost'],[peer,'JGL','PublicPeer'],[outsider,'MID','PublicOutsider']])assert.equal((await user.request('/api/slots/0','PUT',{character:character(pos,name)})).status,200);
  assert.equal((await host.request('/api/rooms','POST',{slot:0,visibility:'invalid'})).status,400);
  assert.equal((await host.request('/api/rooms','POST',{slot:0,visibility:'public'})).status,400);
  const old=(await host.request('/api/rooms','POST',{slot:0})).data.room;
  let result=await host.request('/api/rooms','POST',{slot:0,chooseTeam:true,waitingRoom:true,visibility:'public',name:'공개 <모집>'});assert.equal(result.status,200);
  const code=result.data.room.code,route='/api/rooms/'+code;
  let list=(await outsider.request('/api/rooms/public')).data.rooms;assert.equal(list.length,1);assert.equal(list[0].code,code);assert(!list.some(r=>r.code===old.code));assert.equal(list[0].isMember,false);
  assert.deepEqual(list[0].openPositions,['TOP','JGL','ADC','SUP']);assert.equal(JSON.stringify(list).includes('PublicHost'),false);assert(!('players' in list[0]));assert(!('seed' in list[0]));
  assert.equal((await outsider.request(route)).status,403);assert.equal((await outsider.request(route+'/export')).status,403);
  assert.equal((await outsider.request('/api/rooms/join','POST',{slot:0,code,public:true})).status,409);
  assert.equal((await peer.request('/api/rooms/join','POST',{slot:0,code,public:true})).status,200);
  assert.equal((await peer.request(route+'/visibility','POST',{visibility:'private'})).status,403);
  assert.equal((await host.request(route+'/visibility','POST',{visibility:'private'})).status,200);
  assert.equal((await outsider.request('/api/rooms/public')).data.rooms.length,0);
  assert.equal((await outsider.request('/api/rooms/join','POST',{slot:0,code,public:true})).status,409);
  assert.equal((await host.request(route+'/visibility','POST',{visibility:'public'})).status,200);
  list=(await peer.request('/api/rooms/public')).data.rooms;assert.equal(list[0].memberCount,2);assert.equal(list[0].isMember,true);assert(!list[0].openPositions.includes('JGL'));
  for(const user of [host,peer])assert.equal((await user.request(route+'/ready','POST',{ready:true})).status,200);
  assert.equal((await host.request(route+'/prepare','POST',{})).status,200);
  assert.equal((await outsider.request('/api/rooms/public')).data.rooms.length,0);
  for(const body of [{slot:0,code,public:true},{slot:0,code}])assert.equal((await outsider.request('/api/rooms/join','POST',body)).status,409);
  assert.equal((await peer.request('/api/rooms/join','POST',{slot:0,code,public:true})).status,200);
  assert.equal((await host.request(route+'/team','POST',{team:'T1'})).status,200);
  assert.equal((await host.request(route+'/start','POST',{})).status,200);
  assert.equal((await outsider.request('/api/rooms/join','POST',{slot:0,code})).status,409);
  assert.equal((await host.request(route+'/visibility','POST',{visibility:'private'})).status,409);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});

test('late-season live updates omit history, compress full loads and pace slow viewers without exposing future results',async t=>{
 const temp=await mkdtemp(path.join(tmpdir(),'live-speed-api-')),file=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(file);server.base=running.base;const host=actor(server),outsider=actor(server);
  await host.request('/api/slots/0','PUT',{character:character('MID','SpeedHost')});const original=(await host.request('/api/rooms','POST',{slot:0,year:2026})).data.room,route='/api/rooms/'+original.code;
  await host.request(route+'/cup-draft','POST',{turn:1,pickNumber:1,remaining:true});await running.stop();
  let db=new Store(file);try{
   const r=db.room(original.code),m={id:'speed-live-fixture',date:r.season.date,teamA:r.season.team,teamB:'JDG',stage:'LCK',round:'테스트',bestOf:3,status:'scheduled'};r.season.schedule.push(m);
   const sample=structuredClone(r);settleDay(sample,{npcTakeover:true});const archived=sample.season.results.find(g=>g.id===m.id);
   for(let i=0;i<32;i++)r.season.results.push({...structuredClone(archived),id:'archived-'+i,date:'2026-01-01'});
   const pending=structuredClone(r),summary=settleDay(pending,{npcTakeover:true});summary.npcTakeover=true;beginLiveMatch(r,pending,summary,{interactive:true,stepMs:1e9});advanceLiveMatch(r,Date.now()+1e12);assert(r.liveMatch.intermission);db.saveRoom(r);
  }finally{db.close();}
  running=await launch(file);server.base=running.base;const first=(await host.request(route)).data.room,scope=`liveUpdate=1&liveId=${first.broadcast.id}&seasonId=${first.season.id}&turn=${first.season.turn}`;
  assert.equal((await outsider.request(route+'?'+scope)).status,403);
  const plain=await fetch(server.base+route,{headers:{Cookie:host.cookie,'Accept-Encoding':'identity'}}),plainText=await plain.text();assert(!plain.headers.get('content-encoding'));
  const zipped=await fetch(server.base+route,{headers:{Cookie:host.cookie,'Accept-Encoding':'gzip'}});assert.equal(zipped.headers.get('content-encoding'),'gzip');assert(Number(zipped.headers.get('content-length'))<Buffer.byteLength(plainText)/4);assert.deepEqual(await zipped.json(),JSON.parse(plainText));
  const rejected=await fetch(server.base+route,{headers:{Cookie:host.cookie,'Accept-Encoding':'gzip;q=0'}});assert(!rejected.headers.get('content-encoding'));await rejected.arrayBuffer();
  const update=(await host.request(route+'?'+scope)).data;assert(update.roomPatch);assert(!update.room);assert(!update.roomPatch.view.season);assert(!update.roomPatch.view.liveMatch);assert(!update.roomPatch.view.pendingRoom);assert.deepEqual(mergeLiveRoom(first,update.roomPatch),first);
  const mismatch=(await host.request(route+'?'+scope.replace(first.broadcast.id,'wrong-live'))).data;assert(mismatch.room);assert(!mismatch.roomPatch);
  const resumed=await host.request(route+'/set-strategy','POST',{turn:first.season.turn,seasonId:first.season.id,liveId:first.broadcast.id,liveUpdate:true,...first.broadcast.intermission,strategy:'side'});assert.equal(resumed.status,200,JSON.stringify(resumed.data));assert(resumed.data.roomPatch);const next=mergeLiveRoom(first,resumed.data.roomPatch);assert(next);assert.equal(next.season,first.season);assert.equal(next.broadcast.activeSet,2);assert.equal(next.broadcast.sets[1].events.length,1);assert(!('winner'in next.broadcast.sets[1]));assert(!next.season.results.some(m=>m.id==='speed-live-fixture'));assert.deepEqual(next.broadcast.sets[0],first.broadcast.sets[0]);
  const fullBytes=Buffer.byteLength(JSON.stringify(first)),patchBytes=Buffer.byteLength(JSON.stringify(resumed.data));assert(patchBytes<fullBytes/5);t.diagnostic(`Public state ${fullBytes} bytes → live update ${patchBytes} bytes (${(100*(1-patchBytes/fullBytes)).toFixed(1)}% less before gzip).`);
  await running.stop();db=new Store(file);try{const r=db.room(original.code);r.liveMatch.stepMs=1400;r.liveMatch.startedAt=Date.now()-1e9;db.saveRoom(r);}finally{db.close();}
  running=await launch(file);server.base=running.base;const paced=(await host.request(route+'?'+scope)).data.roomPatch;assert(paced);assert.equal(paced.view.broadcast.sets[1].events.length,2);assert(!paced.view.broadcast.sets[1].completed);assert.equal(paced.view.broadcast.activeSet,2);
 }finally{await running?.stop();await rm(temp,{recursive:true,force:true});}
});
