import { readinessFor } from './readiness.mjs';

const keys=['mechanics','laning','macro','communication','mental','mastery'];
const labels={mechanics:'피지컬',laning:'라인전',macro:'운영',communication:'소통',mental:'멘탈',mastery:'숙련도'};
const weights={TOP:[1.1,1.25,1,.85,.9,1.1],JGL:[1,.65,1.3,1.15,1,1.15],MID:[1.2,1.2,1.1,.9,.95,1.15],ADC:[1.3,1.15,.95,.9,1.05,1.2],SUP:[.95,.8,1.25,1.3,1,1.15]};
const clamp=n=>Math.max(0,Math.min(100,n));

// Local daily planning: no model call, hidden match result or extra API cost.
// Re-evaluate after every settled day; never reuse a week-old condition snapshot.
export function choosePreparation(room,player,actions){
 const s=room.season,c=player.character,fatigue=Number(c.fatigue??10),condition=Number(c.condition??85),stress=Number(c.stress??10);
 const recent=(s.autoPreparation||[]).filter(d=>d.userId===player.userId).slice(-5),role=weights[c.position]||weights.MID;
 const ownNext=s.schedule.filter(m=>m.date>s.date&&m.status!=='completed'&&[m.teamA,m.teamB].includes(s.team)).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const daysToGame=ownNext?Math.round((Date.parse(ownNext.date)-Date.parse(s.date))/86400000):Infinity,near=daysToGame<=3;
 if(fatigue>70||condition<40||stress>80)return {action:'rest',reason:`피로 ${Math.round(fatigue)} · 컨디션 ${Math.round(condition)} · 스트레스 ${Math.round(stress)}. 강한 훈련보다 회복을 먼저 챙긴다.`};
 const top=Math.max(...keys.map(k=>Number(c.stats?.[k]??65))),growth=readinessFor(c).growthFactor;
 const scores=actions.map(action=>{
  const effects=action.effects;
  const gain=keys.reduce((sum,k,i)=>{
   const current=Number(c.stats?.[k]??65),delta=Math.min(Math.max(0,99-current),(effects[k]||0)*growth);
   return sum+delta*role[i]*(1+(top-current)/20);
  },0);
  const nextFatigue=clamp(fatigue+(effects.fatigue||0)-3),nextCondition=clamp(condition+(effects.condition||0)+1),nextStress=clamp(stress+(effects.stress||0));
  let score=gain*8-Math.max(0,nextFatigue-25)*(near?.38:.23)-Math.max(0,85-nextCondition)*(near?.45:.27)-Math.max(0,nextStress-25)*.16;
  if(near){if(action.id==='analysis')score+=daysToGame===1?3.5:daysToGame===2?2.5:1.5;if(action.id==='team')score+=1;}
  score-=recent.filter(d=>d.action===action.id).length*.8;
  if(recent.at(-1)?.action===action.id)score-=2.3;
  // At the same utility, authored action order keeps the decision reproducible.
  return {action:action.id,score};
 }).sort((a,b)=>b.score-a.score);
 const chosen=scores[0]?.action||'rest',action=actions.find(a=>a.id===chosen);
 let reason;
 if(chosen==='rest'||chosen==='walk')reason=`피로 ${Math.round(fatigue)} · 컨디션 ${Math.round(condition)} · 스트레스 ${Math.round(stress)}를 보고 회복 시간을 잡는다.`;
 else if(near&&chosen==='analysis')reason=`우리 팀 경기 ${daysToGame}일 전. 피로 부담이 적은 상대 분석으로 운영과 멘탈을 준비한다.`;
 else{
  const target=keys.filter(k=>(action?.effects[k]||0)>0).sort((a,b)=>Number(c.stats?.[a]??65)-Number(c.stats?.[b]??65))[0];
  reason=`${labels[target]||'경기력'} 보완과 ${c.position} 포지션의 준비 효율을 보고 ${action?.name||'훈련'}을 선택한다.`;
 }
 return {action:chosen,reason};
}

export function rememberPreparation(s,player,decision){
 const item={date:s.date,turn:s.turn,userId:player.userId,action:decision.action,reason:decision.reason};
 s.autoPreparation=[...(s.autoPreparation||[]),item].slice(-60);
 return item;
}
