import config from '../data/ewc-2026.json' with {type:'json'};
import { seededRandom } from './match.mjs';
export const EWC_RULES=config;
const teams=['T1','Gen.G','HLE','DK','KT','BNK','DRX','NS','DNF','BRO'];
const game=(s,n)=>s.schedule.find(m=>m.id===`ewc-kr-${n}`);
const main=(s,n)=>s.schedule.find(m=>m.id===s.tournaments.fixtureIds.ewc[n-1]);
const winner=m=>m?.result?.winner||null;
const loser=m=>m?.result?(m.result.winner===m.teamA?m.teamB:m.teamA):null;
const win=(s,n)=>winner(game(s,n)),lose=(s,n)=>loser(game(s,n));
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const shuffle=(input,seed)=>{const a=[...input],r=seededRandom(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function log(s,text,type='qualification'){s.history.unshift({id:`ewc-log-${s.turn}-${s.history.length}`,date:s.date,turn:s.turn,type,text});}
function pair(m,a,b,reason=''){
 if(m?.status==='pending'&&a&&b&&a!==b){m.teamA=a;m.teamB=b;m.status='scheduled';if(reason){m.selectionRight=true;m.selectionReason=reason;}}
}
function coinPair(s,m,a,b){if(m?.status!=='pending'||!a||!b)return;const [left,right]=shuffle([a,b],`${s.seed}:ewc:coin:${m.id}`);pair(m,left,right,'전제 경기 완료 후 동전 추첨');}

export function previousEwcChampion(s){
 const r=seededRandom(`${s.seed}:ewc:previous-champion:${s.team}`);
 const candidates=config.gameHistory.participants2025.filter(t=>t.team!==s.team);
 return {...candidates[Math.floor(r()*candidates.length)],fictional:true,basis:'게임 속 가상 전년도 EWC 우승팀'};
}
export function qualifierNodes(s){
 const ten=s.ewc.qualifierTeams.length===10,offset=ten?1:0;
 return {playIns:ten?[1,2]:[1],upper:[2,3,4,5].map(n=>n+offset),upperSemis:[6,8].map(n=>n+offset),lowerFirst:[7,9].map(n=>n+offset),lowerSecond:[10,11].map(n=>n+offset),upperFinal:12+offset,lowerThird:13+offset,lowerFinal:14+offset};
}

export function ensureEwc(s){
 if(s.year!==2026||s.ewc)return false;
 const legacy=s.finished||s.date>config.qualifierStart||s.results.some(m=>m.stage==='EWC');
 const previousChampion=legacy?{team:config.defendingChampion,region:'LCK',fictional:false,basis:'기존 시즌 기록'}:previousEwcChampion(s);
 const qualifierTeams=teams.filter(t=>previousChampion.region!=='LCK'||t!==previousChampion.team);
 s.ewc={version:3,status:legacy?'legacy':'pending',previousChampion,qualifierTeams,qualifierMatchCount:qualifierTeams.length===10?15:14,flags:{},r1Standings:[],seeds:[],qualifierRanking:[],routes:null,pools:[],groups:[]};
 const known=[...new Set(s.schedule.filter(m=>m.stage==='EWC').flatMap(m=>[m.teamA,m.teamB]).filter(t=>teams.includes(t)))];
 s.qualifications.ewc={status:legacy?(known.includes(s.team)?'qualified':known.length?'not-qualified':'pending'):'pending',teams:legacy?known:previousChampion.region==='LCK'?[previousChampion.team]:[],reason:legacy?'예선 시작일이 지난 기존 저장 · 종전 출전 경로와 경기 기록 유지':`전년도 우승 ${previousChampion.team}(${previousChampion.region}) · 우리 팀은 한국 예선 참가`,legacy};
 if(legacy)return true;
 const ten=qualifierTeams.length===10,rows=config.qualifierSchedule.map(row=>({...row,number:row.number+(ten&&row.number>=2?1:0)}));
 if(ten)rows.splice(1,0,{number:2,date:config.qualifierStart,round:'플레이인 · 하위 4팀 두 번째 경기',bestOf:3,dateBasis:'game-assigned'});
 for(const row of rows)s.schedule.push({id:`ewc-kr-${row.number}`,date:row.date,stage:'EWC 한국 예선',round:row.round,bestOf:row.bestOf,teamA:null,teamB:null,status:'pending',fixtureBasis:row.dateBasis});
 s.schedule.sort((a,b)=>a.date.localeCompare(b.date)||(a.sourceStart||'').localeCompare(b.sourceStart||'')||a.id.localeCompare(b.id,undefined,{numeric:true}));
 log(s,`전년도 EWC 우승팀은 ${previousChampion.team}(${previousChampion.region})이다. ${previousChampion.region==='LCK'?'해당 팀을 제외한 LCK 9팀':'LCK 10팀 전원'}이 Road to EWC에 참가한다.`,'season-background');
 return true;
}

export function ewcRoundOneTable(s){
 const fixtures=s.schedule.filter(m=>m.id.startsWith('league-')).sort((a,b)=>a.date.localeCompare(b.date)||(a.sourceStart||'').localeCompare(b.sourceStart||'')).slice(0,45);
 if(fixtures.length!==45||fixtures.some(m=>!m.result))return null;
 const table=teams.map(team=>({team,played:0,wins:0,losses:0,setWins:0,setLosses:0}));
 for(const m of fixtures){const a=table.find(r=>r.team===m.teamA),b=table.find(r=>r.team===m.teamB);a.played++;b.played++;a.setWins+=m.result.scoreA;a.setLosses+=m.result.scoreB;b.setWins+=m.result.scoreB;b.setLosses+=m.result.scoreA;table.find(r=>r.team===m.result.winner).wins++;table.find(r=>r.team!==m.result.winner&&[m.teamA,m.teamB].includes(r.team)).losses++;}
 const head=(a,b)=>fixtures.filter(m=>[m.teamA,m.teamB].includes(a)&&[m.teamA,m.teamB].includes(b)).reduce((n,m)=>n+(m.result.winner===a?-1:1),0);
 return table.sort((a,b)=>b.wins-a.wins||(b.setWins-b.setLosses)-(a.setWins-a.setLosses)||head(a.team,b.team)||hash(`${s.seed}:${a.team}`)-hash(`${s.seed}:${b.team}`));
}

export function resolveEwcSeats(s,direct,second){
 const e=s.ewc,prior=e.previousChampion,defender=prior.region==='LCK'&&direct===prior.team?second:prior.team;
 if(!direct||!defender||!e.qualifierRanking[2])return null;
 const qualifiers=e.qualifierRanking.filter(t=>t!==direct&&t!==defender).slice(0,2);
 if(qualifiers.length!==2)return null;
 const all=[defender,direct,...qualifiers];if(new Set(all).size!==4)throw new Error('EWC 출전권이 중복되었습니다.');
 const country=prior.region==='LCK'?[prior.team,...all.filter(t=>t!==prior.team)]:[direct,...qualifiers];
 return {defending:defender,defendingRegion:defender!==prior.team?'LCK':prior.region,split:direct,seasonQualifier:direct===prior.team?second:direct,qualifiers,teams:country,passdown:e.qualifierRanking.slice(0,2).some(t=>t===direct||t===defender)?e.qualifierRanking[2]:null,defendingTransferred:defender!==prior.team};
}

function permutations(a){if(a.length<2)return [a];return a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t]));}
export function drawEwcGroups(s,routes){
 const slot=(team,route)=>({team,region:'LCK',route});
 const f=config.foreignSlots;
 const pools=[
  [slot(routes.split,'LCK #1'),f.LCP1,f.LEC1,f.LPL1],
  [f.CN1,slot(routes.qualifiers[0],'한국 예선 #1'),f.LCS1,{team:routes.defending,region:routes.defendingRegion,route:'전년도 챔피언 슬롯'}],
  [f.APAC1,f.CN2,f.EMEA1,slot(routes.qualifiers[1],'한국 예선 #2')],
  [f.CBLOL1,f.EMEA2,f.NA1,f.SA1],
 ].map((p,i)=>p.map(x=>({...x,pool:i+1})));
 // A foreign title defender can also hold a split/qualifier slot. Keep the
 // title invitation and pass the duplicate regional slot to a distinct reserve.
 const occupied=new Set(pools.flat().map(x=>x.team)),foreignPassdowns=[];
 for(const pool of pools)for(const entry of pool){
  if(routes.defendingRegion==='LCK'||entry.route==='전년도 챔피언 슬롯'||entry.team!==routes.defending)continue;
  const replacement=shuffle(config.gameHistory.regionalReserves[entry.region]||[],`${s.seed}:ewc:passdown:${entry.region}`).find(team=>!occupied.has(team));
  if(!replacement)throw new Error('EWC 해외 중복 자격 승계 팀이 없습니다.');
  foreignPassdowns.push({region:entry.region,from:entry.team,to:replacement,route:entry.route});
  entry.team=replacement;entry.route+=' · 중복 자격 차순위 승계';occupied.add(replacement);
 }
 if(new Set(pools.flat().map(x=>x.team)).size!==16)throw new Error('EWC 본선 16팀이 중복되었습니다.');
 const groups=Array.from({length:4},(_,i)=>({name:'ABCD'[i],slots:[]}));
 function fill(p){if(p===4)return true;for(const order of permutations(shuffle(pools[p],`${s.seed}:ewc:pool:${p}`))){if(order.some((team,i)=>groups[i].slots.some(t=>t.region===team.region)))continue;order.forEach((team,i)=>groups[i].slots.push(team));if(fill(p+1))return true;groups.forEach(g=>g.slots.pop());}return false;}
 if(!fill(0))throw new Error('EWC 지역 중복 없는 풀 추첨에 실패했습니다.');
 return {pools,groups,foreignPassdowns};
}

