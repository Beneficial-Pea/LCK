import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeason,TEAMS } from '../lib/season.mjs';
import { simulateSeries } from '../lib/match.mjs';
import { ensureEwc,updateEwc,ewcRoundOneTable,previousEwcChampion,qualifierNodes,resolveEwcSeats,drawEwcGroups } from '../lib/ewc.mjs';
import { renderEwcCard,renderEwcTournament } from '../public/ewc.js';

function seedFor(region,own='T1'){
 for(let i=0;i<1000;i++){const seed=`ewc-unit-${i}`,p=previousEwcChampion({seed,team:own});if(region==='LCK'?p.region==='LCK':p.region!=='LCK')return seed;}
 throw new Error('Missing seed');
}
function ready(region='LCK',extra=''){
 const s=createSeason({year:2026,team:'T1',seed:seedFor(region)+extra});
 const first=s.schedule.filter(m=>m.id.startsWith('league-')).slice(0,45);
 for(const m of first){const a=TEAMS.indexOf(m.teamA)<TEAMS.indexOf(m.teamB);m.result={winner:a?m.teamA:m.teamB,scoreA:a?2:0,scoreB:a?0:2};m.status='completed';s.results.push(m);}
 s.date='2026-05-02';updateEwc(s);return s;
}
function complete(s,m,forced=null){
 assert.equal(m.status,'scheduled',m.id);
 m.result=simulateSeries({teamA:{name:m.teamA,power:forced===m.teamA?95:70},teamB:{name:m.teamB,power:forced===m.teamB?95:70},bestOf:m.bestOf,seed:s.seed+':'+m.id,stage:m.stage,selectionRight:m.selectionRight,selectionReason:m.selectionReason});m.status='completed';s.results.push(m);updateEwc(s);
}
function playQualifier(s){
 const dates=[...new Set(s.schedule.filter(m=>m.stage==='EWC 한국 예선').map(m=>m.date))];
 for(const date of dates){s.date=date;updateEwc(s);for(const m of s.schedule.filter(m=>m.stage==='EWC 한국 예선'&&m.date===date))complete(s,m);}
 return s;
}
function road(s,direct,second){
 for(const [index,who]of [[2,direct],[4,second]]){const m=s.schedule.find(m=>m.id===s.tournaments.fixtureIds.road[index]);m.teamA=who;m.teamB=TEAMS.find(t=>t!==who);m.status='completed';m.result={winner:who,scoreA:3,scoreB:1};s.results.push(m);}updateEwc(s);
}
test('the previous champion is saved, never the selected club, and enables both nine- and ten-team qualifiers',()=>{
 const modes=new Set();for(const team of TEAMS)for(let i=0;i<30;i++){const s=createSeason({year:2026,team,seed:'history-'+i}),e=s.ewc;modes.add(e.qualifierTeams.length);assert.notEqual(e.previousChampion.team,team);assert(e.qualifierTeams.includes(team));assert.deepEqual(e.previousChampion,previousEwcChampion(s));assert.equal(s.qualifications.ewc.status,'pending');assert(e.qualifierMatchCount===(e.qualifierTeams.length===10?15:14));}
 assert.deepEqual([...modes].sort((a,b)=>a-b),[9,10]);
});
test('seeding is an immutable first-round snapshot; later league results never change it',()=>{
 const s=ready(),snapshot=structuredClone(s.ewc.r1Standings),seeds=[...s.ewc.seeds];assert(snapshot.every(r=>r.played===9));assert(!seeds.includes(s.ewc.previousChampion.team));
 s.standings.reverse();for(const m of s.schedule.filter(m=>m.id.startsWith('league-')).slice(45)){m.result={winner:m.teamB,scoreA:0,scoreB:2};m.status='completed';s.results.push(m);}updateEwc(s);
 assert.deepEqual(s.ewc.seeds,seeds);assert.deepEqual(ewcRoundOneTable(s),snapshot);
});
test('nine- and ten-team brackets eliminate only play-in losers after one loss and otherwise require two losses',()=>{
 for(let i=0;i<20;i++){
  const s=playQualifier(ready('LCK','-bracket-'+i)),e=s.ewc,n=qualifierNodes(s),matches=s.results.filter(m=>m.stage==='EWC 한국 예선');
  assert.equal(matches.length,e.qualifierMatchCount);assert.equal(matches.filter(m=>m.bestOf===5).length,2);assert.equal(new Set(e.qualifierRanking).size,3);
  const losers=new Map(e.seeds.map(t=>[t,0]));for(const m of matches)losers.set(m.result.winner===m.teamA?m.teamB:m.teamA,losers.get(m.result.winner===m.teamA?m.teamB:m.teamA)+1);
  const playInLosers=n.playIns.map(i=>{const m=matches.find(x=>x.id==='ewc-kr-'+i);return m.result.winner===m.teamA?m.teamB:m.teamA;});
  for(const [team,losses]of losers){assert.equal(losses,playInLosers.includes(team)?1:team===e.qualifierRanking[0]?0:team===e.qualifierRanking[1]?1:2);}
  assert(matches.every(m=>m.date>='2026-05-04'&&m.date<='2026-05-26'));assert(!matches.some(m=>s.schedule.some(l=>l.id.startsWith('league-')&&l.date===m.date)));
 }
});
test('overlap passes to the lower-final loser, including title-slot transfer and an overseas defending champion',()=>{
 for(const region of ['LCK','foreign']){
  const s=playQualifier(ready(region)),e=s.ewc,[a,b,c]=e.qualifierRanking;
  const overlap=resolveEwcSeats(s,a,b);assert(overlap.qualifiers.includes(c));assert.equal(overlap.passdown,c);assert.equal(overlap.teams.length,e.previousChampion.region==='LCK'?4:3);
  if(e.previousChampion.region==='LCK'){const transferred=resolveEwcSeats(s,e.previousChampion.team,a);assert.equal(transferred.seasonQualifier,a);assert.equal(transferred.defending,a);assert.equal(transferred.split,e.previousChampion.team);assert(transferred.defendingTransferred);assert(transferred.qualifiers.includes(c));}
  const top=s.schedule.find(m=>m.id===s.tournaments.fixtureIds.road[2]);top.teamA=a;top.teamB=b;top.status='scheduled';updateEwc(s);assert(e.flags.passdownConfirmed);assert(s.qualifications.ewc.teams.includes(c));
 }
});
test('all regional champion histories yield sixteen unique entrants in region-separated pools and groups',()=>{
 for(let i=0;i<35;i++){
  const s=playQualifier(ready('foreign','-pools-'+i)),e=s.ewc,[a,b]=e.qualifierRanking;road(s,a,b);assert(e.flags.drawn);assert.equal(e.pools.length,4);assert.equal(new Set(e.pools.flat().map(x=>x.team)).size,16);
  for(const g of e.groups){assert.equal(g.slots.length,4);assert.equal(new Set(g.slots.map(x=>x.region)).size,4);assert.deepEqual(g.slots.map(x=>x.pool),[1,2,3,4]);}
  assert(!s.qualifications.ewc.teams.includes(e.previousChampion.region!=='LCK'?e.previousChampion.team:'not-a-team')||e.previousChampion.region==='LCK');
 }
});
test('GSL elimination games, quarter-final separation, RoFS and bronze/final complete without unresolved fixtures',()=>{
 for(let i=0;i<8;i++){
  const s=playQualifier(ready('LCK','-main-'+i)),e=s.ewc;road(s,e.qualifierRanking[0],e.qualifierRanking[1]);
  const ids=s.tournaments.fixtureIds.ewc,m=n=>s.schedule.find(g=>g.id===ids[n-1]);
  for(const date of [...new Set(ids.map(x=>s.schedule.find(g=>g.id===x).date))].sort()){
   s.date=date;updateEwc(s);for(const fixture of s.schedule.filter(g=>g.stage==='EWC'&&g.date===date)){assert(fixture.selectionRight);complete(s,fixture);}
  }
  for(let g=0;g<4;g++){assert.equal(m(g*2+1).bestOf,1);assert.equal(m(g*2+2).bestOf,1);assert.equal(m(9+g).bestOf,3);assert.equal(m(13+g).bestOf,1);assert.equal(m(17+g).bestOf,3);assert.equal(m(17+g).teamA,loserFor(m(13+g)));}
  const groups=new Map(e.groups.flatMap(g=>g.slots.map(x=>[x.team,g.name]))),halves=new Map();
  for(let n=21;n<=24;n++){const x=m(n);assert.notEqual(groups.get(x.teamA),groups.get(x.teamB));for(const t of [x.teamA,x.teamB]){const g=groups.get(t),half=Math.floor((n-21)/2);if(halves.has(g))assert.notEqual(halves.get(g),half);else halves.set(g,half);}assert(x.selectionReason.includes('2승 0패'));}
  assert.equal(m(27).round,'3위 결정전');assert.equal(m(27).bestOf,3);assert.equal(m(28).bestOf,5);assert(e.champion&&e.thirdPlace);assert.notEqual(e.champion,e.thirdPlace);assert.equal(e.status,'completed');
 }
});
const loserFor=m=>m.result.winner===m.teamA?m.teamB:m.teamA;
test('late saves keep historical participants and scores, while new presentation escapes labels',()=>{
 const s=ready(),before=structuredClone(s.schedule);delete s.ewc;s.date='2026-06-01';assert(ensureEwc(s));assert.equal(s.ewc.status,'legacy');assert.deepEqual(s.schedule,before);assert.equal(ensureEwc(s),false);
 const fresh=ready();fresh.ewc.previousChampion.team='<img src=x onerror=bad>';const html=renderEwcCard({season:fresh})+renderEwcTournament({season:fresh});assert(!html.includes('<img'));assert(html.includes('&lt;img'));
});
