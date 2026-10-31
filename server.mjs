import {resetRoomSeason} from './lib/room-reset.mjs';
import {dayActivity} from './lib/day-schedule.mjs';
import {scrimSchedule,todayScrim,playScrim} from './lib/scrims.mjs';
import {INTERVIEW_CHOICES,answerInterview} from './lib/pom-interviews.mjs';
import {seasonShared} from './lib/season.mjs';
import {listNotices,saveNotice,deleteNotice} from './lib/notices.mjs';
import { ensureCupDraft, currentCupCaptain, pickCupTeam, completeCupDraft } from './lib/cup-draft.mjs';
import { Accounts } from './lib/accounts.mjs';
import { CHAMPION_RECOMMENDATIONS, recommendChampions } from './lib/champion-recommendations.mjs';
import { choosePreparation, rememberPreparation } from './lib/auto-preparation.mjs';
import { readinessFor } from './lib/readiness.mjs';
import { CHARACTER_BACKGROUNDS, normalizeBackground, startingStats, backgroundIntro } from './lib/backgrounds.mjs';
import { vacationFor, vacationWindows } from './lib/vacations.mjs';
import { ensureEwc, updateEwc } from './lib/ewc.mjs';
import { ensureDemacia, updateDemacia, declineDemacia } from './lib/demacia.mjs';
import { answerDailyLife } from './lib/daily-life.mjs';
import { clubSchedule } from './lib/club-schedule.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { normalizePortrait } from './lib/portrait.mjs';
import { applyWorldEffects } from './lib/world-events.mjs';
import { beginLiveMatch, advanceLiveMatch, getLiveBroadcast, resumeLiveMatch } from './lib/live-match.mjs';
import { hasNicknameCollision, ensureRosterNicknames, normalizeNickname } from './lib/nicknames.mjs';
import { getTeamNpcPower, getBalanceReport, applyTeamNpcPreset } from './lib/balance.mjs';
import { TEAM_PROFILES, TEAM_PROFILE_BASIS, defaultOpponentSettings } from './lib/team-profiles.mjs';
import { ACTIONS, TEAMS, POSITIONS, RULES, RULES2026, createSeason, settleDay, getRoster } from './lib/season.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const storageMaintenance=process.env.STORAGE_MAINTENANCE==='1';
const store = storageMaintenance?null:new Store(process.env.DATA_FILE || path.join(root, '.data', 'game.sqlite'));
const accounts=storageMaintenance?null:new Accounts(store,{adminInviteCode:process.env.FIRST_TEAM_ADMIN_INVITE||'',secure:process.env.COOKIE_SECURE==='1',trustProxy:process.env.TRUST_PROXY==='1'});
const LIMIT = 256 * 1024;
const locations = ['연습실', '거실', '주방', '분석실', '헬스장', '매니저실', '경기장', 'PC방', '편의점', '식당', '카페', '클리닉'];
const clone = value => structuredClone(value);
const clean = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };


function normalizeCharacter(input = {}) {
  if (!input || typeof input !== 'object') fail(400, '선수 설정이 필요합니다.');
  const nickname = clean(input.nickname, 24), name = clean(input.name, 24);
  if (!nickname || !name || !normalizeNickname(nickname)) fail(400, '선수 이름과 닉네임을 입력하세요. 보이지 않는 문자만 사용할 수 없습니다.');
  if (!POSITIONS.includes(input.position)) fail(400, '올바른 포지션을 선택하세요.');
  if (input.team != null && input.team !== '' && !TEAMS.includes(input.team)) fail(400, '리그 참가 팀을 확인하세요.');
  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 17 || age > 60) fail(400, '나이는 17~60세로 입력하세요.');
  const style=clean(input.style,40)||'균형 운영',autoChampions=input.autoChampions===true,recommendation=autoChampions?recommendChampions(input.position,style):null;
  const mainChampion = recommendation?.mainChampion||clean(input.mainChampion, 32);
  if (!mainChampion) fail(400, '주력 챔피언을 입력하세요.');
  let pool = recommendation?.pool||(Array.isArray(input.pool) ? input.pool : String(input.pool || '').split(/[,\n]/));
  pool = [...new Set([mainChampion, ...pool.map(x => clean(x, 32)).filter(Boolean)])].slice(0, 20);
  return {
    id: randomUUID(), name, nickname, age, background:normalizeBackground(input.background), team: input.team || null, position: input.position, tier: '1군',
    appearance: clean(input.appearance, 1000), personality: clean(input.personality, 1000), memo: clean(input.memo, 2000), ...normalizePortrait(input),
    mainChampion, pool, style, autoChampions,
    stats: startingStats(normalizeBackground(input.background)),
    condition: 85, fatigue: 10, stress: 10
  };
}

