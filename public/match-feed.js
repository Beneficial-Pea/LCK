const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function splitMatchText(event){
 const casting=typeof event.casting==='string'?event.casting.trim():'';
 let situation=String(event.text??'');
 // Older saves appended this exact, separately recorded commentary to text.
 // A later spotlight paragraph may follow it, so preserve both surrounding parts.
 if(casting){const index=situation.indexOf(casting);if(index>=0)situation=(situation.slice(0,index)+situation.slice(index+casting.length)).replace(/ {2,}/g,' ').trim();}
 return {situation,casting};
}

export function renderMatchText(event){
 const {situation,casting}=splitMatchText(event);
 return `${(event.multiKills||[]).map(m=>`<div class="multi-kill-banner multi-${m.count}" data-multikill="${m.count}">${escape(m.label)} · ${escape(m.nickname)}</div>`).join('')}<section class="match-situation"><span class="match-voice-label">상황 기록</span><p>${escape(situation)}</p>${event.flow?.text?`<div class="match-flow" data-match-flow="${escape(event.flow.kind)}"><span>${escape(event.flow.label)}</span><p>${escape(event.flow.text)}</p></div>`:''}</section>${casting?`<blockquote class="match-casting" data-match-casting><span class="match-voice-label">해설 중계</span><p>${escape(casting)}</p></blockquote>`:''}`;
}
