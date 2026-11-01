// Pure presentation helpers: no random decisions or state changes happen here.
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stats = { mechanics: '피지컬', laning: '라인전', macro: '운영', communication: '소통', mental: '멘탈', mastery: '숙련도' };
const positions = { TOP: '탑', JGL: '정글', MID: '미드', ADC: '원딜', SUP: '서포터' };
const types = { 'champion-nerf': '챔피언 너프', 'champion-buff': '챔피언 상향', injury: '컨디션 사건', 'team-synergy': '팀워크', 'npc-incident': '선수단 이슈' };
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatted = value => String(Math.round(number(value) * 10) / 10);
const signed = value => `${number(value) > 0 ? '+' : ''}${formatted(value)}`;
const changes = value => Object.entries(value || {}).filter(([key, delta]) => key in stats && Number.isFinite(Number(delta)) && Number(delta) !== 0);
const changeText = value => changes(value).map(([key, delta]) => `${stats[key]} ${signed(delta)}`).join(' · ');
const eventId = value => value?.eventId || value?.id;

export function effectiveStat(character, key) {
  const value = character?.effectiveStats?.[key] ?? character?.stats?.[key] ?? 0;
  return number(value);
}

function remainingDays(event, turn) {
  const expiry = event.expiresTurn ?? (number(event.turn) + number(event.durationDays));
  return Math.max(0, number(expiry) - turn);
}

export function affectsUs(room, event) {
  const team = room?.season?.team;
  if (!team) return false;
  if ((event.targets || []).some(target => target.team === team)) return true;
  const roster = room.roster || room.players?.map(player => player.character) || [];
  if (roster.some(character => character.eventEffects?.some(effect => eventId(effect) === event.id && number(effect.remainingDays) > 0))) return true;
  // A patch also affects a newly joined signature player while it is active.
  return remainingDays(event, number(room?.season?.turn)) > 0 && event.scope === 'champion' && event.champion && roster.some(character => character.mainChampion === event.champion||event.championPolicy==='pool-v2'&&(character.pool||[]).includes(event.champion));
}

function worldStoryText(value){
 return String(value||'').replace(' 실제 패치 뉴스가 아닌 가상 시즌 사건이다.','').replace(' 가상 시즌 사건이다.','').replace(' 실존 선수의 실제 논란이나 뉴스가 아니다.','').replace('의 가상 선수 ','의 선수 ').replace(' · 가상 인터뷰 해프닝',' · 인터뷰 해프닝');
}

function scopeText(event) {
  if (event.scope === 'champion' && event.champion) return `${event.champion} ${event.championPolicy==='pool-v2'?'시그니처·주력 챔피언 풀':'시그니처'} 선수 전원`;
  if (event.scope === 'team') {
    const teams = [...new Set((event.targets || []).map(target => target.team).filter(Boolean))];
    return `${event.team || teams.join(', ') || '해당 팀'} 선수단`;
  }
  if (event.type === 'npc-incident') return '해당 선수';
  return '해당 선수';
}

function renderTargets(event) {
  const targets = Array.isArray(event.targets) ? event.targets : [];
  if (!targets.length) return '<p class="world-news-target-note">조건에 맞는 선수에게 경기 판정 효과가 적용됩니다.</p>';
  return `<details class="world-news-targets"${targets.length <= 2 ? ' open' : ''}><summary>영향 선수 ${targets.length}명 <span>소속·능력치 확인</span></summary><ul>${targets.map(target => `<li><span class="world-news-player"><strong>${escape(target.nickname || '선수')}</strong><small>${escape(target.team || '소속 미정')} · ${escape(positions[target.position] || target.position || '')}</small></span><span class="world-news-target-change">${escape(changeText(target.statChanges || event.statChanges) || '경기 상태 변화')}</span></li>`).join('')}</ul></details>`;
}

