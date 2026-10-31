import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, POSITIONS, RULES, TEAMS, createSeason, getRoster, settleDay } from '../lib/season.mjs';

function makeRoom(options = {}) {
  return { id: 'room', hostId: 'u', players: [{ userId: 'u', ownerName: 'owner', location: '연습실', duoId: null, character: { id: 'c', name: '선수', nickname: 'MyPlayer', team: options.team || 'T1', position: 'MID', mainChampion: '아리', pool: ['아리', '아지르', '오리아나', '사일러스', '갈리오', '탈리야', '빅토르', '르블랑'], stats: { mechanics: options.power || 65, laning: options.power || 65, macro: options.power || 65, communication: options.power || 65, mental: options.power || 65, mastery: options.power || 65 }, condition: 90, fatigue: 5, stress: 10, tier: '연습생' } }], season: createSeason(options), submissions: {}, revision: 0 };
}
function advance(room, action = 'rest') { room.submissions = Object.fromEntries(room.players.map(p => [p.userId, { turn: room.season.turn, action }])); return settleDay(room); }
function seasonRun(options) { const room = makeRoom(options); for (let i = 0; i < 301; i++) advance(room, i % 4 === 0 ? 'analysis' : 'rest'); return room; }

test('fixed regular-season opponent counts, dates and stage windows', () => {
  const s = createSeason({ seed: 'schedule' });
  const league = s.schedule.filter(g => g.stage === 'LCK R1~2');
  assert.equal(league.length, 90);
  for (const team of TEAMS) assert.equal(league.filter(g => g.teamA === team || g.teamB === team).length, 18);
  for (const a of TEAMS) for (const b of TEAMS) if (a !== b) assert.equal(league.filter(g => [g.teamA, g.teamB].includes(a) && [g.teamA, g.teamB].includes(b)).length, 2);
  for (const day of new Set(league.map(g => g.date))) { const today = league.filter(g => g.date === day); assert.equal(new Set(today.flatMap(g => [g.teamA, g.teamB])).size, today.length * 2); }
  assert.equal(new Set(s.schedule.map(g => g.id)).size, s.schedule.length);
  assert.ok(s.schedule.every(g => g.date >= '2025-01-15' && g.date <= '2025-11-09'));
  assert.ok(RULES.some(text => text.includes('완전 재현이 아닙니다')));
});

test('missing/late actions block settlement; explicit NPC takeover rests and records it', () => {
  const room = makeRoom(); const before = structuredClone(room);
  assert.throws(() => settleDay(room), /제출/); assert.deepEqual(room, before);
  room.submissions.u = { turn: 0, action: 'mechanics' };
  assert.throws(() => settleDay(room), /제출/);
  room.players[0].character.fatigue = 80;
  const summary = settleDay(room, { npcTakeover: true });
  assert.equal(summary.actions[0].action, 'rest'); assert.equal(summary.actions[0].takeover, true);
  assert.equal(room.season.turn, 2); assert.equal(room.season.date, '2025-01-14');
  assert.equal(room.players[0].character.fatigue, 55);
  assert.equal(room.players[0].character.tier, '1군');
  assert.deepEqual(room.submissions, {});
});

test('training grows distinct stats; fatigue limits growth, temporary duo stays temporary', () => {
  const room = makeRoom(); const original = room.players[0].character.stats.mechanics;
  advance(room, 'mechanics'); assert.ok(room.players[0].character.stats.mechanics > original); assert.equal(room.players[0].character.stats.macro, 65);
  const fatigueRoom = makeRoom(); fatigueRoom.players[0].character.fatigue = 90;
  advance(fatigueRoom, 'mechanics'); assert.ok(fatigueRoom.players[0].character.stats.mechanics < room.players[0].character.stats.mechanics);
  advance(room, 'duo'); assert.equal(room.players[0].duoId, null);
  assert.equal(room.season.relationships[0].targetId, 'temporary-npc');
  assert.ok(room.season.history[0].text.includes('해제'));
  assert.equal(getRoster(room).length, 5); assert.deepEqual(getRoster(room).map(p => p.position), POSITIONS);
  assert.equal(getRoster(room).filter(p => !p.npc).length, 1);
});

test('a selected fixed NPC duo keeps its identity and never becomes a temporary assignment', () => {
  const room = makeRoom(); room.players[0].duoId = 'NPC:TOP';
  advance(room, 'duo'); advance(room, 'duo');
  assert.equal(room.players[0].duoId, 'NPC:TOP');
  assert.equal(room.season.relationships.length, 1);
  const relation = room.season.relationships[0];
  assert.equal(relation.targetId, 'NPC:TOP'); assert.equal(relation.targetName, getRoster(room).find(player => player.position === 'TOP').nickname);
  assert.equal(relation.memories.length, 2); assert.equal(relation.affinity, 6);
  assert.ok(room.season.history.filter(e => e.type === 'action').every(e => !e.text.includes('임시 배정')));
  room.players[0].duoId = null; advance(room, 'duo');
  assert.equal(room.players[0].duoId, null);
  assert.equal(room.season.relationships[1].targetId, 'temporary-npc');
});

