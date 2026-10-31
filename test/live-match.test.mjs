import test from 'node:test';
import assert from 'node:assert/strict';
import { beginLiveMatch, getLiveBroadcast, advanceLiveMatch } from '../lib/live-match.mjs';

const stat = value => ({ mechanics: value, laning: value, macro: value, communication: value, mental: value, mastery: value });
const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
function set(number, a = 'A', b = 'B') {
  const scoreboard = [a, b].flatMap(team => positions.map((position, i) => ({
    team, nickname: `${team}-${position}`, position, champion: `${team}-챔피언${i}`, k: team === a && i === 2 ? 99 : 0, d: 77, a: 88,
    avatarSource: 'PRIVATE-SCOREBOARD-SOURCE', privateMemo: 'PRIVATE-SCOREBOARD-MEMO',
  })));
  const draft = {
    picksA: scoreboard.filter(row => row.team === a).map(({ nickname, position, champion }) => ({ nickname, position, champion })),
    picksB: scoreboard.filter(row => row.team === b).map(({ nickname, position, champion }) => ({ nickname, position, champion })),
    bansA: ['밴A'], bansB: ['밴B'], notes: ['간소화 피어리스'],
  };
  return {
    number, winner: a, duration: '99:59', killsA: 99, killsB: 77, mvp: 'PRIVATE-FUTURE-MVP', scoreboard, draft,
    events: [
      { id: `set${number}-draft`, time: '00:00', type: 'draft', text: `${number}세트 밴픽`, score: [0, 0], gold: [2500, 2500], reactions: ['밴픽 보자'] },
      { id: `set${number}-kill`, time: '03:21', type: 'first_blood', text: `${a}-MID가 미드 강가에서 ${b}-MID를 잡았다.`, team: a, score: [1, 0], gold: [3500, 3000],
        kills: [{ killer: `${a}-MID`, victim: `${b}-MID`, killerTeam: a, victimTeam: b, assists: [`${a}-JGL`] }], reactions: ['퍼블'] },
      { id: `set${number}-nexus`, time: '31:09', type: 'nexus', text: `${a}의 넥서스 마무리`, team: a, score: [1, 0], gold: [60000, 50000], reactions: ['끝났다'] },
    ],
  };
}

function fixture({ multiple = false } = {}) {
  const player = userId => ({ userId, ownerName: userId, location: '연습실', duoId: null, character: {
    id: userId + '-player', nickname: userId, team: 'A', position: userId === 'u' ? 'MID' : 'JGL',
    stats: stat(65), condition: 85, fatigue: 10, stress: 10,
    avatar: 'old-final', avatarSource: 'old-private-source', avatarCrop: { x: .5, y: .5, zoom: 1 },
  } });
  const room = { id: 'room', hostId: 'u', revision: 5, players: [player('u'), player('friend')],
    submissions: { u: { turn: 3, action: 'rest' }, friend: { turn: 3, action: 'rest' } },
    season: { team: 'A', date: '2026-01-14', turn: 3, finished: false, standings: [{ team: 'A', wins: 0 }], results: [], history: [], schedule: [] },
  };
  const games = [{ id: 'game-one', date: room.season.date, stage: 'LCK Cup', round: '그룹', teamA: 'A', teamB: 'B', bestOf: 3, status: 'completed',
    result: { winner: 'A', scoreA: 2, scoreB: 0, recap: ['PRIVATE-FUTURE-RECAP'], sets: [set(1), set(2)] } }];
  if (multiple) games.push({ ...structuredClone(games[0]), id: 'game-two', teamB: 'C', bestOf: 1, result: { winner: 'A', scoreA: 1, scoreB: 0, sets: [set(1, 'A', 'C')] } });
  room.season.schedule = games.map(({ result, ...match }) => ({ ...match, status: 'scheduled' }));
  const pending = structuredClone(room);
  pending.season.date = '2026-01-15'; pending.season.turn = 4;
  pending.season.standings[0].wins = games.length;
  pending.season.history.push({ text: 'PRIVATE-FUTURE-RESULT' });
  pending.season.results = games;
  pending.season.schedule = games;
  pending.submissions = {};
  for (const p of pending.players) { p.character.stats = stat(75);p.character.condition = 90;p.character.fatigue = 4;p.character.stress = 5; }
  const summary = { date: room.season.date, turn: 3, matches: games.map(game => game.id), nextDate: pending.season.date, finished: false };
  return { room, pending, summary, games };
}

