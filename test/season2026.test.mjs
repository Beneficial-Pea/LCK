import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSeason, settleDay, TEAMS } from '../lib/season.mjs';

const calendar = JSON.parse(readFileSync(new URL('../data/calendar-2026.json', import.meta.url), 'utf8'));
const sourceMatches = [...calendar.domestic, ...calendar.international];
const sourceById = new Map(sourceMatches.map(m => [String(m.id), m]));
const keys = ['mechanics', 'laning', 'macro', 'communication', 'mental', 'mastery'];

function makeRoom(options = {}) {
  const team = options.team || 'T1';
  return {
    id: '2026-room', hostId: 'u', revision: 0, submissions: {},
    players: [{
      userId: 'u', ownerName: '오너', location: '연습실', duoId: null,
      character: {
        id: 'player', name: '시즌검증선수', nickname: 'SeasonPlayer', team, position: 'MID', tier: '1군',
        mainChampion: '아리', pool: ['아리', '아지르', '오리아나', '사일러스', '갈리오', '탈리야', '빅토르', '르블랑'],
        style: '균형 운영', stats: Object.fromEntries(keys.map(key => [key, options.power ?? 65])), condition: 90, fatigue: 5, stress: 10
      }
    }],
    season: createSeason({ year: 2026, ...options })
  };
}
function advance(room, i = 0) {
  room.submissions.u = { turn: room.season.turn, action: i % 4 === 0 ? 'analysis' : 'rest' };
  try { return settleDay(room); }
  catch (error) { throw new Error(`${room.season.seed} ${room.season.date}: ${error.message}`, { cause: error }); }
}
const cache = new Map();
function runSeason(options = {}, fresh = false) {
  const key = JSON.stringify(options);
  if (!fresh && cache.has(key)) return cache.get(key);
  const room = makeRoom(options);
  for (let i = 0; i < 308 && !room.season.finished; i++) advance(room, i);
  if (!fresh) cache.set(key, room);
  return room;
}
const weakOptions = { team: 'BRO', power: 35, npcPower: 35, difficulty: 'hard', seed: '2026-weak' };
const strongOptions = { team: 'T1', power: 99, npcPower: 95, difficulty: 'easy', seed: '2026-strong', opponents: TEAMS.map(name => ({ name, power: 35, style: '균형 운영' })) };
const balancedOptions = { team: 'DK', power: 70, npcPower: 70, seed: '2026-balanced' };

test('2026 calendar keeps every imported KST slot and the actual fixed Cup/R1~2 pairings', () => {
  const s = createSeason({ year: 2026, seed: '2026-calendar' });
  assert.equal(s.year, 2026); assert.equal(s.startDate, '2026-01-12'); assert.equal(s.endDate, '2026-11-15');
  assert.equal(s.totalTurns, 308); assert.equal(s.turn, 1); assert.equal(s.date, s.startDate);
  assert.equal(s.schedule.length, sourceMatches.length+27+s.ewc.qualifierMatchCount);
  assert.equal(new Set(s.schedule.map(g => g.id)).size, s.schedule.length);
  assert.equal(new Set(s.schedule.filter(g=>g.sourceId!=null).map(g => String(g.sourceId))).size, sourceMatches.length);
  for (const match of s.schedule.filter(g=>g.sourceId!=null)) {
    const source = sourceById.get(String(match.sourceId));
    assert.ok(source, `unknown source slot ${match.id}/${match.sourceId}`);
    assert.equal(match.date, source.date); assert.equal(match.sourceStart, source.start);
    assert.deepEqual(match.sourceTeams, source.teams); assert.equal(match.bestOf, source.bestOf);
    assert.ok(match.date >= s.startDate && match.date <= s.endDate);
    assert.ok(!match.result, 'historical completed scores must not pre-resolve this game season');
  }
  const cup = s.schedule.filter(g => g.id.startsWith('cup-group-'));
  const league = s.schedule.filter(g => g.id.startsWith('league-'));
  assert.equal(cup.length, 25); assert.equal(cup.filter(g => g.bestOf === 5).length, 5);
  assert.equal(league.length, 90);
  assert.equal(s.schedule.filter(g => g.id.startsWith('groups-')).length, 40);
  for (const match of [...cup, ...league]) assert.deepEqual([match.teamA, match.teamB], sourceById.get(String(match.sourceId)).teams);
  for (const team of TEAMS) assert.equal(league.filter(g => [g.teamA, g.teamB].includes(team)).length, 18);
  for (const a of TEAMS) for (const b of TEAMS) if (a !== b) {
    assert.equal(league.filter(g => [g.teamA, g.teamB].includes(a) && [g.teamA, g.teamB].includes(b)).length, 2);
  }
});

