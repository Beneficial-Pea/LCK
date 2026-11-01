const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const w=match=>({match,outcome:'winner'}),l=match=>({match,outcome:'loser'});
const edge=(id,...slots)=>({id,slots});

// Bracket edges come from the current season's routing, never source scores or
// source team names. Unresolved draws remain empty until the engine draws them.
export function tournamentBoards(room){
 const s=room.season,t=s.tournaments,ids=t?.fixtureIds||{},template=key=>t.templates?.[key]||[],boards=[];
 const add=(key,title,matchIds,edges=[],labels={})=>boards.push({key,title,ids:matchIds||[],edges,labels});
 add('fst','퍼스트 스탠드 · 그룹 / 준결승 / 결승',ids.fst,template('fst'));
 const road=ids.road||[];
 add('road','ROAD TO MSI',road,[edge(road[1],{label:'정규시즌 4위'},w(road[0])),edge(road[3],{label:'정규시즌 3위'},w(road[1])),edge(road[4],l(road[2]),w(road[3]))],{[road[0]]:'진출 토너먼트 1R',[road[1]]:'진출 토너먼트 2R',[road[2]]:'MSI 1시드 결정전',[road[3]]:'진출 토너먼트 3R',[road[4]]:'MSI 2시드 결정전'});
 add('msiPlayin','MSI · 플레이인',ids.msiPlayin,template('msiPlayin'));
 add('msiMain','MSI · 본선 더블 엘리미네이션',ids.msiMain,template('msiMain'));
 add('worldsPlayin','WORLDS · 플레이인',ids.worldsPlayin,template('worldsPlayin'));
 const knockout=ids.worldsKnockout||[];
 add('worldsKnockout','WORLDS · 8강 / 준결승 / 결승',knockout,[edge(knockout[4],w(knockout[0]),w(knockout[1])),edge(knockout[5],w(knockout[2]),w(knockout[3])),edge(knockout[6],w(knockout[4]),w(knockout[5]))]);
 const swiss=s.schedule.filter(m=>/^worlds-swiss|^swiss/.test(m.id)||/스위스/.test(m.round)&&m.stage==='월즈');
 if(swiss.length)add('worldsSwiss','WORLDS · 스위스 라운드',swiss.map(m=>m.id),[],Object.fromEntries(swiss.map(m=>[m.id,m.round])));
 if(s.ewc?.status!=='legacy'){
  const ten=s.ewc?.qualifierTeams?.length===10,o=ten?1:0,id=n=>`ewc-kr-${n}`,upper=[2,3,4,5].map(n=>id(n+o)),semi=[6,8].map(n=>id(n+o)),low=[7,9].map(n=>id(n+o)),low2=[10,11].map(n=>id(n+o)),uf=id(12+o),lf=id(14+o),low3=id(13+o);
  const labels=Object.fromEntries([...(ten?[1,2]:[1]).map(n=>[id(n),'플레이인 · 패배 시 탈락']),...upper.map((n,i)=>[n,`승자조 1R · ${i+1}경기`]),...semi.map((n,i)=>[n,`승자조 준결승 · ${i+1}경기`]),...low.map(n=>[n,'패자조 1R']),...low2.map(n=>[n,'패자조 2R']),[uf,'승자조 결승 · EWC 진출전'],[low3,'패자조 준결승'],[lf,'패자조 결승 · EWC 진출전']]);
  const edges=[edge(upper[0],{label:'예선 1시드'},w(id(ten?2:1))),...(ten?[edge(upper[2],{label:'예선 2시드'},w(id(1)))]:[]),edge(semi[0],w(upper[0]),w(upper[1])),edge(semi[1],w(upper[2]),w(upper[3])),edge(low[0],l(upper[0]),l(upper[1])),edge(low[1],l(upper[2]),l(upper[3])),edge(low2[0],w(low[0]),l(semi[1])),edge(low2[1],w(low[1]),l(semi[0])),edge(uf,w(semi[0]),w(semi[1])),edge(low3,w(low2[0]),w(low2[1])),edge(lf,l(uf),w(low3))];
  add('ewcRoad','ROAD TO EWC · 한국 예선',s.schedule.filter(m=>m.stage==='EWC 한국 예선').map(m=>m.id),edges,labels);
 }
 const main=ids.ewc||[];
 for(let g=0;g<4;g++){
  const [a,b,lower,upper,decider]=[main[g*2],main[g*2+1],main[8+g],main[12+g],main[16+g]];
  add(`ewcGroup${g}`,`EWC · ${'ABCD'[g]}조`,[a,b,lower,upper,decider],[edge(lower,l(a),l(b)),edge(upper,w(a),w(b)),edge(decider,l(upper),w(lower))],{[a]:'1R · 1경기',[b]:'1R · 2경기',[lower]:'패자전 · 패배 시 탈락',[upper]:'승자전 · 승리 시 8강',[decider]:'최종전 · 승리 시 8강'});
 }
 add('ewcPlayoffs','EWC · 플레이오프',main.slice(20),[edge(main[24],w(main[20]),w(main[21])),edge(main[25],w(main[22]),w(main[23])),edge(main[26],l(main[24]),l(main[25])),edge(main[27],w(main[24]),w(main[25]))],{[main[26]]:'3위 결정전',[main[27]]:'최종 결승'});
 const demacia=s.schedule.filter(m=>m.id.startsWith('demacia-')),dm=n=>`demacia-${n}`;
 add('demaciaOnline','데마시아컵 · 온라인 스위스 / 진출전',demacia.filter(m=>Number(m.id.split('-')[1])<21).map(m=>m.id),[],Object.fromEntries(demacia.map(m=>[m.id,m.round])));
 add('demaciaKnockout','데마시아컵 · 오프라인 8강 / 준결승 / 결승',Array.from({length:7},(_,i)=>dm(21+i)),[edge(dm(25),w(dm(21)),w(dm(22))),edge(dm(26),w(dm(23)),w(dm(24))),edge(dm(27),w(dm(25)),w(dm(26)))]);
 return boards;
}