test('live projections expose only the current draft and never the stored future result', () => {
  const { room, pending, summary } = fixture();
  const before = structuredClone(room.season);
  assert.equal(beginLiveMatch(room, pending, summary, { now: 1000, stepMs: 100 }), true);
  assert.deepEqual(room.season, before, 'the actual season is not settled ahead of the broadcast');
  const live = getLiveBroadcast(room);
  assert.equal(live.status, 'live'); assert.equal(live.matchId, 'game-one');
  assert.equal(live.sets.length, 1);assert.equal(live.sets[0].events.length, 1);
  assert.deepEqual(live.sets[0].draft.picksA, pending.season.results[0].result.sets[0].draft.picksA);
  assert.equal(live.scoreA, 0);assert.equal(live.scoreB, 0);assert.equal(live.activeSet, 1);
  assert.equal(live.sets[0].completed, false); assert.equal(live.sets[0].duration, '00:00');
  const json = JSON.stringify(live);
  for (const secret of ['PRIVATE-', 'pendingRoom', '99:59', 'recap', 'totalFrames', 'endTime']) assert(!json.includes(secret), secret);
  assert(!Object.hasOwn(live, 'winner'));assert(!Object.hasOwn(live.sets[0], 'winner'));
  assert(live.sets[0].scoreboard.every(row => row.k === 0 && row.d === 0 && row.a === 0));
});

test('current KDA, scores and set winners are derived only from revealed kill and nexus frames', () => {
  const { room, pending, summary } = fixture();beginLiveMatch(room, pending, summary, { now: 1000, stepMs: 100 });
  assert.equal(advanceLiveMatch(room, 1100).changed, true);
  let live = getLiveBroadcast(room), board = live.sets[0].scoreboard;
  assert.equal(live.sets[0].events.length, 2);assert.equal(live.sets[0].duration, '03:21');
  assert.equal(board.find(row => row.nickname === 'A-MID').k, 1);
  assert.equal(board.find(row => row.nickname === 'A-JGL').a, 1);
  assert.equal(board.find(row => row.nickname === 'B-MID').d, 1);
  assert.equal(live.scoreA, 0);assert.equal(live.sets.length, 1);
  advanceLiveMatch(room, 1200);live = getLiveBroadcast(room);
  assert.equal(live.scoreA, 1);assert.equal(live.scoreB, 0);assert.equal(live.sets[0].winner, 'A');
  assert.equal(live.sets[0].completed, true);assert.equal(live.sets.length, 1, 'next set is not revealed early');
  advanceLiveMatch(room, 1300);live = getLiveBroadcast(room);
  assert.equal(live.sets.length, 2);assert.equal(live.activeSet, 2);assert.equal(live.scoreA, 1);
  assert.equal(live.sets[1].events.length, 1);assert.equal(live.sets[1].duration, '00:00');
  assert(!Object.hasOwn(live.sets[1], 'winner'));assert(live.sets[1].scoreboard.every(row => row.k === 0 && row.d === 0 && row.a === 0));
});

test('elapsed progress survives persistence and neither duplicate polling nor a backwards clock rewinds it', () => {
  const { room, pending, summary } = fixture();beginLiveMatch(room, pending, summary, { now: 1000, stepMs: 100 });
  advanceLiveMatch(room, 1200);
  const restarted = JSON.parse(JSON.stringify(room));
  assert.deepEqual(getLiveBroadcast(restarted), getLiveBroadcast(room));
  const revision = restarted.revision;
  assert.equal(advanceLiveMatch(restarted, 1100).changed, false);
  assert.equal(restarted.revision, revision);assert.equal(getLiveBroadcast(restarted).scoreA, 1);
  assert.equal(advanceLiveMatch(restarted, 1200).changed, false);
  advanceLiveMatch(restarted, 1400);assert.equal(getLiveBroadcast(restarted).sets[1].events.length, 2);
});

