import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { ACTIONS, TEAMS, POSITIONS, RULES, createSeason, settleDay, getRoster } from './lib/season.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const store = new Store(process.env.DATA_FILE || path.join(root, '.data', 'game.sqlite'));
const LIMIT = 128 * 1024;
const locations = ['연습실', '거실', '주방', '분석실', '헬스장', '매니저실', '경기장', 'PC방', '편의점', '식당', '카페', '클리닉'];
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const clean = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };

function identity(req, res) {
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('ft_session='));
  const token = cookie?.slice('ft_session='.length);
  let user = token ? store.userByToken(hash(token)) : null;
  if (!user) {
    const next = randomBytes(32).toString('hex');
    user = { id: randomUUID(), name: '오너', slots: Array(5).fill(null), createdAt: new Date().toISOString() };
    store.createUser(user, hash(next));
    res.setHeader('Set-Cookie', `ft_session=${next}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`);
  }
  // Legacy character tiers are always migrated to first team, without changing seasons.
  for (const char of user.slots) if (char) char.tier = '1군';
  return user;
}

function normalizeCharacter(input = {}) {
  if (!input || typeof input !== 'object') fail(400, '선수 설정이 필요합니다.');
  const nickname = clean(input.nickname, 24), name = clean(input.name, 24);
  if (!nickname || !name) fail(400, '선수 이름과 닉네임을 입력하세요.');
  if (!POSITIONS.includes(input.position)) fail(400, '올바른 포지션을 선택하세요.');
  if (!TEAMS.includes(input.team)) fail(400, '리그 참가 팀을 선택하세요.');
  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 17 || age > 60) fail(400, '나이는 17~60세로 입력하세요.');
  const mainChampion = clean(input.mainChampion, 32);
  if (!mainChampion) fail(400, '주력 챔피언을 입력하세요.');
  let pool = Array.isArray(input.pool) ? input.pool : String(input.pool || '').split(/[,\n]/);
  pool = [...new Set([mainChampion, ...pool.map(x => clean(x, 32)).filter(Boolean)])].slice(0, 20);
  return {
    id: randomUUID(), name, nickname, age, team: input.team, position: input.position, tier: '1군',
    appearance: clean(input.appearance, 1000), personality: clean(input.personality, 1000), memo: clean(input.memo, 2000),
    mainChampion, pool, style: clean(input.style, 40) || '균형 운영',
    stats: { mechanics: 65, laning: 65, macro: 65, communication: 65, mental: 65, mastery: 65 },
    condition: 85, fatigue: 10, stress: 10
  };
}

function sessionView(user) {
  return {
    user: { id: user.id, name: user.name }, slots: user.slots,
    rooms: store.roomsFor(user.id).map(r => ({ code: r.code, name: r.name, team: r.season.team, date: r.season.date, turn: r.season.turn, memberCount: r.players.length }))
  };
}

function roomFor(code, userId) {
  const room = store.room(code.toUpperCase());
  if (!room) fail(404, '초대코드에 해당하는 방이 없습니다.');
  if (!room.players.some(p => p.userId === userId)) fail(403, '참가한 방만 조회하거나 진행할 수 있습니다.');
  return room;
}

function roomView(room, userId) {
  const view = clone(room);
  view.me = userId;
  view.messages = store.messages(room.code, userId);
  view.roster = getRoster(room);
  for (const p of view.players) p.character.tier = '1군';
  return view;
}

function systemMessage(room, text, senderName = '매니저') {
  store.addMessage(room.code, { channel: 'team', senderId: 'system', senderName, text, at: new Date().toISOString() });
}
function ensureHost(room, user) { if (room.hostId !== user.id) fail(403, '방장만 정산하거나 방을 관리할 수 있습니다.'); }
function ensureTurn(room, body) {
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
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
  catch { fail(400, '올바른 JSON 요청이 필요합니다.'); }
}

