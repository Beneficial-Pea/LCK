import { randomUUID } from 'node:crypto';

const gameplayFields = ['stats', 'condition', 'fatigue', 'stress'];
const copy = value => structuredClone(value);

function gameFor(live, id) {
  return live.pendingRoom.season.results.find(game => game.id === id);
}

// The completed simulation is kept server-side while its observed events are
// released by the shared clock. No pending season state is a public response.
export function beginLiveMatch(room, pendingRoom, summary, { now = Date.now(), stepMs = 1400 } = {}) {
  if (room.liveMatch) throw new Error('이미 중계 중인 경기입니다.');
  const ids = new Set(summary.matches || []);
  const games = pendingRoom.season.results.filter(game => ids.has(game.id) &&
    [game.teamA, game.teamB].includes(room.season.team) && game.result?.sets?.some(set => set.events?.length));
  if (!games.length) return false;
  const frames = [];
  for (const game of games) for (const [setIndex, set] of game.result.sets.entries()) {
    for (let eventIndex = 0; eventIndex < (set.events || []).length; eventIndex++) frames.push({ matchId: game.id, setIndex, eventIndex });
  }
  if (!frames.length) return false;
  room.liveMatch = {
    id: randomUUID(), startedAt: now, stepMs: Math.max(1, Number(stepMs) || 1400), cursor: 0,
    gameIds: games.map(game => game.id), frames, pendingRoom, summary: copy(summary),
  };
  return true;
}

function visibleScoreboard(set, events) {
  const rows = (set.scoreboard || []).map(row => ({ nickname: row.nickname, position: row.position,
    team: row.team, champion: row.champion, k: 0, d: 0, a: 0 }));
  for (const event of events) for (const kill of event.kills || []) {
    const killer = rows.find(row => row.nickname === kill.killer && (!kill.killerTeam || row.team === kill.killerTeam));
    const victim = rows.find(row => row.nickname === kill.victim && (!kill.victimTeam || row.team === kill.victimTeam));
    if (killer) killer.k++;
    if (victim) victim.d++;
    for (const nickname of kill.assists || []) {
      const assist = rows.find(row => row.nickname === nickname && (!kill.killerTeam || row.team === kill.killerTeam));
      if (assist) assist.a++;
    }
  }
  return rows;
}

export function getLiveBroadcast(room) {
  const live = room.liveMatch;
  if (!live) return null;
  const frame = live.frames[Math.min(live.cursor, live.frames.length - 1)];
  const game = gameFor(live, frame.matchId);
  const sets = [];
  let scoreA = 0, scoreB = 0;
  for (let i = 0; i <= frame.setIndex; i++) {
    const source = game.result.sets[i];
    const count = i < frame.setIndex ? source.events.length : frame.eventIndex + 1;
    const events = copy(source.events.slice(0, count));
    const last = events.at(-1);
    const completed = count === source.events.length;
    const scoreboard = visibleScoreboard(source, events);
    const set = {
      number: source.number, events, draft: copy(source.draft), scoreboard, completed,
      killsA: scoreboard.filter(row => row.team === game.teamA).reduce((sum, row) => sum + row.k, 0),
      killsB: scoreboard.filter(row => row.team === game.teamB).reduce((sum, row) => sum + row.k, 0),
      duration: last?.time || '00:00',
    };
    if (completed) {
      set.winner = source.winner;
      if (source.winner === game.teamA) scoreA++; else scoreB++;
    }
    sets.push(set);
  }
  return {
    id: live.id, status: 'live', matchId: game.id, teamA: game.teamA, teamB: game.teamB,
    stage: game.stage, round: game.round, bestOf: game.bestOf ?? game.result.bestOf, date: game.date,
    sets, scoreA, scoreB, activeSet: game.result.sets[frame.setIndex].number,
    currentEventIndex: frame.eventIndex + 1, pace: 'compressed',
  };
}

// Called synchronously while reading/mutating a room, before checking its ETag.
// The running server is a single instance, and all SQLite writes are synchronous.
export function advanceLiveMatch(room, now = Date.now()) {
  const live = room.liveMatch;
  if (!live) return { changed: false, completed: false };
  const cursor = Math.max(live.cursor, Math.floor(Math.max(0, now - live.startedAt) / live.stepMs));
  if (cursor >= live.frames.length) {
    const pending = live.pendingRoom;
    const players = new Map(pending.players.map(player => [player.userId, player]));
    for (const current of room.players) {
      const resolved = players.get(current.userId);
      if (!resolved) continue;
      for (const field of gameplayFields) current.character[field] = copy(resolved.character[field]);
    }
    room.season = pending.season;
    room.submissions = pending.submissions;
    room.lastBroadcast = { id: live.id, matchIds: [...live.gameIds], date: live.summary.date, completedAt: now };
    delete room.liveMatch;
    room.revision = (room.revision || 0) + 1;
    return { changed: true, completed: true, date: live.summary.date, summary: live.summary };
  }
  if (cursor === live.cursor) return { changed: false, completed: false };
  live.cursor = cursor;
  room.revision = (room.revision || 0) + 1;
  return { changed: true, completed: false };
}