export function renderWorldEvents(room, { limit = 6 } = {}) {
  const season = room?.season || {};
  const world = season.worldEvents || {};
  const turn = number(season.turn);
  const all = Array.isArray(world.events) ? [...world.events] : [];
  all.sort((a, b) => number(b.turn) - number(a.turn));
  const shown = all.slice(0, Math.max(1, Math.min(30, number(limit) || 6)));
  const activeIds = new Set((world.activeEffects || []).filter(effect => number(effect.expiresTurn) > turn).map(eventId));
  for (const event of all) if (remainingDays(event, turn) > 0) activeIds.add(event.id);
  const header = `<div class="panel-header world-news-header"><div><span class="eyebrow">LEAGUE WIRE</span><h2>리그 소식 · 랜덤 이벤트</h2></div><span class="tag ${activeIds.size ? 'purple' : ''}">진행 효과 ${activeIds.size}건</span></div>`;
  const intro = '';
  const feed = shown.length ? `<div class="world-news-feed">${shown.map(event => {
    const days = remainingDays(event, turn), active = days > 0;
    const positive = changes(event.statChanges).some(([, delta]) => number(delta) > 0);
    const negative = changes(event.statChanges).some(([, delta]) => number(delta) < 0);
    const tone = negative ? 'negative' : positive ? 'positive' : 'neutral';
    return `<article class="world-news-item ${tone}${active ? '' : ' is-ended'}" data-world-event="${escape(event.id)}"><div class="world-news-meta"><time>${escape(String(event.date || '').replaceAll('-', '.'))}</time><span class="world-news-kind">${escape(types[event.type] || '시즌 사건')}</span>${affectsUs(room, event) ? '<span class="world-news-ours">우리 팀 영향</span>' : '<span class="world-news-league">다른 팀 소식</span>'}<span class="world-news-duration">${active ? `${days}일 남음` : '효과 종료'}</span></div><h3>${escape(worldStoryText(event.title||'리그 소식'))}</h3><p class="world-news-summary">${escape(worldStoryText(event.summary))}</p><div class="world-news-impact"><span>${escape(scopeText(event))}</span><strong>${escape(event.gradedNerf?'시그니처 라인전 -2 · 주력 풀 라인전 -1':changeText(event.statChanges) || '상태 변화')}</strong><small>${number(event.durationDays)}일간 · ${event.expiresDate ? `${escape(String(event.expiresDate).replaceAll('-', '.'))} 종료` : `턴 ${number(event.expiresTurn)} 종료`}</small></div>${renderTargets(event)}${affectsUs(room,event)?`<button class="button small ghost" data-action="world-event-open" data-id="${escape(event.id)}">우리 팀 영향 보기</button>`:''}</article>`;
  }).join('')}</div>` : '<div class="world-news-empty"><span aria-hidden="true">◇</span><strong>아직 기록된 리그 소식이 없습니다.</strong><p>하루를 정산하면 패치와 선수단 사건이 무작위로 발생합니다.<br>챔피언 너프는 같은 시그니처를 쓰는 상대 선수에게도 적용됩니다.</p></div>';
  const footer = `<div class="panel-footer world-news-footer">${shown.length ? `최근 ${shown.length}건 · 누적 ${all.length}건. ` : ''}일시적 효과는 기본 성장 능력치와 별도로 적용되고 기간이 끝나면 해제됩니다.</div>`;
  return `<section class="panel world-news" data-world-events aria-label="리그 랜덤 이벤트">${header}${intro}${feed}${footer}</section>`;
}

export function renderEventEffects(character) {
  const effects = (character?.eventEffects || []).filter(effect => number(effect.remainingDays) > 0);
  if (!effects.length) return '';
  const keys = [...new Set(effects.flatMap(effect => changes(effect.statChanges).map(([key]) => key)))];
  const statLines = keys.map(key => {
    const base = number(character.stats?.[key]), value = effectiveStat(character, key), diff = value - base;
    return `<span class="world-effective-stat ${diff < 0 ? 'negative' : diff > 0 ? 'positive' : ''}"><span>${stats[key]}</span><span><s>${formatted(base)}</s> → <strong>${formatted(value)}</strong><small>(${signed(diff)})</small></span></span>`;
  }).join('');
  return `<div class="world-player-effects" aria-label="경기 적용 이벤트"><div class="world-effect-heading">이벤트 적용 능력 <small>기본 능력치 보존</small></div><div class="world-effective-stats">${statLines}</div><ul>${effects.map(effect => `<li><span>${escape(effect.title || '시즌 사건')}</span><small>${escape(changeText(effect.statChanges))} · ${number(effect.remainingDays)}일</small></li>`).join('')}</ul></div>`;
}

export function currentWorldTargets(room,event){
 const roster=room.roster||room.players?.map(p=>p.character)||[];
 if(roster.some(c=>Array.isArray(c.eventEffects)))return roster.flatMap(c=>{const effect=c.eventEffects?.find(x=>eventId(x)===event.id&&number(x.remainingDays)>0);return effect?[{id:c.id,nickname:c.nickname,position:c.position,team:c.team,statChanges:effect.statChanges}]:[];});
 return (event.targets||[]).filter(t=>t.team===room.season.team);
}
export function pendingWorldEvents(room){return (room?.season.worldEvents?.events||[]).filter(event=>remainingDays(event,number(room.season.turn))>0&&currentWorldTargets(room,event).length).sort((a,b)=>a.turn-b.turn);}
export function renderWorldEventPopup(room,event){
 if(!event)return '<p class="note">소식 기록을 찾을 수 없습니다.</p>';
 const current=currentWorldTargets(room,event),targets=current.length?current:(event.targets||[]).filter(t=>t.team===room.season.team),days=remainingDays(event,number(room.season.turn));
 return `<article data-world-event-popup="${escape(event.id)}"><div class="eyebrow accent">${escape(event.date)} · ${escape(types[event.type]||'리그 소식')}</div><h3>${escape(worldStoryText(event.title))}</h3><p class="life-event-text">${escape(worldStoryText(event.summary))}</p><div class="notice section-gap"><strong>${escape(room.season.team)} 영향 선수</strong>${targets.map(t=>`<p><b>${escape(t.nickname)}</b> · ${escape(positions[t.position]||t.position)}<br>${escape(changeText(t.statChanges))}</p>`).join('')}<p class="note">${days?`${days}일 남음 · ${escape(event.expiresDate)} 종료`:'효과가 종료된 소식입니다.'}</p></div><p class="note section-gap">일시적 변화는 현재 경기 적용 능력치에 반영되며, 기간이 끝나면 해제됩니다.</p></article>`;
}
