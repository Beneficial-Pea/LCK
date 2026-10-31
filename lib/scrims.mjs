import {seededRandom,simulateSeries} from './match.mjs';
import {vacationWindows} from './vacations.mjs';
import {strategyFor} from './match-strategies.mjs';
const add=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function scrimSchedule(room){
 const s=room.season;if(s.year!==2026||!s.team||s.draft)return [];
 const holidays=vacationWindows(s),busy=new Set(s.schedule.filter(m=>[m.teamA,m.teamB].includes(s.team)).map(m=>m.date));
 const used=new Set(),done=s.scrimDiary||[],plan=[];
 const opponents=s.opponents.filter(t=>t.name!==s.team);if(!opponents.length)return [];
 for(let month=1;month<=11;month++)for(let slot=0;slot<2;slot++){
  const id=`scrim-${s.year}-${month}-${slot}`,completed=done.find(e=>e.id===id);if(completed){plan.push(completed);used.add(completed.date);continue;}
  const random=seededRandom(`${s.seed}:${id}`),opponent=opponents[Math.floor(random()*opponents.length)].name;
  let date=s.scrimPlan?.find(e=>e.id===id)?.date||`${s.year}-${String(month).padStart(2,'0')}-${slot?'23':'09'}`;
  if(date<s.startDate)date=add(s.startDate,3+slot);
  for(let i=0;i<60&&(busy.has(date)||used.has(date)||date===s.cupDraft?.date||holidays.some(h=>date>=h.start&&date<=h.end));i++)date=add(date,1);
  if(date<s.date||date>s.endDate||busy.has(date)||used.has(date)||holidays.some(h=>date>=h.start&&date<=h.end))continue;
  used.add(date);plan.push({id,date,opponent,status:'scheduled',bestOf:3,title:`${opponent} 비공개 스크림`});
 }
 return plan.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export const todayScrim=room=>scrimSchedule(room).find(e=>e.date===room.season.date&&e.status==='scheduled');
export function playScrim(room,id,focus,getProfile){
 const s=room.season,choice=strategyFor(focus),event=todayScrim(room);if(!event||event.id!==id)throw Object.assign(new Error('오늘 진행할 상세 스크림이 없습니다.'),{status:409});
 s.scrimPlan=scrimSchedule(room);
 const result=simulateSeries({teamA:getProfile(room,s.team),teamB:getProfile(room,event.opponent),bestOf:3,seed:`${s.seed}:${id}`,stage:'비공개 스크림',strategy:{teamA:choice.name}});
 const feedback={balanced:'라인과 오브젝트 사이의 합류 순서를 확인했다.',early:'초반 정글 동선과 라인 합류 타이밍을 복기했다.',teamfight:'한타 진입 순서와 주요 스킬 사용 시점을 맞췄다.',side:'사이드 라인 배분과 본대의 교전 회피를 점검했다.'}[focus];
 const growth={balanced:{communication:.3,macro:.2},early:{laning:.3,mechanics:.2},teamfight:{communication:.3,mechanics:.2},side:{macro:.3,mastery:.2}}[focus];
 for(const p of room.players){for(const [key,v] of Object.entries(growth))p.character.stats[key]=Math.min(99,p.character.stats[key]+v);p.character.fatigue=Math.min(100,p.character.fatigue+5);p.character.condition=Math.max(0,p.character.condition-2);}
 const record={...event,status:'completed',focus,focusName:choice.name,winner:result.winner,scoreA:result.scoreA,scoreB:result.scoreB,feedback,growth,sets:result.sets.map(set=>({number:set.number,winner:set.winner,duration:set.duration,killsA:set.killsA,killsB:set.killsB,draft:set.draft,scoreboard:set.scoreboard}))};
 (s.scrimDiary??=[]).push(record);s.history.unshift({id,date:s.date,turn:s.turn,type:'scrim',text:`비공개 스크림 · ${s.team} ${result.scoreA}:${result.scoreB} ${event.opponent}. ${choice.name}. ${feedback}`});return record;
}
