import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateSeries} from '../lib/match.mjs';
import {visibleObjectives,renderObjectiveBoard} from '../public/objective-board.js';
const input={teamA:{name:'A',power:73},teamB:{name:'B',power:73},bestOf:5,seed:'objective-counters'};
test('each published event tracks actual monotonic objectives and each set starts from zero',()=>{
 for(const set of simulateSeries(input).sets){
  let prior={towers:[0,0],dragons:[0,0],grubs:[0,0],barons:[0,0],elders:[0,0],heralds:[0,0]};
  assert.deepEqual(set.events[0].objectives,prior);
  for(const event of set.events){for(const key of Object.keys(prior))for(let side=0;side<2;side++)assert(event.objectives[key][side]>=prior[key][side]);prior=event.objectives;
   const secs=event.time.split(':').reduce((m,v)=>m*60+Number(v),0);if(secs<360)assert.equal(event.objectives.grubs[0]+event.objectives.grubs[1],0);
  }
  assert.deepEqual(prior,set.objectives);assert.equal(set.objectives.grubs[0]+set.objectives.grubs[1],3);assert(set.objectives.towers.every(v=>v<=11));
 }
});
test('the scoreboard follows only revealed events, and old unknown objectives remain unknown',()=>{
 const set=simulateSeries(input).sets[0];for(let i=1;i<=set.events.length;i++)assert.deepEqual(visibleObjectives(set.events.slice(0,i)),set.events[i-1].objectives);
 const html=renderObjectiveBoard({teamA:'<img>',teamB:'B',events:set.events.slice(0,1)});assert(!html.includes('<img>'));assert(html.includes('data-count="0"'));assert(html.includes('유충'));assert(html.includes('포탑'));assert(html.includes('용'));
 const old=visibleObjectives([{team:'A',objective:'드래곤',dragonCount:2}],null,['A','B']);assert.deepEqual(old.dragons,[2,0]);assert.deepEqual(old.grubs,[null,null]);assert.deepEqual(old.towers,[null,null]);
});
test('legacy objective rules can replay without adding grubs to an in-progress series',()=>{
 const a=simulateSeries({...input,objectiveVersion:0}),b=simulateSeries({...input,objectiveVersion:0});assert.deepEqual(a,b);assert(a.sets.every(set=>!set.objectiveVersion&&!('grubs'in set.objectives)&&!set.events.some(e=>e.objective==='공허 유충 3마리')));
});
