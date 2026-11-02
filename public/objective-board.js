const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={
 towers:'<path d="M5 3v6l3 3-1 9h10l-1-9 3-3V3h-4v4H9V3z"/>',
 dragons:'<path d="m3 4 6 2 3-4 3 5 6-3-3 9-4 2-2 7-3-7-5-2 4-3z"/>',
 grubs:'<path d="M6 18c-4-5-1-12 5-12s10 5 7 10c-2 4-8 6-12 2Z"/><path d="m7 5-2-3m11 4 3-3M8 12h1m5 0h1M9 16h5"/>',
 barons:'<path d="m3 3 5 3 4-4 4 4 5-3-2 11-7 8-7-8zM8 11h2m4 0h2"/>',
 heralds:'<path d="m4 5 4 2 4-5 4 5 4-2-2 12-6 5-6-5zM8 12h8"/>',
 elders:'<path d="m2 4 7 3 3-5 3 5 7-3-5 11-5 7-5-7zM9 12h6"/>'
};
const labels={dragons:'용',grubs:'유충',towers:'포탑',barons:'바론',heralds:'전령',elders:'장로'};
export function visibleObjectives(events=[],final=null,teams=[]){
 const latest=events.at(-1)?.objectives;if(latest)return latest;
 if(final)return final;
 // Older records did not track tower/grub captures. Do not fabricate them.
 const counts={dragons:[0,0],barons:[0,0],elders:[0,0],towers:[null,null],grubs:[null,null],heralds:[0,0]};
 for(const event of events){const i=teams.indexOf(event.team);if(i<0)continue;
  if(event.objective==='드래곤'||event.objective==='용 영혼')counts.dragons[i]=Number.isFinite(event.dragonCount)?event.dragonCount:counts.dragons[i]+1;
  else if(event.objective==='바론'||event.type==='baron')counts.barons[i]++;
  else if(event.objective==='장로 드래곤')counts.elders[i]++;
  else if(event.objective==='전령')counts.heralds[i]++;
 }
 return counts;
}
export function renderObjectiveBoard({teamA,teamB,events=[],final=null,blueTeam=teamA}){
 const last=events.at(-1),counts=visibleObjectives(events,final,[teamA,teamB]),score=last?.score||[0,0],gold=last?.gold||[2500,2500];
 const blueIndex=blueTeam===teamB?1:0,redIndex=1-blueIndex;
 const side=(name,i,displaySide)=>`<div class="objective-side side-${displaySide}" data-objective-side="${i}" data-team="${e(name)}"><div class="objective-team"><strong>${e(name)}</strong><span><small>GOLD</small> ${(gold[i]/1000).toFixed(1)}k</span></div><div class="objective-primary">${['towers','dragons','grubs'].map(key=>`<span class="objective-stat ${key}" title="${e(labels[key])}" data-objective="${key}" data-count="${counts[key]?.[i]??'unknown'}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg><small>${labels[key]}</small><b>${counts[key]?.[i]??'—'}</b></span>`).join('')}</div><div class="objective-secondary">${['barons','heralds','elders'].map(key=>`<span title="${labels[key]}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>${labels[key]} <b>${counts[key]?.[i]??'—'}</b></span>`).join('')}${counts.dragons?.[i]===4?'<span class="dragon-soul">용 영혼</span>':''}</div></div>`;
 return `<div class="objective-board" data-objective-board aria-label="현재 공개된 경기 오브젝트 현황">${side(blueIndex?teamB:teamA,blueIndex,0)}<div class="objective-center"><small>현재 게임 시간</small><time>${e(last?.time||'00:00')}</time><strong data-live-kill-score>${score[blueIndex]} <span>:</span> ${score[redIndex]}</strong><small>KILLS</small></div>${side(redIndex?teamB:teamA,redIndex,1)}</div>`;
}
