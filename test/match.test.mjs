import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateSeries } from '../lib/match.mjs';

const stats = value => ({ mechanics: value, laning: value, macro: value, communication: value, mental: value, mastery: value });
const team = (name, value = 65, extras = {}) => ({ name, style: 'balanced', players: ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(position => ({ nickname: `${name}-${position}`, position, stats: stats(value), condition: 90, fatigue: 10, stress: 10, pool: [], ...extras })) });

test('seed reproduces every draft, event and series result without mutating inputs', () => {
  const teamA = team('서울'), teamB = team('부산');
  const before = structuredClone({ teamA, teamB });
  const a = simulateSeries({ teamA, teamB, bestOf: 5, seed: 'replay-42' });
  const b = simulateSeries({ teamA, teamB, bestOf: 5, seed: 'replay-42' });
  assert.deepEqual(a, b);
  assert.deepEqual({ teamA, teamB }, before);
  assert.notDeepEqual(a, simulateSeries({ teamA, teamB, bestOf: 5, seed: 'replay-43' }));
});

test('every kill and assist in the scoreboard is an actual logged event', () => {
  const result = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 5, seed: 'scoreboard' });
  for (const set of result.sets) {
    const totals = new Map(set.scoreboard.map(p => [`${p.team}:${p.nickname}`, { k: 0, d: 0, a: 0 }]));
    const events = set.events.flatMap(e => e.kills || []);
    for (const kill of events) {
      totals.get(`${kill.killerTeam}:${kill.killer}`).k++;
      totals.get(`${kill.victimTeam}:${kill.victim}`).d++;
      for (const assistant of kill.assists) totals.get(`${kill.killerTeam}:${assistant}`).a++;
      assert(!kill.assists.includes(kill.killer), 'killer cannot assist own kill');
      assert.equal(new Set(kill.assists).size, kill.assists.length);
    }
    for (const player of set.scoreboard) {
      const recorded = totals.get(`${player.team}:${player.nickname}`);
      assert.deepEqual({ k: player.k, d: player.d, a: player.a }, recorded);
    }
    assert.equal(set.killsA, set.scoreboard.filter(p => p.team === 'A').reduce((sum, p) => sum + p.k, 0));
    assert.equal(set.killsB, set.scoreboard.filter(p => p.team === 'B').reduce((sum, p) => sum + p.k, 0));
    assert.equal(set.events.filter(e => e.type === 'first_blood').length, 1);
    assert.equal(set.events.at(-1).type, 'nexus');
    assert.equal(set.events.at(-1).team, set.winner);
    const combat = set.events.filter(e => e.kills?.length);
    assert.equal(combat[0].type, 'first_blood');
    const stamp = e => e.time.split(':').reduce((m, n) => m * 60 + Number(n), 0);
    for (let i = 1; i < set.events.length; i++) assert(stamp(set.events[i]) >= stamp(set.events[i - 1]));
  }
});

test('a series stops immediately on the required number of wins', () => {
  for (const bestOf of [1, 3, 5]) {
    const result = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf, seed: `best-${bestOf}` });
    assert.equal(Math.max(result.scoreA, result.scoreB), Math.ceil(bestOf / 2));
    assert.equal(result.sets.length, result.scoreA + result.scoreB);
    assert(result.sets.length <= bestOf);
    assert.equal(result.winner, result.scoreA > result.scoreB ? 'A' : 'B');
  }
  assert.throws(() => simulateSeries({ bestOf: 2 }), /bestOf/);
});

test('fearless draft never reuses a champion in later sets and reports substitute picks', () => {
  const result = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 5, seed: 'fearless' });
  const used = new Set();
  for (const set of result.sets) {
    const banned = new Set([...set.draft.bansA, ...set.draft.bansB]);
    for (const pick of [...set.draft.picksA, ...set.draft.picksB]) {
      assert.equal(typeof pick.champion, 'string');
      assert(!used.has(pick.champion), `${pick.champion} reused`);
      assert(!banned.has(pick.champion), `${pick.champion} was banned`);
      used.add(pick.champion);
    }
    assert(set.draft.notes.length > 0);
  }
});

test('ability and condition affect victories across identical seeds', () => {
  let strongWins = 0, weakWins = 0, freshWins = 0, tiredWins = 0;
  for (let i = 0; i < 80; i++) {
    const seed = `strength-${i}`;
    if (simulateSeries({ teamA: team('A', 90), teamB: team('B', 45), bestOf: 1, seed }).winner === 'A') strongWins++;
    if (simulateSeries({ teamA: team('A', 45), teamB: team('B', 90), bestOf: 1, seed }).winner === 'A') weakWins++;
    if (simulateSeries({ teamA: team('A', 70), teamB: team('B', 70), bestOf: 1, seed }).winner === 'A') freshWins++;
    if (simulateSeries({ teamA: team('A', 70, { condition: 20, fatigue: 90, stress: 90 }), teamB: team('B', 70), bestOf: 1, seed }).winner === 'A') tiredWins++;
  }
  assert(strongWins > 65, `strong team wins ${strongWins}/80`);
  assert(weakWins < 15, `weak team wins ${weakWins}/80`);
  assert(freshWins > tiredWins + 15, `fresh ${freshWins}, tired ${tiredWins}`);
});

test('ganks, trades and community comments reference recorded participants', () => {
  let trades = 0;
  for (let i = 0; i < 12; i++) {
    const result = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 1, seed: `trade-${i}` });
    const set = result.sets[0];
    const first = set.events.find(e => e.type === 'first_blood');
    assert(first.text.includes(first.kills[0].killer));
    assert(first.text.includes(first.kills[0].victim));
    for (const event of set.events.filter(e => e.type === 'trade_kill')) {
      trades++;
      assert.equal(event.kills[0].victim, first.kills[0].killer);
      assert(event.text.includes('러브샷'));
    }
    assert(set.events.some(e => e.type === 'objective'));
    assert(set.events.some(e => e.type === 'gank'));
    assert(set.events.some(e => e.type === 'teamfight'), 'ordinary teamfights must precede the final fight');
  }
  assert(trades > 0);
});

test('the accumulated events allow different game lengths', () => {
  const durations = new Set();
  for (let i = 0; i < 30; i++) durations.add(simulateSeries({ teamA: team('A', 90), teamB: team('B', i % 2 ? 45 : 88), bestOf: 1, seed: `duration-${i}` }).sets[0].duration.slice(0, 2));
  assert(durations.size >= 2, `Only one minute duration: ${[...durations]}`);
});

test('a third dragon is never incorrectly narrated as dragon soul', () => {
  for (let i = 0; i < 30; i++) {
    const set = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 1, seed: `soul-${i}` }).sets[0];
    const dragons = { A: 0, B: 0 };
    for (const event of set.events.filter(e => e.type === 'objective')) {
      if (event.objective === '드래곤' || event.objective === '용 영혼') dragons[event.team]++;
      if (event.objective === '용 영혼') assert.equal(dragons[event.team], 4);
      else assert(!event.text.includes('용 영혼'));
    }
  }
});
