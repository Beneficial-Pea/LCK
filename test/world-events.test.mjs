import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeason, getRoster, settleDay } from '../lib/season.mjs';
import { simulateSeries } from '../lib/match.mjs';
import { applyWorldEvent, applyWorldEffects, getWorldCandidates, processWorldEvents } from '../lib/world-events.mjs';

const statKeys = ['mechanics', 'laning', 'macro', 'communication', 'mental', 'mastery'];
const stats = value => Object.fromEntries(statKeys.map(key => [key, value]));
function roomFor(year = 2026, seed = 'world-events-spec') {
  const season = createSeason({ year, team: 'T1', seed });
  for (const profile of season.opponents) for (const player of profile.players) player.mainChampion = '비교 챔피언';
  const enemy = season.opponents.find(profile => profile.name === 'Gen.G').players.find(player => player.position === 'MID');
  enemy.mainChampion = '아리';
  return {
    id: 'world-event-room', hostId: 'human-user', revision: 0, submissions: {},
    players: [{ userId: 'human-user', ownerName: '오너', location: '연습실', duoId: null, character: {
      id: 'human-player', name: '오리지널 선수', nickname: '인트', team: 'T1', position: 'MID', tier: '1군',
      mainChampion: '아리', pool: ['아리', '오리아나', '아지르'], stats: stats(65), condition: 90, fatigue: 5, stress: 10,
    } }], season,
  };
}
const candidatesFor = room => getWorldCandidates(room, getRoster(room));
const ahriNerf = room => applyWorldEvent(room, { type: 'champion-nerf', champion: '아리', durationDays: 14 }, candidatesFor(room));
const nextDate = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

test('a signature-champion nerf affects friendly and opposing players by exactly one lane point', () => {
  const room = roomFor(), all = candidatesFor(room);
  assert.equal(all.filter(player => player.team === 'T1').length, 5, 'human roster slots must replace their NPC candidates');
  const original = structuredClone(all);
  const event = ahriNerf(room);
  assert.equal(event.type, 'champion-nerf'); assert.equal(event.champion, '아리');
  assert.equal(event.fictional, true); assert.equal(event.durationDays, 14);
  assert(event.targets.some(target => target.id === 'human-player' && target.nickname === '인트'));
  assert(event.targets.some(target => target.team === 'Gen.G'));
  const decorated = applyWorldEffects(room, all);
  for (let i = 0; i < decorated.length; i++) {
    const player = decorated[i], before = original[i];
    assert.deepEqual(player.stats, before.stats, 'base abilities remain a separate training record');
    assert.equal(player.effectiveStats.laning, before.stats.laning - Number(before.mainChampion === '아리'));
    if (before.mainChampion === '아리') assert.equal(player.eventEffects[0].remainingDays, 14);
  }
  assert.deepEqual(all, original, 'decoration must not mutate persistent profiles');
  const lateEntrant = { ...room.players[0].character, id: 'late-player', nickname: '새 참가자', team: 'KT' };
  assert.equal(applyWorldEffects(room, [lateEntrant])[0].effectiveStats.laning, 64, 'global patches also affect later eligible players');
});

test('generated roster NPCs keep their event effects across fresh roster construction', () => {
  const room = roomFor();
  const npc = getRoster(room).find(player => player.npc && player.position === 'JGL');
  applyWorldEvent(room, { type: 'injury', targetId: npc.id, durationDays: 7 }, candidatesFor(room));
  const first = getRoster(room).find(player => player.id === npc.id);
  const second = getRoster(room).find(player => player.id === npc.id);
  assert(first.effectiveStats.mechanics < first.stats.mechanics);
  assert.deepEqual(first.effectiveStats, second.effectiveStats);
  assert.deepEqual(first.eventEffects, second.eventEffects);
  first.effectiveStats.mechanics = 1;
  assert.equal(getRoster(room).find(player => player.id === npc.id).effectiveStats.mechanics, second.effectiveStats.mechanics);
});

test('temporary adaptation expires without undoing intervening training growth', () => {
  const room = roomFor();
  const event = ahriNerf(room);
  assert.equal(event.expiresTurn, room.season.turn + 14);
  room.players[0].character.stats.laning = 67.5;
  room.season.turn = event.expiresTurn - 1;
  let player = applyWorldEffects(room, [room.players[0].character])[0];
  assert.equal(player.effectiveStats.laning, 66.5); assert.equal(player.eventEffects[0].remainingDays, 1);
  room.season.turn = event.expiresTurn;
  player = applyWorldEffects(room, [room.players[0].character])[0];
  assert.equal(player.effectiveStats.laning, 67.5); assert.equal(player.stats.laning, 67.5);
  assert.equal(player.eventEffects.length, 0);
  assert.equal(room.season.worldEvents.events[0].id, event.id, 'the historical incident remains after its active modifier expires');
});