export function resolvedSlotTeam(room,slot){
 if(slot?.team)return slot.team;
 const prior=slot?.match?room.season.schedule.find(m=>m.id===slot.match):null;
 if(!prior?.result)return null;
 return slot.outcome==='winner'?prior.result.winner:prior.result.winner===prior.teamA?prior.teamB:prior.teamA;
}

function renderBoardChanges(matches,board,labels){
 const completed=matches.filter(m=>m.result),date=completed.map(m=>m.date).sort().at(-1);if(!date)return '';
 const changes=completed.filter(m=>m.date===date).map(m=>{
  const winner=m.result.winner,loser=winner===m.teamA?m.teamB:m.teamA;
  const next=outcome=>board.edges.find(edge=>edge.slots.some(slot=>slot.match===m.id&&slot.outcome===outcome));
  const up=next('winner'),down=next('loser'),label=labels.get(m.id)||'',last=m.id===matches.at(-1).id;
  const qualified=/Playin/.test(board.key)&&last||/진출전|MSI [12]시드/.test(label);
  const winnerStatus=up?`${labels.get(up.id)||'다음 라운드'} 진출`:qualified?'본선 진출':/ewcGroup/.test(board.key)&&/승리 시 8강/.test(label)?'8강 진출':/최종 결승/.test(label)?'대회 우승':'경기 승리';
  const loserStatus=down?`${labels.get(down.id)||'다음 라운드'} 이동`:qualified?'대회 탈락':'경기 패배';
  const score=winner===m.teamA?`${m.result.scoreA}:${m.result.scoreB}`:`${m.result.scoreB}:${m.result.scoreA}`;
  return `<div class="round-change-row"><p><strong>${e(winner)}</strong> <small>${e(score)}</small> · <span class="accent">${e(winnerStatus)}</span></p><p class="note">${e(loser)} · ${e(loserStatus)}</p></div>`;
 }).join('');
 return `<div class="round-changes" data-round-changes><h3>${e(date.slice(5).replace('-','/'))} · 최근 경기일 진출 변동</h3>${changes}</div>`;
}

