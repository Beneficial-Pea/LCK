import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePreparation,rememberPreparation } from '../lib/auto-preparation.mjs';
import { createSeason,ACTIONS,seasonShared } from '../lib/season.mjs';

function fixture(extra={}){
 const character={id:'planner',nickname:'Planner',position:'MID',team:'T1',stats:{mechanics:65,laning:65,macro:65,communication:65,mental:65,mastery:65},fatigue:10,condition:85,stress:10,...extra};
 const player={userId:'u',character,location:'연습실'};
 const room={season:createSeason({year:2026,team:'T1',seed:'planner'}),players:[player],submissions:{},revision:0};
 room.season.schedule=[];return {room,player,character};
}
test('weekly preparation re-evaluates actual daily state and varies useful training choices',()=>{
 const {room,player,character}=fixture(),before=structuredClone(character.stats),decisions=[];
 for(let i=0;i<7;i++){
  const decision=choosePreparation(room,player,ACTIONS);assert(ACTIONS.some(a=>a.id===decision.action));assert(decision.reason);
  decisions.push(decision);rememberPreparation(room.season,player,decision);
  seasonShared.applyAction(room,player,{action:decision.action,autoReason:decision.reason},false);
  room.season.date=seasonShared.addDays(room.season.date);room.season.turn++;
 }
 assert(new Set(decisions.map(d=>d.action)).size>=3);assert(character.fatigue<71);assert(character.condition>=60);
 assert(Object.keys(before).some(k=>character.stats[k]>before[k]));
 assert.equal(room.season.autoPreparation.length,7);assert(room.season.history.filter(h=>h.type==='action').every(h=>h.autoReason&&h.text.includes('[자동 준비:')));
});
test('exhaustion triggers recovery first, then training resumes as condition recovers',()=>{
 const {room,player,character}=fixture({fatigue:95,condition:45,stress:70}),decisions=[];
 for(let i=0;i<7;i++){
  const d=choosePreparation(room,player,ACTIONS);decisions.push(d.action);rememberPreparation(room.season,player,d);seasonShared.applyAction(room,player,{action:d.action},false);
 }
 assert.equal(decisions[0],'rest');assert(character.fatigue<71);assert(character.condition>45);assert(decisions.some(a=>a!=='rest'&&a!=='walk'));
});
test('the planner considers role weaknesses and upcoming fixtures without seeing future results',()=>{
 const {room,player,character}=fixture();character.stats.mechanics=35;assert.equal(choosePreparation(room,player,ACTIONS).action,'mechanics');
 character.stats.mechanics=65;character.stats.macro=35;assert.equal(choosePreparation(room,player,ACTIONS).action,'analysis');
 character.stats.macro=65;room.season.schedule=[{id:'next',date:seasonShared.addDays(room.season.date),teamA:'T1',teamB:'Gen.G',status:'scheduled'}];
 const before=choosePreparation(room,player,ACTIONS);assert.equal(before.action,'analysis');assert(before.reason.includes('경기 1일 전'));
 room.season.schedule[0].privateResult={winner:'T1',scoreA:2};assert.deepEqual(choosePreparation(room,player,ACTIONS),before);
});
test('automatic choices and their reasons are reproducible after persistence and keep a bounded diary',()=>{
 const {room,player}=fixture();const d=choosePreparation(room,player,ACTIONS),copy=JSON.parse(JSON.stringify(room));assert.deepEqual(choosePreparation(copy,copy.players[0],ACTIONS),d);
 for(let i=0;i<100;i++)rememberPreparation(room.season,player,d);assert.equal(room.season.autoPreparation.length,60);
});