function updateMain(s){
 const e=s.ewc;if(!e.flags.drawn)return;
 for(let i=0;i<4;i++){
  const first=main(s,i*2+1),second=main(s,i*2+2),lower=main(s,9+i),upper=main(s,13+i),decider=main(s,17+i);
  coinPair(s,lower,loser(first),loser(second));coinPair(s,upper,winner(first),winner(second));
  pair(decider,loser(upper),winner(lower),'승자전 패배 팀의 상위 시드');
  const g=e.groups[i];g.winner=winner(upper);g.runnerUp=winner(decider);g.eliminated=[loser(lower),loser(decider)].filter(Boolean);
 }
 if(!e.flags.quarters&&e.groups.every(g=>g.runnerUp)){
  e.flags.quarters=true;
  const order=shuffle(e.groups,`${s.seed}:ewc:quarter-winners`),top=shuffle(order.slice(2),`${s.seed}:ewc:quarter-top`),bottom=shuffle(order.slice(0,2),`${s.seed}:ewc:quarter-bottom`);
  for(let i=0;i<4;i++){const opponent=i<2?top[i]:bottom[i-2];pair(main(s,21+i),order[i].winner,opponent.runnerUp,'그룹 승자전 승리(2승 0패) 상위 시드');}
  log(s,'EWC 8강 대진 확정. 그룹 1위와 2위가 대결하며 같은 그룹 두 팀은 결승 이전에 만나지 않는다.');
 }
 coinPair(s,main(s,25),winner(main(s,21)),winner(main(s,22)));coinPair(s,main(s,26),winner(main(s,23)),winner(main(s,24)));
 const bronze=main(s,27);if(bronze)bronze.round='3위 결정전';
 coinPair(s,bronze,loser(main(s,25)),loser(main(s,26)));coinPair(s,main(s,28),winner(main(s,25)),winner(main(s,26)));
 const q=s.qualifications.ewc;
 if(q.teams.includes(s.team)&&e.groups.some(g=>g.eliminated.includes(s.team)))q.status='eliminated';
 if(!e.flags.finished&&winner(main(s,28))){e.flags.finished=true;e.status='completed';e.champion=winner(main(s,28));e.thirdPlace=winner(bronze);if(q.teams.includes(s.team))q.status=e.champion===s.team?'champion':'eliminated';log(s,`EWC 우승: ${e.champion}. 3위: ${e.thirdPlace}.`,'title');}
}