test('Cup runner-up actually enters First Stand without winning Cup and other LCK teams stay out', () => {
  let runnerUpRoom;
  for (let i = 0; i < 16 && !runnerUpRoom; i++) {
    const room = makeRoom({ team: 'T1', power: 84, npcPower: 83, seed: `2026-runnerup-${i}` });
    let days = 0;
    while (room.season.date <= '2026-03-01' && !room.season.finished) advance(room, days++);
    const final = room.season.schedule.find(g => g.id === 'cup-final');
    assert.ok(final?.result, 'Cup must finish on its recorded final date');
    if ([final.teamA, final.teamB].includes(room.season.team) && final.result.winner !== room.season.team) runnerUpRoom = room;
  }
  assert.ok(runnerUpRoom, 'a seeded runner-up path must be reachable');
  const s = runnerUpRoom.season;
  const cupFinal = s.schedule.find(g => g.id === 'cup-final');
  assert.deepEqual(new Set(s.qualifications.firstStand.teams), new Set([cupFinal.teamA, cupFinal.teamB]));
  assert.equal(s.qualifications.firstStand.team, cupFinal.result.winner);
  assert.ok(s.qualifications.firstStand.teams.includes(s.team));
  assert.equal(s.qualifications.firstStand.status, 'qualified');
  const fstEnd = sourceMatches.filter(g => g.league === 'FST').map(g => g.date).sort().at(-1);
  let days = 0;
  while (s.date <= fstEnd) advance(runnerUpRoom, days++);
  const fstLck = new Set(s.results.filter(g => String(g.id).startsWith('fst-')).flatMap(g => [g.teamA, g.teamB]).filter(team => TEAMS.includes(team)));
  assert.deepEqual(fstLck, new Set([cupFinal.teamA, cupFinal.teamB]));
  assert.ok(s.results.some(g => g.id.startsWith('fst-') && [g.teamA, g.teamB].includes(s.team)));
});

test('2026 group split carries all R1~2 results into two further intra-group rounds', () => {
  const room = makeRoom({ seed: '2026-carry', team: 'Gen.G' });
  let i = 0;
  while (room.season.date < '2026-07-29') advance(room, i++);
  const s = room.season;
  assert.ok(s.standings.every(row => row.played === 18));
  assert.equal(s.groups.legend.length, 5); assert.equal(s.groups.rise.length, 5);
  const before = new Map(s.standings.map(row => [row.team, { played: row.played, wins: row.wins, losses: row.losses }]));
  advance(room, i++);
  for (const row of s.standings) {
    const prior = before.get(row.team);
    assert.ok(row.played >= prior.played); assert.ok(row.wins >= prior.wins); assert.ok(row.losses >= prior.losses);
  }
  while (!s.finished) advance(room, i++);
  assert.ok(s.standings.every(row => row.played === 26));
  for (const match of s.results.filter(g => g.id.startsWith('groups-'))) {
    assert.ok(s.groups.legend.includes(match.teamA) === s.groups.legend.includes(match.teamB));
  }
});

test('weak, strong and balanced seasons finish every 2026 stage and enforce qualification or elimination', () => {
  const msiStatuses = [];
  for (const options of [weakOptions, strongOptions, balancedOptions]) {
    const room = runSeason(options), s = room.season;
    assert.equal(s.finished, true); assert.equal(s.turn, 308); assert.equal(s.date, '2026-11-15');
    assert.ok(s.schedule.every(g => !['scheduled', 'pending'].includes(g.status)), `unresolved fixture in ${options.seed}`);
    const completed = s.schedule.filter(g => g.status === 'completed');
    assert.equal(s.results.length, completed.length); assert.equal(new Set(s.results.map(g => g.id)).size, s.results.length);
    for (const id of ['cup-final', 'fst-final', 'msi-final', 'worlds-final']) assert.ok(s.results.some(g => g.id === id), `${id} never executed`);
    assert.equal(s.tournaments.roadSeeds.length, 6); assert.equal(s.qualifications.msi.teams.length, 2);
    assert.ok(s.qualifications.msi.teams.every(team => s.tournaments.roadSeeds.includes(team)));
    assert.equal(s.qualifications.firstStand.teams.length, 2);
    const fstLck = new Set(s.results.filter(g => g.id.startsWith('fst-')).flatMap(g => [g.teamA, g.teamB]).filter(team => TEAMS.includes(team)));
    assert.deepEqual(fstLck, new Set(s.qualifications.firstStand.teams));
    const final = s.results.find(g => g.id === 'msi-final');
    assert.equal(s.qualifications.worlds.seeds, [final.teamA, final.teamB].some(team => TEAMS.includes(team)) ? 4 : 3);
    assert.equal(s.qualifications.worlds.teams.length, s.qualifications.worlds.seeds);
    if (s.qualifications.msi.status === 'not-qualified') assert.ok(!s.results.some(g => g.id.startsWith('msi-') && [g.teamA, g.teamB].includes(s.team)));
    if (s.qualifications.worlds.status === 'not-qualified') assert.ok(!s.results.some(g => /^(worlds-|swiss-)/.test(g.id) && [g.teamA, g.teamB].includes(s.team)));
    if (options === weakOptions) { assert.equal(s.qualifications.msi.status, 'not-qualified'); assert.equal(s.qualifications.worlds.status, 'not-qualified'); }
    msiStatuses.push(s.qualifications.msi.status);
    assert.throws(() => settleDay(room, { npcTakeover: true }), /종료/);
  }
  assert.ok(msiStatuses.includes('not-qualified')); assert.ok(msiStatuses.some(status => ['champion', 'eliminated'].includes(status)));
});

