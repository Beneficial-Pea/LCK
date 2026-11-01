import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason,settleDay,seasonShared} from '../lib/season.mjs';
import {beginLiveMatch,advanceLiveMatch,getLiveBroadcast,resumeLiveMatch} from '../lib/live-match.mjs';
import {scrimSchedule,todayScrim,playScrim} from '../lib/scrims.mjs';
import {completeCupDraft} from '../lib/cup-draft.mjs';
import {simulateSeries} from '../lib/match.mjs';
const make=(seed='training')=>({hostId:'u',revision:1,players:[{userId:'u',character:{id:'char',nickname:'Test',team:'T1',position:'MID',mainChampion:'아리',pool:['아리','아지르','오리아나'],style:'균형 운영',stats:{mechanics:75,laning:75,macro:75,communication:75,mental:75,mastery:75},condition:90,fatigue:10,stress:10}}],submissions:{},season:createSeason({year:2026,team:'T1',seed})});
function ready(r){r.submissions.u={turn:r.season.turn,action:'rest'};}
test('interactive series pause at every set boundary and apply plans without rewriting revealed sets',()=>{
 const room=make();completeCupDraft(room.season);
 for(let i=0;i<15&&!room.season.schedule.some(m=>m.date===room.season.date&&m.status==='scheduled'&&[m.teamA,m.teamB].includes('T1'));i++){ready(room);settleDay(room);}
 ready(room);const date=room.season.date,turn=room.season.turn,pending=structuredClone(room),summary=settleDay(pending);assert(beginLiveMatch(room,pending,summary,{now:1000,stepMs:1,interactive:true}));
 advanceLiveMatch(room,100000);let b=getLiveBroadcast(room);assert(b.intermission);assert.equal(b.sets.length,1);assert.equal(b.sets[0].completed,true);assert.equal(room.season.turn,turn);assert(!JSON.stringify(b).includes('pendingRoom'));assert(!b.pom);
 assert.equal(advanceLiveMatch(room,200000).changed,false);
 const storedSet=room.liveMatch.pendingRoom.season.results.find(m=>m.id===b.matchId).result.sets[0];storedSet.events[0].text='배포 이전에 기록된 상황';storedSet.events[0].casting='배포 이전의 해설';storedSet.events[0].reactions=['배포 이전에 공개된 댓글'];
 const old=structuredClone(room.liveMatch.pendingRoom.season.results.find(m=>m.id===b.matchId).result.sets[0]);
 assert.throws(()=>resumeLiveMatch(room,{matchId:b.matchId,nextSet:99,strategy:'early'},r=>settleDay(r)),e=>e.status===409);
 assert.throws(()=>resumeLiveMatch(room,{...b.intermission,strategy:'invalid'},r=>settleDay(r)),e=>e.status===400);
 const corrupted=structuredClone(room);corrupted.liveMatch.pendingRoom.season.results.find(m=>m.id===b.matchId).result.sets[0].killsA++;assert.throws(()=>resumeLiveMatch(corrupted,{...b.intermission,strategy:'early'},r=>settleDay(r)),/공개된 세트/);
 resumeLiveMatch(room,{...b.intermission,strategy:'early'},r=>settleDay(r),{now:200000});
 let game=room.liveMatch.pendingRoom.season.results.find(m=>m.id===b.matchId);assert.deepEqual(game.result.sets[0],old);assert.equal(game.result.sets[1].strategy[game.teamA==='T1'?'teamA':'teamB'],'초반 주도권');
 let attempts=0;while(room.liveMatch&&attempts++<6){advanceLiveMatch(room,300000+attempts*100000);b=getLiveBroadcast(room);if(b?.intermission)resumeLiveMatch(room,{...b.intermission,strategy:'teamfight'},r=>settleDay(r),{now:300000+attempts*100000});}
 assert(!room.liveMatch);assert.equal(room.season.turn,turn+1);assert.equal(room.lastBroadcast.date,date);assert.equal(room.season.results.filter(m=>m.id===game.id).length,1);assert(!room.season.interviews);assert(room.season.results.find(m=>m.id===game.id).result.pom);
});
test('strategy affects later combat while keeping the first set identical and preserving fearless draft rules',()=>{
 let changed=false;for(let i=0;i<8;i++){
  const input={teamA:{name:'A',power:70},teamB:{name:'B',power:70},bestOf:5,seed:'plan-'+i};
  const a=simulateSeries({...input,setStrategies:{2:{teamA:'초반 주도권'}}}),b=simulateSeries({...input,setStrategies:{2:{teamA:'한타'}}});assert.deepEqual(a.sets[0],b.sets[0]);
  if(JSON.stringify(a.sets[1].events)!==JSON.stringify(b.sets[1].events))changed=true;
  const spent=new Set();for(const set of a.sets){for(const p of [...set.draft.picksA,...set.draft.picksB]){assert(!spent.has(p.champion));spent.add(p.champion);}assert.equal(set.draft.bansA.length,5);assert.equal(set.draft.bansB.length,5);}
 }assert(changed);
});
test('scrims produce private set records and growth without changing official tables or awards',()=>{
 const room=make();completeCupDraft(room.season);const event=scrimSchedule(room)[0];assert(event);room.season.date=event.date;const before=structuredClone(room.season.standings),results=room.season.results.length,macro=room.players[0].character.stats.macro;
 assert.equal(todayScrim(room).id,event.id);const record=playScrim(room,event.id,'side',seasonShared.teamProfile);assert.equal(record.status,'completed');assert(record.sets.length>=2);assert.equal(room.players[0].character.stats.macro,macro+.3);assert.equal(room.season.results.length,results);assert.deepEqual(room.season.standings,before);assert(!todayScrim(room));assert.throws(()=>playScrim(room,event.id,'side',seasonShared.teamProfile),e=>e.status===409);assert.equal(scrimSchedule(structuredClone(room)).find(e=>e.id===event.id).status,'completed');
});
test('match and scrim days settle without generic preparation actions or hidden training benefits',()=>{
 const room=make('dedicated-days');completeCupDraft(room.season);
 const practice=scrimSchedule(room)[0];room.season.date=practice.date;playScrim(room,practice.id,'side',seasonShared.teamProfile);const before=room.players[0].character.stats.mechanics;room.submissions={u:{turn:room.season.turn,action:'mechanics'}};
 let summary=settleDay(room);assert.deepEqual(summary.actions,[]);assert.equal(room.players[0].character.stats.mechanics,before);
 const game=room.season.schedule.find(m=>m.status==='scheduled'&&[m.teamA,m.teamB].includes('T1'));room.season.date=game.date;room.submissions={};summary=settleDay(room);assert(summary.matches.includes(game.id));assert.deepEqual(summary.actions,[]);assert.equal(room.players[0].character.stats.mechanics,before);
});