export function renderBracketBoard(room,board){
 const matches=board.ids.map(id=>room.season.schedule.find(m=>m.id===id)).filter(Boolean);if(!matches.length)return '';
 const edges=board.edges,byId=new Map(matches.map((m,i)=>[m.id,{m,i,depth:0,lower:false}]));
 const metadata=(id,seen=new Set())=>{
  const node=byId.get(id);if(!node||seen.has(id))return {depth:0,lower:false,lowerRound:0};if(node.ready)return node;
  const next=new Set(seen);next.add(id);
  const sources=(edges.find(edge=>edge.id===id)?.slots||[]).filter(slot=>byId.has(slot.match)).map(slot=>({slot,node:metadata(slot.match,next)}));
  node.depth=sources.length?Math.max(...sources.map(x=>x.node.depth))+1:0;
  node.lower=sources.some(x=>x.slot.outcome==='loser'||x.node.lower);node.lowerRound=node.lower?Math.max(0,...sources.filter(x=>x.node.lower).map(x=>x.node.lowerRound||0))+1:0;
  node.grandFinal=sources.length===2&&sources.every(x=>x.slot.outcome==='winner')&&sources.some(x=>x.node.lower)&&sources.some(x=>!x.node.lower);
  node.ready=true;return node;
 };
 for(const m of matches)metadata(m.id);
 const groupMode=matches.every(m=>/그룹/.test(m.round));
 const labels=new Map(matches.map(m=>{
  const n=byId.get(m.id),final=/final$/.test(m.id)||/결승$/.test(m.round),single=/8강|4강/.test(m.round);
  let label=board.labels[m.id];
  if(!label){
   if(final||n.grandFinal)label=/Playin/.test(board.key)?'최종 진출전':'최종 결승';
   else if(single)label=/4강/.test(m.round)?'준결승 · 4강':'8강';
   else if(/그룹/.test(m.round))label=n.depth===0?'그룹 1R':n.lower?(n.lowerRound>1?'그룹 최종전':'그룹 패자전'):'그룹 승자전';
   else label=n.lower?`패자조 ${n.lowerRound}R`:`승자조 ${n.depth+1}R`;
  }
  return [m.id,label];
 }));
 // Lower-bracket final and upper semifinal/final are identified by routing.
 if(!groupMode){
  const upper=matches.filter(m=>!byId.get(m.id).lower&&!byId.get(m.id).grandFinal&&!/final$/.test(m.id)&&!/그룹/.test(m.round)&&!board.labels[m.id]&&!/8강|4강|그룹/.test(m.round));
  const max=Math.max(-1,...upper.map(m=>byId.get(m.id).depth));
  if(max>0)for(const m of upper){const d=byId.get(m.id).depth;if(d===max)labels.set(m.id,'승자조 결승');else if(d===max-1&&d>0)labels.set(m.id,'승자조 준결승');}
  const lower=matches.filter(m=>byId.get(m.id).lower&&!byId.get(m.id).grandFinal&&!/final$/.test(m.id)&&!/그룹/.test(m.round)&&!board.labels[m.id]);
  const maxLower=Math.max(-1,...lower.map(m=>byId.get(m.id).lowerRound));
  if(maxLower>1)for(const m of lower){const d=byId.get(m.id).lowerRound;if(d===maxLower)labels.set(m.id,'패자조 결승');else if(d===maxLower-1)labels.set(m.id,'패자조 준결승');}
 }
 const columnRows=new Map();
 // Swiss pairings are new draws, so their rounds are columns without invented edges.
 const dates=[...new Set(matches.map(m=>m.date))];
 const independent=edges.length===0;
 const separateLanes=[...byId.values()].some(n=>n.lower)&&!matches.some(m=>/그룹|8강|4강/.test(m.round));
 const upperColumns=new Map();
 if(separateLanes)for(const n of byId.values())if(!n.lower)upperColumns.set(n.depth,(upperColumns.get(n.depth)||0)+1);
 const lowerStart=Math.max(1,...upperColumns.values())*170+100;
 for(const m of matches){
  const n=byId.get(m.id);if(independent)n.depth=dates.indexOf(m.date);
  const lane=separateLanes&&n.lower&&!n.grandFinal&&!/final$/.test(m.id)?'lower':'upper',column=`${lane}:${n.depth}`,row=columnRows.get(column)||0;
  n.x=15+n.depth*245;n.y=(lane==='lower'?lowerStart:45)+row*170;columnRows.set(column,row+1);
 }
 const width=Math.max(480,...[...byId.values()].map(n=>n.x+225)),height=Math.max(240,...[...byId.values()].map(n=>n.y+170));
 const paths=edges.flatMap(edge=>{const target=byId.get(edge.id);if(!target)return [];return edge.slots.flatMap((slot,j)=>{
  const source=byId.get(slot.match);if(!source)return [];
  const result=source.m.result,sourceTeam=result?(slot.outcome==='winner'?result.winner:result.winner===source.m.teamA?source.m.teamB:source.m.teamA):null,port=sourceTeam&&sourceTeam===target.m.teamA?0:sourceTeam&&sourceTeam===target.m.teamB?1:j;
  const x=source.x+200,y=source.y+76,tx=target.x,ty=target.y+65+port*32,mid=x+(tx-x)/2;
  return [`<path d="M${x},${y} H${mid} V${ty} H${tx}" class="bracket-edge ${slot.outcome==='loser'?'drop':''}"/>`];
 });}).join('');
 return `<section data-tournament-board="${e(board.key)}"><h3>${e(board.title)}</h3>${renderBoardChanges(matches,board,labels)}<div class="domestic-bracket-scroll" tabindex="0" role="region" aria-label="${e(board.title)} 대진표"><div class="domestic-bracket" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" aria-hidden="true">${paths}</svg>${separateLanes?`<span class="bracket-lane" style="top:15px">UPPER · 승자조${/Road/.test(board.key)?' / 플레이인':''}</span><span class="bracket-lane" style="top:${lowerStart-30}px">LOWER · 패자조</span>`:''}${matches.map(m=>{
  const n=byId.get(m.id),r=m.result,slots=edges.find(edge=>edge.id===m.id)?.slots||[],known=['A','B'].map((side,j)=>m['team'+side]||resolvedSlotTeam(room,slots[j]));
  return `<article class="bracket-node ${r?'completed':''} ${/final$/.test(m.id)?'final':''}" style="left:${n.x}px;top:${n.y}px" data-bracket-match="${e(m.id)}"><header><strong>${e(labels.get(m.id))}</strong><small>${e(m.date.slice(5).replace('-','/'))} · BO${m.bestOf}</small></header>${['A','B'].map((side,j)=>{
   const slot=slots[j],source=byId.get(slot?.match),pending=slot?.label||slot?.team||(source?`M${source.i+1} ${slot.outcome==='winner'?'승자':'패자'}`:/8강/.test(m.round)?'그룹 통과팀 추첨':'진출팀 미정'),team=known[j];
   return `<div class="bracket-team ${r?.winner===team?'winner':''} ${team===room.season.team?'ours':''}"><span>${e(team||pending)}</span><strong>${r?.['score'+side]??'—'}</strong></div>`;
  }).join('')}<small class="bracket-id">M${n.i+1}</small>${r?`<button class="text-link" data-action="watch-match" data-id="${e(m.id)}">경기 기록 →</button>`:`<small class="bracket-pending">${known.every(Boolean)?'대진 확정':known.some(Boolean)?'상대 결정 대기':'대진 확정 대기'}</small>`}</article>`;
 }).join('')}</div></div></section>`;
}

