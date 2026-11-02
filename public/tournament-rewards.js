import {dailyEffectsText} from './life-events.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qualificationTarget=r=>({road:'MSI',playin:'LCK 플레이오프',cupPlayin:'LCK Cup 플레이오프',msiPlayin:'MSI 본선'})[r.stageKey||String(r.id||'').replace(/^stage-/,'')]||'';
export const tournamentMomentLabel=r=>r.kind==='stage-wrap'?(r.placement==='qualified'?[qualificationTarget(r),'진출 확정'].filter(Boolean).join(' '):'일정 종료'):r.placement==='champion'?'우승':'준우승';
export const tournamentMoments=room=>[...(room?.season.tournamentRewards||[]),...(room?.season.stageWrapUps||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
export function renderTournamentReward(reward,userId){
 if(!reward)return '<p class="note">대회 성적 기록이 없습니다.</p>';
 if(reward.kind==='stage-wrap'){
  const out=reward.placement==='eliminated',pass=reward.placement==='qualified';
  return `<article class="tournament-celebration" data-stage-wrap="${e(reward.id)}"><div class="tournament-medal" aria-hidden="true">${out?'🤝':pass?'↗':'✓'}</div><div class="eyebrow accent">${e(reward.tournament)} · ${e(reward.date)}</div><h3>${out?'이번 대회는 여기까지입니다.':pass?e(tournamentMomentLabel(reward))+'!':'주요 일정을 마쳤습니다.'}</h3><p>${e(reward.team)} · ${e(reward.tournament)} ${out?'탈락':pass?'통과':'종료'}</p>${reward.detail?`<p>${e(reward.detail)}</p>`:''}<div class="stage-dialogue section-gap">${(reward.dialogue||[]).map(line=>`<blockquote><strong>${e(line.speaker)}</strong><p>“${e(line.text)}”</p></blockquote>`).join('')}</div></article>`;
 }
 const won=reward.placement==='champion';
 return `<article class="tournament-celebration" data-tournament-reward="${e(reward.id)}"><div class="tournament-medal" aria-hidden="true">${won?'🏆':'🥈'}</div><div class="eyebrow accent">${e(reward.tournament)} · ${e(reward.date)}</div><h3>${e(reward.team)} ${won?'우승했습니다!':'준우승했습니다!'}</h3><p>${won?'결승을 승리로 마무리했습니다. 대회 우승 트로피를 차지했습니다.':'결승까지 올라 준우승을 기록했습니다. 이번 대회에서 쌓은 경험이 다음 경기로 이어집니다.'}</p><div class="notice section-gap"><strong>${won?'우승의 자신감':'결승 무대의 경험'}</strong><p>${e(dailyEffectsText(reward.players.find(p=>p.userId===userId)?.effects))}</p></div><p class="note section-gap">현재 방의 선수에게 한 번 적용된 보상입니다. 능력치 상승은 이번 시즌에 유지되며, 회복 효과는 현재 상태에 반영됩니다.</p></article>`;
}
