import rules from '../data/demacia-2026.json' with {type:'json'};
import { seededRandom } from './match.mjs';

export const DEMACIA_RULES=rules;
const regionalTeams={
 LCK:['T1','Gen.G','HLE','DK','KT','BNK','DRX','NS','DNF','BRO'],
 LPL:['BLG','AL','TES','JDG','IG','WBG','LNG','NIP','EDG','OMG','TT','FPX','UP','WE'],
 LEC:['G2','KC','MKOI','FNC','VIT','GX','SK','BDS','TH','NAVI'],
 LCS:['C9','TLAW','LYON','SEN','FLY','TL','100T','DSG','SR','DIG'],
 LCP:['CFO','TSW','DCG','GAM','PSG','TS','DFM','SHG','MVK','MVKE','VKE'],
 CBLOL:['FUR','LOS','PNG','RED','LOUD','PAIN','VKS','KBM','FX'],
};
export const regionOf=team=>Object.entries(regionalTeams).find(([,teams])=>teams.includes(team))?.[0]||null;
const id=n=>`demacia-${n}`;
const game=(s,n)=>s.schedule.find(m=>m.id===id(n));
const win=(s,n)=>game(s,n)?.result?.winner;
const lose=(s,n)=>{const m=game(s,n);return m?.result?(m.result.winner===m.teamA?m.teamB:m.teamA):null;};
const done=(s,a,b)=>Array.from({length:b-a+1},(_,i)=>Boolean(win(s,a+i))).every(Boolean);
function shuffle(values,seed){const a=[...values],r=seededRandom(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function log(s,text,type='qualification'){s.history.unshift({id:`demacia-log-${s.turn}-${s.history.length}`,date:s.date,turn:s.turn,type,text});}
function pair(s,n,a,b){const m=game(s,n);if(m&&m.status==='pending'&&a&&b&&a!==b){m.teamA=a;m.teamB=b;m.status='scheduled';}}

export function ensureDemacia(s){
 if(s.year!==2026||s.demacia)return false;
 s.demacia={version:1,status:'pending',declined:[],entrants:[],slots:null,regionalOrder:[],flags:{},online:[],rescue:[]};
 s.qualifications.demacia={status:'pending',teams:[],reason:'MSI 지역 순위와 월즈 진출팀 확정 대기'};
 // Never insert already elapsed fixtures into an existing or finished save.
 if(s.date>rules.startDate||s.finished){s.demacia.status='unavailable';s.qualifications.demacia={status:'unavailable',teams:[],reason:'이 저장은 대회 시작일이 지나 새 대진을 소급 추가하지 않습니다.'};return true;}
 for(const slot of rules.schedule)for(let n=slot.from;n<=slot.to;n++)s.schedule.push({id:id(n),date:slot.date,stage:'데마시아컵',round:slot.round,teamA:null,teamB:null,bestOf:slot.bestOf,status:'pending',fixtureBasis:'user-provided-demacia-format',sourceRound:slot.round,selectionRight:true,coachComms:n>=21});
 s.schedule.sort((a,b)=>a.date.localeCompare(b.date)||(a.sourceStart||'').localeCompare(b.sourceStart||'')||a.id.localeCompare(b.id,undefined,{numeric:true}));
 return true;
}

export function demaciaRegionSlots(s){
 const final=s.results.find(m=>m.id==='msi-final');if(!final)return null;
 const matches=s.results.filter(m=>m.stage==='MSI');
 const teams=[final.result.winner,final.result.winner===final.teamA?final.teamB:final.teamA];
 for(const m of [...matches].reverse()){teams.push(m.result.winner===m.teamA?m.teamB:m.teamA,m.result.winner);}
 const regions=[...new Set(teams.map(regionOf).filter(Boolean))];
 for(const region of Object.keys(rules.announcedSlots))if(!regions.includes(region))regions.push(region);
 return {order:regions,slots:Object.fromEntries(regions.map((region,i)=>[region,rules.slotDistribution[i]]))};
}

// No foreign regional-season/Championship Points database is available. Preserve
// the announcement's ordered invitation slots instead of inventing real ranks.
export function demaciaInvitees(s){
 const d=s.demacia,worlds=new Set(s.qualifications.worlds.teams||[]),declined=new Set(d.declined),entrants=[];
 const regular=s.standings.map(row=>row.team);
 const ordered=s.groups?[...regular.filter(t=>s.groups.legend.includes(t)),...regular.filter(t=>s.groups.rise.includes(t))]:regular;
 for(const region of d.regionalOrder){
  const count=d.slots[region];
  if(region==='LCK'){
   const candidates=ordered.filter(team=>!worlds.has(team)&&!declined.has(team));
   for(const team of candidates.slice(0,count))entrants.push({team,region,rank:ordered.indexOf(team)+1,basis:'정규시즌 최종 순위 · 월즈 진출팀 제외'});
  }else{
   let rank=rules.foreignPriorityStart[region],accepted=0;
   while(accepted<count){
    const kind=['LPL','LCP'].includes(region)?'CP':region==='CBLOL'?'스플릿2':'서머';
    const team=`${region} ${kind} ${rank}위`;
    if(!declined.has(team)&&!worlds.has(team)){entrants.push({team,region,rank,basis:'해외 실제 초청 팀명 미확인 · 순위 슬롯 NPC'});accepted++;}
    rank++;
   }
  }
 }
 if(entrants.length!==12)throw new Error('데마시아컵 초청 가능한 12개 팀을 확인하세요.');
 return entrants;
}

function seenOpponents(s){const seen=new Map(s.demacia.entrants.map(e=>[e.team,new Set()]));for(const m of s.results.filter(m=>m.id.startsWith('demacia-')&&Number(m.id.split('-')[1])<=20)){seen.get(m.teamA)?.add(m.teamB);seen.get(m.teamB)?.add(m.teamA);}return seen;}
function draw(s,names,label,{sameRegion=false}={}){
 const teams=shuffle(names,`${s.seed}:demacia:draw:${label}`),seen=seenOpponents(s),region=t=>s.demacia.entrants.find(e=>e.team===t)?.region;
 if(sameRegion){
  const left=teams.slice(0,6),right=teams.slice(6);
  function rightDraw(i,remaining){if(i===left.length)return [];for(let j=0;j<remaining.length;j++){const b=remaining[j];if(region(left[i])===region(b))continue;const tail=rightDraw(i+1,remaining.filter((_,k)=>k!==j));if(tail)return [[left[i],b],...tail];}return null;}
  const pairs=rightDraw(0,right);if(!pairs)throw new Error('데마시아컵 첫 라운드 지역 분리 추첨 실패');
  s.demacia.draws??={};s.demacia.draws.R1={left,right:pairs.map(p=>p[1])};return pairs;
 }
 function solve(left){if(!left.length)return [];const [a,...rest]=left;for(let i=0;i<rest.length;i++){const b=rest[i];if(seen.get(a)?.has(b)||(sameRegion&&region(a)===region(b)))continue;const tail=solve(rest.filter((_,j)=>j!==i));if(tail)return [[a,b],...tail];}return null;}
 const pairs=solve(teams);if(!pairs)throw new Error(`데마시아컵 ${label}에서 재대결 없는 추첨을 만들 수 없습니다.`);return pairs;
}
function seedDraw(s,names,start,label,options){draw(s,names,label,options).forEach(([a,b],i)=>pair(s,start+i,a,b));}
function updateOnlineTable(s){
 const rows=s.demacia.entrants.map(e=>({team:e.team,region:e.region,wins:0,losses:0,opponents:[],status:'playing'}));
 for(let n=1;n<=15;n++){const m=game(s,n);if(!m?.result)continue;const w=rows.find(r=>r.team===win(s,n)),l=rows.find(r=>r.team===lose(s,n));w.wins++;l.losses++;w.opponents.push(l.team);l.opponents.push(w.team);}
 for(const r of rows)if(r.wins===2)r.status='qualified';
 if(s.demacia.flags.rescueDone){for(const r of rows.filter(r=>r.losses===2&&r.wins===0)){if(r.team===s.demacia.rescueWinner){r.wins=1;r.rescueWinner=true;}else{r.losses=3;r.status='eliminated';}}}
 for(let n=19;n<=20;n++){const m=game(s,n);if(!m?.result)continue;const w=rows.find(r=>r.team===win(s,n)),l=rows.find(r=>r.team===lose(s,n));w.wins++;l.losses++;w.status='qualified';l.status='eliminated';w.opponents.push(l.team);l.opponents.push(w.team);}
 s.demacia.online=rows;
}

function updateRescue(s){
 const teams=[...new Set([16,17,18].flatMap(n=>[game(s,n)?.teamA,game(s,n)?.teamB]))].filter(Boolean);
 const rows=teams.map(team=>({team,wins:0,setWins:0,setLosses:0}));
 for(let n=16;n<=18;n++){const m=game(s,n);if(!m?.result)continue;const a=rows.find(r=>r.team===m.teamA),b=rows.find(r=>r.team===m.teamB);rows.find(r=>r.team===m.result.winner).wins++;a.setWins+=m.result.scoreA;a.setLosses+=m.result.scoreB;b.setWins+=m.result.scoreB;b.setLosses+=m.result.scoreA;}
 // The supplied slides do not specify a three-way tie rule. Use set differential,
 // then the saved seeded draw; retain the evidence and disclose this one detail.
 const tieOrder=shuffle(teams,`${s.seed}:demacia:rescue-tie`);
 rows.sort((a,b)=>b.wins-a.wins||(b.setWins-b.setLosses)-(a.setWins-a.setLosses)||tieOrder.indexOf(a.team)-tieOrder.indexOf(b.team));s.demacia.rescue=rows;
 return rows[0]?.team;
}

export function updateDemacia(s){
 const d=s.demacia;if(!d||d.status==='unavailable')return;
 const distribution=demaciaRegionSlots(s);
 if(distribution&&!d.slots){d.regionalOrder=distribution.order;d.slots=distribution.slots;s.qualifications.demacia.slots=d.slots;log(s,`데마시아컵 MSI 지역별 초청권 확정: ${d.regionalOrder.map(r=>`${r} ${d.slots[r]}팀`).join(' · ')}.`);}
 if(!d.flags.invited&&d.slots&&s.flags.worldsSeeded){
  d.flags.invited=true;d.status='invited';d.entrants=demaciaInvitees(s);
  const teams=d.entrants.filter(e=>e.region==='LCK').map(e=>e.team);
  s.qualifications.demacia={status:teams.includes(s.team)?'qualified':'not-qualified',teams,slots:d.slots,reason:'정규시즌 순위가 높은 월즈 미진출 팀 우선 초청'};
  seedDraw(s,d.entrants.map(e=>e.team),1,'R1',{sameRegion:true});
  log(s,`데마시아컵 LCK 초청: ${teams.join(', ')}. 월즈 진출팀은 제외했다. 10월 3일 온라인 개막, 17일 결승.`);
 }
 if(!d.flags.invited)return;
 if(!d.flags.r2&&done(s,1,6)){d.flags.r2=true;seedDraw(s,[1,2,3,4,5,6].map(n=>win(s,n)),7,'R2-1-0');seedDraw(s,[1,2,3,4,5,6].map(n=>lose(s,n)),10,'R2-0-1');}
 if(!d.flags.r3&&done(s,7,12)){
  d.flags.r3=true;seedDraw(s,[7,8,9].map(n=>lose(s,n)).concat([10,11,12].map(n=>win(s,n))),13,'R3-1-1');
  const bottom=shuffle([10,11,12].map(n=>lose(s,n)),`${s.seed}:demacia:0-2`);
  pair(s,16,bottom[0],bottom[1]);pair(s,17,bottom[0],bottom[2]);pair(s,18,bottom[1],bottom[2]);
 }
 updateOnlineTable(s);updateRescue(s);
 if(!d.flags.rescueDone&&done(s,16,18)){
  d.flags.rescueDone=true;d.rescueWinner=updateRescue(s);updateOnlineTable(s);
  seedDraw(s,[13,14,15].map(n=>lose(s,n)).concat(d.rescueWinner),19,'R4');
  log(s,`데마시아컵 0승 2패조 라운드 로빈: ${d.rescueWinner}이 1위로 마지막 진출전에 합류. 다른 두 팀은 탈락.`);
 }
 if(!d.flags.knockout&&done(s,19,20)){
  d.flags.knockout=true;d.status='knockout';
  const clean=shuffle([7,8,9].map(n=>win(s,n)),`${s.seed}:demacia:2-0`),last=shuffle([19,20].map(n=>win(s,n)),`${s.seed}:demacia:2-2`),middle=shuffle([13,14,15].map(n=>win(s,n)),`${s.seed}:demacia:2-1`);
  pair(s,21,clean[0],last[0]);pair(s,22,clean[1],middle[0]);pair(s,23,clean[2],last[1]);pair(s,24,middle[1],middle[2]);
  d.knockoutTeams=[...clean,...middle,...last];log(s,`데마시아컵 오프라인 8강 진출: ${d.knockoutTeams.join(', ')}. 전 경기 BO5, 코치 보이스는 팀별 세트당 최대 3회·각 45초.`);
 }
 pair(s,25,win(s,21),win(s,22));pair(s,26,win(s,23),win(s,24));pair(s,27,win(s,25),win(s,26));
 const own=s.qualifications.demacia;
 if(own.status==='qualified'){
  if(d.online.find(r=>r.team===s.team)?.status==='eliminated'||[21,22,23,24,25,26,27].some(n=>lose(s,n)===s.team))own.status='eliminated';
 }
 if(!d.flags.finished&&win(s,27)){d.flags.finished=true;d.status='completed';d.champion=win(s,27);if(own.teams.includes(s.team)&&!d.declined.includes(s.team))own.status=d.champion===s.team?'champion':'eliminated';log(s,`${d.champion}이 2026 데마시아컵 글로벌 인비테이셔널을 우승했다.`,'title');}
}

export function declineDemacia(s,team){
 const d=s.demacia;
 if(!d?.flags.invited||s.date>=rules.startDate||s.results.some(m=>m.id.startsWith('demacia-'))||!d.entrants.some(e=>e.team===team))throw Object.assign(new Error('개막 전 현재 초청팀만 참가를 거절할 수 있습니다.'),{status:409});
 d.declined.push(team);d.entrants=demaciaInvitees(s);
 for(let n=1;n<=6;n++){const m=game(s,n);m.teamA=m.teamB=null;m.status='pending';}
 seedDraw(s,d.entrants.map(e=>e.team),1,'R1',{sameRegion:true});
 s.qualifications.demacia.teams=d.entrants.filter(e=>e.region==='LCK').map(e=>e.team);
 s.qualifications.demacia.status=d.declined.includes(s.team)?'declined':s.qualifications.demacia.teams.includes(s.team)?'qualified':'not-qualified';
 updateOnlineTable(s);log(s,`${team}이 데마시아컵 초청을 거절해 차순위 적격 팀으로 초청권을 넘겼다.`);
}
