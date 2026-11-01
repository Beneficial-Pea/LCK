import {cupDraftSummary} from './cup-draft.js';
import { renderActiveTournament, resolvedSlotTeam } from './tournament-board.js';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positions={TOP:'탑',JGL:'정글',MID:'미드',ADC:'원딜',SUP:'서포터'};
const statNames={mechanics:'피지컬',laning:'라인전',macro:'운영',communication:'소통',mental:'멘탈',mastery:'숙련도'};
export function backgroundOptions(backgrounds=[],selected='none'){
 const groups=[...new Set(backgrounds.map(b=>b.category||'기본 배경'))];
 return groups.map(category=>`<optgroup label="${e(category)}">${backgrounds.filter(b=>(b.category||'기본 배경')===category).map(b=>`<option value="${e(b.id)}" ${b.id===selected?'selected':''}>${e(b.name)}</option>`).join('')}</optgroup>`).join('');
}
export function backgroundPreview(backgrounds,id){
 const b=backgrounds?.find(b=>b.id===id)||backgrounds?.[0];if(!b)return '';
 return `<p>${e(b.description)}</p><div class="background-stat-preview">${Object.entries(statNames).map(([k,label])=>`<span>${e(label)} <strong>${65+(b.bonuses[k]||0)}</strong>${b.bonuses[k]?` <small>+${b.bonuses[k]}</small>`:''}</span>`).join('')}</div><small>기본 65에 배경 보너스를 한 번 적용한 시작 능력치입니다.</small>`;
}
export function renderPomCard(pom){
 if(!pom)return '';
 return `<section class="panel pom-card" data-match-pom><span class="eyebrow accent">PLAYER OF THE MATCH</span><h3>${e(pom.nickname)} <span class="tag purple">POM</span></h3><p>${e(positions[pom.position]||pom.position)} · ${e(pom.team)} · 시리즈 ${pom.kills}/${pom.deaths}/${pom.assists}</p><p class="note">${(pom.reasons||[]).map(e).join(' · ')}</p></section>`;
}
export function renderSeasonAwards(room){
 const awards=room.season.awards,ceremony=awards?.ceremony;
 const rows=Object.values(awards?.ledger||{}).filter(p=>p.regular.matches).sort((a,b)=>b.regular.pom-a.regular.pom||b.regular.ratingTotal/Math.max(1,b.regular.sets)-a.regular.ratingTotal/Math.max(1,a.regular.sets)||a.playerId.localeCompare(b.playerId));
 const tracked=(awards?.processedIds?.length||0)-(awards?.untrackedMatches||0);
 return `<div class="notice">POM은 시리즈 승리 팀에서 킬 관여·생존·포지션별 기여를 반영해 한 명을 선정합니다. POM 1회는 100포인트입니다. 올해의 선수는 정규시즌 POM 최다 수상자이며, 동률이면 경기 기여도로 결정합니다. 올프로는 포지션별 정규시즌 기록과 출전량을 반영합니다.</div>${ceremony?`<section class="award-winner"><span class="eyebrow accent">${e(room.season.year)} PLAYER OF THE YEAR</span><h2>${e(ceremony.playerOfYear.nickname)}</h2><p>${e(ceremony.playerOfYear.team)} · ${e(positions[ceremony.playerOfYear.position])} · 정규시즌 POM ${ceremony.playerOfYear.regular.pom}회 · ${ceremony.playerOfYear.regular.pom*100}점</p></section><div class="all-pro-grid">${ceremony.allPro.map(t=>`<section class="panel"><div class="panel-header"><h3>ALL-PRO ${e(t.tier)}</h3></div><div class="panel-body">${t.players.map(p=>`<p><span class="position-badge">${e(p.position)}</span> <strong>${e(p.nickname)}</strong><small> · POM ${p.regular.pom}회 · ${p.regular.pom*100}점</small></p>`).join('')}</div></section>`).join('')}</div>`:`<p class="note section-gap">${e(awards?.ceremonyDate||`${room.season.year}-10-01`)} · 월즈 전 시즌 시상식 예정. 아래는 현재까지의 정규시즌 POM 순위입니다.</p>`}<h3 class="section-gap">정규시즌 POM 순위</h3>${rows.length?`<div class="awards-table-wrap"><table class="standings"><thead><tr><th>#</th><th>선수</th><th>포지션</th><th>POM 횟수</th><th>POM 포인트</th></tr></thead><tbody>${rows.slice(0,20).map((p,i)=>`<tr class="${p.team===room.season.team?'ours':''}"><td>${i+1}</td><td>${e(p.nickname)}<small> · ${e(p.team)}</small></td><td>${e(p.position)}</td><td>${p.regular.pom}회</td><td>${p.regular.pom*100}점</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">정규시즌 경기가 끝나면 순위가 쌓입니다.</div>'}<p class="note section-gap">전체 POM 집계 ${tracked}경기 · 시즌 시상식은 정규시즌만 반영 · 올프로 최소 출전: 해당 포지션 최다 출전 세트의 40%${awards?.untrackedMatches?`<br>업데이트 전 ${awards.untrackedMatches}경기는 개인 기록이 없어 집계에서 제외됩니다.`:''}</p>`;
}
export function renderCupProgress(room){
 const s=room.season,t=s.tournaments,groups=t?.cupGroups;if(s.year!==2026||!groups)return '';
 if(['scheduled','drafting'].includes(s.cupDraft?.status))return `<section class="panel section-gap" data-cup-progress><div class="panel-header"><h2>LCK CUP · 미디어데이 그룹 지명</h2><span class="tag">그룹 편성 중 · ${s.cupDraft.picks.length}/8 지명</span></div><div class="panel-body"><p class="note">10개 팀 중 대표 2팀이 번갈아 8팀을 지명합니다. 아직 그룹 배틀은 시작하지 않았습니다.</p><div class="cup-group-grid">${groups.map((teams,i)=>`<section><h3>${i===0?'바론 그룹':'장로 그룹'}</h3><p>${teams.map(e).join(' · ')}</p><p class="note">${5-teams.length}자리 지명 대기</p></section>`).join('')}</div><p class="note">5팀씩 확정된 뒤 그룹 순위표를 표시합니다. 그룹 배틀에서는 바론과 장로 소속 팀이 맞붙습니다.</p></div></section>`;
 const matches=s.schedule||[],ids=t.fixtureIds||{};
 const names=(values)=>values?.length?values.map(e).join(' · '):'그룹 배틀 종료 후 확정';
 const stageTeams=key=>[...new Set(matches.filter(m=>(ids[key]||[]).includes(m.id)&&m.teamA&&m.teamB).flatMap(m=>[m.teamA,m.teamB]))];
 const qualifiers=t.cupPlayinQualifiers||[2,3,4].map(i=>matches.find(m=>m.id===ids.cupPlayin?.[i])?.result?.winner).filter(Boolean);
 const direct=t.cupDirect||[],playin=t.cupPlayinTeams||stageTeams('cupPlayin'),playoffs=t.cupPlayoffTeams||(s.flags?.cupPlayoffSeeded?[...new Set([...direct,...qualifiers])]:[]);
 return `<section class="panel section-gap" data-cup-progress><div class="panel-header"><h2>LCK CUP · 그룹과 진출 현황</h2><span class="tag">${s.flags?.cupPlayoffSeeded?'플레이오프':s.flags?.cupSeeded?'플레이인':'그룹 배틀'}</span></div><div class="panel-body">${cupDraftSummary(s)}<div class="cup-group-grid">${groups.map((teams,i)=>{
  const rows=teams.map(team=>(s.cupStandings||[]).find(p=>p.team===team)||{team,points:0,wins:0,losses:0,setWins:0,setLosses:0}).sort((a,b)=>b.points-a.points||(b.setWins-b.setLosses)-(a.setWins-a.setLosses)||a.team.localeCompare(b.team));
  return `<section><h3>${i===0?'바론 그룹':'장로 그룹'} <span class="tag ${s.flags?.cupSeeded&&t.cupWinningGroup===i?'green':''}">${rows.reduce((n,r)=>n+(r.points||0),0)}점</span></h3><table class="standings"><thead><tr><th>팀</th><th>승</th><th>패</th><th>득실</th><th>점수</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.team===s.team?'ours':''}"><td>${e(r.team)}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.setWins-r.setLosses>0?'+':''}${r.setWins-r.setLosses}</td><td>${r.points||0}</td></tr>`).join('')}</tbody></table></section>`;
 }).join('')}</div><p class="note">그룹 합산 점수로 승리 그룹을 결정합니다. 마지막 주 BO5 승리는 2점입니다.</p><div class="cup-advancement"><div><span class="eyebrow accent">플레이오프 직행 · 3팀</span><p>${names(direct)}</p></div><div><span class="eyebrow">플레이인 참가 · 6팀</span><p>${names(playin)}</p></div><div><span class="eyebrow">플레이인 통과 · 3팀</span><p>${qualifiers.length?names(qualifiers):'플레이인 결과에 따라 확정'}</p></div><div><span class="eyebrow accent">플레이오프 진출 · 6팀</span><p>${playoffs.length?names(playoffs):'직행 3팀 + 플레이인 통과 3팀'}</p></div></div></div></section>`;
}

export function domesticAdvancements(room,key){
 const s=room.season,cup=key.startsWith('cup'),playin=key.toLowerCase().includes('playin'),ids=s.tournaments?.fixtureIds?.[key]||[],edges=s.tournaments?.templates?.[key]||[];
 return ids.map((id,i)=>{
  const m=s.schedule.find(m=>m.id===id);if(!m?.result)return null;
  const winner=m.result.winner,loser=winner===m.teamA?m.teamB:m.teamA;
  let winnerStatus,loserStatus;
  if(playin){
   winnerStatus=cup?(i>=2?'플레이오프 진출':'플레이인 2R 진출'):(i===0||i===2?'플레이오프 진출':'플레이인 최종 진출전 이동');
   loserStatus=cup?(i===2||i===3?'플레이인 최종 진출전 이동':'플레이인 탈락'):(i===0?'플레이인 최종 진출전 이동':'플레이인 탈락');
  }else{
   const destination=outcome=>edges.find(edge=>edge.slots.some(slot=>slot.match===id&&slot.outcome===outcome));
   const nextWin=destination('winner'),nextLoss=destination('loser');
   winnerStatus=nextWin?`${playoffLabels[ids.indexOf(nextWin.id)]} 진출`:i===ids.length-1?'대회 우승':'경기 승리';
   loserStatus=nextLoss?`${playoffLabels[ids.indexOf(nextLoss.id)]} 이동`:i===ids.length-1?'준우승':'대회 탈락';
  }
  return {matchId:id,date:m.date,winner,loser,winnerStatus,loserStatus,score:winner===m.teamA?`${m.result.scoreA}:${m.result.scoreB}`:`${m.result.scoreB}:${m.result.scoreA}`};
 }).filter(Boolean);
}
function renderDomesticChanges(room,key){
 let rows=domesticAdvancements(room,key),prior=false;
 if(!rows.length&&!key.toLowerCase().includes('playin')){rows=domesticAdvancements(room,key.startsWith('cup')?'cupPlayin':'playin');prior=true;}
 const date=rows.map(r=>r.date).sort().at(-1);if(!date)return '';
 return `<div class="round-changes" data-round-changes><h3>${e(date.slice(5).replace('-','/'))} · ${prior?'플레이인 최종 결과':'최근 경기일 진출 변동'}</h3>${rows.filter(r=>r.date===date).map(r=>`<div class="round-change-row"><p><strong>${e(r.winner)}</strong> <small>${e(r.score)}</small> · <span class="accent">${e(r.winnerStatus)}</span></p><p class="note">${e(r.loser)} · ${e(r.loserStatus)}</p></div>`).join('')}</div>`;
}

const playoffLabels=['승자조 1R · 1경기','승자조 1R · 2경기','승자조 준결승 · 1경기','승자조 준결승 · 2경기','패자조 1R','패자조 2R','승자조 결승','패자조 3R','패자조 결승','최종 결승'];
export function renderDomesticBracket(room,key){
 const s=room.season,t=s.tournaments,ids=t?.fixtureIds?.[key]||[],matches=ids.map(id=>s.schedule.find(m=>m.id===id)).filter(Boolean);
 if(!matches.length)return '';
 const cup=key.startsWith('cup'),playin=key.toLowerCase().includes('playin'),labels=playin?matches.map((_,i)=>i===matches.length-1?'최종 진출전':`플레이인 ${Math.floor(i/2)+1}R · ${i%2+1}경기`):playoffLabels;
 const coords=playin?(cup?[[15,65],[15,300],[265,65],[265,300],[515,185]]:[[15,65],[15,300],[265,185]]):[[15,65],[15,235],[245,65],[245,235],[245,470],[475,470],[475,150],[705,470],[935,470],[1165,260]];
 const width=playin?(cup?745:495):1395,height=playin?490:665,nodeWidth=200;
 const edges=t.templates?.[key]||(!cup&&playin?[{id:ids[2],slots:[{match:ids[1],outcome:'winner'},{match:ids[0],outcome:'loser'}]}]:[]);
 const byId=new Map(matches.map((m,i)=>[m.id,{m,i,point:coords[i]}]));
 const lines=edges.flatMap(edge=>{
  const target=byId.get(edge.id);if(!target)return [];
  return edge.slots.flatMap((slot,j)=>{
   const source=byId.get(slot.match);if(!source)return [];
   const [sx,sy]=source.point,[tx,ty]=target.point,x1=sx+nodeWidth,y1=sy+72,x2=tx,y2=ty+55+j*32,middle=x1+(x2-x1)/2;
   return [`<path d="M${x1},${y1} H${middle} V${y2} H${x2}" class="bracket-edge ${slot.outcome==='loser'?'drop':''}"/>`];
  });
 }).join('');
 const sourceText=(m,j)=>{
  const slot=edges.find(edge=>edge.id===m.id)?.slots[j];
  if(slot?.team)return slot.team;
  if(slot?.match){const resolved=resolvedSlotTeam(room,slot);if(resolved)return resolved;const prior=byId.get(slot.match);return `${labels[prior?.i]||'이전 경기'} ${slot.outcome==='winner'?'승자':'패자'}`;}
  return '진출팀 미정';
 };
 const title=`${cup?'LCK CUP':'LCK'} · ${playin?'플레이인':'플레이오프'}`;
 const direct=cup?t.cupDirect:t.playoffDirect,participants=cup?(playin?t.cupPlayinTeams:t.cupPlayoffTeams):(playin?t.playinSeeds:t.playoffSeeds);
 const playinIds=t.fixtureIds[cup?'cupPlayin':'playin']||[],qualified=(cup?[2,3,4]:[0,2]).map(i=>s.schedule.find(m=>m.id===playinIds[i])?.result?.winner).filter(Boolean);
 return `<section class="panel domestic-bracket-panel" data-lck-stage="${e(key)}"><div class="panel-header"><h2>${e(title)}</h2><span class="tag purple">${playin?'진출전':'DOUBLE ELIMINATION'}</span></div><div class="panel-body"><p class="note">${participants?.length?`참가: ${participants.map(e).join(' · ')}<br>`:''}${direct?.length?`플레이오프 직행: ${direct.map(e).join(' · ')}<br>`:''}${qualified?.length?`플레이인 통과: ${qualified.map(e).join(' · ')}<br>`:''}대진표를 가로로 밀어 다음 라운드와 결승을 확인하세요. 주황 연결선은 패자조 이동입니다.</p>${renderDomesticChanges(room,key)}<div class="domestic-bracket-scroll" tabindex="0" role="region" aria-label="${e(title)} 대진표"><div class="domestic-bracket" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" aria-hidden="true">${lines}</svg>${!playin?'<span class="bracket-lane upper">UPPER · 승자조</span><span class="bracket-lane lower">LOWER · 패자조</span>':''}${matches.map((m,i)=>{
  const [x,y]=coords[i],r=m.result,known=['A','B'].map((side,j)=>m['team'+side]||resolvedSlotTeam(room,edges.find(edge=>edge.id===m.id)?.slots[j]));
  return `<article class="bracket-node ${r?'completed':''} ${i===matches.length-1?'final':''}" style="left:${x}px;top:${y}px" data-bracket-match="${e(m.id)}"><header><strong>${e(labels[i])}</strong><small>${e(m.date.slice(5).replace('-','/'))} · BO${m.bestOf}</small></header>${['A','B'].map((side,j)=>{const team=known[j],score=r?.['score'+side];return `<div class="bracket-team ${r?.winner===team?'winner':''} ${team===s.team?'ours':''}"><span>${e(team||sourceText(m,j))}</span><strong>${score??'—'}</strong></div>`;}).join('')}${r?`<button class="text-link" data-action="watch-match" data-id="${e(m.id)}">경기 기록 →</button>`:`<small class="bracket-pending">${known.every(Boolean)?'대진 확정':known.some(Boolean)?'상대 결정 대기':'대진 확정 대기'}</small>`}</article>`;
 }).join('')}</div></div>${!playin&&matches.at(-1)?.result?`<p class="domestic-champion">${e(cup?'LCK CUP':'LCK')} 우승 · <strong>${e(matches.at(-1).result.winner)}</strong></p>`:''}</div></section>`;
}

export function renderLckStandings(room,regularTable){
 const s=room.season,active=renderActiveTournament(room);
 if(active)return active;
 if(s.year===2026){
  if(s.date<'2026-04-01'){
   if(s.flags?.cupPlayoffSeeded)return renderDomesticBracket(room,'cupPlayoffs');
   if(s.flags?.cupSeeded)return renderDomesticBracket(room,'cupPlayin');
   return renderCupProgress(room);
  }
  if(s.date>='2026-08-24'&&s.flags?.playinSeeded)return renderDomesticBracket(room,s.flags?.playoffSeeded?'playoffs':'playin');
 }
 return `<section class="panel" data-lck-stage="regular"><div class="panel-header"><h2>LCK 순위</h2><span class="eyebrow">REGULAR SEASON</span></div>${regularTable}</section>`;
}

export function renderReadiness(c,{open=false}={}){
 const r=c.readiness;if(!r)return '';
 const lost=Math.max(0,(1-r.conditionFactor)*100),growth=Math.round((1-r.growthFactor)*100);
 return `<details ${open?'open':''} class="player-readiness ${r.tier==='양호'?'':'debuff'}" data-player-readiness><summary><span class="tag ${r.tier==='양호'?'green':'red'}">${e(r.tier)}</span><strong>경기력 보정</strong><span class="readiness-toggle" aria-hidden="true"></span></summary><div class="readiness-body"><p>컨디션 ${Math.round(c.condition)} · 능력 반영 −${lost.toFixed(1)}%<br>피로 ${Math.round(c.fatigue)} · 경기력 −${r.fatiguePenalty.toFixed(1)} / 스트레스 ${Math.round(c.stress)} · 경기력 −${r.stressPenalty.toFixed(1)}</p><small>${growth?`피로 누적으로 훈련 성장량 ${growth}% 감소. `:'훈련 성장량 100%. '}휴식·산책으로 회복할 수 있습니다. 기본 능력치는 유지됩니다.</small></div></details>`;
}