export function updateEwc(s){
 const e=s.ewc;if(!e)return;
 if(e.status==='legacy'){
  const known=[...new Set(s.schedule.filter(m=>m.stage==='EWC').flatMap(m=>[m.teamA,m.teamB]).filter(t=>teams.includes(t)))];
  s.qualifications.ewc.teams=known;if(known.length)s.qualifications.ewc.status=known.includes(s.team)?winner(main(s,28))?(winner(main(s,28))===s.team?'champion':'eliminated'):'qualified':'not-qualified';return;
 }
 const n=qualifierNodes(s),prior=e.previousChampion;
 if(!e.flags.seeded){
  const r1=ewcRoundOneTable(s);if(r1){
   e.flags.seeded=true;e.r1Standings=r1;e.seeds=r1.map(r=>r.team).filter(t=>prior.region!=='LCK'||t!==prior.team);
   const x=e.seeds;
   if(x.length===10){pair(game(s,n.playIns[0]),x[6],x[9]);pair(game(s,n.playIns[1]),x[7],x[8]);}else pair(game(s,n.playIns[0]),x[7],x[8]);
   log(s,`Road to EWC 시드 확정: ${x.join(', ')}. LCK 1라운드 성적만 사용한다.${prior.region==='LCK'?` 전년도 우승 ${prior.team}은 예선을 면제받았다.`:' LCK 10팀 전원이 한국 예선에 참가한다.'}`);
  }
 }
 if(e.flags.seeded){
  const x=e.seeds,ten=x.length===10;
  pair(game(s,n.upper[0]),x[0],win(s,ten?n.playIns[1]:n.playIns[0]));pair(game(s,n.upper[1]),x[3],x[4]);pair(game(s,n.upper[2]),x[1],ten?win(s,n.playIns[0]):x[6]);pair(game(s,n.upper[3]),x[2],x[5]);
  pair(game(s,n.upperSemis[0]),win(s,n.upper[0]),win(s,n.upper[1]));pair(game(s,n.lowerFirst[0]),lose(s,n.upper[0]),lose(s,n.upper[1]));
  pair(game(s,n.upperSemis[1]),win(s,n.upper[2]),win(s,n.upper[3]));pair(game(s,n.lowerFirst[1]),lose(s,n.upper[2]),lose(s,n.upper[3]));
  pair(game(s,n.lowerSecond[0]),win(s,n.lowerFirst[0]),lose(s,n.upperSemis[1]));pair(game(s,n.lowerSecond[1]),win(s,n.lowerFirst[1]),lose(s,n.upperSemis[0]));
  pair(game(s,n.upperFinal),win(s,n.upperSemis[0]),win(s,n.upperSemis[1]));pair(game(s,n.lowerThird),win(s,n.lowerSecond[0]),win(s,n.lowerSecond[1]));pair(game(s,n.lowerFinal),lose(s,n.upperFinal),win(s,n.lowerThird));
 }
 if(!e.flags.qualifierFinished&&win(s,n.lowerFinal)){e.flags.qualifierFinished=true;e.qualifierRanking=[win(s,n.upperFinal),win(s,n.lowerFinal),lose(s,n.lowerFinal)];log(s,`EWC 한국 예선 통과: ${e.qualifierRanking.slice(0,2).join(', ')}. 승계 대기: ${e.qualifierRanking[2]}.`);}
 const road=s.tournaments.fixtureIds.road,top=s.schedule.find(m=>m.id===road[2]),second=s.schedule.find(m=>m.id===road[4]);
 const direct=winner(top),q=s.qualifications.ewc,provisional=[win(s,n.upperFinal),win(s,n.lowerFinal)].filter(Boolean);
 if(!e.flags.drawn){
  const guaranteed=new Set([...(prior.region==='LCK'?[prior.team]:[]),...provisional]);if(direct)guaranteed.add(direct);
  if(e.qualifierRanking.length&&top?.teamA&&top?.teamB&&[top.teamA,top.teamB].every(t=>e.qualifierRanking.slice(0,2).includes(t))){
   guaranteed.add(e.qualifierRanking[2]);if(!e.flags.passdownConfirmed){e.flags.passdownConfirmed=true;log(s,`Road to MSI 1시드 후보가 모두 EWC 예선 통과 팀이다. 중복이 확정되어 ${e.qualifierRanking[2]}의 EWC 출전권 승계를 확정했다.`);}
  }
  q.teams=[...guaranteed];q.status=guaranteed.has(s.team)?'qualified':'pending';
  const routes=resolveEwcSeats(s,direct,winner(second));
  if(routes){
   e.flags.drawn=true;e.status='qualified';e.routes=routes;q.teams=routes.teams;q.status=routes.teams.includes(s.team)?'qualified':'not-qualified';q.reason=routes.defendingTransferred?`${prior.team} LCK #1 획득 · LCK #2가 챔피언 슬롯 승계`:`전년도 우승 ${prior.team} · 스플릿 우승 · 한국 예선`;
   const draw=drawEwcGroups(s,routes);e.pools=draw.pools;e.groups=draw.groups;e.foreignPassdowns=draw.foreignPassdowns;
   for(let i=0;i<4;i++){const p=e.groups[i].slots;pair(main(s,i*2+1),p[0].team,p[3].team,'상위 풀 팀의 첫 선택권');pair(main(s,i*2+2),p[1].team,p[2].team,'상위 풀 팀의 첫 선택권');}
   log(s,`EWC LCK 대표 확정: ${q.teams.join(', ')}.${routes.passdown?` 중복 출전권은 ${routes.passdown}에게 승계했다.`:''}${routes.defendingTransferred?` 챔피언 슬롯은 ${routes.defending}에게 양도했다.`:''}`);
  }
 }
 const losses=s.results.filter(m=>m.stage==='EWC 한국 예선'&&loser(m)===s.team).length;
 e.qualifierStatus=s.team===prior.team?'exempt':provisional.includes(s.team)?'qualified':e.qualifierRanking[2]===s.team?(e.flags.passdownConfirmed||e.routes?.passdown===s.team?'passed-down':'passdown-candidate'):n.playIns.some(i=>lose(s,i)===s.team)||losses>=2?'eliminated':e.flags.seeded?'playing':'pending';
 updateMain(s);
}
