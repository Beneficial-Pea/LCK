const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setSides(set,match){
 const saved=set?.draft?.assignment;
 return saved?.version===1?saved:{blueTeam:match.teamA,redTeam:match.teamB,sideChoiceTeam:null,firstPickChoiceTeam:set?.draft?.selectionRight?.team||null,firstPickTeam:set?.draft?.selectionRight?.team||match.teamA,legacy:true};
}
export function renderSeriesScore(set,match,{scoreA=0,scoreB=0,ownTeam='',live=false}={}){
 const sides=setSides(set,match),blueIsA=sides.blueTeam===match.teamA;
 const team=(name,color)=>`<div class="big-team ${name===ownTeam?'accent':''}" data-score-side="${color}" data-team="${esc(name)}">${esc(name)}<small>${color==='blue'?'블루팀':'레드팀'}</small></div>`;
 return `<div class="big-score" data-series-scoreboard>${team(sides.blueTeam,'blue')}<div class="score-numbers" ${live?'data-live-series-score':''}><span data-series-blue-score>${esc(blueIsA?scoreA:scoreB)}</span> <span>:</span> <span data-series-red-score>${esc(blueIsA?scoreB:scoreA)}</span></div>${team(sides.redTeam,'red')}</div>`;
}
export function renderSetRights(set,match){
 const a=setSides(set,match),team=value=>esc(value||'기록 없음');
 return `<div class="set-rights" data-set-rights><span>진영 선택권 <strong>${team(a.sideChoiceTeam)}</strong></span><span>퍼스트픽 선택권 <strong>${a.mode==='side'?'진영에 따라 결정':team(a.firstPickChoiceTeam)}</strong></span><span>퍼스트픽 <strong>${team(a.firstPickTeam)}</strong></span><small>${esc(a.legacy?'이전 경기의 진영 선택권은 별도로 기록되지 않았습니다.':a.reason)}${a.mode==='rofs'?' · 선지명 팀은 퍼스트픽, 상대 팀은 블루 진영을 자동 선택합니다.':a.mode==='side'?' · 선택권 팀이 블루 진영과 퍼스트픽을 자동 선택합니다.':''}</small></div>`;
}
function sideHeading(team,color){return `<header class="set-side-heading"><span>${color==='blue'?'블루팀':'레드팀'}</span><strong>${esc(team)}</strong></header>`;}
function comfortBadge(comfort){
 if(!comfort||!['signature','main','off-pool'].includes(comfort.kind))return '';
 const label={signature:'시그니처',main:'주력', 'off-pool':'등록 풀 밖'}[comfort.kind];
 return `<span class="champion-comfort champion-comfort--${esc(comfort.kind)}">${label} ${comfort.bonusPercent>0?'+':''}${esc(comfort.bonusPercent)}%</span>`;
}
export function renderSetScoreboard(set,match,{live=false}={}){
 const a=setSides(set,match),rows=set?.scoreboard||[];
 return `<section class="panel set-scoreboard-panel" data-set-scoreboard="${esc(set?.number)}"><div class="panel-header"><h2>SET ${esc(set?.number)} · ${live?'현재 선수 기록':'선수 기록'}</h2><span class="eyebrow">${live?'공개된 교전 집계 · ':''}K / D / A</span></div>${renderSetRights(set,match)}<div class="set-team-grid">${[['blue',a.blueTeam],['red',a.redTeam]].map(([color,team])=>`<section class="set-team ${color}" data-side="${color}" data-team="${esc(team)}">${sideHeading(team,color)}<table class="scoreboard set-team-scoreboard"><thead><tr><th>포지션</th><th>선수 · 챔피언</th><th>K / D / A</th></tr></thead><tbody>${rows.filter(p=>p.team===team).map(p=>`<tr><td>${esc(p.position)}</td><td><strong>${esc(p.nickname)}</strong><div class="champion-detail"><small>${esc(p.champion)}</small>${comfortBadge(p.championComfort)}</div></td><td>${esc(p.k||0)} / ${esc(p.d||0)} / ${esc(p.a||0)}</td></tr>`).join('')}</tbody></table></section>`).join('')}</div></section>`;
}
export function renderSetDraft(set,match,{live=false}={}){
 const a=setSides(set,match),draft=set?.draft;if(!draft)return '';
 return `<section class="panel" data-set-draft><div class="panel-header"><h2>SET ${esc(set.number)} · ${live?'공개된 밴픽':'밴픽 노트'}</h2><span class="tag purple">피어리스 드래프트</span></div>${renderSetRights(set,match)}<div class="set-team-grid set-draft-grid">${[['blue',a.blueTeam],['red',a.redTeam]].map(([color,name])=>{const side=name===match.teamA?'A':'B';return `<section class="set-team ${color}" data-side="${color}">${sideHeading(name,color)}${(draft['picks'+side]||[]).map(p=>`<div class="draft-pick"><span>${esc(p.position)} · ${esc(p.nickname)}</span><strong class="draft-champion"><span class="draft-champion-name">${esc(p.champion)}</span>${comfortBadge(p.comfort)}</strong></div>`).join('')}<div class="bans">BAN ${(draft['bans'+side]||[]).map(esc).join(' / ')||'—'}</div></section>`;}).join('')}</div><div class="panel-body">${draft.rule?`<p class="note">${esc(draft.rule)}</p>`:''}${draft.notes?.length?`<p class="note section-gap">${draft.notes.map(esc).join(' · ')}</p>`:''}</div></section>`;
}
