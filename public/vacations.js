const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderVacationPanel(room,userId,isHost){
 const v=room.vacation;if(!v)return '';
 const records=(room.season.vacations?.entries||[]).filter(x=>x.userId===userId).slice(0,4);
 return `<section class="panel vacation-panel"><div class="today-hero"><div class="eyebrow accent">TEAM VACATION · 선수단 휴가</div><h2>${e(v.title)}</h2><p class="today-copy">${e(v.start)} — ${e(v.end)} · ${e(v.remainingDays)}일 남음<br>각자의 시간을 보내고 다시 만납니다. 휴가 중에는 훈련과 대화 선택 없이 하루를 넘깁니다.</p></div><div class="panel-body">${records.length?records.map(x=>`<article class="vacation-memory"><small>${e(x.date)}</small><p>${e(x.description)}</p></article>`).join(''):'<p class="note">짐을 챙겨 각자의 휴가를 떠났습니다. 하루를 넘기면 쉬는 동안의 이야기가 기록됩니다.</p>'}</div><div class="settle-box">${isHost?'<button class="button primary" data-action="vacation-day">휴가 하루 보내기 →</button><button class="button ghost" data-action="vacation-end">남은 휴가 넘기기 ↗</button>':'<p class="note">방장이 휴가를 넘기면 모두의 일정과 기록이 함께 반영됩니다.</p>'}</div></section>`;
}
