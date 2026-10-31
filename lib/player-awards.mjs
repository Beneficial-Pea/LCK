import { performanceRating } from './match-honors.mjs';

const counts=['sets','setWins','kills','deaths','assists','teamKills','firstBloods','steals','shutdowns','triples','quadras','pentas'];
const empty=()=>Object.fromEntries([...counts,'matches','pom','ratingTotal'].map(k=>[k,0]));
export function ensureAwards(s){
 if(!s.awards)s.awards={version:1,ceremonyDate:`${s.year||2025}-10-01`,processedIds:(s.results||[]).map(m=>m.id),untrackedMatches:(s.results||[]).length,ledger:{},ceremony:null};
 return s.awards;
}
export function recordMatchAwards(s,match,result){
 const awards=ensureAwards(s);if(awards.processedIds.includes(match.id))return false;
 awards.processedIds.push(match.id);
 const regular=/^(league-|groups-)/.test(match.id);
 for(const p of result.performances||[]){
  const key=`${p.team}:${p.playerId}`;
  const row=awards.ledger[key]??={playerId:p.playerId,team:p.team,nickname:p.nickname,position:p.position,total:empty(),regular:empty()};
  row.nickname=p.nickname;
  for(const totals of [row.total,...(regular?[row.regular]:[])]){
   totals.matches++;for(const k of counts)totals[k]+=p[k]||0;
   totals.ratingTotal+=performanceRating(p)*p.sets;
   if(result.pom?.team===p.team&&result.pom?.playerId===p.playerId)totals.pom++;
  }
 }
 return true;
}
const compare=(a,b)=>b.regular.pom-a.regular.pom||b.regular.ratingTotal/Math.max(1,b.regular.sets)-a.regular.ratingTotal/Math.max(1,a.regular.sets)||a.playerId.localeCompare(b.playerId);
export function awardCandidates(s){return Object.values(s.awards?.ledger||{}).filter(p=>p.regular.matches>0).sort(compare);}
export function publishSeasonAwards(s){
 const awards=ensureAwards(s);if(awards.ceremony||s.date<awards.ceremonyDate)return false;
 const candidates=awardCandidates(s);if(!candidates.length)return false;
 const positions=['TOP','JGL','MID','ADC','SUP'];
 const ranked=Object.fromEntries(positions.map(position=>{
  const rows=candidates.filter(p=>p.position===position),minimum=Math.ceil(Math.max(0,...rows.map(p=>p.regular.sets))*.4);
  return [position,rows.filter(p=>p.regular.sets>=minimum)];
 }));
 const snapshot=p=>p?structuredClone({...p,rating:Math.round(p.regular.ratingTotal/p.regular.sets*100)/100}):null;
 awards.ceremony={date:s.date,playerOfYear:snapshot(candidates[0]),allPro:['FIRST','SECOND','THIRD'].map((tier,i)=>({tier,players:positions.map(position=>snapshot(ranked[position][i])).filter(Boolean)})),trackedMatches:awards.processedIds.length-awards.untrackedMatches};
 const winner=candidates[0];
 (s.history??=[]).unshift({date:s.date,turn:s.turn,type:'season-awards',text:`올해의 선수는 ${winner.nickname}. 정규시즌 POM ${winner.regular.pom}회로 시즌을 빛냈다. 올프로 퍼스트·세컨드·서드 팀이 발표됐다.`});
 return true;
}