test('saved international strategy breaks survive alias updates after three revealed sets without rewriting history',()=>{
 let room,summary,pending;
 for(let i=0;i<20;i++){
  const candidate=make('saved-overseas-'+i);completeCupDraft(candidate.season);
  Object.assign(candidate.season.schedule.find(m=>m.id==='fst-final'),{date:candidate.season.date,teamA:'JDG',teamB:'T1',bestOf:5,status:'scheduled'});
  const next=structuredClone(candidate),settled=settleDay(next);
  if(next.season.results[0].result.sets.length>=4){room=candidate;pending=next;summary=settled;break;}
 }
 assert(room,'fixture reaches a fourth set');
 const game=pending.season.results[0],legacyRoles={TOP:'Top',JGL:'Jungle',MID:'Mid',ADC:'Carry',SUP:'Support'};
 for(const row of game.result.sets[0].scoreboard.filter(p=>p.team==='JDG')){
  const from=row.nickname,to=`JDG AsterJDG${legacyRoles[row.position]}`;
  pending=JSON.parse(JSON.stringify(pending).replaceAll(from,to));
 }
 beginLiveMatch(room,pending,summary,{now:1000,stepMs:1,interactive:true});
 const live=room.liveMatch;live.cursor=live.frames.findLastIndex(f=>f.setIndex===2);live.intermission={matchId:'fst-final',nextSet:4};live.handledBreaks=['fst-final:2','fst-final:3'];
 const revealed=structuredClone(pending.season.results[0].result.sets.slice(0,3));
 const broken=structuredClone(room);broken.liveMatch.pendingRoom.season.results[0].result.sets[1].scoreboard[0].k++;
 assert.throws(()=>resumeLiveMatch(broken,{matchId:'fst-final',nextSet:4,strategy:'balanced'},r=>settleDay(r)),/공개된 세트/);
 resumeLiveMatch(room,{matchId:'fst-final',nextSet:4,strategy:'balanced'},r=>settleDay(r),{now:2000});
 assert.deepEqual(room.liveMatch.pendingRoom.season.results[0].result.sets.slice(0,3),revealed);
 assert.equal(room.liveMatch.pendingRoom.season.results[0].result.sets[3].strategy.teamB,'균형 운영');
 assert(!room.liveMatch.intermission);assert.equal(getLiveBroadcast(room).activeSet,4);
});