test('staff relations remember shared work and unlock a personal event once at the threshold', () => {
  for (const [action, targetId] of [['analysis', 'staff:analyst'], ['team', 'staff:coach']]) {
    const room = makeRoom();
    for (let i = 0; i < 3; i++) advance(room, action);
    const relation = room.season.relationships.find(r => r.targetId === targetId);
    assert.equal(relation.affinity, 9); assert.equal(relation.personalEventUnlocked, undefined);
    assert.equal(relation.memories.length, 3);
    advance(room, action);
    assert.equal(relation.affinity, 12); assert.equal(relation.personalEventUnlocked, true);
    assert.equal(room.season.history.filter(e => e.type === 'personal-event' && e.targetId === targetId).length, 1);
    for (let i = 0; i < 42; i++) advance(room, action);
    assert.equal(relation.memories.length, 40);
    assert.equal(room.season.history.filter(e => e.type === 'personal-event' && e.targetId === targetId).length, 1);
  }
});

test('three complete deterministic seasons reach all required stages without unresolved fixtures', () => {
  const finalStatuses = [];
  for (const options of [{ seed: 'whole-weak', team: 'BRO', power: 30, npcPower: 35, difficulty: 'hard' }, { seed: 'whole-strong', power: 99, npcPower: 95, difficulty: 'easy' }, { seed: 'whole-balanced', power: 65 }]) {
    const room = seasonRun(options), s = room.season;
    assert.equal(s.finished, true); assert.equal(s.turn, 301); assert.equal(s.date, '2025-11-09');
    assert.ok(s.schedule.every(g => g.status === 'completed'), `unresolved fixtures for ${options.seed}`);
    assert.equal(s.results.length, s.schedule.length);
    assert.equal(new Set(s.results.map(g => g.id)).size, s.results.length);
    assert.ok(s.results.some(g => g.id === 'worlds-final')); assert.ok(s.results.some(g => g.id === 'msi-final')); assert.ok(s.results.some(g => g.id === 'fst-final'));
    assert.ok(s.standings.every(t => t.played === 30));
    assert.equal(s.results.filter(g => g.stage === 'LCK R3~5').length, 60);
    const cupChampion = s.schedule.find(g => g.id === 'cup-final').result.winner;
    const fstLckTeams = new Set(s.results.filter(g => g.stage === '퍼스트 스탠드').flatMap(g => [g.teamA, g.teamB]).filter(t => TEAMS.includes(t)));
    assert.deepEqual([...fstLckTeams], [cupChampion]);
    assert.equal(s.qualifications.msi.teams.length, 2);
    assert.ok(s.qualifications.msi.teams.every(t => s.tournaments.roadSeeds.includes(t)));
    const finalists = [s.schedule.find(g => g.id === 'msi-final').teamA, s.schedule.find(g => g.id === 'msi-final').teamB];
    assert.equal(s.qualifications.worlds.seeds, finalists.some(t => TEAMS.includes(t)) ? 4 : 3);
    assert.equal(s.qualifications.worlds.teams.length, s.qualifications.worlds.seeds);
    const swiss = s.tournaments.worldsSwiss;
    assert.equal(swiss.length, 16); assert.equal(swiss.filter(t => t.wins === 3).length, 8); assert.equal(swiss.filter(t => t.losses === 3).length, 8);
    if (s.qualifications.msi.status === 'not-qualified') assert.ok(!s.results.some(g => g.stage === 'MSI' && [g.teamA, g.teamB].includes(s.team)));
    if (s.qualifications.worlds.status === 'not-qualified') assert.ok(!s.results.some(g => g.stage === '월즈' && [g.teamA, g.teamB].includes(s.team)));
    if (options.seed === 'whole-weak') { assert.equal(s.qualifications.msi.status, 'not-qualified'); assert.equal(s.qualifications.worlds.status, 'not-qualified'); }
    finalStatuses.push(s.qualifications.msi.status);
    assert.throws(() => settleDay(room, { npcTakeover: true }), /종료/);
  }
  assert.ok(finalStatuses.includes('not-qualified')); assert.ok(finalStatuses.some(s => s === 'champion' || s === 'eliminated'));
});

test('same saved seed and actions reproduce all match scores, standings and gates', () => {
  const a = seasonRun({ seed: 'repeat', team: 'DK' }).season;
  const b = seasonRun({ seed: 'repeat', team: 'DK' }).season;
  assert.deepEqual(a.results.map(g => [g.id, g.result.scoreA, g.result.scoreB]), b.results.map(g => [g.id, g.result.scoreA, g.result.scoreB]));
  assert.deepEqual(a.standings, b.standings); assert.deepEqual(a.qualifications, b.qualifications);
});

test('LCK missing the MSI final receives exactly three Worlds seats', () => {
  const room = seasonRun({ team: 'BRO', power: 35, seed: 'three-seeds', npcPower: 35, opponents: TEAMS.map(name => ({ name, power: 35, style: '균형 운영' })) });
  const s = room.season, final = s.schedule.find(g => g.id === 'msi-final');
  assert.ok(!TEAMS.includes(final.teamA)); assert.ok(!TEAMS.includes(final.teamB));
  assert.equal(s.qualifications.worlds.seeds, 3); assert.equal(s.qualifications.worlds.teams.length, 3);
  assert.ok(s.qualifications.worlds.reason.includes('미진출'));
});

test('opponents preserve explicit per-player strengths/styles and config is a snapshot', () => {
  const input = [{ name: 'Gen.G', power: 91, style: '사이드 운영' }]; const s = createSeason({ opponents: input, difficulty: 'normal' });
  input[0].power = 35;
  const opponent = s.opponents.find(o => o.name === 'Gen.G');
  assert.equal(opponent.power, 91); assert.equal(opponent.style, '사이드 운영'); assert.equal(opponent.players.length, 5);
  assert.ok(opponent.players.every(p => p.stats.mechanics > 80));
  assert.ok(ACTIONS.find(a => a.id === 'rest'));
});
