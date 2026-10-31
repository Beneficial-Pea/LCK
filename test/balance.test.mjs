import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeason, getRoster, POSITIONS } from '../lib/season.mjs';
import { applyTeamNpcPreset, getBalanceReport, getTeamNpcPower } from '../lib/balance.mjs';

const keys = ['mechanics', 'laning', 'macro', 'communication', 'mental', 'mastery'];
const character = (position = 'MID', power = 65) => ({
  id: `player-${position}`, name: '밸런스 선수', nickname: `Balance${position}`, age: 20, team: 'Gen.G', position,
  mainChampion: '아리', pool: ['아리', '아지르'], style: '균형 운영', tier: '1군',
  stats: Object.fromEntries(keys.map(key => [key, power])), condition: 90, fatigue: 5, stress: 10,
  avatar: 'existing-final', avatarSource: 'private-edit-source', avatarCrop: { x: .2, y: .7, zoom: 2 },
});
function makeRoom() {
  return {
    id: 'balance-room', hostId: 'owner', revision: 7,
    players: [{ userId: 'owner', ownerName: '오너', character: character(), location: '카페', scenePosition: { x: 60, y: 75, location: '카페' }, duoId: 'NPC:TOP' }],
    season: createSeason({ year: 2026, team: 'Gen.G', seed: 'balance-unit', npcPower: 65 }),
    submissions: { owner: { turn: 1, action: 'analysis' } },
    lobby: { status: 'started', settings: { npcPower: 65, npcPowerMode: 'custom' } },
  };
}
function game(id, teamA, teamB, winner) { return { id, date: '2026-01-14', teamA, teamB, result: { winner, scoreA: winner === teamA ? 2 : 0, scoreB: winner === teamB ? 2 : 0 } }; }

test('a low custom NPC baseline is diagnosed and the team preset changes only the four NPCs', () => {
  const room = makeRoom(), before = structuredClone(room);
  const oldRoster = getRoster(room), report = getBalanceReport(room), power = getTeamNpcPower('Gen.G');
  assert.equal(power, 90);
  assert.equal(report.npcPower, 65);assert.equal(report.teamNpcPower, power);
  assert.equal(report.npcPowerMode, 'custom');assert.equal(report.canRecalibrate, true);assert.equal(report.needsReview, true);
  assert.match(report.reason, /65.*90/);
  const adjustment = applyTeamNpcPreset(room), newRoster = getRoster(room);
  assert.deepEqual(adjustment, { before: 65, after: power, effectiveFrom: before.season.date });
  assert.equal(newRoster.filter(player => player.npc).length, 4);
  for (const npc of newRoster.filter(player => player.npc)) {
    const original = oldRoster.find(player => player.id === npc.id);
    assert(original);
    for (const key of keys) assert.equal(npc.stats[key] - original.stats[key], power - 65);
  }
  assert.deepEqual(newRoster.find(player => !player.npc).stats, before.players[0].character.stats);
  assert.deepEqual(room.players, before.players);
  assert(getBalanceReport(room).rosterPower > report.rosterPower + 15);
  assert.equal(getBalanceReport(room).canRecalibrate, false);
});

test('recalibration preserves saved results, game date, submissions, human sources and identity', () => {
  const room = makeRoom();
  room.season.results = [game('past-loss', 'Gen.G', 'T1', 'T1')];
  room.season.date = '2026-01-15';room.season.turn = 4;
  room.season.history = [{ id: 'existing-history', text: '이미 있었던 경기 기록' }];
  const before = structuredClone(room);
  applyTeamNpcPreset(room);
  assert.deepEqual(room.season.results, before.season.results);
  assert.deepEqual(room.season.schedule, before.season.schedule);
  assert.deepEqual(room.season.standings, before.season.standings);
  assert.equal(room.season.date, before.season.date);assert.equal(room.season.turn, before.season.turn);
  assert.deepEqual(room.submissions, before.submissions);assert.deepEqual(room.players, before.players);
  assert.equal(room.hostId, before.hostId);assert.equal(room.revision, before.revision);
  assert.equal(room.lobby.settings.npcPowerMode, 'team');assert.equal(room.lobby.settings.npcPower, 90);
  assert.equal(room.season.history.length, 2);assert.deepEqual(room.season.history[1], before.season.history[0]);
  assert.match(room.season.history[0].text, /기존 경기 결과.*유저 선수/);
  const history = structuredClone(room.season.history);
  assert.deepEqual(applyTeamNpcPreset(room), { before: 90, after: 90, effectiveFrom: '2026-01-15' });
  assert.deepEqual(room.season.history, history, 'Repeated preset application never fabricates duplicate adjustment history');
});

test('loss-streak diagnosis counts only this team and stops at its latest win', () => {
  const room = makeRoom();
  room.season.results = [
    game('old-win', 'Gen.G', 'HLE', 'Gen.G'),
    game('loss-1', 'Gen.G', 'T1', 'T1'), game('elsewhere-1', 'KT', 'DK', 'DK'),
    game('loss-2', 'HLE', 'Gen.G', 'HLE'), game('elsewhere-2', 'BRO', 'NS', 'BRO'),
    game('loss-3', 'Gen.G', 'DK', 'DK'), game('loss-4', 'KT', 'Gen.G', 'KT'),
  ];
  room.players[0].character.fatigue = 60;room.players[0].character.condition = 40;
  const report = getBalanceReport(room);
  assert.equal(report.lostStreak, 4);assert.equal(report.fatigue, 60);assert.equal(report.condition, 40);
  assert.match(report.reason, /4연패/);assert.match(report.reason, /피로 60, 컨디션 40/);
  room.season.results.push(game('new-win', 'Gen.G', 'DK', 'Gen.G'));
  assert.equal(getBalanceReport(room).lostStreak, 0);
  room.season.results.push(game('one-new-loss', 'T1', 'Gen.G', 'T1'));
  assert.equal(getBalanceReport(room).lostStreak, 1);
});

test('healthy settings explain uncertainty instead of guaranteeing victory', () => {
  const room = makeRoom();
  room.season.npcPower = 90;room.lobby.settings = { npcPower: 90, npcPowerMode: 'team' };
  room.players = POSITIONS.map((position, index) => ({ userId: `u-${index}`, character: character(position, 90), location: '연습실' }));
  const report = getBalanceReport(room);
  assert.equal(report.needsReview, false);assert.equal(report.canRecalibrate, false);
  assert.equal(report.npcPowerMode, 'team');assert.equal(report.lostStreak, 0);
  assert.match(report.reason, /승패가 결정되지는 않습니다/);
});

test('unselected, live and finished seasons cannot be recalibrated or accidentally mutated', () => {
  const pending = makeRoom();pending.season.team = null;
  assert.deepEqual(getBalanceReport(pending), { pending: true, canRecalibrate: false, needsReview: false });
  const live = makeRoom();live.liveMatch = { id: 'live' };
  const finished = makeRoom();finished.season.finished = true;
  for (const room of [pending, live, finished]) {
    const before = structuredClone(room);
    assert.throws(() => applyTeamNpcPreset(room), error => error.status === 409);
    assert.deepEqual(room, before);
    assert.equal(getBalanceReport(room).canRecalibrate, false);
  }
});