export function activeTournamentState(room){
 const s=room.season;if(s.year!==2026)return null;
 const ranges=[['ewcRoad','2026-05-04','2026-05-26'],['road','2026-06-06','2026-06-14'],['fst','2026-03-16','2026-03-22'],['msiPlayin','2026-06-28','2026-07-01'],['msiMain','2026-07-02','2026-07-12'],['ewc','2026-07-15','2026-07-19'],['worldsPlayin','2026-10-16','2026-10-19'],['worldsSwiss','2026-10-20','2026-11-03'],['worldsKnockout','2026-11-04','2026-11-15'],['demacia','2026-10-03','2026-10-17']];
 const active=ranges.filter(([,from,to])=>s.date>=from&&s.date<=to);
 if(!active.length)return null;
 if(active.length>1&&s.qualifications.demacia?.teams?.includes(s.team))active.sort((a,b)=>Number(b[0]==='demacia')-Number(a[0]==='demacia'));
 const key=active[0][0],boards=tournamentBoards(room).filter(b=>key==='ewc'?s.date<='2026-07-16'?b.key.startsWith('ewcGroup'):b.key==='ewcPlayoffs':key==='demacia'?b.key===(s.date>='2026-10-12'?'demaciaKnockout':'demaciaOnline'):b.key===key);
 const ready=boards.some(b=>b.ids.some(id=>{const m=s.schedule.find(m=>m.id===id);return m?.teamA&&m?.teamB;}));
 return {key,boards,ready};
}
export function renderActiveTournament(room,{resolvedOnly=false}={}){
 const active=activeTournamentState(room);if(!active)return '';
 const {key}=active;const boards=resolvedOnly?active.boards.filter(b=>b.ids.some(id=>{const m=room.season.schedule.find(m=>m.id===id);return m?.teamA&&m?.teamB;})):active.boards;if(!boards.some(b=>b.ids.length))return '';
 return `<section class="panel active-tournament-panel" data-active-tournament="${e(key)}"><div class="panel-header"><h2>대회 대진 · 진출 현황</h2><span class="tag purple">${e(key.startsWith('worlds')?'WORLDS':key==='ewc'?'EWC':key==='fst'?'FIRST STAND':key.startsWith('msi')?'MSI':key==='road'?'ROAD TO MSI':key==='ewcRoad'?'ROAD TO EWC':'DEMACIA CUP')}</span></div><div class="panel-body"><p class="note">연결선을 따라 다음 라운드로 이동합니다. 주황선은 패자조 경로입니다. 가로로 밀어 전체 대진을 볼 수 있습니다.</p>${boards.map(b=>renderBracketBoard(room,b)).join('')}</div></section>`;
}
