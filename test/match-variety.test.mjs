import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateSeries } from '../lib/match.mjs';

const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const keys = ['mechanics', 'laning', 'macro', 'communication', 'mental', 'mastery'];
const team = (name, power = 65, human = null) => ({ name, style: '균형 운영', players: positions.map(position => ({
  nickname: `${name}-${position}`, position,
  stats: Object.fromEntries(keys.map(key => [key, human !== null && position === 'MID' ? human : power])),
  condition: 85, fatigue: 10, stress: 10,
})) });
const seconds = event => event.time.split(':').reduce((sum, n) => sum * 60 + Number(n), 0);

test('many seeds produce different tactical paths and event counts rather than the same fixed scene list', () => {
  const paths = new Set(), counts = new Set(), types = new Set(), comments = new Set();
  for (let i = 0; i < 100; i++) {
    const set = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 1, seed: `variety-${i}` }).sets[0];
    paths.add(set.events.map(e => `${e.type}:${e.subtype || ''}`).join(','));
    counts.add(set.events.length);
    for (const event of set.events) { types.add(event.subtype || event.type);for (const comment of event.reactions) comments.add(comment); }
  }
  assert(paths.size > 90, `Only ${paths.size}/100 tactical paths differ`);
  assert(counts.size >= 6, `Only ${counts.size} event counts`);
  for (const type of ['solo_kill', 'invade', 'bot_skirmish', 'counter_gank', 'vision_catch', 'outplay', 'tower_dive', 'objective_steal', 'baron_steal']) assert(types.has(type), `${type} was never simulated`);
  assert(comments.size > 500, `Only ${comments.size} different reactions across 100 games`);
  assert([...comments].some(c => /씨발|시발|ㅅㅂ|존나/.test(c)));
  assert([...comments].some(c => /노/.test(c)));
});

test('objectives respect spawn and respawn time and a soul requires four recorded dragons', () => {
  for (let i = 0; i < 100; i++) {
    const set = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 1, seed: `timing-${i}` }).sets[0];
    const dragons = { A: 0, B: 0 };let lastDragon = null, lastBaron = null, soul = false;
    for (const event of set.events) {
      if (['드래곤', '용 영혼', '장로 드래곤'].includes(event.objective)) {
        const stamp = seconds(event);assert(stamp >= 300);
        if (lastDragon !== null) assert(stamp - lastDragon >= (soul ? 360 : 300), `${event.objective} respawned too soon`);
        lastDragon = stamp;
        if (event.objective !== '장로 드래곤') dragons[event.team]++;
        if (event.objective === '용 영혼') { assert.equal(dragons[event.team], 4);soul = true; }
        if (event.objective === '장로 드래곤') assert(soul, 'Elder appeared before any team earned a soul');
      }
      if (event.type === 'baron') {
        assert(seconds(event) >= 1200);
        if (lastBaron !== null) assert(seconds(event) - lastBaron >= 360);
        lastBaron = seconds(event);
      }
      if (event.objective === '전령') assert(seconds(event) >= 960);
    }
    const first = set.events.find(e => e.type === 'first_blood');
    assert(seconds(first) >= 180 && seconds(first) < 420);
    assert.equal(set.events.find(e => e.kills?.length), first);
  }
});

test('shared-series reactions do not repeat exact text and only mention observed streaks', () => {
  for (let i = 0; i < 12; i++) {
    const result = simulateSeries({ teamA: team('A'), teamB: team('B'), bestOf: 5, seed: `community-series-${i}` });
    const all = result.sets.flatMap(set => set.events.flatMap(e => e.reactions));
    assert.equal(new Set(all).size, all.length);
    for (const set of result.sets) {
      const deaths = new Map(set.scoreboard.map(player => [player.nickname, 0]));
      for (const event of set.events) {
        for (const kill of event.kills || []) deaths.set(kill.victim, deaths.get(kill.victim) + 1);
        for (const comment of event.reactions.filter(c => c.includes('또 죽네'))) {
          const victim = [...deaths.keys()].find(name => comment.startsWith(name));
          assert(victim && deaths.get(victim) >= 2);
        }
        assert(!event.reactions.some(c => /주사위|내부 스탯|점멸 안|궁 왜 안/.test(c)));
      }
    }
  }
});

test('equal teams have no fixed losing side and weaker teams can still win without forced outcomes', () => {
  let equalWins = 0, underdogWins = 0, favoriteWins = 0;
  for (let i = 0; i < 300; i++) {
    const seed = `balance-${i}`;
    if (simulateSeries({ teamA: team('A', 65), teamB: team('B', 65), bestOf: 1, seed }).winner === 'A') equalWins++;
    if (simulateSeries({ teamA: team('A', 65), teamB: team('B', 80), bestOf: 1, seed }).winner === 'A') underdogWins++;
    if (simulateSeries({ teamA: team('A', 80), teamB: team('B', 65), bestOf: 1, seed }).winner === 'A') favoriteWins++;
  }
  assert(equalWins > 105 && equalWins < 195, `Equal-power A wins ${equalWins}/300`);
  assert(underdogWins > 0, 'The weaker team must not be hard-coded to lose');
  assert(favoriteWins > underdogWins + 100, `Power should matter: favorite ${favoriteWins}, underdog ${underdogWins}`);
});