test('Worlds reaches exactly eight Swiss qualifiers and eight three-loss eliminations', () => {
  for (const options of [strongOptions, weakOptions]) {
    const s = runSeason(options).season;
    const swiss = s.tournaments.worldsSwiss;
    assert.equal(swiss.length, 16); assert.equal(swiss.filter(row => row.wins === 3).length, 8); assert.equal(swiss.filter(row => row.losses === 3).length, 8);
    assert.ok(swiss.every(row => (row.wins === 3 && row.losses < 3) || (row.losses === 3 && row.wins < 3)));
    const quarters = s.results.filter(g => /^worlds-q[1-4]$/.test(g.id));
    assert.equal(quarters.length, 4);
    assert.deepEqual(new Set(quarters.flatMap(g => [g.teamA, g.teamB])), new Set(swiss.filter(row => row.wins === 3).map(row => row.team)));
  }
});

test('the no-LCK-MSI-final branch grants three Worlds seats while the LCK-final branch grants four', () => {
  const allLow = { team: 'BRO', power: 35, npcPower: 35, seed: '2026-three-seeds', opponents: TEAMS.map(name => ({ name, power: 35, style: '균형 운영' })) };
  const low = runSeason(allLow).season, lowFinal = low.results.find(g => g.id === 'msi-final');
  assert.ok(!TEAMS.includes(lowFinal.teamA) && !TEAMS.includes(lowFinal.teamB));
  assert.equal(low.qualifications.worlds.seeds, 3); assert.equal(low.qualifications.worlds.teams.length, 3);
  const high = runSeason(strongOptions).season, highFinal = high.results.find(g => g.id === 'msi-final');
  assert.ok([highFinal.teamA, highFinal.teamB].some(team => TEAMS.includes(team)));
  assert.equal(high.qualifications.worlds.seeds, 4); assert.equal(high.qualifications.worlds.teams.length, 4);
});

test('repeated 2026 seeds replay simulated results and own-game event KDA without fixing historical scores', () => {
  const a = runSeason(balancedOptions).season;
  const b = runSeason(balancedOptions, true).season;
  assert.deepEqual(a.results.map(g => [g.id, g.result.scoreA, g.result.scoreB]), b.results.map(g => [g.id, g.result.scoreA, g.result.scoreB]));
  assert.deepEqual(a.standings, b.standings); assert.deepEqual(a.qualifications, b.qualifications);
  const own = a.results.filter(g => [g.teamA, g.teamB].includes(a.team)); assert.ok(own.length > 0);
  for (const match of own) for (const set of match.result.sets) {
    assert.ok(set.events.length > 0); assert.equal(set.scoreboard.length, 10);
    assert.equal(set.events.filter(e => e.type === 'first_blood').length, 1);
    const rowsA = set.scoreboard.filter(row => row.team === match.teamA), rowsB = set.scoreboard.filter(row => row.team === match.teamB);
    assert.equal(rowsA.reduce((sum, row) => sum + row.k, 0), set.killsA); assert.equal(rowsB.reduce((sum, row) => sum + row.k, 0), set.killsB);
    assert.equal(rowsA.reduce((sum, row) => sum + row.d, 0), set.killsB); assert.equal(rowsB.reduce((sum, row) => sum + row.d, 0), set.killsA);
  }
  assert.ok(a.results.some(g => {
    const source = sourceById.get(String(g.sourceId));
    return source?.score && (g.result.scoreA !== source.score[0] || g.result.scoreB !== source.score[1]);
  }), 'saved real-world scores must not be used as game outcomes');
});

test('existing 2025 saves without year keep their original dates and 301-turn route', () => {
  const room = makeRoom({ year: 2025, seed: 'legacy-still-2025' });
  assert.equal(room.season.totalTurns, 301); assert.equal(room.season.date, '2025-01-13');
  delete room.season.year;
  advance(room);
  assert.equal(room.season.date, '2025-01-14'); assert.equal(room.season.totalTurns, 301);
  assert.ok(room.season.schedule.every(g => g.date.startsWith('2025-')));
});