test('daily event generation is seed-reproducible, idempotent and not confined to the player team', () => {
  const a = roomFor(2026, 'deterministic-global-events'), b = roomFor(2026, 'deterministic-global-events');
  const start = a.season.date;
  for (let turn = 1; turn <= 160; turn++) {
    for (const room of [a, b]) {
      room.season.turn = turn;room.season.date = nextDate(start, turn - 1);
      processWorldEvents(room);
      const before = structuredClone(room.season.worldEvents);
      processWorldEvents(room);
      assert.deepEqual(room.season.worldEvents, before, 'refreshing the same turn cannot reroll a global incident');
    }
  }
  assert.deepEqual(a.season.worldEvents, b.season.worldEvents);
  assert(a.season.worldEvents.events.length > 5 && a.season.worldEvents.events.length < 80);
  const turns = a.season.worldEvents.events.map(event => event.turn);
  assert.equal(new Set(turns).size, turns.length, 'there is at most one generated event per day');
  assert(a.season.worldEvents.events.some(event => event.targets.some(target => target.team !== 'T1')));
  assert(a.season.worldEvents.events.every(event => event.fictional === true));
});

test('fictional controversy cannot target a human character or impersonate real-player reporting', () => {
  const room = roomFor();room.players[0].character.nickname = 'Faker';
  assert.throws(() => applyWorldEvent(room, { type: 'npc-incident', targetId: 'human-player' }, candidatesFor(room)));
  const npc = candidatesFor(room).find(player => player.npc && player.id.startsWith('npc:') && player.team !== 'T1');
  const event = applyWorldEvent(room, { type: 'npc-incident', targetId: npc.id, durationDays: 7 }, candidatesFor(room));
  assert.equal(event.fictional, true);
  assert(event.targets.length > 0);
  assert(event.targets.every(target => target.id.startsWith('npc:')));
  assert(!event.targets.some(target => target.nickname === 'Faker'));
  assert(!/성범죄|승부조작|불법|체포/.test(event.summary));
});

test('the match engine uses event-adjusted abilities rather than the unmodified displayed base', () => {
  const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const makeTeam = (name, base, effective) => ({ name, players: positions.map(position => ({
    id: name + position, nickname: name + position, position, stats: stats(base), effectiveStats: stats(effective),
    condition: 90, fatigue: 5, stress: 10, mainChampion: '아리', pool: ['아리'],
  })) });
  let adjustedWins = 0, baseWins = 0;
  for (let i = 0; i < 60; i++) {
    const seed = `event-stat-match-${i}`;
    if (simulateSeries({ teamA: makeTeam('A', 95, 5), teamB: makeTeam('B', 5, 95), bestOf: 1, seed }).winner === 'A') adjustedWins++;
    const rawA = makeTeam('A', 95, 95), rawB = makeTeam('B', 5, 5);
    if (simulateSeries({ teamA: rawA, teamB: rawB, bestOf: 1, seed }).winner === 'A') baseWins++;
  }
  assert(adjustedWins < 15, `adjusted weak team won ${adjustedWins}/60`);
  assert(baseWins > 45, `baseline strong team won ${baseWins}/60`);
});

test('both year engines settle global news once per game day and preserve existing training', () => {
  for (const year of [2025, 2026]) {
    const room = roomFor(year, `daily-engine-${year}`);
    const turn = room.season.turn, initial = room.players[0].character.stats.laning;
    room.submissions['human-user'] = { turn, action: 'laning' };
    settleDay(room);
    assert.equal(room.season.worldEvents.lastProcessedTurn, turn);
    assert(room.players[0].character.stats.laning > initial);
    assert.equal(room.season.turn, turn + 1);
    const retained = structuredClone(room.season.worldEvents);
    getRoster(room);getRoster(room);
    assert.deepEqual(room.season.worldEvents, retained, 'cosmetic roster reads cannot generate another event');
  }
});

test('waiting and completed seasons do not roll new events and long ledgers stay bounded', () => {
  const waiting = roomFor();waiting.lobby = { status: 'waiting' };
  const before = structuredClone(waiting);
  processWorldEvents(waiting);assert.deepEqual(waiting, before);
  const finished = roomFor();finished.season.finished = true;
  processWorldEvents(finished);assert.equal(finished.season.worldEvents, undefined);
  const room = roomFor();
  for (let turn = 1; turn <= 180; turn++) {
    room.season.turn = turn;
    applyWorldEvent(room, { type: 'champion-nerf', champion: '아리', durationDays: 14 }, candidatesFor(room));
  }
  assert(room.season.worldEvents.events.length <= 120);
  assert(room.season.worldEvents.activeEffects.length <= 60);
  assert.equal(new Set(room.season.worldEvents.events.map(event => event.id)).size, room.season.worldEvents.events.length);
});
