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

test('2026 team activities stop automatic skipping and persist exactly once across restarts',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'club-api-')),dataFile=path.join(temp,'game.sqlite'),server={base:''};let running;
 try{
  running=await launch(dataFile);server.base=running.base;const user=actor(server);
  await user.request('/api/session');await user.request('/api/slots/0','PUT',{character:character('MID','ClubPlayer')});
  const meta=await user.request('/api/meta');assert.deepEqual(meta.data.availableSeasons.map(s=>s.year),[2026]);
  let response=await user.request('/api/rooms','POST',{slot:0,year:2026,seed:'club-api'});assert.equal(response.status,200);
  const route='/api/rooms/'+response.data.room.code;
  response=await user.request(route+'/auto','POST',{turn:1,action:'rest'});assert.equal(response.status,200);assert.equal(response.data.days,1);assert.equal(response.data.decisions.length,1);assert.notEqual(response.data.decisions[0].action,'rest');assert(response.data.decisions[0].reason);assert(response.data.room.season.history.some(h=>h.autoReason));
  let r=response.data.room;const event=r.clubSchedule.find(e=>e.date===r.season.date);assert(event);
  const refused=await user.request(route+'/auto','POST',{turn:r.season.turn,action:'rest'});assert.equal(refused.status,409);
  await user.request(route+'/action','POST',{turn:r.season.turn,action:'rest'});
  response=await user.request(route+'/settle','POST',{turn:r.season.turn});assert.equal(response.status,200);
  r=response.data.room;assert.equal(r.season.clubDiary.filter(e=>e.id===event.id).length,1);
  assert.equal(r.clubSchedule.find(e=>e.id===event.id).status,'completed');
  await running.stop();running=await launch(dataFile);server.base=running.base;
  const restored=(await user.request(route)).data.room;assert.deepEqual(restored.season.clubDiary,r.season.clubDiary);
  assert.equal(restored.season.turn,r.season.turn);
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
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,30));after=(await host.request(liveRoute)).data.room;if(!after.broadcast)break;}
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
  for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,15));completed=(await host.request(route)).data.room;if(!completed.broadcast)break;}
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
      assert.ok(room.messages.some(m => m.text.includes('NPC 대행')));
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