function sessionView(user) {
  const account=accounts.account(user.id);
  for(const c of user.slots||[])if(c)c.tier='1군';
  return { authenticated:true,
    user: { id: user.id, name: user.name, username:account.username, role:account.role }, slots: user.slots,
    rooms: store.roomsFor(user.id).map(r => { progressRoom(r); return { code: r.code, name: r.name, team: r.season.team, date: r.season.date, turn: r.season.turn, memberCount: r.players.length, lobbyStatus: r.lobby?.status || 'started' }; })
  };
}

function roomFor(code, userId) {
  const room = store.room(code.toUpperCase());
  if (!room) fail(404, '초대코드에 해당하는 방이 없습니다.');
  if (!room.players.some(p => p.userId === userId)) fail(403, '참가한 방만 조회하거나 진행할 수 있습니다.');
  if(!room.liveMatch){const demaciaChanged=ensureDemacia(room.season),ewcChanged=ensureEwc(room.season),cupChanged=ensureCupDraft(room.season);if(demaciaChanged||ewcChanged||cupChanged){updateDemacia(room.season);updateEwc(room.season);room.revision++;store.saveRoom(room);}}
  progressRoom(room);
  return room;
}

function progressRoom(room) {
  const progress = advanceLiveMatch(room);
  if (!progress.changed) return;
  if (progress.completed) systemMessage(room, `${progress.date} 경기 중계와 일정 정산 완료. ${room.season.finished ? '시즌이 종료되었습니다.' : `다음 일정 ${room.season.date}.`}`);
  store.saveRoom(room);
}

function roomView(room, userId) {
  const view = clone(Object.fromEntries(Object.entries(room).filter(([key])=>key!=='liveMatch')));
  if(Array.isArray(view.season.rules))view.season.rules=view.season.rules.map(rule=>typeof rule==='string'?rule.replace('밴은 팀당 3개로 간소화했습니다.','매 세트 양 팀이 각각 챔피언 5개를 밴합니다.'):rule);
  view.broadcast = getLiveBroadcast(room);
  view.clubSchedule = clubSchedule(room);
  view.dayActivity=dayActivity(room);
  view.scrimSchedule=scrimSchedule(room);view.interviewChoices=INTERVIEW_CHOICES;
  view.vacation=vacationFor(room.season);view.vacationWindows=vacationWindows(room.season);
  view.me = userId;
  view.balance = getBalanceReport(room);
  view.messages = store.messages(room.code, userId);
  view.roster = getRoster(room.season.team ? room : { ...room, season: { ...room.season, team: '대기실' } });
  for (const profile of view.season.opponents || []) profile.players = applyWorldEffects(room, ensureRosterNicknames(room, profile.players || [], profile.name));
  for (const p of view.players) {
    p.character = applyWorldEffects(room, [p.character])[0];
    p.character.tier = '1군';p.character.readiness=readinessFor(p.character);
    if (p.userId !== userId) { delete p.character.avatarSource; delete p.character.avatarCrop; }
  }
  const ownCharacterId = view.players.find(p => p.userId === userId)?.character.id;
  for (const character of view.roster) {
    character.readiness=readinessFor(character);
    if (character.id !== ownCharacterId) { delete character.avatarSource; delete character.avatarCrop; }
  }
  return view;
}

function systemMessage(room, text, senderName = '매니저') {
  store.addMessage(room.code, { channel: 'team', senderId: 'system', senderName, text, at: new Date().toISOString() });
}
function ensureHost(room, user) { if (room.hostId !== user.id) fail(403, '방장만 정산하거나 방을 관리할 수 있습니다.'); }
function ensureStarted(room) {
  if (room.lobby && room.lobby.status !== 'started') fail(409, '대기실에서 준비와 팀 선택을 완료한 뒤 방장이 시즌 시작을 눌러야 합니다.');
}
function ensureNoBroadcast(room) {
  if (room.liveMatch) fail(409, '경기 중계가 진행 중입니다. 경기가 끝나면 다음 행동을 제출할 수 있습니다.');
}
function ensureWaiting(room) {
  if (room.lobby?.status !== 'waiting') fail(409, '이미 시작한 시즌입니다. 준비 상태를 변경하거나 다시 시작할 수 없습니다.');
}
function ensureAllReady(room) {
  const missing = room.players.filter(p => room.lobby.ready[p.userId] !== true);
  if (missing.length) fail(409, `${missing.map(p => p.character.nickname).join(', ')}의 준비를 기다리고 있습니다.`);
}
function ensureTurn(room, body) {
  if(body.seasonId&&body.seasonId!==room.season.id)fail(409,'시즌이 변경됐습니다. 현재 방을 새로 확인해 주세요.');
  if (Number(body.turn) !== room.season.turn) fail(409, '이전 턴의 요청입니다. 현재 날짜를 확인하고 다시 제출하세요.');
  if (room.season.finished) fail(409, '종료된 시즌입니다. 기록을 열람하거나 새 시즌을 만드세요.');
}
function actionId(body) {
  if (!ACTIONS.some(a => a.id === body.action)) fail(400, '제공된 준비 행동을 선택하세요.');
  return body.action;
}
function slotCharacter(user, value) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index > 4 || !user.slots[index]) fail(400, '저장된 캐릭터 슬롯을 선택하세요.');
  return clone(user.slots[index]);
}
function safeOpponents(input) {
  if (!input) return undefined;
  if (!Array.isArray(input) || input.length > 10) fail(400, '상대 설정은 최대 10팀입니다.');
  return input.map(p => {
    if (!TEAMS.includes(p.name)) fail(400, '상대 팀 이름은 LCK 팀 목록에서 선택하세요.');
    const power = Number(p.power);
    if (!Number.isFinite(power) || power < 35 || power > 95) fail(400, '상대 전력은 35~95로 설정하세요.');
    return { name: p.name, power, style: clean(p.style, 30) || '균형 운영' };
  });
}

