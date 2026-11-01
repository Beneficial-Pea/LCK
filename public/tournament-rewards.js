import {dailyEffectsText} from './life-events.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderTournamentReward(reward,userId){
 if(!reward)return '<p class="note">대회 성적 기록이 없습니다.</p>';
 const won=reward.placement==='champion';
 return `<article class="tournament-celebration" data-tournament-reward="${e(reward.id)}"><div class="tournament-medal" aria-hidden="true">${won?'🏆':'🥈'}</div><div class="eyebrow accent">${e(reward.tournament)} · ${e(reward.date)}</div><h3>${e(reward.team)} ${won?'우승했습니다!':'준우승했습니다!'}</h3><p>${won?'결승을 승리로 마무리했습니다. 대회 우승 트로피를 차지했습니다.':'결승까지 올라 준우승을 기록했습니다. 이번 대회에서 쌓은 경험이 다음 경기로 이어집니다.'}</p><div class="notice section-gap"><strong>${won?'우승의 자신감':'결승 무대의 경험'}</strong><p>${e(dailyEffectsText(reward.players.find(p=>p.userId===userId)?.effects))}</p></div><p class="note section-gap">현재 방의 선수에게 한 번 적용된 보상입니다. 능력치 상승은 이번 시즌에 유지되며, 회복 효과는 현재 상태에 반영됩니다.</p></article>`;
}
