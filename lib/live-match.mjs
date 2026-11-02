import {MATCH_STRATEGIES,strategyFor} from './match-strategies.mjs';
import { randomUUID } from 'node:crypto';

const gameplayFields = ['stats', 'condition', 'fatigue', 'stress'];
const copy = value => structuredClone(value);
// Presentation banks may change during a deployment. Verify revealed gameplay,
// then keep its original text instead of blocking a saved intermission on prose.
function observedMechanics(set){
 // Names and draft notes are presentation. Compare each actor by the stable
 // player identity so a nickname deployment cannot invalidate a saved pause.
 const actors=new Map((set.scoreboard||[]).map(p=>[p.nickname,`${p.team}:${p.playerId||p.position}`]));
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,canonical(v)])):typeof value==='string'?actors.get(value)||value:value;
 const {notes,rule,...draft}=set.draft||{};
 return canonical({number:set.number,winner:set.winner,duration:set.duration,killsA:set.killsA,killsB:set.killsB,draft,scoreboard:set.scoreboard,goldA:set.goldA,goldB:set.goldB,objectives:set.objectives,events:(set.events||[]).map(e=>({id:e.id,time:e.time,type:e.type,team:e.team,score:e.score,gold:e.gold,kills:e.kills,objective:e.objective,steal:e.steal,dragonCount:e.dragonCount}))});
}


function gameFor(live, id) {
  return live.pendingRoom.season.results.find(game => game.id === id);
}

// The completed simulation is kept server-side while its observed events are
// released by the shared clock. No pending season state is a public response.
export function beginLiveMatch(room, pendingRoom, summary, { now = Date.now(), stepMs = 1400, interactive = false } = {}) {
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
    id: randomUUID(), interactive, ...(interactive?{baseRoom:copy(room),handledBreaks:[]}:{}), startedAt: now, stepMs: Math.max(1, Number(stepMs) || 1400), cursor: 0,
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
      ...(last?.objectives?{objectives:copy(last.objectives)}:{}),
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
    ...(Math.max(scoreA,scoreB)>=Math.ceil((game.bestOf??game.result.bestOf)/2)?{pom:copy(game.result.pom)}:{}),
    ...(live.intermission?{intermission:{matchId:live.intermission.matchId,nextSet:live.intermission.nextSet,choices:copy(MATCH_STRATEGIES)}}:{}),
    currentEventIndex: frame.eventIndex + 1, pace: 'compressed',
  };
}

// Called synchronously while reading/mutating a room, before checking its ETag.
// The running server is a single instance, and all SQLite writes are synchronous.
export function advanceLiveMatch(room, now = Date.now()) {
  const live = room.liveMatch;
  if (!live) return { changed: false, completed: false };
  if(live.intermission)return {changed:false,completed:false};
  let cursor = Math.max(live.cursor, Math.floor(Math.max(0, now - live.startedAt) / live.stepMs));
  if(live.interactive){
    const boundary=live.frames.findIndex((frame,i)=>i>=live.cursor&&i<=cursor&&live.frames[i+1]?.matchId===frame.matchId&&live.frames[i+1].setIndex===frame.setIndex+1&&!(live.handledBreaks||[]).includes(`${frame.matchId}:${frame.setIndex+2}`));
    if(boundary>=0){const frame=live.frames[boundary];live.cursor=boundary;live.intermission={matchId:frame.matchId,nextSet:frame.setIndex+2};room.revision=(room.revision||0)+1;return {changed:true,completed:false};}
  }
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

export function resumeLiveMatch(room,{matchId,nextSet,strategy},rebuild,{now=Date.now()}={}){
 const live=room.liveMatch,pause=live?.intermission;
 if(!pause||pause.matchId!==matchId||Number(nextSet)!==pause.nextSet)throw Object.assign(new Error('전략 선택 차례가 변경됐습니다. 현재 세트를 확인하세요.'),{status:409});
 const choice=strategyFor(strategy),base=copy(live.baseRoom),plans=(base.season.matchPlans??={}),game=gameFor(live,matchId);
 // Saved pauses keep the gameplay rules under which their sets were played.
 base.season.worldPatchPolicyVersions??={};
 base.season.worldPatchPolicyVersions[base.season.turn]=live.pendingRoom.season.worldPatchPolicyVersions?.[base.season.turn]??1;
 base.season.matchDraftVersions??={};
 for(const id of live.gameIds)base.season.matchDraftVersions[id]=gameFor(live,id).result.sets[0]?.draft?.assignment?.version===1?1:0;
 base.season.matchObjectiveVersions??={};
 for(const id of live.gameIds)base.season.matchObjectiveVersions[id]=gameFor(live,id).result.sets[0]?.objectiveVersion===1?1:0;
 plans[matchId]??={};plans[matchId][pause.nextSet]={[game.teamA===room.season.team?'teamA':'teamB']:choice.name};
 const pending=copy(base),summary=rebuild(pending),temporary=copy(base);beginLiveMatch(temporary,pending,summary,{now,stepMs:live.stepMs});const fresh=temporary.liveMatch;
 if(!fresh)throw new Error('다음 세트 중계를 만들지 못했습니다.');
 for(const id of live.gameIds){const oldGame=gameFor(live,id),newGame=pending.season.results.find(m=>m.id===id);const shown=live.frames.slice(0,live.cursor+1).filter(f=>f.matchId===id);if(!shown.length)continue;
  const lastIndex=shown.at(-1).setIndex;
  if(!newGame||JSON.stringify(oldGame.result.sets.slice(0,lastIndex+1).map(observedMechanics))!==JSON.stringify(newGame.result.sets.slice(0,lastIndex+1).map(observedMechanics)))throw new Error('이미 공개된 세트가 변경되어 전략 적용을 중단했습니다.');
  for(let i=0;i<=lastIndex;i++)newGame.result.sets[i]=copy(oldGame.result.sets[i]);
 }
 const seenComments=new Set(base.season.commentaryMemory||[]),shownFrames=live.frames.slice(0,live.cursor+1);
 const dayGames=pending.season.results.filter(m=>(summary.matches||[]).includes(m.id)&&[m.teamA,m.teamB].includes(base.season.team));
 for(const m of dayGames)for(const [i,set] of m.result.sets.entries())for(const event of set.events||[]){
  const revealed=shownFrames.some(f=>f.matchId===m.id&&f.setIndex===i);
  if(!revealed)event.reactions=(event.reactions||[]).filter(text=>{if(seenComments.has(text))return false;seenComments.add(text);return true;});
  else for(const text of event.reactions||[])seenComments.add(text);
 }
 pending.season.commentaryMemory=[...(base.season.commentaryMemory||[]),...dayGames.flatMap(m=>m.result.sets.flatMap(set=>set.events.flatMap(e=>e.reactions||[])))].slice(-600);
 live.baseRoom=base;live.pendingRoom=pending;live.summary=copy(summary);live.frames=fresh.frames;live.gameIds=fresh.gameIds;live.handledBreaks.push(`${matchId}:${pause.nextSet}`);delete live.intermission;
 live.cursor++;live.startedAt=now-live.cursor*live.stepMs;room.revision=(room.revision||0)+1;
 return {matchId,nextSet:pause.nextSet,strategy:choice.name};
}