async function bodyOf(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMIT) fail(413, '요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  try { const parsed=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail(400,'올바른 JSON 요청이 필요합니다.');return parsed; }
  catch { fail(400, '올바른 JSON 요청이 필요합니다.'); }
}

async function api(req, res, url) {
  const method = req.method, route = url.pathname;
  if (!['GET', 'HEAD'].includes(method) && req.headers.origin) {
    let origin;try{origin=new URL(req.headers.origin);}catch{fail(403,'다른 사이트에서 보낸 요청은 허용되지 않습니다.');}
    if (origin.host !== req.headers.host) fail(403, '다른 사이트에서 보낸 요청은 허용되지 않습니다.');
  }
  const body = ['POST', 'PUT', 'DELETE'].includes(method) ? await bodyOf(req) : {};
  if(route==='/api/auth/register'&&method==='POST')return sessionView(await accounts.register(req,res,body));
  if(route==='/api/auth/login'&&method==='POST')return sessionView(await accounts.login(req,res,body));
  if(route==='/api/auth/logout'&&method==='POST')return accounts.logout(req,res);
  if(route==='/api/session'&&method==='GET'){const current=accounts.current(req);return current?sessionView(current.user):accounts.status(req);}
  const {user,account}=accounts.require(req);
  const noticeMatch=route.match(/^\/api\/notices\/([a-zA-Z0-9-]{1,64})$/);
  if(route==='/api/notices'&&method==='GET')return {notices:listNotices(store)};
  if((route==='/api/notices'&&method==='POST')||(noticeMatch&&['PUT','DELETE'].includes(method))){
    if(account.role!=='admin')fail(403,'관리자만 공지를 작성하거나 변경할 수 있습니다.');
    if(method==='DELETE')return deleteNotice(store,noticeMatch[1],body.revision);
    return {notice:saveNotice(store,body,user.name,noticeMatch?.[1]||null)};
  }
  if(route==='/api/auth/password'&&method==='POST')return accounts.changePassword(req,res,body);
  if(route==='/api/invitations'&&method==='GET')return accounts.invitations(req);
  if(route==='/api/invitations'&&method==='POST')return accounts.issue(req,body);
  const invitationMatch=route.match(/^\/api\/invitations\/([a-zA-Z0-9-]{1,64})$/);
  if(invitationMatch&&method==='DELETE')return accounts.revoke(req,invitationMatch[1]);
  if (route === '/api/meta' && method === 'GET') return { championRecommendations:CHAMPION_RECOMMENDATIONS, characterBackgrounds:CHARACTER_BACKGROUNDS, actions: ACTIONS, teams: TEAMS, teamProfiles: TEAM_PROFILES, teamProfileBasis: TEAM_PROFILE_BASIS, availableSeasons: [{ year: 2026, label: '2026 시즌', startDate: '2026-01-12', endDate: '2026-11-15', totalTurns: 308 }], positions: POSITIONS, rules: RULES2026, seasonRules: { 2025: RULES, 2026: RULES2026 }, locations, savePersistence: process.env.SAVE_PERSISTENCE || 'server' };
  if (route === '/api/profile' && method === 'POST') {
    accounts.rename(user,body.name);return sessionView(user);
  }
  const slotMatch = route.match(/^\/api\/slots\/([0-4])$/);
  if (slotMatch && method === 'DELETE') {
    user.slots[Number(slotMatch[1])] = null;
    store.saveUser(user); return { slots: user.slots };
  }
  if (slotMatch && method === 'PUT') {
    user.slots[Number(slotMatch[1])] = normalizeCharacter(body.character);
    store.saveUser(user); return { slots: user.slots };
  }
  if (route === '/api/rooms' && method === 'POST') {
    const character = slotCharacter(user, body.slot);
    const chooseTeam = body.chooseTeam === true;
    const waitingRoom = chooseTeam || body.waitingRoom === true;
    const year = Number(body.year ?? (chooseTeam ? 2026 : 2025));
    if (![2025, 2026].includes(year)) fail(400, '지원하는 시즌은 2025년과 2026년입니다.');
    character.team = chooseTeam ? null : character.team || 'T1';
    if (store.roomsFor(user.id).length >= 20) fail(400, '저장된 시즌 방은 최대 20개입니다. 기존 방에서 나간 뒤 새 방을 만드세요.');
    if (body.difficulty && !['easy', 'normal', 'hard'].includes(body.difficulty)) fail(400, '난이도를 선택하세요.');
    const npcPower = Number(body.npcPower ?? 65);
    if (!Number.isFinite(npcPower) || npcPower < 35 || npcPower > 95) fail(400, 'NPC 능력치는 35~95입니다.');
    const npcPowerMode = body.npcPowerMode ?? 'custom';
    if (!['team', 'custom'].includes(npcPowerMode)) fail(400, 'NPC 전력 설정 방식을 확인하세요.');
    let code;
    do { code = randomBytes(5).toString('hex').slice(0, 8).toUpperCase(); } while (store.room(code));
    const settings = { year, seed: randomBytes(24).toString('hex'), difficulty: body.difficulty || 'normal', npcPower: npcPowerMode === 'team' && character.team ? getTeamNpcPower(character.team) : npcPower, npcPowerMode, opponents: safeOpponents(body.opponents) ?? defaultOpponentSettings() };
    const season = createSeason({ ...settings, team: character.team || 'T1' });
    if (chooseTeam) { season.team = null; season.draft = true; }
    const room = {
      id: randomUUID(), code, name: clean(body.name, 50) || (chooseTeam ? '우리의 시즌 대기실' : `${character.team} 선수단`), hostId: user.id,
      players: [{ userId: user.id, ownerName: user.name, character, duoId: null, location: '연습실', joinedAt: new Date().toISOString() }],
      submissions: {}, revision: 1, createdAt: new Date().toISOString(),
      lobby: { status: waitingRoom ? 'waiting' : 'started', ready: {}, startedAt: waitingRoom ? null : new Date().toISOString(), requireTeamSelection: chooseTeam, selectedTeam: character.team, ...(chooseTeam ? { settings } : {}) },
      season
    };
    store.transaction(() => { store.saveRoom(room); systemMessage(room, `${backgroundIntro(character)} 오늘부터 1군 일정에 합류합니다. 비어 있는 포지션은 NPC가 맡습니다.`); });
    return { room: roomView(room, user.id) };
  }
  if (route === '/api/rooms/join' && method === 'POST') {
    return store.transaction(() => {
      const code = clean(body.code, 20).toUpperCase(), room = store.room(code);
      if (!room) fail(404, '초대코드를 확인하세요.');
      progressRoom(room);
      if (room.players.some(p => p.userId === user.id)) return { room: roomView(room, user.id) };
      if (room.liveMatch) fail(409, '경기 중계가 진행 중입니다. 경기가 끝난 뒤 참가하세요.');
      if (room.lobby?.status === 'selecting') fail(409, '팀 선택이 진행 중입니다. 방장이 시즌을 시작한 뒤 다시 참가하세요.');
      if (room.players.length >= 5) fail(409, '이 방은 정원 5명이 모두 참가했습니다.');
      if (room.season.finished) fail(409, '종료된 시즌에는 새로 참가할 수 없습니다.');
      const character = slotCharacter(user, body.slot);
      if (room.lobby?.requireTeamSelection) character.team = room.lobby.status === 'waiting' ? null : room.season.team;
      else if (!character.team) character.team = room.season.team;
      else if (character.team !== room.season.team) fail(409, `이 방은 ${room.season.team} 선수단입니다. 같은 팀 캐릭터로 참가하세요.`);
      if (room.players.some(p => p.character.position === character.position)) fail(409, '이미 참가자가 맡고 있는 포지션입니다. 다른 포지션 캐릭터를 선택하세요.');
      if (hasNicknameCollision(room.players, character.nickname)) fail(409, '이미 같은 닉네임의 선수가 있습니다. 다른 닉네임으로 참가하세요.');
      room.players.push({ userId: user.id, ownerName: user.name, character, duoId: null, location: '연습실', joinedAt: new Date().toISOString() });
      if (!room.hostId) room.hostId = user.id;
      if (room.lobby?.status === 'waiting') room.lobby.ready[user.id] = false;
      room.revision++; store.saveRoom(room); systemMessage(room, `${backgroundIntro(character)} ${character.position}의 NPC가 자리를 비웠습니다.`);
      return { room: roomView(room, user.id) };
    });
  }
  const match = route.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/([a-z]+(?:-[a-z]+)*))?$/);
  if (!match) fail(404, 'API 경로를 찾을 수 없습니다.');
  const [, code, operation] = match;
  if (method === 'GET') {
    const room = roomFor(code, user.id);
    if (operation === 'export') {
      const saved = clone(Object.fromEntries(Object.entries(room).filter(([key])=>key!=='liveMatch')));
      saved.broadcast = getLiveBroadcast(room);
      for (const player of saved.players) { delete player.character.avatarSource; delete player.character.avatarCrop; }
      return { exportedAt: new Date().toISOString(), format: 'first-team-season-v1', room: { ...saved, messages: undefined }, notice: '현재 서버의 시즌 기록 내보내기. 개인 메시지와 편집용 원본 사진은 포함하지 않습니다. 초대코드는 서버에 종속됩니다.' };
    }
    if (operation) fail(404, '조회 경로를 찾을 수 없습니다.');
    if (url.searchParams.get('since') === String(room.revision)) { res.statusCode = 304; return null; }
    return { room: roomView(room, user.id) };
  }
  if (method !== 'POST') fail(405, '지원하지 않는 요청 방식입니다.');
  return store.transaction(() => {
    const room = roomFor(code, user.id);
    const me = room.players.find(p => p.userId === user.id);
    let extra = {};
    switch (operation) {
      case 'ready': {
        ensureWaiting(room);
        if (typeof body.ready !== 'boolean') fail(400, '준비 상태는 true 또는 false로 제출하세요.');
        room.lobby.ready[user.id] = body.ready;
        break;
      }
      case 'prepare': {
        ensureHost(room, user); ensureWaiting(room);
        if (!room.lobby.requireTeamSelection) fail(409, '이 방은 기존 시작 방식을 사용합니다. 시즌 시작을 눌러 주세요.');
        ensureAllReady(room);
        room.lobby.status = 'selecting';
        systemMessage(room, '전원 준비 완료. 방장이 팀 소개를 확인하고 이번 시즌의 소속 팀을 선택합니다.');
        break;
      }
      case 'team': {
        ensureHost(room, user);
        if (!room.lobby?.requireTeamSelection || room.lobby.status !== 'selecting') fail(409, '전원 준비 후 팀 선택 단계에서 소속 팀을 선택하세요.');
        if (!TEAMS.includes(body.team)) fail(400, 'LCK 참가 팀을 선택하세요.');
        room.lobby.selectedTeam = body.team;
        if (room.lobby.settings.npcPowerMode === 'team') room.lobby.settings.npcPower = getTeamNpcPower(body.team);
        room.season = createSeason({ ...room.lobby.settings, team: body.team });
        room.season.draft = true;
        for (const player of room.players) player.character.team = body.team;
        break;
      }
      case 'start': {
        ensureHost(room, user);
        if (room.lobby?.requireTeamSelection) {
          if (room.lobby.status !== 'selecting') fail(409, '전원 준비 후 팀 선택 단계로 이동하세요.');
          if (!room.lobby.selectedTeam) fail(409, '이번 시즌의 소속 팀을 선택하세요.');
        } else ensureWaiting(room);
        ensureAllReady(room);
        room.lobby.status = 'started';
        room.lobby.startedAt = new Date().toISOString();
        if (room.season.draft) room.season.draft = false;
        systemMessage(room, room.season.year===2026&&['scheduled','drafting'].includes(room.season.cupDraft?.status)?'전원 준비 완료. 시즌 전 미디어데이에서 바론·장로 그룹을 먼저 편성합니다. 지명이 끝나면 첫 준비 일정으로 넘어갑니다.':'전원 준비 완료. 시즌을 시작합니다. 빈 포지션은 NPC가 맡으며 게임 날짜는 그대로 유지됩니다.');
        break;
      }
      case 'demacia-decline': {
        ensureStarted(room);ensureNoBroadcast(room);ensureHost(room,user);
        declineDemacia(room.season,room.season.team);break;
      }
      case 'life': {
        ensureStarted(room);ensureNoBroadcast(room);if(vacationFor(room.season))fail(409,'휴가 중에는 대화 선택 없이 일상을 보냅니다.');
        extra.interaction=answerDailyLife(room,user.id,body.entryId,body.choice);break;
      }
      case 'portrait': {
        if (!Object.hasOwn(body, 'avatar')) fail(400, '변경하거나 삭제할 사진을 지정하세요.');
        Object.assign(me.character, normalizePortrait(body));
        break;
      }
      case 'balance': {
        ensureHost(room, user);
        if (body.mode !== 'team') fail(400, '팀 기본 NPC 전력으로 조정하는 방식을 선택하세요.');
        extra.adjustment = applyTeamNpcPreset(room);
        break;
      }
      case 'cup-draft': {
        ensureStarted(room);ensureHost(room,user);ensureNoBroadcast(room);ensureTurn(room,body);
        const draft=room.season.cupDraft;
        if(!draft||!['scheduled','drafting'].includes(draft.status)||room.season.date!==draft.date)fail(409,'오늘은 진행할 컵 미디어데이 지명이 없습니다.');
        if(Number(body.pickNumber)!==draft.picks.length+1)fail(409,'지명이 이미 진행됐습니다. 최신 상태를 확인하세요.');
        if(body.team){if(currentCupCaptain(room.season)!==room.season.team)fail(403,'우리 팀이 그룹 대표로 지명하는 차례가 아닙니다.');pickCupTeam(room.season,body.team);}
        else if(body.remaining===true)completeCupDraft(room.season);
        else pickCupTeam(room.season);
        break;
      }
      case 'set-strategy': {
        ensureStarted(room);ensureHost(room,user);ensureTurn(room,body);
        extra.strategy=resumeLiveMatch(room,body,pending=>settleDay(pending,{npcTakeover:room.liveMatch.summary.npcTakeover===true}));break;
      }
      case 'scrim': {
        ensureStarted(room);ensureNoBroadcast(room);ensureHost(room,user);ensureTurn(room,body);
        extra.scrim=playScrim(room,body.id,body.focus,seasonShared.teamProfile);break;
      }
      case 'pom-interview': {
        ensureStarted(room);ensureNoBroadcast(room);ensureTurn(room,body);
        extra.interview=answerInterview(room,body.id,body.choice,user.id);break;
      }
      case 'action': {
        if(room.lobby?.requireTeamSelection&&['scheduled','drafting'].includes(room.season.cupDraft?.status))fail(409,'시즌 전 미디어데이에서 그룹 지명을 먼저 완료해 주세요.');
        ensureStarted(room);if(vacationFor(room.season))fail(409,'선수단 휴가 중입니다. 행동 선택 없이 휴가를 넘겨주세요.');
        ensureNoBroadcast(room);
        ensureTurn(room, body);
        room.submissions[user.id] = { turn: room.season.turn, action: actionId(body), target: clean(body.target, 80) || null };
        break;
      }
      case 'vacation': {
        ensureStarted(room);ensureNoBroadcast(room);ensureHost(room,user);ensureTurn(room,body);
        const holiday=vacationFor(room.season);if(!holiday)fail(409,'현재는 휴가 기간이 아닙니다.');
        const start=room.season.date;let days=0;
        do{extra.summary=settleDay(room);days++;}while(body.untilEnd===true&&days<32&&vacationFor(room.season)?.id===holiday.id&&!room.season.finished);
        extra.days=days;systemMessage(room,`${start}부터 휴가 ${days}일을 보냈습니다. 현재 일정 ${room.season.date}.`);break;
      }
      case 'settle': {
        ensureStarted(room);
        ensureNoBroadcast(room);
        ensureHost(room, user); ensureTurn(room, body);
        if(room.lobby?.requireTeamSelection&&['scheduled','drafting'].includes(room.season.cupDraft?.status))fail(409,'시즌 전 미디어데이에서 그룹 지명을 먼저 완료해 주세요.');
        if(todayScrim(room))fail(409,'오늘의 상세 스크림을 먼저 진행해 주세요.');
        const missing = vacationFor(room.season)||dayActivity(room)?[]:room.players.filter(p => room.submissions[p.userId]?.turn !== room.season.turn);
        if (missing.length && body.npcTakeover !== true) fail(409, '아직 행동을 제출하지 않은 선수가 있습니다. 기다리거나 NPC 대행을 명시적으로 선택하세요.');
        const playedDate = room.season.date;
        if (body.live === true) {
          const pending = clone(room);
          const summary = settleDay(pending, { npcTakeover: body.npcTakeover === true });summary.npcTakeover=body.npcTakeover===true;
          const live = beginLiveMatch(room, pending, summary, { interactive:room.season.year===2026, stepMs: Number(process.env.LIVE_STEP_MS) || 1400 });
          if (live) {
            extra.summary = { date: summary.date, turn: summary.turn, live: true, matches: [...room.liveMatch.gameIds] };
          } else {
            room.season = pending.season; room.players = pending.players;
            room.submissions = pending.submissions; room.revision = pending.revision;
            extra.summary = summary;
          }
        } else extra.summary = settleDay(room, { npcTakeover: body.npcTakeover === true });
        if (missing.length) systemMessage(room, `${playedDate} 미제출 ${missing.map(p => p.character.nickname).join(', ')}: 방장이 NPC 대행(휴식)을 선택했습니다.`);
        systemMessage(room, room.liveMatch ? `${playedDate} 경기 중계를 시작합니다. 현재까지 진행된 장면과 점수만 공개됩니다.` : `${playedDate} 일정 정산 완료. ${room.season.finished ? '시즌이 종료되었습니다.' : `다음 일정 ${room.season.date}.`}`);
        break;
      }
      case 'auto': {
        ensureStarted(room);
        ensureNoBroadcast(room);
        ensureHost(room, user); ensureTurn(room, body);
        if (room.players.length !== 1) fail(409, '자동 진행은 혼자 플레이하는 방에서만 사용할 수 있습니다.');
        let days = 0;const decisions=[];
        for (let i = 0; i < 7 && !room.season.finished; i++) {
          const ownGame = room.season.schedule.some(g => g.date === room.season.date && g.status === 'scheduled' && [g.teamA, g.teamB].includes(room.season.team));
          if(ownGame||todayScrim(room))break;
          if(vacationFor(room.season)){settleDay(room);days++;continue;}
          const decision=choosePreparation(room,me,ACTIONS);
          decisions.push(rememberPreparation(room.season,me,decision));
          room.submissions[user.id] = { turn: room.season.turn, action:decision.action,autoReason:decision.reason };
          settleDay(room, { npcTakeover: false }); days++;
        }
        if (!days) fail(409, '오늘은 우리 팀 경기 또는 상세 스크림이 있습니다. 오늘 일정에서 직접 진행해 주세요.');
        extra.days = days;extra.decisions=decisions;
        systemMessage(room, `자동 준비 ${days}일. 매일 선수 상태와 다음 경기를 보고 훈련·회복을 선택했습니다. 구단 행사와 휴가는 자동으로 넘기며, 우리 팀 경기·상세 스크림 전에는 멈춥니다.`);
        break;
      }
      case 'location': {
        if (!locations.includes(body.location)) fail(400, '이동할 장소를 선택하세요.');
        me.location = body.location;
        me.scenePosition = null;
        break;
      }
      case 'move': {
        if (body.location !== me.location) fail(409, '장소가 변경되었습니다. 현재 장소에서 다시 이동하세요.');
        const { x, y } = body;
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 8 || x > 92 || y < 58 || y > 90) fail(400, '이동 위치는 장면의 이동 가능한 바닥 안이어야 합니다.');
        me.scenePosition = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, location: me.location };
        break;
      }
      case 'duo': {
        const target = body.target;
        if (target != null && typeof target !== 'string') fail(400, '듀오 대상을 선택하세요.');
        if (target && target === user.id) fail(400, '자기 자신을 듀오로 등록할 수 없습니다.');
        if (target && !room.players.some(p => p.userId === target) && !POSITIONS.some(p => target === `NPC:${p}` && !room.players.some(m => m.character.position === p))) fail(400, '같은 팀 선수 또는 빈 포지션의 NPC를 선택하세요.');
        me.duoId = target || null;
        break;
      }
      case 'chat': {
        const channel = body.channel, text = clean(body.text, 2000);
        if (!['owner', 'team', 'dm'].includes(channel) || !text) fail(400, '채팅 종류와 내용을 확인하세요.');
        const to = channel === 'dm' ? clean(body.to, 80) : null;
        if (channel === 'dm' && (!to || to === user.id || !room.players.some(p => p.userId === to))) fail(400, '개인 메시지 수신자를 선택하세요.');
        store.addMessage(room.code, { channel, senderId: user.id, senderName: channel === 'owner' ? user.name : me.character.nickname, text, to, at: new Date().toISOString() });
        if (channel === 'team' && /@(?:코치|매니저|분석관)/.test(text)) {
          const name = text.includes('@코치') ? '코치' : text.includes('@분석관') ? '분석관' : '매니저';
          systemMessage(room, name === '코치' ? '모니터에 다음 상대의 리플레이를 띄웠다. “오늘 행동을 분석으로 제출하면 준비에 반영할게.”' : name === '분석관' ? '“상대 전력과 성향은 로스터에서 확인해. 초반 주도권 팀은 첫 동선을 조심하고.”' : '“캘린더 확인해. 준비 행동은 정산 전까지 수정할 수 있어.”', name);
        }
        break;
      }
      case 'transfer': {
        ensureHost(room, user);
        if (!room.players.some(p => p.userId === body.userId)) fail(400, '참가한 선수를 선택하세요.');
        room.hostId = body.userId; systemMessage(room, '방장 권한이 이전되었습니다.');
        break;
      }
      case 'reset': {
        ensureHost(room,user);ensureNoBroadcast(room);
        if(body.seasonId!==room.season.id||Number(body.turn)!==room.season.turn)fail(409,'방의 시즌이나 날짜가 변경됐습니다. 다시 확인해 주세요.');
        if(body.confirmation!=='초기화')fail(400,'초기화하려면 확인란에 초기화를 입력해 주세요.');
        resetRoomSeason(room);systemMessage(room,'방장이 이 방의 시즌 진행과 선수 성장을 초기화했습니다. 참가자와 채팅은 유지되며, 준비 완료 후 팀 선택과 시즌 전 미디어데이부터 다시 시작합니다.');break;
      }
      case 'leave': {
        room.players = room.players.filter(p => p.userId !== user.id);
        delete room.submissions[user.id];
        if (room.lobby?.ready) delete room.lobby.ready[user.id];
        for (const p of room.players) if (p.duoId === user.id) p.duoId = null;
        if (room.hostId === user.id) room.hostId = room.players[0]?.userId || null;
        if (!room.players.length && room.lobby?.requireTeamSelection && room.lobby.status !== 'started') {
          room.lobby.status = 'waiting'; room.lobby.selectedTeam = null; room.season.team = null; room.season.draft = true;
        }
        systemMessage(room, `${me.character.nickname} 퇴장. 빈 포지션은 NPC가 맡습니다.${room.players.length ? ' 방장은 남은 참가자에게 이전됩니다.' : ' 시즌 기록은 서버에 보관됩니다.'}`);
        room.revision++; store.saveRoom(room); return { left: true };
      }
      default: fail(404, '지원하지 않는 방 동작입니다.');
    }
    room.revision++; store.saveRoom(room);
    return { room: roomView(room, user.id), ...extra };
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if(url.pathname==='/healthz'){
      if(!['GET','HEAD'].includes(req.method))fail(405,'지원하지 않는 요청 방식입니다.');
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.end(req.method==='HEAD'?undefined:JSON.stringify({status:storageMaintenance?'maintenance':'ok'}));
    }
    if(storageMaintenance){
      res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','120');
      if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({error:'저장소를 안전하게 이전하고 있습니다. 잠시 후 다시 접속해 주세요.'}));}
      res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIRST TEAM · 저장소 이전</title><body style="background:#0d1117;color:#e6ebf2;font-family:sans-serif;padding:12vh 8vw;line-height:1.8"><h1>저장소를 안전하게 이전하고 있어요.</h1><p>계정과 시즌 기록을 옮기는 동안 잠시 접속을 쉬어 갑니다.<br>이전이 끝나면 같은 계정으로 이어 할 수 있습니다.</p></body></html>');
    }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const result = await api(req, res, url);
      if (res.statusCode === 304) return res.end();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(result));
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail(405, '지원하지 않는 요청 방식입니다.');
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/scenes.js': ['scenes.js', 'text/javascript'], '/scenes.css': ['scenes.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
    files['/world-events.js'] = ['world-events.js', 'text/javascript'];
    files['/world-events.css'] = ['world-events.css', 'text/css'];
    files['/auth.js']=['auth.js','text/javascript'];
    files['/auth.css']=['auth.css','text/css'];
    files['/training.js']=['training.js','text/javascript'];
    files['/training.css']=['training.css','text/css'];
    files['/notices.js']=['notices.js','text/javascript'];
    files['/notices.css']=['notices.css','text/css'];
    files['/cup-draft.js']=['cup-draft.js','text/javascript'];
    files['/honors.js']=['honors.js','text/javascript'];
    files['/tournament-board.js']=['tournament-board.js','text/javascript'];
    files['/match-feed.js'] = ['match-feed.js','text/javascript'];
    files['/vacations.js'] = ['vacations.js','text/javascript'];
    files['/ewc.js'] = ['ewc.js','text/javascript'];
    files['/demacia.js'] = ['demacia.js','text/javascript'];
    files['/crest.svg'] = ['crest.svg', 'image/svg+xml'];
    const entry = files[url.pathname];
    if (!entry) fail(404, '페이지를 찾을 수 없습니다.');
    res.setHeader('Content-Type', `${entry[1]}; charset=utf-8`);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(await readFile(path.join(root, 'public', entry[0])));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: status === 500 ? '서버 처리 중 문제가 발생했습니다. 저장된 진행은 유지됩니다.' : e.message }));
  }
});

const port = Number(process.env.PORT || 3000), host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => console.log(`FIRST TEAM listening on port ${server.address().port}`));
function shutdown() { server.close(() => { store?.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