test('POM stays private until the final nexus and awards commit with the pending season',()=>{
 const {room,pending,summary}=fixture();
 const pom={nickname:'AFTER-FINAL-NEXUS',team:'A',playerId:'u-player'};
 pending.season.results[0].result.pom=pom;pending.season.awards={ledger:{private:'FUTURE-AWARD'}};
 beginLiveMatch(room,pending,summary,{now:1000,stepMs:100});
 assert(!JSON.stringify(getLiveBroadcast(room)).includes('AFTER-FINAL-NEXUS'));assert(!room.season.awards);
 advanceLiveMatch(room,1400);assert(!getLiveBroadcast(room).pom);
 advanceLiveMatch(room,1500);assert.deepEqual(getLiveBroadcast(room).pom,pom);assert(!room.season.awards);
 advanceLiveMatch(room,1600);assert.deepEqual(room.season.awards,pending.season.awards);
});

test('the match commits exactly once after the final frame while retaining current membership and cosmetics', () => {
  const { room, pending, summary } = fixture();beginLiveMatch(room, pending, summary, { now: 1000, stepMs: 100 });
  room.players[0].character.avatar = 'new-final'; room.players[0].character.avatarSource = 'new-private-source';
  room.players[0].character.avatarCrop = { x: .2, y: .8, zoom: 3 };
  room.players[0].location = '카페';room.players[0].scenePosition = { x: 80, y: 70, location: '카페' };room.players[0].duoId = 'NPC:TOP';
  room.players = room.players.filter(p => p.userId === 'u');room.hostId = 'u';room.revision += 4;
  const currentRevision = room.revision;
  advanceLiveMatch(room, 1500);
  assert.equal(room.season.date, '2026-01-14');assert(getLiveBroadcast(room));
  assert.equal(getLiveBroadcast(room).scoreA, 2, 'final nexus has a short visible hold before the day commits');
  const result = advanceLiveMatch(room, 1600);
  assert.equal(result.completed, true);assert.equal(room.season.date, '2026-01-15');assert.equal(room.season.turn, 4);
  assert.equal(room.season.results.length, 1);assert.equal(room.season.standings[0].wins, 1);
  assert.deepEqual(room.submissions, {});assert.equal(room.players.length, 1);
  assert.deepEqual(room.players[0].character.stats, stat(75));assert.equal(room.players[0].character.condition, 90);
  assert.equal(room.players[0].character.avatar, 'new-final');assert.equal(room.players[0].character.avatarSource, 'new-private-source');
  assert.deepEqual(room.players[0].character.avatarCrop, { x: .2, y: .8, zoom: 3 });
  assert.equal(room.players[0].location, '카페');assert.equal(room.players[0].duoId, 'NPC:TOP');
  assert.deepEqual(room.players[0].scenePosition, { x: 80, y: 70, location: '카페' });
  assert.equal(room.revision, currentRevision + 2);
  assert.deepEqual(room.lastBroadcast.matchIds, ['game-one']);assert.equal(room.lastBroadcast.date, '2026-01-14');
  assert.equal(getLiveBroadcast(room), null);
  const after = structuredClone(room);
  assert.equal(advanceLiveMatch(room, 9000).changed, false);assert.deepEqual(room, after);
});

test('multiple same-day own matches reveal one current series at a time and commit together', () => {
  const { room, pending, summary } = fixture({ multiple: true });beginLiveMatch(room, pending, summary, { now: 1000, stepMs: 100 });
  assert.equal(getLiveBroadcast(room).matchId, 'game-one');
  advanceLiveMatch(room, 1600);const live = getLiveBroadcast(room);
  assert.equal(live.matchId, 'game-two');assert.equal(live.teamB, 'C');assert.equal(live.scoreA, 0);assert.equal(live.sets.length, 1);
  assert(!JSON.stringify(live).includes('PRIVATE-'));
  assert.equal(room.season.turn, 3);
  assert.equal(advanceLiveMatch(room, 1900).completed, true);
  assert.equal(room.season.turn, 4);assert.equal(room.season.results.length, 2);assert.deepEqual(room.lastBroadcast.matchIds, ['game-one', 'game-two']);
});

test('days without an actual own-team result do not create a fake live series', () => {
  const { room, pending, summary } = fixture();room.season.team = 'D';
  assert.equal(beginLiveMatch(room, pending, summary, { now: 1000, stepMs: 100 }), false);
  assert.equal(getLiveBroadcast(room), null);assert.equal(room.season.turn, 3);
});
