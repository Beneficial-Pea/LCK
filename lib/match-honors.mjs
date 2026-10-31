const labels={3:'트리플킬',4:'쿼드라킬',5:'펜타킬'};
const seconds=t=>String(t).split(':').reduce((n,x)=>n*60+Number(x),0);
const time=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};

// Kill timing is presentation-only and uses its own seeded stream. It never
// changes the kills, winner, KDA or combat random sequence.
export function annotateMultiKills(set,seed){
 let previous=0;const streaks=new Map();
 for(const event of set.events){
  const records=event.kills||[],end=seconds(event.time),raw=[0];
  for(let i=1;i<records.length;i++)raw.push(raw.at(-1)+3+hash(`${seed}:${event.id}:gap:${i}`)%15);
  const span=raw.at(-1),available=Math.max(0,end-previous),scale=span>available&&span?available/span:1;
  const start=end-Math.round(span*scale),best=new Map();
  for(let i=0;i<records.length;i++){
   const r=records[i],at=start+Math.round(raw[i]*scale),key=`${r.killerTeam}:${r.killer}`,dead=`${r.victimTeam}:${r.victim}`;
   r.timeSeconds=at;r.time=time(at);
   const old=streaks.get(key),count=old&&at-old.last<=10?old.count+1:1;
   streaks.set(key,{last:at,count,start:count===1?at:old.start});streaks.delete(dead);
   if(count>=3){const row=set.scoreboard.find(p=>p.team===r.killerTeam&&p.nickname===r.killer);best.set(key,{playerId:row?.playerId,team:r.killerTeam,nickname:r.killer,position:row?.position,champion:r.champion,count:Math.min(count,5),label:labels[Math.min(count,5)],time:r.time,start:time(streaks.get(key)?.start??at)});}
  }
  event.multiKills=[...best.values()];
  for(const multi of event.multiKills){
   event.text+=` ${multi.label}. ${multi.nickname}이 연속 ${multi.count}킬을 완성했다.`;
   const calls=multi.count===5?[`${multi.nickname}, 펜타킬입니다! 다섯 명을 모두 정리합니다!`,`마지막 한 명까지 잡았습니다! ${multi.nickname}의 펜타킬입니다!`,`다섯 번째 처치까지 들어갑니다! ${multi.nickname}, 펜타킬을 완성했습니다!`]:multi.count===4?[`${multi.nickname}, 쿼드라킬입니다! 네 명을 정리했습니다!`,`네 번째 처치입니다! ${multi.nickname}이 쿼드라킬을 만듭니다!`,`연속 네 명을 잡습니다! ${multi.nickname}의 쿼드라킬입니다!`]:[`${multi.nickname}, 트리플킬입니다! 세 명을 연속으로 잡았습니다!`,`세 번째 처치까지 연결합니다! ${multi.nickname}이 트리플킬을 기록합니다!`,`처치가 이어집니다! ${multi.nickname}, 트리플킬입니다!`];
   event.casting=[event.casting,calls[hash(`${seed}:${event.id}:multi-call:${multi.nickname}`)%calls.length]].filter(Boolean).join(' ');
   event.reactions.push(`${multi.nickname} ${multi.label} 씨발 ㅋㅋㅋㅋ`,multi.count===5?'펜타????? 마지막까지 다 잡았노':`${multi.count}명 연속으로 잡는 거 봤냐 ㄷㄷ`);
  }
  previous=end;
 }
 return set;
}

export function summarizePerformances(sets){
 const rows=new Map();
 for(const set of sets)for(const p of set.scoreboard||[]){
  const playerId=p.playerId||`${p.team}:${p.position}`,key=`${p.team}:${playerId}`;
  let row=rows.get(key);if(!row){row={playerId,team:p.team,nickname:p.nickname,position:p.position,background:p.background||'none',sets:0,setWins:0,kills:0,deaths:0,assists:0,teamKills:0,firstBloods:0,steals:0,shutdowns:0,triples:0,quadras:0,pentas:0};rows.set(key,row);}
  row.sets++;row.setWins+=Number(set.winner===p.team);row.kills+=p.k;row.deaths+=p.d;row.assists+=p.a;row.teamKills+=p.team===set.scoreboard[0].team?set.killsA:set.killsB;
  for(const event of set.events||[]){
   if(event.type==='first_blood'&&event.kills?.some(k=>k.killerTeam===p.team&&k.killer===p.nickname))row.firstBloods++;
   if(event.steal&&event.team===p.team&&event.actors?.[0]===p.nickname)row.steals++;
   row.shutdowns+=(event.kills||[]).filter(k=>k.killerTeam===p.team&&k.killer===p.nickname&&k.shutdown).length;
   for(const m of event.multiKills||[])if(m.team===p.team&&m.nickname===p.nickname)row[m.count===5?'pentas':m.count===4?'quadras':'triples']++;
  }
 }
 return [...rows.values()];
}

export function performanceRating(p){
 const weights={TOP:[1.15,.65,.8],JGL:[1.1,.75,.8],MID:[1.25,.6,.9],ADC:[1.3,.5,.95],SUP:[1.15,1.05,.6]}[p.position]||[1,.7,.8],sets=Math.max(1,p.sets);
 const participation=(p.kills+p.assists)/Math.max(1,p.teamKills);
 return Math.round((participation*8+(p.kills*weights[0]+p.assists*weights[1]-p.deaths*weights[2]+p.firstBloods*.7+p.steals*1.4+p.shutdowns*.4+p.triples*.5+p.quadras+p.pentas*2)/sets+p.setWins/sets*2)*100)/100;
}
export function selectPom(performances,winner,seed){
 const candidates=performances.filter(p=>p.team===winner).map(p=>({...p,rating:performanceRating(p)})).sort((a,b)=>b.rating-a.rating||hash(seed+a.playerId)-hash(seed+b.playerId));
 const best=candidates[0];if(!best)return null;
 return {...best,participation:Math.round((best.kills+best.assists)/Math.max(1,best.teamKills)*100),reasons:[`킬 관여 ${Math.round((best.kills+best.assists)/Math.max(1,best.teamKills)*100)}%`,`시리즈 ${best.kills}/${best.deaths}/${best.assists}`,best.steals?`오브젝트 스틸 ${best.steals}회`:best.position==='SUP'?`어시스트 ${best.assists}회`:best.pentas?`펜타킬 ${best.pentas}회`:best.quadras?`쿼드라킬 ${best.quadras}회`:best.triples?`트리플킬 ${best.triples}회`:`세트 ${best.setWins}승 기여`]};
}
