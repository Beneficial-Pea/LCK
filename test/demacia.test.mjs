import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDemacia,updateDemacia,declineDemacia,DEMACIA_RULES } from '../lib/demacia.mjs';
import { simulateSeries } from '../lib/match.mjs';
import { renderDemaciaCard,renderDemaciaTournament } from '../public/demacia.js';

const teams=['T1','Gen.G','HLE','DK','KT','BNK','DRX','NS','DNF','BRO'];
function season(seed='demacia-test'){
 const s={year:2026,team:'KT',seed,date:'2026-09-14',turn:246,finished:false,schedule:[],standings:teams.map(team=>({team})),groups:{legend:teams.slice(0,5),rise:teams.slice(5)},history:[],flags:{worldsSeeded:true},qualifications:{worlds:{teams:teams.slice(0,4)}},results:[{id:'msi-final',stage:'MSI',teamA:'T1',teamB:'BLG',result:{winner:'T1'}}]};
 ensureDemacia(s);updateDemacia(s);return s;
}
function play(s){
 const dates=[...new Set(s.schedule.map(m=>m.date))].sort();
 for(const date of dates){s.date=date;updateDemacia(s);for(const m of s.schedule.filter(m=>m.date===date)){assert.equal(m.status,'scheduled',m.id+' unresolved');m.result=simulateSeries({teamA:{name:m.teamA,power:72},teamB:{name:m.teamB,power:72},bestOf:m.bestOf,seed:s.seed+':'+m.id,stage:m.stage,selectionRight:m.selectionRight,coachComms:m.coachComms});m.status='completed';s.results.push(m);updateDemacia(s);}s.turn++;}
 return s;
}
test('provided slides produce exactly twenty online and seven offline fixtures on their stated dates',()=>{
 const s=season();assert.equal(s.schedule.length,27);
 for(const spec of DEMACIA_RULES.schedule)for(let n=spec.from;n<=spec.to;n++){const m=s.schedule.find(m=>m.id==='demacia-'+n);assert.equal(m.date,spec.date);assert.equal(m.bestOf,spec.bestOf);assert.equal(m.coachComms,n>=21);assert(m.selectionRight);}
 assert.equal(s.schedule.filter(m=>m.bestOf===1).length,6);assert.equal(s.schedule.filter(m=>m.coachComms).length,7);
});
test('invitations use regular-season order, exclude Worlds and pass a refusal to the next eligible club',()=>{
 const s=season(),q=s.qualifications.demacia;
 assert.deepEqual(q.teams,['KT','BNK','DRX']);assert.equal(q.status,'qualified');assert.equal(s.demacia.entrants.length,12);
 assert.deepEqual(Object.values(s.demacia.slots).sort(),[1,1,2,2,3,3]);
 assert(!s.demacia.entrants.some(e=>s.qualifications.worlds.teams.includes(e.team)));
 declineDemacia(s,'KT');assert.deepEqual(s.qualifications.demacia.teams,['BNK','DRX','NS']);assert.equal(s.qualifications.demacia.status,'declined');
 s.date='2026-10-03';assert.throws(()=>declineDemacia(s,'BNK'),/개막/);
});
test('game MSI outcomes determine regional quotas rather than fixing LCK to three seats',()=>{
 const s=season();s.results=[{id:'msi-main-12',stage:'MSI',teamA:'G2',teamB:'FUR',result:{winner:'G2'}},{id:'msi-final',stage:'MSI',teamA:'BLG',teamB:'G2',result:{winner:'BLG'}}];
 delete s.demacia;delete s.qualifications.demacia;s.schedule=[];ensureDemacia(s);updateDemacia(s);
 assert.equal(s.demacia.slots.LPL,3);assert.equal(s.demacia.slots.LEC,3);assert.equal(s.demacia.slots.CBLOL,2);assert.equal(Object.values(s.demacia.slots).reduce((a,b)=>a+b),12);
});
test('many draws avoid first-round regional matches and every subsequent online rematch, including the rescue winner',()=>{
 let championSeen=false,knockoutSeen=false;
 for(let i=0;i<35;i++){
  const s=play(season('demacia-draw-'+i)),seen=new Set();
  for(const m of s.results.filter(m=>m.id.startsWith('demacia-')&&Number(m.id.split('-')[1])<=20)){
   const key=[m.teamA,m.teamB].sort().join('|');assert(!seen.has(key),key+' rematched');seen.add(key);
   if(Number(m.id.split('-')[1])<=6)assert.notEqual(s.demacia.entrants.find(e=>e.team===m.teamA).region,s.demacia.entrants.find(e=>e.team===m.teamB).region);
  }
  assert.equal(s.demacia.knockoutTeams.length,8);assert.equal(new Set(s.demacia.knockoutTeams).size,8);
  assert.equal(s.demacia.online.filter(r=>r.status==='qualified').length,8);assert.equal(s.demacia.online.filter(r=>r.status==='eliminated').length,4);
  assert.equal(s.demacia.online.filter(r=>r.wins===2&&r.losses===0).length,3);assert.equal(s.demacia.online.filter(r=>r.wins===2&&r.losses===1).length,3);assert.equal(s.demacia.online.filter(r=>r.wins===2&&r.losses===2).length,2);
  assert.equal(s.demacia.rescue.length,3);assert(s.demacia.rescue.every(r=>r.setWins+r.setLosses>=4));
  assert.equal(s.demacia.status,'completed');assert(s.demacia.champion);
  const g=n=>s.schedule.find(m=>m.id==='demacia-'+n),r=t=>s.demacia.online.find(x=>x.team===t);
  for(const n of [21,23]){assert.equal(r(g(n).teamA).losses,0);assert.equal(r(g(n).teamB).losses,2);}
  assert.equal(r(g(22).teamA).losses,0);assert.equal(r(g(22).teamB).losses,1);assert.equal(r(g(24).teamA).losses,1);assert.equal(r(g(24).teamB).losses,1);
  championSeen||=s.qualifications.demacia.status==='champion';knockoutSeen||=s.demacia.knockoutTeams.includes('KT');
 }
 assert(knockoutSeen);assert(championSeen);
});
test('RoFS goes from the drawn left team to the preceding set loser; coach calls reset with each set and never pause',()=>{
 const result=simulateSeries({teamA:{name:'A',power:75},teamB:{name:'B',power:75},bestOf:5,seed:'coach-rofs',selectionRight:true,coachComms:true});
 assert.equal(result.sets[0].draft.selectionRight.team,'A');
 for(let i=0;i<result.sets.length;i++){
  const set=result.sets[i];if(i)assert.equal(set.draft.selectionRight.team,result.sets[i-1].winner==='A'?'B':'A');
  for(const c of set.coachComms){assert(c.used<=3&&c.used>=1);assert.equal(c.remaining,3-c.used);assert.equal(c.activations[0].number,1);for(const a of c.activations){assert.equal(a.duration,45);const seconds=t=>t.split(':').reduce((n,x)=>n*60+Number(x),0);assert.equal(seconds(a.end)-seconds(a.start),45);}}
  for(const e of set.events.filter(e=>e.type==='coach_comms')){assert.equal(e.kills.length,0);assert.equal(e.coach.limit,3);assert.equal(e.coach.duration,45);}
 }
 const online=simulateSeries({teamA:{name:'A'},teamB:{name:'B'},bestOf:3,seed:'online-no-coach',selectionRight:true});assert(!online.sets.some(s=>s.events.some(e=>e.type==='coach_comms')));
});
test('migration is once-only, retains completed seasons and escapes all displayed participant text',()=>{
 const s=season(),before=s.schedule.length;assert.equal(ensureDemacia(s),false);assert.equal(s.schedule.length,before);
 const old=structuredClone(s);delete old.demacia;old.date='2026-10-09';assert(ensureDemacia(old));assert.equal(old.demacia.status,'unavailable');assert.equal(old.schedule.length,before);
 s.demacia.entrants[0].team='<script>bad</script>';s.qualifications.demacia.teams=['<img onerror=bad>'];
 const html=renderDemaciaCard({season:s},true)+renderDemaciaTournament({season:s});assert(!html.includes('<script>'));assert(!html.includes('<img onerror'));assert(html.includes('&lt;script&gt;'));
});
