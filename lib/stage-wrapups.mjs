const titleFinals=new Set(['cup-final','po-final','fst-final','msi-final','worlds-final','ewc-final','demacia-27']);
const own=(s,m)=>[m.teamA,m.teamB].includes(s.team);
const lost=(s,m)=>m.result&&own(s,m)&&m.result.winner!==s.team;
const done=m=>m.status==='completed'&&m.result;
const games=(s,ids)=>ids.map(id=>s.schedule.find(m=>m.id===id)).filter(Boolean);
const allDone=rows=>rows.length>0&&rows.every(done);
function templateFinish(s,key){
 const edges=s.tournaments?.templates?.[key]||[];
 const last=games(s,s.tournaments?.fixtureIds?.[key]||[]).filter(m=>done(m)&&own(s,m)).at(-1);
 if(!last||!edges.length||titleFinals.has(last.id))return null;
 const outcome=lost(s,last)?'loser':'winner';
 if(edges.some(edge=>edge.slots.some(slot=>slot.match===last.id&&slot.outcome===outcome)))return null;
 return {outcome:outcome==='loser'?'eliminated':'qualified',matchId:last.id};
}
// A snapshot of closed stages, not a migration of historical results. Comparing
// before/after a settlement avoids retroactive popups in an existing season.
export function stageFinishSnapshot(s){
 const result={},t=s.tournaments||{},ids=t.fixtureIds||{};
 const add=(key,label,value)=>{if(value)result[key]={label,...value};};
 const phase=(key,prefix)=>games(s,ids[key]||s.schedule.filter(m=>m.id.startsWith(prefix)).map(m=>m.id));
 const cupGroup=phase('cupGroup','cup-group');
 if(allDone(cupGroup)){
  const eliminated=s.year===2026?t.cupEliminated?.includes(s.team):t.cupSeeds&&!t.cupSeeds.slice(0,6).includes(s.team);
  add('cup-group','LCK Cup 그룹 배틀',{outcome:eliminated?'eliminated':'completed',detail:eliminated?'그룹 배틀에서 이번 컵 일정을 마쳤습니다.':t.cupDirect?.includes(s.team)?'플레이오프에 직행합니다.':'그룹 배틀 일정을 마쳤습니다.'});
 }
 if(s.year===2026){
  for(const [key,label] of [['cupPlayin','LCK Cup 플레이인'],['cupPlayoffs','LCK Cup 플레이오프'],['fst','퍼스트 스탠드'],['msiPlayin','MSI 플레이인'],['msiMain','MSI 본선']])add(key,label,templateFinish(s,key));
 }
 for(const [key,prefix,label] of [['league','league-','LCK 정규시즌 R1~2'],['groups','groups-',s.year===2026?'LCK 정규시즌 R3~4':'LCK 정규시즌 R3~5']]){
  if(allDone(phase(key,prefix))){
   const group=key==='groups'?s.standings.find(r=>r.team===s.team)?.group:null;
   const table=group?s.standings.filter(r=>r.group===group):s.standings;
   const place=table.findIndex(r=>r.team===s.team)+1;
   const next=key==='groups'?(t.playoffDirect?.includes(s.team)?'플레이오프에 직행합니다.':t.playinSeeds?.includes(s.team)?'플레이인에서 다음 경기를 준비합니다.':'이번 LCK 대회 일정을 마쳤습니다.'):'정규시즌 전반기 일정을 마쳤습니다.';
   add(key,label,{outcome:'completed',detail:`${group?group+' 그룹 ':''}${place?place+'위. ':''}${next}`});
  }
 }
 const pi=phase('playin','pi-').filter(m=>done(m)&&own(s,m)).at(-1);
 if(pi){
  const exit=s.year===2026?['pi-2','pi-3']:['pi-lower','pi-final'];
  const pass=s.year===2026?['pi-1','pi-3']:['pi-upper','pi-final'];
  if(lost(s,pi)&&exit.includes(pi.id))add('playin','LCK 플레이인',{outcome:'eliminated',matchId:pi.id});
  else if(!lost(s,pi)&&pass.includes(pi.id))add('playin','LCK 플레이인',{outcome:'qualified',matchId:pi.id});
 }
 if(s.year===2026)add('playoffs','LCK 플레이오프',templateFinish(s,'playoffs'));
 else{
  for(const [key,prefix,label,exit] of [['cupPlayoffs','cup-','LCK Cup 플레이오프',/^cup-(q|s)/],['playoffs','po-','LCK 플레이오프',/^po-(q|lower)/]]){
   const last=s.schedule.filter(m=>m.id.startsWith(prefix)&&done(m)&&own(s,m)).at(-1);
   if(last&&lost(s,last)&&exit.test(last.id))add(key,label,{outcome:'eliminated',matchId:last.id});
  }
 }
 const road=phase('road','road-').filter(m=>done(m)&&own(s,m)).at(-1);
 if(road){
  const exit=s.year===2026?[ids.road?.[0],ids.road?.[1],ids.road?.[3],ids.road?.[4]]:['road-q1','road-q2','road-lower','road-lower-final'];
  const pass=s.year===2026?[ids.road?.[2],ids.road?.[4]]:['road-upper','road-lower-final'];
  if(lost(s,road)&&exit.includes(road.id))add('road','Road to MSI',{outcome:'eliminated',matchId:road.id});
  else if(!lost(s,road)&&pass.includes(road.id))add('road','Road to MSI',{outcome:'qualified',matchId:road.id});
 }
 for(const [key,label,stage] of [['firstStand','퍼스트 스탠드','퍼스트 스탠드'],['msi','MSI','MSI'],['worlds','월즈','월즈'],['demacia','데마시아컵','데마시아컵']]){
  const last=s.schedule.filter(m=>m.stage===stage&&done(m)&&own(s,m)).at(-1);
  if(!last||titleFinals.has(last.id))continue;
  if(s.qualifications?.[key]?.status==='eliminated'){
   const phaseKey=key==='firstStand'?'fst':key==='msi'?(last.id.startsWith('msi-pi-')?'msiPlayin':'msiMain'):key;
   add(phaseKey,key==='msi'&&last.id.startsWith('msi-pi-')?'MSI 플레이인':label,{outcome:'eliminated',matchId:last.id});
  }else if(key==='worlds'&&lost(s,last)&&/^worlds-[qs]/.test(last.id))add(key,label,{outcome:'eliminated',matchId:last.id});
 }
 if(s.ewc?.qualifierStatus==='eliminated')add('ewc-qualifier','Road to EWC 한국 예선',{outcome:'eliminated'});
 const ewc=phase('ewc','ewc-').filter(m=>m.stage==='EWC'&&done(m)&&own(s,m)).at(-1);
 if(ewc&&!titleFinals.has(ewc.id)){
  const index=(ids.ewc||[]).indexOf(ewc.id);
  if(index===26)add('ewc','EWC',{outcome:'completed',detail:lost(s,ewc)?'EWC 4위로 대회를 마쳤습니다.':'EWC 3위로 대회를 마쳤습니다.',matchId:ewc.id});
  else if(s.ewc?.groups?.some(g=>g.eliminated?.includes(s.team))||lost(s,ewc)&&index>=20&&index<=23)add('ewc','EWC',{outcome:'eliminated',matchId:ewc.id});
 }
 return result;
}
const talks={
 eliminated:[['코치','우리끼리 잘해보자고 했잖아. 이번 대회는 여기까지지만, 다음에 고칠 건 같이 찾자.'],['매니저','오늘은 장비 정리하고 먼저 쉬자. 복기는 내일 같이 하면 돼.']],
 qualified:[['코치','잘 버텼다. 올라간 만큼 상대도 더 강해질 거야. 다음 경기 준비도 같이 하자.'],['매니저','다음 일정은 내가 정리해서 공유할게. 오늘은 밥부터 먹고 쉬자.']],
 completed:[['코치','긴 일정 치르느라 수고했어. 잘된 건 남기고, 부족했던 건 같이 맞춰보자.'],['매니저','잠깐 숨 돌리자. 다음 일정도 우리끼리 하나씩 준비하면 돼.']]
};
export function recordStageWrapUps(room,before){
 const s=room.season,after=stageFinishSnapshot(s),entries=s.stageWrapUps||[],added=[];
 for(const [key,finish] of Object.entries(after)){
  if(before[key]||entries.some(e=>e.stageKey===key))continue;
  const entry={id:`stage-${key}`,kind:'stage-wrap',stageKey:key,date:s.date,team:s.team,tournament:finish.label,placement:finish.outcome,detail:finish.detail||'',matchId:finish.matchId||null,dialogue:talks[finish.outcome].map(([speaker,text])=>({speaker,text})),players:room.players.map(p=>({userId:p.userId}))};
  entries.push(entry);added.push(entry);
  s.history.unshift({id:entry.id,date:s.date,turn:s.turn,type:'stage-wrap',text:`${entry.tournament} · ${entry.placement==='eliminated'?'탈락':entry.placement==='qualified'?'다음 단계 진출':'일정 종료'}. ${entry.detail}`});
 }
 if(added.length)s.stageWrapUps=entries;
 return added;
}
