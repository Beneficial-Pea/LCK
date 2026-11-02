import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason,getRoster,seasonShared} from '../lib/season.mjs';
import {applyTeamNpcPreset} from '../lib/balance.mjs';
import {completeCupDraft} from '../lib/cup-draft.mjs';
import {scrimSchedule,playScrim} from '../lib/scrims.mjs';
const stats=Object.fromEntries(['mechanics','laning','macro','communication','mental','mastery'].map(k=>[k,65]));
const make=(year=2026)=>({players:[{userId:'u',duoId:null,character:{id:'human',nickname:'Human',team:'T1',position:'MID',stats:{...stats},condition:85,fatigue:10,stress:10}}],season:createSeason({team:'T1',year,seed:'npc-training',npcPower:65}),submissions:{}});
const byId=room=>Object.fromEntries(getRoster(room).map(p=>[p.id,p]));
test('selected and temporary NPC duo partners gain only their own stats and survive serialization',()=>{
 for(const target of ['NPC:TOP',null]){const room=make(),before=byId(room);room.players[0].duoId=target;
  const summary=seasonShared.applyAction(room,room.players[0],{action:'duo'},false),after=byId(JSON.parse(JSON.stringify(room))),changed=Object.values(after).filter(p=>p.npc&&p.stats.communication!==before[p.id].stats.communication);
  assert.equal(changed.length,1);const npc=changed[0];assert.equal(npc.position,'TOP');assert.equal(npc.stats.communication,before[npc.id].stats.communication+.7);assert.equal(npc.stats.mastery,before[npc.id].stats.mastery+.4);assert.equal(npc.stats.mechanics,before[npc.id].stats.mechanics);assert.equal(summary.npcGrowth.length,1);assert(summary.text.includes('NPC 동반 성장'));assert.equal(room.players[0].duoId,target);
 }
});
test('team training grows all actual NPCs once per shared session and never applies NPC growth to humans',()=>{
 const room=make(2025),before=byId(room);const npcId=getRoster(room).find(p=>p.position==='TOP').id;
 seasonShared.applyAction(room,room.players[0],{action:'team'},false);let after=byId(room);
 for(const p of Object.values(after).filter(p=>p.npc)){assert.equal(p.stats.communication,before[p.id].stats.communication+.6);assert.equal(p.stats.macro,before[p.id].stats.macro+.4);assert.equal(p.stats.mechanics,before[p.id].stats.mechanics+.2);}
 const snapshot=structuredClone(room.season.npcTraining);seasonShared.applyAction(room,room.players[0],{action:'team'},false);assert.deepEqual(room.season.npcTraining,snapshot);
 room.players.push({userId:'top',character:{id:'new-top',nickname:'TopHuman',position:'TOP',stats:{...stats}}});after=byId(room);assert(!after[npcId]);assert.deepEqual(after['new-top'].stats,stats);
 room.players.pop();assert.equal(byId(room)[npcId].stats.communication,before[npcId].stats.communication+.6);
 room.season.turn++;seasonShared.applyAction(room,room.players[0],{action:'team'},false);assert.equal(byId(room)[npcId].stats.communication,before[npcId].stats.communication+1.2);
});
test('team preset recalibration retains NPC growth without changing human stats or exceeding caps',()=>{
 const room=make(),human=structuredClone(room.players),before=byId(room);seasonShared.applyAction(room,room.players[0],{action:'team'},false);
 const grown=structuredClone(room.season.npcTraining);applyTeamNpcPreset(room);const power=room.season.npcPower,after=byId(room);
 assert.deepEqual(room.season.npcTraining,grown);assert.equal(after['npc:T1:TOP'].stats.macro,before['npc:T1:TOP'].stats.macro+(power-65)+.4);
 room.season.npcPower=99;room.season.turn++;for(let i=0;i<8;i++){seasonShared.applyAction(room,room.players[0],{action:'team'},false);room.season.turn++;}assert(getRoster(room).every(p=>Object.values(p.stats).every(v=>v<=99)));assert.deepEqual(human[0].character.stats,stats);
});
test('detailed scrim grows all four NPCs once and preserves trained stats across a later team preset',()=>{
 const room=make();completeCupDraft(room.season);const event=scrimSchedule(room)[0];room.season.date=event.date;const before=byId(room);
 const record=playScrim(room,event.id,'side',seasonShared.teamProfile);assert.equal(record.npcGrowth.length,4);const after=byId(room);for(const npc of Object.values(after).filter(p=>p.npc)){assert.equal(npc.stats.macro,before[npc.id].stats.macro+.3);assert.equal(npc.stats.mastery,before[npc.id].stats.mastery+.2);}
 assert.throws(()=>playScrim(room,event.id,'side',seasonShared.teamProfile));const saved=structuredClone(room.season.npcTraining);applyTeamNpcPreset(room);assert.deepEqual(room.season.npcTraining,saved);
});
test('legacy replay policy suppresses new growth only for that saved turn; roster reads and solo actions never train NPCs',()=>{
 const room=make(),before=JSON.stringify(room);getRoster(room);getRoster(room);assert.equal(JSON.stringify(room),before);
 seasonShared.applyAction(room,room.players[0],{action:'mechanics'},false);assert(!room.season.npcTraining);
 room.season.npcTrainingVersions={[room.season.turn]:0};seasonShared.applyAction(room,room.players[0],{action:'team'},false);assert(!room.season.npcTraining);
 room.season.turn++;seasonShared.applyAction(room,room.players[0],{action:'team'},false);assert.equal(Object.keys(room.season.npcTraining).length,4);
});

test('a saved pre-update team-training intermission resumes without adding NPC gains to already played sets',async()=>{
 const {settleDay}=await import('../lib/season.mjs'),{beginLiveMatch,advanceLiveMatch,getLiveBroadcast,resumeLiveMatch}=await import('../lib/live-match.mjs');
 const room=make(2025);room.hostId='u';room.revision=1;const s=room.season;
 const match={id:'legacy-npc-series',date:s.date,stage:'LCK Cup',round:'그룹',teamA:'T1',teamB:'BRO',bestOf:3,status:'scheduled'};s.schedule.push(match);room.submissions.u={turn:s.turn,action:'team'};
 // Build exactly the old behavior, then omit its previously nonexistent marker.
 const pending=structuredClone(room);pending.season.npcTrainingVersions={[s.turn]:0};const summary=settleDay(pending);delete pending.season.npcTrainingVersions;
 assert(beginLiveMatch(room,pending,summary,{now:1000,stepMs:1,interactive:true}));advanceLiveMatch(room,100000);const broadcast=getLiveBroadcast(room);assert(broadcast.intermission);
 const old=structuredClone(room.liveMatch.pendingRoom.season.results.find(m=>m.id===match.id).result.sets[0]);resumeLiveMatch(room,{...broadcast.intermission,strategy:'early'},r=>settleDay(r),{now:100000});
 assert.deepEqual(room.liveMatch.pendingRoom.season.results.find(m=>m.id===match.id).result.sets[0],old);assert(!room.liveMatch.pendingRoom.season.npcTraining);
});