async function api(req, res, url) {
  const user = identity(req, res);
  const method = req.method, route = url.pathname;
  if (!['GET', 'HEAD'].includes(method) && req.headers.origin) {
    const origin = new URL(req.headers.origin);
    if (origin.host !== req.headers.host) fail(403, '다른 사이트에서 보낸 요청은 허용되지 않습니다.');
  }
  if (route === '/api/meta' && method === 'GET') return { actions: ACTIONS, teams: TEAMS, positions: POSITIONS, rules: RULES, locations, savePersistence: process.env.SAVE_PERSISTENCE || 'server' };
  if (route === '/api/session' && method === 'GET') return sessionView(user);
  const body = ['POST', 'PUT', 'DELETE'].includes(method) ? await bodyOf(req) : {};
  if (route === '/api/profile' && method === 'POST') {
    user.name = clean(body.name, 24) || '오너'; store.saveUser(user); return sessionView(user);
  }
  const slotMatch = route.match(/^\/api\/slots\/([0-4])$/);
  if (slotMatch && method === 'PUT') {
    user.slots[Number(slotMatch[1])] = normalizeCharacter(body.character);
    store.saveUser(user); return { slots: user.slots };
  }
  if (route === '/api/rooms' && method === 'POST') {
    const character = slotCharacter(user, body.slot);
    if (store.roomsFor(user.id).length >= 20) fail(400, '저장된 시즌 방은 최대 20개입니다. 기존 방에서 나간 뒤 새 방을 만드세요.');
    if (body.difficulty && !['easy', 'normal', 'hard'].includes(body.difficulty)) fail(400, '난이도를 선택하세요.');
    const npcPower = Number(body.npcPower ?? 65);
    if (!Number.isFinite(npcPower) || npcPower < 35 || npcPower > 95) fail(400, 'NPC 능력치는 35~95입니다.');
    let code;
    do { code = randomBytes(5).toString('hex').slice(0, 8).toUpperCase(); } while (store.room(code));
    const room = {
      id: randomUUID(), code, name: clean(body.name, 50) || `${character.team} 선수단`, hostId: user.id,
      players: [{ userId: user.id, ownerName: user.name, character, duoId: null, location: '연습실', joinedAt: new Date().toISOString() }],
      submissions: {}, revision: 1, createdAt: new Date().toISOString(),
      season: createSeason({ team: character.team, seed: clean(String(body.seed ?? '2025'), 80), difficulty: body.difficulty || 'normal', npcPower, opponents: safeOpponents(body.opponents) })
    };
    store.transaction(() => { store.saveRoom(room); systemMessage(room, `${character.nickname} 입단. 오늘부터 1군 일정에 합류합니다. 비어 있는 포지션은 NPC가 맡습니다.`); });
    return { room: roomView(room, user.id) };
  }
  if (route === '/api/rooms/join' && method === 'POST') {
    return store.transaction(() => {
      const code = clean(body.code, 20).toUpperCase(), room = store.room(code);
      if (!room) fail(404, '초대코드를 확인하세요.');
      if (room.players.some(p => p.userId === user.id)) return { room: roomView(room, user.id) };
      if (room.players.length >= 5) fail(409, '이 방은 정원 5명이 모두 참가했습니다.');
      if (room.season.finished) fail(409, '종료된 시즌에는 새로 참가할 수 없습니다.');
      const character = slotCharacter(user, body.slot);
      if (character.team !== room.season.team) fail(409, `이 방은 ${room.season.team} 선수단입니다. 같은 팀 캐릭터로 참가하세요.`);
      if (room.players.some(p => p.character.position === character.position)) fail(409, '이미 참가자가 맡고 있는 포지션입니다. 다른 포지션 캐릭터를 선택하세요.');
      room.players.push({ userId: user.id, ownerName: user.name, character, duoId: null, location: '연습실', joinedAt: new Date().toISOString() });
      room.revision++; store.saveRoom(room); systemMessage(room, `${character.nickname} 합류. ${character.position}의 NPC가 자리를 비웠습니다.`);
      return { room: roomView(room, user.id) };
    });
  }
  const match = route.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/([a-z]+))?$/);
  if (!match) fail(404, 'API 경로를 찾을 수 없습니다.');
  const [, code, operation] = match;
  if (method === 'GET') {
    const room = roomFor(code, user.id);
    if (operation === 'export') {
      return { exportedAt: new Date().toISOString(), format: 'first-team-season-v1', room: { ...room, messages: undefined }, notice: '현재 서버의 시즌 기록 내보내기. 개인 메시지는 포함하지 않습니다. 초대코드는 서버에 종속됩니다.' };
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
      case 'action': {
        ensureTurn(room, body);
        room.submissions[user.id] = { turn: room.season.turn, action: actionId(body), target: clean(body.target, 80) || null };
        break;
      }
      case 'settle': {
        ensureHost(room, user); ensureTurn(room, body);
        const missing = room.players.filter(p => room.submissions[p.userId]?.turn !== room.season.turn);
        if (missing.length && body.npcTakeover !== true) fail(409, '아직 행동을 제출하지 않은 선수가 있습니다. 기다리거나 NPC 대행을 명시적으로 선택하세요.');
        const playedDate = room.season.date;
        extra.summary = settleDay(room, { npcTakeover: body.npcTakeover === true });
        if (missing.length) systemMessage(room, `${playedDate} 미제출 ${missing.map(p => p.character.nickname).join(', ')}: 방장이 NPC 대행(휴식)을 선택했습니다.`);
        systemMessage(room, `${playedDate} 일정 정산 완료. ${room.season.finished ? '시즌이 종료되었습니다.' : `다음 일정 ${room.season.date}.`}`);
        break;
      }
      case 'auto': {
        ensureHost(room, user); ensureTurn(room, body);
        if (room.players.length !== 1) fail(409, '자동 진행은 혼자 플레이하는 방에서만 사용할 수 있습니다.');
        const action = actionId(body);
        let days = 0;
        for (let i = 0; i < 7 && !room.season.finished; i++) {
          const ownGame = room.season.schedule.some(g => g.date === room.season.date && g.status === 'scheduled' && [g.teamA, g.teamB].includes(room.season.team));
          if (ownGame) break;
          room.submissions[user.id] = { turn: room.season.turn, action };
          settleDay(room, { npcTakeover: false }); days++;
        }
        if (!days) fail(409, '오늘은 우리 팀 경기일입니다. 준비 행동을 제출한 뒤 경기일을 직접 정산하세요.');
        extra.days = days;
        systemMessage(room, `혼자 플레이 자동 진행 ${days}일. 선택한 준비 행동을 반복했고 우리 팀 경기일에는 멈춥니다.`);
        break;
      }
      case 'location': {
        if (!locations.includes(body.location)) fail(400, '이동할 장소를 선택하세요.');
        me.location = body.location;
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
      case 'leave': {
        room.players = room.players.filter(p => p.userId !== user.id);
        delete room.submissions[user.id];
        for (const p of room.players) if (p.duoId === user.id) p.duoId = null;
        if (room.hostId === user.id) room.hostId = room.players[0]?.userId || null;
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
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      const result = await api(req, res, url);
      if (res.statusCode === 304) return res.end();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(result));
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail(405, '지원하지 않는 요청 방식입니다.');
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
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
function shutdown() { server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
