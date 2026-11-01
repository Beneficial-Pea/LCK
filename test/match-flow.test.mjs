import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlowTracker,FLOW_FACT_COUNT} from '../lib/match-flow.mjs';
import {BROADCAST_EXPANSION_COUNTS,expandedSpectatorLines,expandedCasterLines} from '../lib/broadcast-expansion.mjs';
import {COMMENTARY_TYPES} from '../lib/commentary.mjs';
import {simulateSeries} from '../lib/match.mjs';
import {renderMatchText} from '../public/match-feed.js';
const state=(gold,towers=[0,0],baronBuff=[0,0])=>({gold,towers,baronBuff});
const start=()=>{const observe=createFlowTracker(['A','B']);observe({type:'draft',team:null},state([5000,5000]),0);return observe;};
const event=(team,type='teamfight',extra={})=>({team,type,kills:[{killerTeam:team},{killerTeam:team}],...extra});
test('flow distinguishes narrowing a deficit from crossing into a real comeback',()=>{
 const flow=start();assert.equal(flow(event('A'),state([8000,5000]),120).kind,'first_lead');
 const recovery=flow(event('B'),state([9000,8500]),240);assert.equal(recovery.kind,'recovery');assert.equal(recovery.team,'B');assert.equal(recovery.goldDifference,500);assert(recovery.text.includes('A'));assert(recovery.peakDeficit>=3000);
 const turn=flow(event('B'),state([9000,11000]),360);assert.equal(turn.kind,'comeback');assert.equal(turn.team,'B');assert.equal(turn.goldDifference,2000);assert(turn.text.includes('3.0k'));assert(turn.text.includes('2.0k'));
});
test('a good fight from behind and small gold fluctuations do not claim an unrecorded reversal',()=>{
 const flow=start();flow(event('A'),state([10000,5000]),120);
 const answer=flow(event('B'),state([10500,6000]),240);assert.equal(answer.kind,'fight_back');assert.equal(answer.goldDifference,4500);
 assert.notEqual(flow(event('B'),state([10600,10300]),360)?.kind,'comeback');
 assert.notEqual(flow(event('B'),state([10600,10700]),480)?.kind,'comeback');
 const change=flow(event('B'),state([10600,12000]),600);assert.equal(change.kind,'comeback');
});
test('objective trades and Baron pushes require recorded opposing targets and an active buff',()=>{
 const flow=start();flow(event('A'),state([7000,5000]),100);
 flow(event('A','objective',{objective:'드래곤',dragonCount:1}),state([7500,5000]),150);
 const trade=flow(event('B','side_push',{objective:'포탑',kills:[]}),state([7500,5600],[0,1]),210);assert.equal(trade.kind,'objective_trade');assert.equal(trade.previousObjective,'드래곤');assert.equal(trade.objective,'포탑');assert.equal(trade.team,'B');
 const siege=start();siege(event('A','baron',{objective:'바론',kills:[]}),state([6500,5000],[0,0],[400,0]),220);
 const push=siege(event('A','side_push',{objective:'포탑',kills:[]}),state([7100,5000],[1,0],[400,0]),250);assert.equal(push.kind,'baron_siege');assert.equal(push.towers,1);
 const noBuff=start();noBuff(event('A'),state([6500,5000]),220);assert.notEqual(noBuff(event('A','side_push',{objective:'포탑',kills:[]}),state([7100,5000],[1,0]),250)?.kind,'baron_siege');
 const equalTargets=start();equalTargets(event('A','side_push',{objective:'포탑',kills:[]}),state([5600,5000],[1,0]),100);assert.notEqual(equalTargets(event('B','side_push',{objective:'포탑',kills:[]}),state([5600,5600],[1,1]),160)?.kind,'objective_trade');
});
test('dragon milestones are based on the secured objective, not an assumed future fight',()=>{
 const flow=start();flow(event('A'),state([7000,5000]),100);
 assert.equal(flow(event('A','objective',{objective:'드래곤',dragonCount:3}),state([7500,5000]),600).kind,'soul_point');
 assert.equal(flow(event('A','objective',{objective:'용 영혼',dragonCount:4}),state([8000,5000]),900).kind,'soul');
 assert.equal(flow(event('A','objective',{objective:'장로 드래곤',dragonCount:4}),state([8900,5000]),1300).kind,'elder');
});
test('new banks cover every event and render observed flow separately from casting with escaped content',()=>{
 assert(BROADCAST_EXPANSION_COUNTS.spectators>=500);assert(BROADCAST_EXPANSION_COUNTS.casters>=200);assert(FLOW_FACT_COUNT>=60);
 const c={team:'A',enemy:'B',killer:'Player',victim:'Opponent',location:'강가',champion:'아리',number:2,ownKills:3,enemyKills:1};
 for(const type of COMMENTARY_TYPES){assert(expandedSpectatorLines(type,c).length>=20,type);assert(expandedCasterLines(type,c).length>=8,type);}
 const html=renderMatchText({text:'현재 교전 기록',casting:'현재 교전 해설',flow:{kind:'comeback',label:'<img src=x>',text:'<script>bad</script>'}});assert(html.includes('data-match-flow="comeback"'));assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('현재 교전 기록'));assert(html.includes('현재 교전 해설'));
});
test('real simulated flow uses only current gold and never changes score or leaks a future result',()=>{
 let count=0;const kinds=new Set();
 for(let i=0;i<35;i++){
  const result=simulateSeries({teamA:{name:'A',power:65+i%6},teamB:{name:'B',power:70},bestOf:3,seed:'flow-record-'+i});
  for(const set of result.sets)for(const e of set.events){if(!e.flow)continue;count++;kinds.add(e.flow.kind);const f=e.flow,side=f.team==='A'?0:1;
   assert.equal(f.goldDifference,Math.abs(e.gold[0]-e.gold[1]));assert(!f.text.includes('undefined'));assert(!f.text.includes('${'));assert(!('winner' in f));
   if(['comeback','lead_change','first_lead','snowball'].includes(f.kind))assert(e.gold[side]>e.gold[1-side]);
   if(['recovery','fight_back'].includes(f.kind))assert(e.gold[side]<e.gold[1-side]);
   if(f.kind==='comeback')assert(f.peakDeficit>=3000);
  }
 }
 assert(count>150);assert(kinds.has('recovery'));assert(kinds.has('comeback'));assert(kinds.has('baron_siege'));assert(kinds.has('objective_trade'));
});
