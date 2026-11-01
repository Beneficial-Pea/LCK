import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeason, getRoster, TEAMS } from '../lib/season.mjs';
import { ensureRosterNicknames, hasNicknameCollision, LCK_NPC_ALIASES, normalizeNickname, npcNickname } from '../lib/nicknames.mjs';

const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const human = (nickname, position = 'MID', id = 'human') => ({ userId: id, character: {
  id, nickname, name: nickname, position, team: 'T1', stats: { mechanics: 65, laning: 65, macro: 65, communication: 65, mental: 65, mastery: 65 },
  mainChampion: '아리', pool: ['아리'], condition: 85, fatigue: 10, stress: 10,
} });
const roomFor = (players = [human('나의 선수')], year = 2026) => ({ players, season: createSeason({ team: 'T1', year, seed: 'unique-names' }), submissions: {}, revision: 1 });
const activeRoster = room => [
  ...getRoster(room),
  ...room.season.opponents.filter(profile => profile.name !== room.season.team).flatMap(profile => ensureRosterNicknames(room, profile.players, profile.name)),
];

test('all ten LCK teams start with fifty distinct fictional aliases in both season years', () => {
  assert.equal(Object.values(LCK_NPC_ALIASES).flat().length, 50);
  for (const year of [2025, 2026]) {
    const season = createSeason({ year });
    const names = season.opponents.flatMap(profile => profile.players.map(player => player.nickname));
    assert.equal(names.length, 50);
    assert.equal(new Set(names.map(normalizeNickname)).size, 50);
    assert(names.every(name => /^[A-Za-z]+$/.test(name)), 'A repeated team prefix plus common role name is no longer the alias scheme');
    assert(season.opponents.every(profile => profile.players.every(player => player.generatedNpc === true)));
  }
});

test('a human taking an opponent alias keeps their name and only the NPC gets a collision-free alias', () => {
  const room = roomFor([human('ＮＥＶＥＮ'), human('nevenv1', 'JGL', 'second-human')]);
  const before = structuredClone(room);
  const roster = activeRoster(room);
  assert.equal(roster.length, 50);
  assert.equal(new Set(roster.map(player => normalizeNickname(player.nickname))).size, 50);
  assert.equal(roster.find(player => player.id === 'human').nickname, 'ＮＥＶＥＮ');
  const npc = roster.find(player => player.id === 'npc:Gen.G:MID');
  assert.equal(npc.nickname, 'NevenV2');
  assert.equal(npc.generatedNpc, true);
  assert.deepEqual(room, before, 'Current aliases are a view projection, not a mutation of saved identity or results');
  assert.deepEqual(activeRoster(room).map(player => player.nickname), roster.map(player => player.nickname));
});

test('international and waiting-room fallbacks remain deterministic and globally unique', () => {
  const room = roomFor();
  const teams = ['AL', 'A.L', 'BLG', 'G2', 'KC', 'CFO', 'PSG', 'FLY', '대기실'];
  room.season.schedule.push(...teams.map((team, i) => ({ id: `extra-${i}`, teamA: team, teamB: 'T1' })));
  const players = teams.flatMap(team => positions.map(position => ({ id: `npc:${team}:${position}`, team, position, nickname: 'old repeated name', npc: true })));
  const all = [...activeRoster(room), ...ensureRosterNicknames(room, players)];
  assert.equal(new Set(all.map(player => normalizeNickname(player.nickname))).size, all.length);
  assert.deepEqual(ensureRosterNicknames(room, players), ensureRosterNicknames(structuredClone(room), players));
  assert.equal(npcNickname('대기실', 'MID'), 'ReserveMid');
});

test('legacy NPC names are projected for future views while old scoreboards and stored profiles stay unchanged', () => {
  const room = roomFor();
  for (const profile of room.season.opponents) for (const player of profile.players) {
    player.nickname = `${profile.name} Comma`; delete player.generatedNpc;
  }
  room.season.results.push({ id: 'historical', result: { sets: [{ scoreboard: [{ nickname: 'Gen.G Comma' }], events: [{ text: 'Gen.G Comma 퍼스트 킬' }] }] } });
  const before = structuredClone(room);
  const projected = activeRoster(room);
  assert.equal(new Set(projected.map(player => normalizeNickname(player.nickname))).size, 50);
  assert(projected.filter(player => player.npc).every(player => player.generatedNpc === true));
  assert.equal(projected.find(player => player.id === 'npc:Gen.G:MID').nickname, 'Neven');
  assert.deepEqual(room, before);
});

test('human nickname duplicate checks normalize width, case, whitespace and invisible separators', () => {
  const players = [human('Ｒａｖｅｌ'), human('인트', 'JGL', 'second-human')];
  assert(hasNicknameCollision(players, 'ravel'));
  assert(hasNicknameCollision(players, 'Ra\u200bvel'));
  assert(hasNicknameCollision(players, ' R a v e l '));
  assert(hasNicknameCollision(players, ' 인트 '));
  assert(!hasNicknameCollision(players, 'ravel', 'human'));
  assert(!hasNicknameCollision(players, '새 닉네임'));
  assert(!hasNicknameCollision(players, ''));
  assert.equal(TEAMS.length * positions.length, 50);
});

test('all overseas slots use short aliases distinct from every LCK slot and human nickname',async()=>{
 const {INTERNATIONAL_NPC_TEAMS}=await import('../lib/nicknames.mjs');
 const room=roomFor([human('Aeris')]);
 const overseas=INTERNATIONAL_NPC_TEAMS.flatMap(team=>positions.map(position=>({id:`npc:${team}:${position}`,team,position,npc:true})));
 const all=[...activeRoster(room),...ensureRosterNicknames(room,overseas)];
 assert.equal(new Set(all.map(p=>normalizeNickname(p.nickname))).size,all.length);
 for(const p of ensureRosterNicknames(room,overseas)){assert(p.nickname.length<=12);assert(!/(Top|Jungle|Mid|Carry|Support)/.test(p.nickname));}
 assert.notEqual(npcNickname('JDG','TOP'),'AsterJDGTop');
});
