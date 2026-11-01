import {normalizeTeamDisplay,teamDisplayText} from './team-display.js';
import {renderObjectiveBoard} from './objective-board.js';
import {renderTournamentReward,tournamentMoments,tournamentMomentLabel} from './tournament-rewards.js';
import {renderLifeEvent,renderLifePending,dailyEffectsText} from './life-events.js';
import {renderStrategyBreak,renderScrims,renderDedicatedDay} from './training.js';
import {renderNotices} from './notices.js';
import {renderCupMedia} from './cup-draft.js';
import { renderAuthPage, renderInvitationPage } from './auth.js';
import { backgroundOptions, backgroundPreview, renderPomCard, renderSeasonAwards, renderLckStandings, renderLeagueStandings, renderTournamentStandings, renderReadiness } from './honors.js';
import { renderVacationPanel } from './vacations.js';
import { renderEwcCard, renderEwcTournament } from './ewc.js';
import { renderMatchText } from './match-feed.js';
import { renderDemaciaCard, renderDemaciaTournament } from './demacia.js';
import { renderLocationScene } from './scenes.js';
import { renderWorldEvents, renderEventEffects, effectiveStat, pendingWorldEvents, renderWorldEventPopup } from './world-events.js';

const $ = (s, p = document) => p.querySelector(s);
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function playerLabel(c) { const n=c?.nickname||'';const t=c?.team;if(!t||n.startsWith(t+' '))return n;return `${displayTeam(t)} ${n}`; }
const roundLabel=m=>m?.id?.startsWith('cup-group')?`그룹 배틀 · ${m.round||''}${m.bestOf===5?' · 슈퍼위크':''}`:m?.round||'';
const posName = {TOP:'탑',JGL:'정글',MID:'미드',ADC:'원딜',SUP:'서포터'};
const statName = {mechanics:'피지컬',laning:'라인전',macro:'운영',communication:'소통',mental:'멘탈',mastery:'챔피언 숙련'};
const styleNames = ['균형 운영','초반 주도권','한타','사이드 운영'];
const actionIcons = {mechanics:'⌘',laning:'⚑',analysis:'⌕',duo:'⇄',team:'▥',rest:'☾',walk:'↗'};
const icons = {
 home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
 match:'<path d="m4 3 16 18M20 3 4 21M3 4l4-1 1 4M21 4l-4-1-1 4M3 17l4 4 3-3M21 17l-4 4-3-3"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2m4 0h2m2 0h1M7 17h2m4 0h2"/>',
 roster:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4c0-4 12-4 12 0v4M16 4a3 3 0 0 1 0 6m2 4c3 0 3 3 3 6"/>',
 dorm:'<path d="m3 10 9-7 9 7M5 9v12h14V9M8 15h8v6M8 11h2m4 0h2"/>',
 chat:'<path d="M4 3h16v13H9l-5 5z"/><path d="M8 7h8M8 11h5"/>',
 slots:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 18h7m-3-4v7"/>',
 lobby:'<path d="M3 21V5h18v16M7 21v-8h10v8M7 8h1m4 0h1m4 0h1M11 17h2"/>',
 invites:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 5 9 7 9-7"/>',
 notices:'<path d="M4 4h16v16H4zM7 8h10M7 12h10M7 16h6"/>',
 rules:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name==='owner'?'chat':name] || icons.home}</svg>`;
const nav = [['home','오늘의 일정'],['match','경기 센터'],['calendar','시즌 캘린더'],['roster','선수단'],['dorm','숙소 생활']];
const state = {session:null,meta:{actions:[],teams:[],positions:[]},room:null,view:'home',slot:0,selectedAction:'analysis',month:'2026-01',selectedDate:null,matchId:null,setIndex:0,eventCount:1,playing:false,chat:'team',dmTo:'',modal:null,busy:false,pendingRender:false,liveSetNumber:null};
const signupParams=new URLSearchParams(location.search),initialInvitation=(signupParams.get('invite')||'').slice(0,128);
state.notices=[];state.noticeEditor=null;state.noticeDelete=null;
state.auth={mode:initialInvitation?'register':'login',invitation:initialInvitation,status:{}};state.invitations=[];state.invitationIssued=null;
if(signupParams.has('invite')){signupParams.delete('invite');history.replaceState(null,'',location.pathname+(signupParams.toString()?'?'+signupParams.toString():'')+location.hash);}
const dismissedLifeEvents=new Set();
try{const saved=JSON.parse(localStorage.getItem('first-team.life-dismissed')||'[]');if(Array.isArray(saved))for(const key of saved.slice(-200))if(typeof key==='string')dismissedLifeEvents.add(key);}catch{}
function pendingLifeEvent(){const room=state.room;if(!room||waitingRoom(room)||room.broadcast||room.vacation||room.season.finished||room.season.draft||['scheduled','drafting'].includes(room.season.cupDraft?.status))return null;return room.season.dailyLife?.entries.find(x=>x.userId===state.session?.user.id&&!x.answer&&x.turn===room.season.turn-1)||null;}
function lifeEventKey(entry){return `${state.room.code}:${state.room.season.id}:${state.session.user.id}:${entry.id}`;}
function maybeOpenLifeEvent(){if(state.modal||!['home','dorm'].includes(state.view))return false;const entry=pendingLifeEvent();if(!entry||dismissedLifeEvents.has(lifeEventKey(entry)))return false;state.modal={kind:'life-event',entryId:entry.id,seasonId:state.room.season.id,turn:state.room.season.turn,key:lifeEventKey(entry)};return true;}
const seenTournamentRewards=new Set();
try{const saved=JSON.parse(localStorage.getItem('first-team.title-seen')||'[]');if(Array.isArray(saved))for(const key of saved.slice(-200))if(typeof key==='string')seenTournamentRewards.add(key);}catch{}
function tournamentRewardKey(reward){return `${state.room.code}:${state.room.season.id}:${state.session.user.id}:${reward.id}`;}
function maybeOpenTournamentReward(){
 if(state.modal||!state.room||waitingRoom()||state.room.broadcast)return false;
 const reward=tournamentMoments(state.room).find(r=>r.players.some(p=>p.userId===state.session.user.id)&&!seenTournamentRewards.has(tournamentRewardKey(r)));
 if(!reward)return false;state.modal={kind:'tournament-reward',rewardId:reward.id,key:tournamentRewardKey(reward)};return true;
}
function renderTournamentResults(){return tournamentMoments(state.room).filter(r=>r.players.some(p=>p.userId===state.session.user.id)).slice(-3).reverse().map(r=>`<div class="notice section-gap"><div class="row between"><strong>${e(r.tournament)} · ${e(tournamentMomentLabel(r))}</strong><button class="button small" data-action="tournament-reward" data-id="${e(r.id)}">${r.kind==='stage-wrap'?'선수단 대화 보기':'성적 보상 보기'}</button></div></div>`).join('');}
const seenWorldEvents=new Set();
try{const saved=JSON.parse(localStorage.getItem('first-team.world-seen')||'[]');if(Array.isArray(saved))for(const key of saved.slice(-200))if(typeof key==='string')seenWorldEvents.add(key);}catch{}
function worldEventKey(event){return `${state.room.code}:${state.room.season.id}:${state.session.user.id}:${event.id}`;}
function maybeOpenWorldEvent(){if(state.modal||!state.room||waitingRoom()||state.room.broadcast)return false;const event=pendingWorldEvents(state.room).find(e=>!seenWorldEvents.has(worldEventKey(e)));if(!event)return false;state.modal={kind:'world-event',eventId:event.id,key:worldEventKey(event)};return true;}
let readinessOpen=false;
try{readinessOpen=localStorage.getItem('first-team.readiness-open')==='1';}catch{}
document.addEventListener('toggle',event=>{const panel=event.target;if(!panel.matches?.('details[data-player-readiness]'))return;readinessOpen=panel.open;try{localStorage.setItem('first-team.readiness-open',readinessOpen?'1':'0');}catch{}for(const other of document.querySelectorAll('details[data-player-readiness]'))if(other!==panel&&other.open!==readinessOpen)other.open=readinessOpen;},true);
let roomPollTimer;
let toastTimer, playbackTimer, sceneMoveTimer, sceneMoveVersion=0, pendingSceneMove=null, portraitDrag=null, lastRoomPoll=0, roomPollInFlight=false;

async function api(path, options = {}) {
 const response = await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body === undefined ? undefined : JSON.stringify(options.body)});
 if (response.status === 304) return null;
 let data;
 try { data = await response.json(); } catch { throw new Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
 if (!response.ok){const error=Object.assign(new Error(typeof data.error==='string'?data.error:data.error?.message||data.message||`요청에 실패했습니다 (${response.status}).`),{status:response.status});if(response.status===401&&!/^\/api\/auth\/(login|register|logout)$/.test(path)){resetLoginState();renderAuth();}throw error;}
 return data;
}
function toast(text, error=false) {
 const el=$('#toast'); el.textContent=teamDisplayText(text,gameYear()); el.className=`show${error?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',5000);
}
function safePortrait(value) {
 return typeof value==='string' && value.length<90000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}
function portrait(character, size='small') {
 const source=safePortrait(character?.avatar),name=character?.nickname||character?.name||'선수';
 return source?`<img class="player-portrait ${size}" src="${e(source)}" alt="${e(name)} 프로필 사진" loading="lazy">`:`<span class="player-portrait ${size} portrait-fallback" role="img" aria-label="${e(name)} 기본 프로필">${e(name.slice(0,1))}</span>`;
}
let dockChannel=localStorage.getItem('first-team.dock-channel')==='team'?'team':'owner';
let ownerDockOpen=localStorage.getItem('first-team.owner-dock')==='1';
const ownerDrafts=new Map();
function refreshOwnerDock(force=false){
 let dock=$('#owner-dock');
 if(!state.room||!state.session){dock?.remove();return;}
 const code=state.room.code,draftKey=code+":"+dockChannel,key=`first-team.owner-seen:${state.session.user.id}:${code}:${dockChannel}`;
 const messages=(state.room.messages||[]).filter(m=>m.channel===dockChannel);
 const last=messages.at(-1)?.id||0;
 let seen=Number(localStorage.getItem(key)||0);
 if(ownerDockOpen){seen=last;localStorage.setItem(key,String(last));}
 const unread=(state.room.messages||[]).filter(m=>['owner','team'].includes(m.channel)&&m.senderId!==state.session.user.id&&m.id>Number(localStorage.getItem(`first-team.owner-seen:${state.session.user.id}:${code}:${m.channel}`)||0)).length;
 if(!dock){dock=document.createElement('aside');dock.id='owner-dock';document.body.append(dock);force=true;}
 if(force||dock.dataset.room!==code||dock.dataset.open!==String(ownerDockOpen)||dock.dataset.channel!==dockChannel||dock.dataset.team!==String(state.room.season.team||'')){
  dock.dataset.team=String(state.room.season.team||'');dock.dataset.channel=dockChannel;dock.dataset.room=code;dock.dataset.open=String(ownerDockOpen);
  dock.innerHTML=ownerDockOpen?`<section class="owner-dock-panel" aria-label="채팅창"><header><div><strong>채팅</strong><small>${dockChannel==='owner'?'실제 참가자 대화':'선수 캐릭터 대화'} · ${e(state.room.name)}</small></div><button type="button" data-owner-toggle aria-label="오너 채팅 접기">—</button></header><div class="dock-tabs" role="tablist"><button type="button" data-dock-channel="owner" role="tab" aria-selected="${dockChannel==='owner'}">오너칸</button><button type="button" data-dock-channel="team" role="tab" aria-selected="${dockChannel==='team'}">${e(displayTeam(state.room.season.team)||'선수단')} 카톡방</button></div><div class="owner-dock-log" role="log" aria-label="오너 대화 기록"></div><form data-form="owner-dock"><label class="sr-only" for="owner-dock-text">오너 메시지</label><textarea id="owner-dock-text" name="text" rows="2" maxlength="2000" placeholder="게임을 보면서 이야기하기…" required>${e(ownerDrafts.get(draftKey)||'')}</textarea><div><small>${e(dockChannel==='owner'?state.session.user.name:playerLabel(me()?.character))} · ${dockChannel==='owner'?'오너':'선수'}로 전송</small><button class="button primary small" type="submit">전송</button></div></form></section>`:`<button class="owner-dock-launcher" type="button" data-owner-toggle aria-expanded="false">◇ 채팅 <span data-owner-unread></span></button>`;
 }
 if(!ownerDockOpen){const badge=$('[data-owner-unread]',dock);if(badge)badge.textContent=unread?String(unread):'';return;}
 const list=$('.owner-dock-log',dock),follow=list.scrollHeight-list.scrollTop-list.clientHeight<50;
 const signature=messages.map(m=>m.id).join(',');
 if(list.dataset.messages!==signature){list.dataset.messages=signature;list.innerHTML=messages.length?messages.map(m=>`<article class="${m.senderId===state.session.user.id?'own':''}"><div><strong>${e(dockChannel==='team'&&state.room.players.find(p=>p.userId===m.senderId)?playerLabel(state.room.players.find(p=>p.userId===m.senderId).character):m.senderName)}</strong><time>${new Date(m.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div><p>${e(m.text)}</p></article>`).join(''):'<p class="owner-dock-empty">일정과 잡담을 편하게 나눠보세요.<br>선수 관계나 경기 판정에는 반영되지 않습니다.</p>';if(follow||force)list.scrollTop=list.scrollHeight;}
 normalizeTeamUI(dock);
}
document.addEventListener('click',event=>{const tab=event.target.closest('[data-dock-channel]');if(tab){dockChannel=tab.dataset.dockChannel;localStorage.setItem('first-team.dock-channel',dockChannel);refreshOwnerDock(true);return;}if(event.target.closest('[data-owner-toggle]')){ownerDockOpen=!ownerDockOpen;localStorage.setItem('first-team.owner-dock',ownerDockOpen?'1':'0');refreshOwnerDock(true);}});
document.addEventListener('input',event=>{if(event.target.id==='owner-dock-text'&&state.room)ownerDrafts.set(state.room.code+":"+dockChannel,event.target.value);});
function clubActivityHTML(event){
 return `<article class="club-appointment" data-club-event="${e(event.id)}"><div class="row between"><strong>${e(event.title)}</strong><span class="tag ${event.status==='completed'?'':'blue'}">${event.status==='completed'?'참여 완료':e(event.category)}</span></div><small>${e(event.date)} · ${e(event.location)}</small><p>${e(event.status==='completed'?event.text:'팀 전원 참여 일정입니다. 하루 정산이나 자동 진행으로 넘기면 활동 기록이 남습니다.')}</p><small>활동에 따른 피로 ${event.fatigue>0?'+':''}${e(event.fatigue)} · 스트레스 ${event.stress>0?'+':''}${e(event.stress)}</small></article>`;
}
function renderClubAgenda(){
 const s=state.room.season,events=state.room.clubSchedule||[],next=events.filter(x=>x.status==='scheduled'&&x.date>=s.date).slice(0,3),recent=events.filter(x=>x.status==='completed').slice(-2).reverse();
 if(!events.length)return '';
 return `<section class="panel section-gap club-agenda"><div class="panel-header"><h2>경기장 밖의 고정 일정</h2><button class="text-link" data-action="nav" data-view="calendar">캘린더 →</button></div><div class="panel-body"><p class="note">광고·화보·인터뷰·팬 행사는 자동 진행으로 넘겨도 참여 기록이 남습니다. 우리 팀 경기와 상세 스크림 당일에만 멈춥니다.</p>${next.map(clubActivityHTML).join('')}${recent.length?`<h3 class="section-gap">최근 참여 기록</h3>${recent.map(clubActivityHTML).join('')}`:''}</div></section>`;
}
function renderDailyStories(){
 if(state.room?.vacation)return '';
 const life=state.room?.season.dailyLife,items=(life?.entries||[]).filter(x=>x.userId===state.session.user.id).slice(0,5);
 return `<section class="panel section-gap"><div class="panel-header"><h2>숙소에서 있었던 일</h2><span class="tag">팀원과 쌓이는 일상</span></div><div class="panel-body">${items.length?items.map(x=>`<article class="life-story"><small>${e(x.date)} · ${e(x.location)} · ${e(x.partnerName)}</small><h3>${e(x.title)}</h3><p>${e(x.text)}</p>${x.incidentEffects?`<p class="note">발생한 변화 · ${e(dailyEffectsText(x.incidentEffects))}</p>`:''}${x.answer?`<p class="accent">${e(x.reply)}</p>${x.effects?`<p class="note">${e(dailyEffectsText(x.effects))}</p>`:''}`:x.turn===state.room.season.turn-1?`<div class="row"><button class="button small" data-action="life-open" data-entry="${e(x.id)}">선택지 열기</button></div>`:'<small>이날의 기록으로 남았습니다.</small>'}</article>`).join(''):'<p class="note">경기 없는 날을 정산하면 선택한 행동과 현재 장소에서 팀원과의 이야기가 생깁니다. 다음 날이 넘어가기 전에 답해 보세요.</p>'}${Object.values(life?.bonds||{}).filter(b=>b.userId===state.session.user.id).map(b=>`<span class="tag">${e(b.targetName)} · 친밀도 ${b.affinity} · 함께한 일 ${b.encounters}회</span>`).join('')}</div></section>`;
}
function portraitEditor(character) {
 const crop=normalizePortraitCrop(state.modal.avatarCrop),available=Boolean(state.modal.avatarSource);
 return `<div class="portrait-editor crop-editor"><div id="portrait-preview"><div id="portrait-crop-frame" tabindex="${available?'0':'-1'}" role="group" aria-label="사진에 보일 부분. 드래그로 위치를 옮기고 확대 슬라이더로 조절하세요." aria-describedby="portrait-crop-help" class="${available?'has-photo':''}">${portrait({...character,avatar:state.modal.avatar},'large')}</div><p class="note portrait-frame-label">프로필에 표시될 영역</p></div><div class="portrait-editor-controls"><strong>프로필 사진 · 보이는 부분 설정</strong><p class="note" id="portrait-crop-help">사진을 드래그해 위치를 옮기고 확대를 조절하세요. 저장하면 미리보기 그대로 적용됩니다.</p><div class="row"><label class="button small" for="portrait-file">사진 선택<input class="sr-only" type="file" id="portrait-file" data-portrait-file accept="image/png,image/jpeg,image/webp"></label><button class="button small ghost" type="button" data-action="remove-portrait">사진 삭제</button></div><div class="portrait-crop-sliders">${[['zoom','확대',1,4,.05,crop.zoom,'배']].map(([key,label,min,max,step,value,unit])=>`<div class="portrait-crop-control"><label for="portrait-crop-${key}">${label}<output id="portrait-value-${key}">${key==='zoom'?Number(value).toFixed(2):value}${unit}</output></label><input id="portrait-crop-${key}" data-portrait-control="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-valuetext="${value}${unit}" ${available?'':'disabled'}></div>`).join('')}</div><button class="button small ghost portrait-reset" type="button" data-action="reset-portrait-crop" ${available?'':'disabled'}>위치·확대 초기화</button><p class="note" id="portrait-status" aria-live="polite">${state.modal.avatar?'등록된 사진을 다시 조절할 수 있습니다.':'사진이 없으면 닉네임 첫 글자를 표시합니다.'}</p><p class="note portrait-file-note">PNG · JPG · WebP / 원본 최대 8MB. 편집용 사진과 표시 사진을 작게 저장합니다.</p></div></div>`;
}
function normalizePortraitCrop(value) {
 const bounded=(n,min,max,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
 return {x:bounded(value?.x,0,1,.5),y:bounded(value?.y,0,1,.5),zoom:bounded(value?.zoom,1,4,1)};
}
function portraitImage(source) {
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve(image):reject(new Error('사진 크기를 확인할 수 없습니다.'));image.onerror=()=>reject(new Error('사진을 열지 못했습니다. 다른 PNG, JPG, WebP 파일을 선택하세요.'));image.src=source;});
}
function encodePortraitCanvas(canvas) {
 for(const quality of [.88,.75,.6,.45]) {
  let result=canvas.toDataURL('image/webp',quality);if(!result.startsWith('data:image/webp;'))result=canvas.toDataURL('image/jpeg',quality);
  const encoded=result.split(',')[1],bytes=Math.floor(encoded.length*3/4)-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
  if(bytes<=64*1024&&safePortrait(result))return result;
 }
 return null;
}
function drawPortraitCrop(image,crop) {
 const side=Math.min(image.naturalWidth,image.naturalHeight)/crop.zoom;
 const x=(image.naturalWidth-side)*crop.x,y=(image.naturalHeight-side)*crop.y;
 for(const size of [256,192,128]) {
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d');if(!context)throw new Error('이 브라우저에서 사진 편집을 지원하지 않습니다.');
  context.fillStyle='#18222a';context.fillRect(0,0,size,size);context.drawImage(image,x,y,side,side,0,0,size,size);
  const result=encodePortraitCanvas(canvas);if(result)return result;
 }
 throw new Error('사진을 충분히 줄이지 못했습니다. 다른 사진을 선택하세요.');
}
async function preparePortrait(file) {
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG, JPG, WebP 사진을 선택하세요.');
 if(file.size>8*1024*1024)throw new Error('원본 사진은 8MB 이하로 선택하세요.');
 const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('사진 파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
 const image=await portraitImage(source),longest=Math.max(image.naturalWidth,image.naturalHeight);
 for(const maximum of [768,640,512,384]) {
  const ratio=Math.min(1,maximum/longest),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const context=canvas.getContext('2d');if(!context)throw new Error('이 브라우저에서 사진 편집을 지원하지 않습니다.');
  context.fillStyle='#18222a';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const avatarSource=encodePortraitCanvas(canvas);if(!avatarSource)continue;
  const decoded=await portraitImage(avatarSource),avatarCrop=normalizePortraitCrop();
  return {avatarSource,avatarCrop,portraitImage:decoded,avatar:drawPortraitCrop(decoded,avatarCrop)};
 }
 throw new Error('사진을 충분히 줄이지 못했습니다. 다른 사진을 선택하세요.');
}
function portraitFields(modal=state.modal) {
 return {avatar:modal.avatar||null,avatarSource:modal.avatar?safePortrait(modal.avatarSource):null,avatarCrop:modal.avatar?normalizePortraitCrop(modal.avatarCrop):null};
}
function commitPortraitCrop(modal=state.modal) {
 if(!modal?.portraitImage||!modal.avatarSource)return;
 modal.avatarCrop=normalizePortraitCrop(modal.avatarCrop);
 modal.avatar=drawPortraitCrop(modal.portraitImage,modal.avatarCrop);
}
function changePortraitCrop(values) {
 const modal=state.modal;if(!modal?.portraitImage||modal.photoLoading)return;
 modal.avatarCrop=normalizePortraitCrop({...modal.avatarCrop,...values});
 try{commitPortraitCrop(modal);refreshPortraitEditor();}catch(error){toast(error.message,true);}
}
async function hydratePortraitSource(modal) {
 if(!modal?.avatarSource||modal.portraitImage||modal.photoLoading)return;
 const request=modal.photoRequest=(modal.photoRequest||0)+1;modal.photoLoading=true;
 const submit=$('#modal-root [type=submit]');if(submit)submit.disabled=true;
 try{const image=await portraitImage(modal.avatarSource);if(state.modal===modal&&modal.photoRequest===request){modal.portraitImage=image;refreshPortraitEditor();}}
 catch(error){if(state.modal===modal&&modal.photoRequest===request)toast(error.message,true);}
 finally{if(modal.photoRequest===request){modal.photoLoading=false;if(state.modal===modal&&submit)submit.disabled=false;}}
}
function refreshPortraitEditor() {
 const modal=state.modal;if(!modal)return;
 const character=modal.kind==='slot'?state.session.slots[modal.index]:me()?.character;
 const frame=$('#portrait-crop-frame');if(frame){const img=frame.querySelector('img');if(img&&modal.avatar)img.src=modal.avatar;else frame.innerHTML=portrait({...character,avatar:modal.avatar},'large');frame.classList.toggle('has-photo',!!modal.avatar);frame.tabIndex=modal.avatar?0:-1;}
 const crop=normalizePortraitCrop(modal.avatarCrop);
 for(const key of ['x','y','zoom']){const control=$(`[data-portrait-control="${key}"]`),value=key==='zoom'?crop.zoom:Math.round(crop[key]*100);if(control){control.value=value;control.disabled=!modal.portraitImage;control.setAttribute('aria-valuetext',key==='zoom'?`${value.toFixed(2)}배`:`${value}%`);}const output=$(`#portrait-value-${key}`);if(output)output.textContent=key==='zoom'?`${value.toFixed(2)}배`:`${value}%`;}
 const reset=$('[data-action="reset-portrait-crop"]');if(reset)reset.disabled=!modal.portraitImage;
 const status=$('#portrait-status');if(status)status.textContent=!modal.avatar?'사진이 없으면 닉네임 첫 글자를 표시합니다.':modal.legacyPortrait?'이전 사진은 저장된 정사각형 안에서 조절됩니다. 원본을 다시 선택하면 전체 영역을 조절할 수 있습니다.':'보이는 부분을 준비했습니다. 아래 저장 버튼을 눌러 적용하세요.';
}
function dateObj(date) { return new Date(`${date}T12:00:00Z`); }
function formatDate(date, full=false) {
 if(!date)return '일정 미정'; const d=dateObj(date); return `${full?d.getUTCFullYear()+'. ':''}${String(d.getUTCMonth()+1).padStart(2,'0')}. ${String(d.getUTCDate()).padStart(2,'0')} (${['일','월','화','수','목','금','토'][d.getUTCDay()]})`;
}
const shortDate = d => d ? d.slice(5).replace('-','.') : '미정';
const me = () => state.room?.players.find(p=>p.userId===state.session?.user.id);
const ownMatch = m => m.teamA===state.room?.season.team || m.teamB===state.room?.season.team;
const readyCount = () => state.room?.players.filter(p=>state.room.submissions[p.userId]?.turn===state.room.season.turn).length || 0;
const host = () => state.room?.hostId===state.session?.user.id;
const gameYear = () => Number(state.room?.season.year||state.room?.season.date?.slice(0,4)||2026);
function normalizeTeamUI(root){normalizeTeamDisplay(root,gameYear(),state.room?.players||[]);}
const displayTeam = name => gameYear()===2026?(state.meta.teamProfiles?.find(t=>t.name===name)?.displayName||name):name;
const waitingRoom = (room=state.room) => ['waiting','selecting'].includes(room?.lobby?.status);
const liveBroadcast = (room=state.room) => room?.broadcast?.status==='live'?room.broadcast:null;
const npcPowerMode = () => state.room?.season.npcPowerMode||state.room?.balance?.npcPowerMode||state.room?.lobby?.settings?.npcPowerMode||'custom';
const lobbyReadyCount = () => state.room?.players.filter(p=>state.room.lobby?.ready?.[p.userId]===true).length||0;
function teamLogo(team) { return `<span class="team-logo">${e(String(displayTeam(team)||'?').replace(/[^A-Za-z0-9가-힣]/g,'').slice(0,3))}</span>`; }
function getMatches() {
 if(!state.room)return [];const map=new Map();
 for(const m of state.room.season.schedule||[])if(m.result)map.set(m.id,m);
 for(const m of state.room.season.results||[])map.set(m.id,m);
 return [...map.values()].filter(m=>m.result?.sets?.length).sort((a,b)=>b.date.localeCompare(a.date));
}
function selectedMatch() { const matches=getMatches();return matches.find(m=>m.id===state.matchId)||matches.find(ownMatch)||matches[0]; }
function setRoom(room, renderNow=true) {
 const wasWaiting=waitingRoom();
 const previousBroadcast=liveBroadcast();
 const first=!state.room||state.room.code!==room.code;
 if(pendingSceneMove?.code===room.code){const player=room.players.find(p=>p.userId===state.session?.user.id);if(player?.location===pendingSceneMove.position.location)player.scenePosition=pendingSceneMove.position;}
 state.room=room;localStorage.setItem('first-team.room',room.code);
 if(state.session){const summary={code:room.code,name:room.name,team:room.season.team,date:room.season.date,turn:room.season.turn,memberCount:room.players.length,lobbyStatus:room.lobby?.status||'started'};const index=state.session.rooms.findIndex(r=>r.code===room.code);if(index>=0)state.session.rooms[index]=summary;else state.session.rooms.push(summary);}
 if(first){state.month=room.season.date.slice(0,7);state.selectedDate=room.season.date;state.matchId=null;state.setIndex=0;state.eventCount=1;state.liveSetNumber=null;if(waitingRoom(room))state.view='lobby';else if(liveBroadcast(room))state.view='match';}
 if(!first&&liveBroadcast(room)&&!previousBroadcast){stopPlayback();state.liveSetNumber=null;if(state.view==='home')state.view='match';}
 if(!first&&previousBroadcast&&!liveBroadcast(room)&&room.lastBroadcast?.id===previousBroadcast.id){
  const ids=room.lastBroadcast.matchIds||[],finished=getMatches().find(match=>match.id===ids.at(-1))||getMatches().find(match=>ids.includes(match.id));
  if(finished){state.matchId=finished.id;state.setIndex=finished.result.sets.length-1;state.eventCount=finished.result.sets[state.setIndex].events?.length||1;}
  state.liveSetNumber=null;toast('경기 종료. 결과와 순위를 확정하고 다음 날짜로 이동했습니다.');
 }
 if(!wasWaiting&&waitingRoom(room)&&!first){state.view='lobby';state.matchId=null;state.liveSetNumber=null;}
 if(wasWaiting&&!waitingRoom(room)&&state.view==='lobby'){state.view='home';toast('선수단 준비 완료. 시즌이 시작되었습니다.');}
 const submission=room.submissions[state.session?.user.id];if(submission)state.selectedAction=submission.action;
 refreshOwnerDock();
 if(renderNow)render();
}
async function refreshSession() { state.session=await api('/api/session'); }
function stopPlayback() { clearInterval(playbackTimer);playbackTimer=null;state.playing=false; }
function navigate(view) {
 if(view==='owner'||view==='chat'){dockChannel=view==='chat'?'team':'owner';if(!state.room){toast('시즌 방에 참가한 뒤 채팅을 사용할 수 있습니다.');return;}ownerDockOpen=true;localStorage.setItem('first-team.owner-dock',ownerDockOpen?'1':'0');refreshOwnerDock(true);return;}
 stopPlayback();
 if(waitingRoom()&&!['lobby','slots','rules','notices','chat','owner','invites'].includes(view)){toast('대기실에서 전원이 준비한 뒤 방장이 시즌을 시작합니다.');state.view='lobby';}
 else if(!state.room && !['home','lobby','slots','rules','notices','invites'].includes(view)){toast('캐릭터를 선택한 뒤 시즌 방을 만들거나 참가해 주세요.');state.view='home';}
 else state.view=view;
 if(state.view==='owner')state.chat='owner';else if(state.view==='chat'&&state.chat==='owner')state.chat='team';
 state.modal=null;render();window.scrollTo({top:0,behavior:'instant'});
}
function refreshLiveStatus() {
 const live=Boolean(liveBroadcast()),topbar=$('.topbar'),existing=$('.live-header-link');
 topbar?.classList.toggle('has-live',live);
 if(live&&!existing)$('.topbar-right')?.insertAdjacentHTML('afterbegin','<button class="live-header-link" data-action="watch-live" aria-label="현재 실시간 경기 중계 열기"><span class="live-pulse"></span>LIVE <span class="live-header-copy">중계 중</span></button>');
 if(!live)existing?.remove();
}
function render() {
 if(!state.session?.user){renderAuth();return;}
 const oldEventList=$('#event-list'),eventPosition=oldEventList?{top:oldEventList.scrollTop,follow:oldEventList.scrollHeight-oldEventList.scrollTop-oldEventList.clientHeight<70}:null;
 const currentNav=[...nav,['lobby','시즌 방'],['slots','캐릭터 슬롯'],['notices','공지사항'],['rules','게임 안내'],['invites','초대장 관리']].find(x=>x[0]===state.view)?.[1]||'오늘의 일정';
 const room=state.room,s=room?.season;
 $('#app').innerHTML=`<div class="shell"><aside class="sidebar"><button class="brand" data-action="nav" data-view="home" aria-label="첫 화면"><span class="brand-mark club-crest"><img src="/crest.svg" alt="다섯 선수가 모인 팀 방패"></span><div><div class="brand-name">FIRST TEAM</div><div class="brand-tag">LCK 시뮬레이터</div></div></button><div class="nav-label">TEAM INTRANET</div><nav aria-label="게임 메뉴">${nav.map(([key,label])=>`<button class="nav-item ${state.view===key?'active':''}" data-action="nav" data-view="${key}">${icon(key)}<span>${label}</span>${key==='chat'&&room?'<span class="nav-dot"></span>':''}</button>`).join('')}</nav><div class="nav-label">MY CLUB</div>${[['lobby','시즌 방'],['slots','캐릭터 슬롯'],['notices','공지사항'],['rules','게임 안내'],...(state.session.user.role==='admin'?[['invites','초대장 관리']]:[])].map(([key,label])=>`<button class="nav-item ${state.view===key?'active':''}" data-action="nav" data-view="${key}">${icon(key)}<span>${label}</span></button>`).join('')}<div class="sidebar-bottom"><div class="connection"><span class="dot"></span>${room?(s.team?`${e(displayTeam(s.team))} 선수단 접속 중`:'대기실 접속 중'):'시즌을 시작할 준비 완료'}<div style="margin-top:5px;font-size:9px;color:#5f7185">SERVER SAVE · SEASON SIMULATION</div></div><button class="user-block" data-action="profile" aria-label="오너 닉네임 변경"><span class="avatar">${e(state.session.user.name.slice(0,1))}</span><span style="text-align:left"><div class="user-name">${e(state.session.user.name)}</div><div class="user-sub">내 계정 · 닉네임 설정</div></span></button></div></aside><div class="workspace"><header class="topbar"><div class="mobile-brand"><span class="brand-mark club-crest"><img src="/crest.svg" alt="다섯 선수가 모인 팀 방패"></span>FIRST TEAM</div><div class="breadcrumb"><span>선수단 내부망</span><span class="sep">/</span><strong>${e(currentNav)}</strong></div><div class="topbar-right">${room?`<button class="room-code" data-action="copy-code" title="초대 코드 복사"># ${e(room.code)}</button><span class="top-pill">SEASON ${gameYear()}</span><span class="save-status">✓ 서버 자동 저장</span>`:'<span class="top-pill">2026 SEASON</span>'}<button class="icon-btn mobile-brand" data-action="mobile-menu" aria-label="추가 메뉴">⋯</button></div></header><main class="main" id="main-content">${renderView()}</main></div><nav class="mobile-nav" aria-label="모바일 게임 메뉴">${nav.map(([key,label])=>`<button class="${state.view===key?'active':''}" data-action="nav" data-view="${key}">${icon(key)}${label.replace('선수단 메신저','메신저').replace('시즌 캘린더','캘린더').replace('오너 메신저','오너')}</button>`).join('')}</nav></div>`;
 if(state.meta.savePersistence==='ephemeral') {
  const notice=document.createElement('div');notice.className='notice section-gap';notice.style.marginBottom='22px';
  notice.textContent='무료 체험 서버 · 세이브는 임시 저장됩니다. 서버 중지·재시작·재배포 시 계정·선수·시즌 기록이 사라질 수 있습니다.';
  $('#main-content').prepend(notice);
  const status=$('.save-status');if(status)status.textContent='✓ 임시 서버 저장';
 }
 if(state.view==='home'&&room&&!waitingRoom(room)) {
  const grid=$('.grid-2'),left=grid?.children[0],right=grid?.children[1];
  if(grid&&left&&right){
   if(room.vacation&&left.firstElementChild)left.firstElementChild.outerHTML=renderVacationPanel(room,state.session.user.id,host());
   else if(room.dayActivity&&left.firstElementChild)left.firstElementChild.outerHTML=renderDedicatedDay(room,host());
   left.querySelector('[data-activity-log]')?.remove();
   const secondary=document.createElement('div');secondary.className='home-secondary';
   while(right.firstChild)secondary.append(right.firstChild);left.append(secondary);
   grid.classList.add('home-operations');right.classList.add('team-news-column');right.innerHTML=renderTeamNews(room);
  }
 }
 if(liveBroadcast(room)) {
  refreshLiveStatus();
  if(state.view==='home') {
   $('.page-head')?.insertAdjacentHTML('afterend','<div class="live-day-notice"><div><strong>경기 중계가 진행 중입니다.</strong><p>날짜·승패·순위는 중계가 끝난 뒤 함께 확정됩니다. 채팅과 숙소 이동은 계속할 수 있습니다.</p></div><button class="button primary" data-action="watch-live">실시간 중계 보기 →</button></div>');
   for(const button of document.querySelectorAll('[data-action="choose-action"],[data-action="submit-action"],[data-action="settle"],[data-action="auto"],[data-action="takeover"]'))button.disabled=true;
  }
  if(state.view==='match'){const list=$('#event-list');if(list)list.scrollTop=!eventPosition||eventPosition.follow?list.scrollHeight:eventPosition.top;}
 }
 if(state.view==='home'&&room&&!waitingRoom(room))$('.season-strip')?.insertAdjacentHTML('afterend',renderQuickAccess()+renderCupMedia(room,host())+renderMyStats()+renderTournamentResults()+renderLifePending(pendingLifeEvent())+renderScrims(room,host()));
 if(state.room&&!waitingRoom()&&['home','dorm'].includes(state.view)&&!(['scheduled','drafting'].includes(state.room.season.cupDraft?.status)))$('#main-content').insertAdjacentHTML('beforeend',renderClubAgenda()+renderDailyStories());
 refreshOwnerDock();
 if(!maybeOpenTournamentReward()&&!maybeOpenWorldEvent())maybeOpenLifeEvent();
 renderModal();
 normalizeTeamUI($('#app'));
 if(['chat','owner'].includes(state.view)){const list=$('.chat-messages');if(list)list.scrollTop=list.scrollHeight;}if(state.view==='lobby'&&waitingRoom()){const list=$('.assembly-messages');if(list)list.scrollTop=list.scrollHeight;}
}
function renderView() {
 if(state.view==='notices')return renderNotices(state.notices,state.session.user.role==='admin',state.noticeEditor,state.noticeDelete);
 if(state.view==='invites')return state.session.user.role==='admin'?renderInvitationPage(state.invitations,state.invitationIssued):'<div class="empty">관리자 전용 메뉴입니다.</div>';
 if(state.view==='rules')return renderRules();
 if(state.view==='slots')return renderSlotsPage();
 if(state.view==='lobby')return renderLobby();
 if(!state.room)return renderWelcome();
 if(waitingRoom()&&!['chat','owner'].includes(state.view))return renderLobby();
 return ({home:renderHome,match:renderMatch,calendar:renderCalendar,roster:renderRoster,dorm:renderDorm,chat:renderChat,owner:renderChat}[state.view]||renderHome)();
}
function pageHead(eyebrow,title,description='',actions='') {return `<div class="page-head"><div><div class="eyebrow accent">${e(eyebrow)}</div><h1>${e(title)}</h1>${description?`<p>${e(description)}</p>`:''}</div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;}
function slotsHTML() {
 return `<div class="slots">${Array.from({length:5},(_,i)=>{const c=state.session.slots[i];return `<button class="slot ${state.slot===i?'selected':''}" data-action="select-slot" data-index="${i}"><div class="slot-index">SLOT 0${i+1}<span>${c?'●':'+'}</span></div>${c?`<div class="slot-profile">${portrait(c,'medium')}<div class="slot-name">${e(playerLabel(c))}</div></div><div class="slot-meta">${e(c.team||'소속 미정')} · ${e(posName[c.position]||c.position)}</div><span class="tag green">1군 선수</span><span class="slot-edit">선택 · 편집</span>`:`<div class="slot-plus">＋</div><div class="slot-meta">새로운 선수</div><span class="tiny-label">선수 등록하기</span>`}</button>`}).join('')}</div>`;
}
function roomListHTML() {
 return state.session.rooms?.length?state.session.rooms.map(r=>`<div class="room-entry"><div><h3>${e(r.name)}</h3><p>${e(r.team||'팀 선택 전')} · ${formatDate(r.date)} · ${e(r.memberCount)}/5명 · ${r.lobbyStatus==='waiting'?'대기실':r.lobbyStatus==='selecting'?'팀 선택 중':'시즌 진행 중'}</p></div><button class="button small" data-action="resume-room" data-code="${e(r.code)}">이어하기 →</button></div>`).join(''):'<div class="empty" style="padding:24px 0"><div class="empty-symbol">↗</div>아직 시작한 시즌이 없습니다.</div>';
}
function renderWelcome() {
 return pageHead('LCK SIMULATOR','시즌 시작','선수를 등록하고 시즌 방을 만들거나 참가하세요.',`<button class="button ghost" data-action="profile">오너 닉네임 설정</button>`)+`<section class="welcome-hero"><div class="hero-copy"><div class="eyebrow accent">FIRST TEAM · LCK SIMULATOR</div><h1>LCK 시즌 시뮬레이션</h1><p>선수 훈련과 공식 경기를 진행합니다.<br>혼자 또는 최대 5명이 같은 방에서 플레이할 수 있습니다.</p><button class="button primary" data-action="${state.session.slots[state.slot]?'open-create':'edit-slot'}" data-index="${state.slot}">${state.session.slots[state.slot]?'새 시즌 시작하기':'내 선수 만들기'} <span>↗</span></button></div><div class="hero-art" aria-hidden="true"><div class="hero-number">01</div><svg viewBox="0 0 460 280"><defs><linearGradient id="screen" x2="1" y2="1"><stop stop-color="#35503b"/><stop offset="1" stop-color="#101c19"/></linearGradient></defs><path d="M30 230H440M50 240H420" stroke="#40503e"/><path d="M48 225V182H408V225" stroke="#465545" fill="none"/><path d="M225 175V145H238V175M203 180H258" stroke="#728a5d" fill="none"/><path d="M125 57H340V150H125z" fill="#0d1514" stroke="#4b6549"/><path d="M132 64H333V143H132z" fill="url(#screen)"/><path d="m205 75-51 55h53l25-24 35 24h50l-47-55z" stroke="#b7ef6144" fill="#b7ef6105"/><path d="M143 134h76M143 128h55M143 122h35" stroke="#84b359"/><path d="M182 175h110l13 10H170z" fill="#263728" stroke="#536748"/><path d="M85 128h18v46H85zM370 128h18v46h-18z" fill="#13201b" stroke="#506448"/><path d="M75 180h32l-4-5H78zM365 180h28l-4-5h-20z" stroke="#536748" fill="none"/><path d="M348 180h19" stroke="#b7ef61"/><circle cx="353" cy="177" r="3" fill="#b7ef61"/><path d="M286 225v-24q0-20 21-20h36q20 0 20 20v24M307 226v19M344 226v19" stroke="#5e7351" fill="#1a261e"/><path d="M25 224h411M5 245h440" stroke="#26372c"/></svg><div class="hero-caption">ONE TEAM. ONE SEASON. YOUR STORY.</div></div></section><div class="section-heading"><h2>나의 선수 슬롯 <span class="muted" style="font-size:10px;margin-left:8px">${state.session.slots.filter(Boolean).length} / 5</span></h2><p>캐릭터 슬롯과 방 정원은 별개입니다.</p></div>${slotsHTML()}<div class="grid-equal"><section class="panel"><div class="panel-header"><h2>시즌 방</h2><span class="tag">최대 5명</span></div><div class="panel-body">${roomListHTML()}<div class="row section-gap"><button class="button primary" data-action="open-create">시즌 방 만들기</button><button class="button" data-action="open-join">초대 코드로 참가</button></div></div></section><section class="panel"><div class="panel-header"><h2>이렇게 시작하세요</h2><span class="eyebrow">QUICK START</span></div><div class="panel-body"><div class="flow-step"><span class="step-num">01</span><div><strong>나의 1군 선수를 등록</strong>포지션과 주력 챔피언을 정해 캐릭터를 저장합니다.</div></div><div class="flow-step"><span class="step-num">02</span><div><strong>대기실에서 팀원과 준비</strong>전원 준비 후 방장이 시즌을 시작합니다. 빈 포지션은 NPC가 맡습니다.</div></div><div class="flow-step"><span class="step-num">03</span><div><strong>준비를 제출하고, 하루를 정산</strong>경기일에는 선수 상태와 상대 전력으로 경기가 진행됩니다.</div></div><button class="text-link section-gap" data-action="nav" data-view="rules">연도별 대회 규칙과 구현 범위 읽기 →</button></div></section></div>`;
}
function renderSlotsPage() {
 const c=state.session.slots[state.slot];
 return pageHead('PLAYER ARCHIVE','캐릭터 슬롯','선수 설정을 보관합니다. 슬롯 편집이나 선택은 진행 중인 시즌 선수를 교체하지 않습니다.',`<button class="button" data-action="edit-slot" data-index="${state.slot}">${c?'선수 편집':'선수 등록'} ＋</button>`)+slotsHTML()+`<section class="panel"><div class="panel-header"><h2>${c?e(playerLabel(c))+'의 선수 등록증':'빈 선수 슬롯'}</h2><span class="eyebrow">SLOT 0${state.slot+1}</span></div><div class="panel-body">${c?`${renderPlayerDetails(c)}<div class="divider"></div><div class="row slot-actions"><button class="button" data-action="edit-slot" data-index="${state.slot}">프로필 편집</button><button class="button primary" data-action="open-create">이 선수로 새 시즌</button><button class="button" data-action="open-join">방 참가</button><button class="button danger slot-delete-button" data-action="delete-slot" data-index="${state.slot}">캐릭터 삭제</button></div>`:'<div class="empty">등록된 선수가 없습니다. 위 슬롯을 눌러 첫 선수를 만들어 주세요.</div>'}</div><div class="panel-footer">이 브라우저의 기기 계정에 저장됩니다. 다른 참가자의 개인 슬롯은 보이지 않습니다.</div></section>`;
}
function renderLobby() {
 return waitingRoom()?renderWaitingRoom()+`<section class="panel section-gap"><div class="panel-header"><h2>다른 시즌 방</h2><div class="row"><button class="button small" data-action="open-create">새 방 만들기</button><button class="button small" data-action="open-join">초대 코드</button></div></div><div class="panel-body">${roomListHTML()}</div></section>`:renderRoomDirectory();
}
function teamProfiles(){return state.meta.teamProfiles?.length?state.meta.teamProfiles:state.meta.teams.map(name=>({name,fullName:name,description:'LCK 참가 팀.',power:70,style:'균형 운영',basis:'게임용 기본 프리셋'}));}
function renderTeamSelection(){
 const selected=state.room.lobby.selectedTeam;
 return `<section class="team-selection"><div class="section-heading"><div><div class="eyebrow accent">STEP 02 · TEAM SELECTION</div><h2>이번 시즌, 어느 팀으로 뛸까요?</h2></div><span class="tag ${host()?'green':'blue'}">${host()?'방장이 팀을 선택합니다':'방장 선택을 기다리는 중'}</span></div><p class="note">준비를 마친 선수들이 같은 팀에 입단합니다. 프리셋 전력은 2026년 기록으로 계산한 초기 전력입니다. ${npcPowerMode()==='team'?'우리 팀의 빈자리는 선택한 팀의 기본 전력에 맞춥니다. 유저 선수는 자신의 능력치를 사용합니다.':'우리 팀 NPC는 직접 정한 방 설정 능력치, 유저 선수는 캐릭터 능력치를 사용합니다.'}</p><div class="team-selection-grid">${teamProfiles().map(t=>`<button class="team-choice ${selected===t.name?'selected':''}" data-action="choose-team" data-team="${e(t.name)}" aria-pressed="${selected===t.name}" ${host()?'':'disabled'}><div class="row between">${teamLogo(t.name)}<span class="tag ${selected===t.name?'green':''}">${selected===t.name?'선택한 팀':`참고 ${e(t.power)}`}</span></div><h3>${e(t.fullName||t.displayName||t.name)}</h3><p>${e(t.description)}</p>${t.record?`<div class="team-record">기록 ${e(t.record.wins)}승 ${e(t.record.losses)}패 · ${e(t.record.played)}경기</div>`:''}<div class="team-choice-style">${e(t.style)} · ${e(t.displayName||t.name)}</div><small>${e(typeof t.basis==='string'?t.basis:JSON.stringify(t.basis||''))}</small></button>`).join('')}</div></section>`;
}
function renderWaitingRoom() {
 const r=state.room,s=r.season,own=me(),ready=lobbyReadyCount(),allReady=ready===r.players.length,selecting=r.lobby.status==='selecting',chosen=r.lobby.selectedTeam||s.team;
 const positions=state.meta.positions.length?state.meta.positions:['TOP','JGL','MID','ADC','SUP'];
 const messages=(r.messages||[]).filter(m=>m.channel==='owner').slice(-40);
 const startButton=selecting?`<button class="button primary" data-action="lobby-start" ${chosen&&allReady?'':'disabled'}>${chosen?`${e(chosen)} · 시즌 전 미디어데이 →`:'먼저 팀을 선택해 주세요'}</button>`:r.lobby.requireTeamSelection?`<button class="button primary" data-action="lobby-prepare" ${allReady?'':'disabled'}>준비 완료 · 팀 선택으로 →</button>`:`<button class="button primary" data-action="lobby-start" ${allReady?'':'disabled'}>시즌 시작 →</button>`;
 return pageHead('TEAM ASSEMBLY · SEASON LOBBY',selecting?'소속 팀 선택':'시즌 대기실',selecting?'방장이 소속 팀을 정하면 시즌 전 미디어데이에서 그룹을 편성합니다.':'각자의 선수를 확인하고 준비를 눌러주세요. 빈 포지션은 NPC가 맡아 혼자서도 시즌을 시작할 수 있습니다.',`<button class="button" data-action="edit-portrait">내 프로필 사진 변경</button><button class="button ghost" data-action="room-controls">방 관리</button><button class="button ghost" data-action="leave-room">대기실 나가기</button>`)+`<section class="assembly-header"><div><span class="eyebrow accent">${e(chosen||'소속 팀 선택 전')} · FIRST TEAM</span><h2>${e(r.name)}</h2><p>${formatDate(s.date,true)} 시즌 시작 · ${r.players.length}/5명 참가</p><div class="assembly-steps"><span class="${selecting?'complete':'current'}">01 선수 준비</span><i>→</i><span class="${selecting?'current':''}">02 팀 선택</span><i>→</i><span>03 시즌 전 미디어데이</span></div></div><button class="assembly-invite" data-action="copy-code" aria-label="초대 코드 ${e(r.code)} 복사"><small>INVITATION CODE · 클릭해서 복사</small><strong>${e(r.code)}</strong></button></section>${selecting?renderTeamSelection():''}<div class="assembly-lineup" aria-label="포지션별 참가 선수">${positions.map(position=>{
  const member=r.players.find(p=>p.character.position===position),raw=member?.character||r.roster?.find(c=>c.position===position),c=!member&&!chosen?{...raw,nickname:`${posName[position]} NPC`}:raw,isReady=member?r.lobby.ready?.[member.userId]===true:true,isMe=member?.userId===own.userId;
  return `<section class="assembly-player ${isMe?'mine':''} ${isReady?'ready':''}"><div class="assembly-seat"><span>${e(posName[position])}</span><span class="mono">${e(position)}</span></div><button class="assembly-profile" data-action="scene-profile" data-character-id="${e(c?.id||'')}" aria-label="${e(c?.nickname||position)} 선수 정보 보기">${portrait(c,'large')}<h3>${e(c?.nickname||'NPC 팀원')}</h3><span>${e(member?.ownerName||'빈자리를 맡는 가상 선수')}</span></button><div class="assembly-tags">${member?`<span class="tag ${isMe?'green':'blue'}">${isMe?'나의 선수':'참가 선수'}</span>${member.userId===r.hostId?'<span class="tag purple">방장</span>':''}`:'<span class="tag">ROSTER NPC</span>'}</div><div class="assembly-champion">${e(c?.mainChampion||'기본 챔피언 풀')}<small>주력 챔피언</small></div><div class="assembly-stats">${Object.entries(statName).slice(0,3).map(([key,name])=>`<span>${name}<strong>${Math.round(c?.stats?.[key]||s.npcPower)}</strong></span>`).join('')}</div><div class="assembly-ready ${isReady?'done':''}"><span>${isReady?'●':'○'}</span>${member?(isReady?'준비 완료':'준비 중'):'NPC · 자동 준비'}</div></section>`;
 }).join('')}</div><div class="assembly-bottom"><section class="panel"><div class="panel-header"><h2>대기실 대화</h2></div><div class="panel-body"><p class="note">오른쪽 아래 채팅창에서 오너칸과 선수단 카톡방을 이용하세요. 화면을 이동하지 않고 대화할 수 있습니다.</p><button class="button" data-action="nav" data-view="owner">채팅창 열기</button></div></section><section class="panel assembly-launch"><div class="panel-header"><h2>${selecting?'선택한 팀으로 시즌 출발':'시즌 출발 확인'}</h2><span class="tag ${allReady?'green':''}">${ready}/${r.players.length} 준비</span></div><div class="panel-body"><div class="assembly-progress" aria-label="준비 현황">${r.players.map(p=>`<span class="${r.lobby.ready?.[p.userId]?'done':''}" title="${e(playerLabel(p.character))}"></span>`).join('')}</div><p class="note">${selecting?'전원이 준비했습니다. 방장이 팀을 선택한 후 시즌 시작을 눌러주세요. 이 단계에서는 새 참가자를 받지 않습니다.':'실제 참가자 전원이 준비하면 방장이 팀 선택으로 넘어갑니다. NPC는 기다릴 필요가 없습니다. 시작 전에는 날짜와 능력치가 진행되지 않습니다.'}</p><div class="assembly-buttons">${selecting?'':`<button class="button ${r.lobby.ready?.[own.userId]?'':'primary'}" data-action="lobby-ready">${r.lobby.ready?.[own.userId]?'준비 취소':'준비 완료 ✓'}</button>`}${host()?startButton:`<span class="note">${selecting?'방장이 팀을 선택하고 시작합니다.':'전원 준비 후 방장이 다음 단계로 진행합니다.'}</span>`}</div><div class="assembly-settings"><span>소속 팀 <strong>${e(chosen||'아직 선택하지 않음')}</strong></span><span>NPC 기본 능력 <strong>${npcPowerMode()==='team'&&!chosen?'팀 선택 후 배정':e(s.npcPower)}</strong>${npcPowerMode()==='team'?' · 팀 기준':' · 직접 설정'}</span><span>난이도 <strong>${e({easy:'쉬움',normal:'보통',hard:'어려움'}[s.difficulty]||s.difficulty)}</strong></span><span>시즌 전개 <strong>새 시즌마다 무작위</strong></span></div>${host()&&r.players.length>1?`<form class="owner-controls" data-form="transfer"><label class="sr-only" for="waiting-host-transfer">새 방장</label><select id="waiting-host-transfer" name="userId">${r.players.filter(p=>p.userId!==own.userId).map(p=>`<option value="${e(p.userId)}">${e(playerLabel(p.character))}</option>`).join('')}</select><button class="button small ghost" type="submit">방장 위임</button></form>`:''}</div></section></div><div class="notice section-gap">프로필을 누르면 선수 정보를 볼 수 있습니다. 대기실 사진 변경은 이 시즌의 내 선수에만 적용됩니다. 캐릭터 슬롯과 다른 시즌 기록은 각각 따로 보관됩니다.</div>`;
}
function renderBalanceCheck() {
 const room=state.room,balance=room?.balance;if(!balance)return '';
 const value=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*10)/10:'—';
 return `<section class="panel section-gap balance-check" data-balance-check><div class="panel-header"><h2>전력 점검</h2><span class="tag ${balance.needsReview?'purple':'green'}">${balance.needsReview?'설정 확인 권장':'현재 설정'}</span></div><div class="panel-body"><div class="balance-metrics"><div><span>우리 로스터 참고 전력</span><strong>${e(value(balance.rosterPower))}</strong></div><div><span>상대 평균 참고 전력</span><strong>${e(value(balance.opponentAverage))}</strong></div><div><span>현재 NPC 기본 능력</span><strong>${e(value(balance.npcPower))}</strong></div><div><span>선택한 팀의 NPC 기준</span><strong>${e(value(balance.teamNpcPower))}</strong></div></div>${typeof balance.lostStreak==='number'&&balance.lostStreak>0?`<p class="note section-gap">최근 ${e(balance.lostStreak)}연패 · 전력 수치와 현재 컨디션, 훈련 선택을 함께 확인하세요.</p>`:''}<p class="note section-gap">${e(balance.reason||'참고 전력은 능력치로 계산한 게임용 요약입니다. 경기 결과를 보장하지 않으며 컨디션·전략·교전 판정도 승패에 영향을 줍니다.')}</p><div class="row section-gap">${host()?`<button class="button ${balance.needsReview?'primary':'ghost'}" data-action="review-balance" ${balance.canRecalibrate&&!liveBroadcast()?'':'disabled'}>팀 기본 NPC 전력으로 조정</button>`:'<span class="note">NPC 전력 조정은 방장이 진행할 수 있습니다.</span>'}${liveBroadcast()?'<span class="note">경기 중계가 끝나면 조정할 수 있습니다.</span>':''}</div><p class="note" style="margin-top:10px">변경은 이후 경기의 빈 포지션 NPC에 적용됩니다. 유저 선수는 자신의 훈련 능력치를 사용합니다.</p></div></section>`;
}
function renderRoomDirectory() {
 return pageHead('SEASON ROOMS','시즌 방','각 방의 날짜, 선수단, 경기 결과와 관계는 별도로 저장됩니다.',`<button class="button primary" data-action="open-create">방 만들기 ＋</button><button class="button" data-action="open-join">초대 코드</button>`)+`<div class="grid-equal"><section class="panel"><div class="panel-header"><h2>참가 중인 시즌</h2><span class="tag green">서버 저장</span></div><div class="panel-body">${roomListHTML()}</div></section><section class="panel"><div class="panel-header"><h2>함께하는 방법</h2><span class="eyebrow">CO-OP</span></div><div class="panel-body"><p class="note">방 코드를 친구에게 전달하면 다른 기기나 브라우저에서 자신의 캐릭터로 참가할 수 있습니다. 다섯 포지션을 한 자리씩 맡고 대기실에서 같은 팀에 입단합니다. 중복 포지션과 6번째 참가는 서버에서 차단합니다.</p><div class="divider"></div><p class="note">참가자 전원의 행동이 제출되면 방장이 정산합니다. 미제출자가 있다면 방장이 명시적으로 NPC 대행을 선택해야 합니다. 접속이 끊겨도 자동으로 다른 사람의 턴을 넘기지 않습니다. 방장이 명시적으로 나가면 다음 참가자에게 권한을 넘깁니다. 단순히 탭을 닫으면 방장 자리는 유지되므로, 자리를 비우기 전에 방장을 위임해 주세요.</p></div></section></div>${state.room?`<section class="panel section-gap"><div class="panel-header"><h2>현재 방 관리 · ${e(state.room.name)}</h2><span class="room-code">${e(state.room.code)}</span></div><div class="panel-body"><div class="settings-row"><span>초대 코드</span><button class="button" data-action="copy-code">${e(state.room.code)} · 복사</button></div><div class="settings-row"><span>시즌 저장본</span><a class="button" href="/api/rooms/${encodeURIComponent(state.room.code)}/export" download>시즌 JSON 내보내기 ↓</a></div>${host()&&state.room.players.length>1?`<form class="settings-row" data-form="transfer"><label for="host-transfer">방장 넘기기</label><div class="owner-controls"><select id="host-transfer" name="userId">${state.room.players.filter(p=>p.userId!==state.session.user.id).map(p=>`<option value="${e(p.userId)}">${e(p.ownerName)} · ${e(playerLabel(p.character))}</option>`).join('')}</select><button class="button" type="submit">방장 위임</button></div></form>`:''}${host()?`<div class="settings-row"><span>시즌 처음부터 다시 시작</span><button class="button danger" data-action="reset-room" ${liveBroadcast()?'disabled':''}>시즌 초기화</button></div>`:''}<div class="settings-row"><span class="muted">남은 참가자에게 방장을 넘기며, 마지막 참가자가 나가면 방과 채팅을 삭제합니다.</span><button class="button danger" data-action="leave-room">시즌 방 나가기</button></div></div></section>`:''}` + renderBalanceCheck();
}
function renderHome() {
 if(state.room.season.cupDraft?.previous&&['scheduled','drafting'].includes(state.room.season.cupDraft.status)&&state.room.season.date<=state.room.season.cupDraft.date)return pageHead('PRESEASON · LCK CUP MEDIA DAY','그룹 지명 미디어데이','시즌 경기를 시작하기 전, 10개 팀이 모여 바론·장로 그룹을 편성합니다.','<button class="button ghost" data-action="room-controls">방 관리</button>')+renderCupMedia(state.room,host());
 const r=state.room,s=r.season,p=me(),today=(s.schedule||[]).filter(m=>m.date===s.date&&m.status==='scheduled'),todayOwn=today.filter(ownMatch),todayClub=(r.clubSchedule||[]).find(x=>x.date===s.date&&x.status==='scheduled'),todayPractice=(r.scrimSchedule||[]).find(x=>x.date===s.date&&x.status==='scheduled'),next=(s.schedule||[]).filter(m=>m.date>=s.date&&m.status==='scheduled'&&ownMatch(m)).slice(0,3);
 const standing=[...(s.standings||[])].sort((a,b)=>b.wins-a.wins||(b.setWins-b.setLosses)-(a.setWins-a.setLosses)),rank=standing.findIndex(t=>t.team===s.team)+1,our=standing.find(t=>t.team===s.team),myAction=r.submissions[p?.userId];
 return pageHead(`${s.team} · TEAM OPERATIONS`,'오늘의 일정',`${formatDate(s.date,true)} · 한국시간 기준`,`<button class="button ghost" data-action="room-controls">방 관리</button><button class="button" data-action="copy-code">친구 초대 ↗</button>`)+`${s.finished?'<div class="finished-banner"><div class="eyebrow accent">SEASON COMPLETE</div><h2>시즌이 끝났습니다.</h2><p>경기 기록과 관계는 이 방에 보관됩니다. 새 시즌은 별도의 방으로 시작할 수 있습니다.</p></div>':''}<div class="season-strip"><div class="strip-item"><label>GAME DATE / KST</label><div class="strip-value">${e(s.date.replaceAll('-','.'))}</div><div class="strip-sub">${e(s.phase||`${gameYear()} LCK SEASON`)}</div></div><div class="strip-item"><label>SEASON PROGRESS</label><div class="strip-value">${e(s.turn)}<small>/ ${e(s.totalTurns)}일</small></div><div class="progress"><span style="width:${Math.min(100,s.turn/s.totalTurns*100)}%"></span></div></div><div class="strip-item"><label>LCK STANDING</label><div class="strip-value">${rank||'—'}<small>위 · ${our?.wins||0}승 ${our?.losses||0}패</small></div><div class="strip-sub">정규시즌 누적 · 세트 ${our?.setWins||0} : ${our?.setLosses||0}</div></div><div class="strip-item"><label>PLAYER CONDITION</label><div class="strip-value ${p?.character.condition<45?'red':'accent'}">${Math.round(p?.character.condition||0)}<small>/ 100</small></div><div class="strip-sub">피로 ${Math.round(p?.character.fatigue||0)} · 스트레스 ${Math.round(p?.character.stress||0)}</div></div></div><div class="grid-2"><div class="stack"><section class="panel"><div class="today-hero"><div class="eyebrow accent">${todayOwn.length?'MATCH DAY · 경기일':todayPractice?'SCRIM DAY · 상세 스크림':todayClub?'CLUB DAY · 팀 고정 일정':'DAILY ROUTINE · 준비일'}</div><div class="today-title row">${todayOwn.length?`${e(s.team)} vs ${e(todayOwn[0].teamA===s.team?todayOwn[0].teamB:todayOwn[0].teamA)}`:todayPractice?e(todayPractice.title):todayClub?e(todayClub.title):'훈련 및 휴식'}<span class="tag ${todayOwn.length?'purple':'green'}">${todayOwn.length?`BO${todayOwn[0].bestOf}`:'1일 1행동'}</span></div><p class="today-copy">${todayOwn.length?'모니터에 상대의 경기 영상이 올라왔다. 코치가 마지막 확인을 요청했다. 오늘의 준비와 선수단 상태를 반영해 경기를 정산합니다.':todayClub?`${e(todayClub.location)}에서 ${e(todayClub.title)} 일정이 있습니다. 준비 행동 정산과 함께 팀 활동에 참여합니다.`:'매니저가 오늘 일정을 공유했다. 훈련 강도를 올리거나, 어제 쌓인 피로를 풀 수 있다. 다음 경기는 준비한 만큼 달라집니다.'}</p></div><div class="panel-body"><div class="section-heading"><h2>나의 준비 행동</h2><span class="row own-player-label">${portrait(p?.character)}<span class="tiny-label">${e(p?.character.nickname)} · ${e(posName[p?.character.position])}</span></span></div><div class="training-grid">${state.meta.actions.map(a=>`<button class="training-card ${state.selectedAction===a.id?'selected':''}" data-action="choose-action" data-id="${e(a.id)}" ${s.finished?'disabled':''}><span class="action-icon">${actionIcons[a.id]||'＋'}</span><strong>${e(a.name)}</strong><p>${e(a.description||a.effects)}</p></button>`).join('')}</div><div class="action-foot"><p class="note">${myAction?`✓ 이번 턴에 ${e(state.meta.actions.find(a=>a.id===myAction.action)?.name||myAction.action)} 제출됨. 정산 전까지 수정할 수 있습니다.`:'행동은 제출 후 하루 정산 시 적용됩니다. 다른 참가자의 선택은 직접 바꿀 수 없습니다.'}</p><button class="button primary" data-action="submit-action" ${s.finished?'disabled':''}>${myAction?'행동 수정':'행동 제출'} →</button></div></div><div class="submission-row">${r.players.map(player=>`<span class="submit-chip ${r.submissions[player.userId]?.turn===s.turn?'done':''}">${r.submissions[player.userId]?.turn===s.turn?'✓':'○'} ${e(playerLabel(player.character))} ${player.userId===r.hostId?'♔':''}</span>`).join('')}<span class="tiny-label" style="align-self:center;margin-left:auto">${readyCount()} / ${r.players.length} 제출</span></div><div class="settle-box">${host()?`<button class="button primary" data-action="settle" ${s.finished||readyCount()<r.players.length?'disabled':''}>${todayOwn.length?'경기 중계 시작 →':'하루 정산하기 →'}</button>${readyCount()<r.players.length?`<button class="button ghost" data-action="takeover" ${s.finished?'disabled':''}>미제출자 NPC 대행</button>`:''}`:'<span class="note">방장이 전원 제출을 확인한 뒤 하루를 정산합니다.</span>'}${r.players.length===1?`<button class="button ghost" data-action="auto" ${s.finished?'disabled':''}>상태 보고 최대 7일 자동 준비 ↗</button>`:''}<p class="note">${r.players.length===1?'자동 준비는 매일 상태·능력치·다음 경기를 보고 훈련과 회복을 고릅니다. 구단 행사·휴가는 자동으로 넘기고 우리 팀 경기·상세 스크림 당일에 멈춥니다.':'실제 하루를 기다릴 필요는 없습니다. NPC 대행 시 기본 휴식 행동과 대행 기록이 남습니다.'}</p></div></section><section class="panel" data-activity-log><div class="panel-header"><h2>선수단 활동 기록</h2><span class="eyebrow">TEAM LOG</span></div><div class="panel-body timeline-scroll">${renderHistory((s.history||[]).slice(0,10))}</div></section></div><div class="stack"><section class="panel"><div class="panel-header"><h2>다가오는 우리 경기</h2><button class="text-link" data-action="nav" data-view="calendar">일정 전체 →</button></div>${next.length?next.map(m=>`<div class="match-card"><div class="row between"><span class="eyebrow">${e(m.stage)} · ${e(roundLabel(m))}</span><span class="tag ${m.date===s.date?'green':''}">${m.date===s.date?'TODAY':shortDate(m.date)}</span></div><div class="match-teams"><div class="team-side">${teamLogo(m.teamA)}<strong class="team-abbr ${m.teamA===s.team?'ours':''}">${e(m.teamA)}</strong></div><span class="vs">VS</span><div class="team-side"><strong class="team-abbr ${m.teamB===s.team?'ours':''}">${e(m.teamB)}</strong>${teamLogo(m.teamB)}</div></div><p class="match-meta">${formatDate(m.date)} · BO${m.bestOf} · ${m.teamA&&m.teamB?'대진 확정':'성적에 따라 대진 확정'}</p></div>`).join(''):'<div class="empty">현재 확정된 우리 팀 경기가 없습니다.<br>진출 결과에 따라 다음 대진이 정해집니다.</div>'}</section></div></div>${renderQualifications()}`;
}
function renderQuickAccess(){return `<div class="home-quick-access" aria-label="순위와 로스터 바로 보기"><button class="quick-access-card" data-action="standings-modal"><span><strong>순위 확인</strong><small>리그 순위 / 대회 대진 / POM 순위</small></span><b aria-hidden="true">↗</b></button><button class="quick-access-card" data-action="team-roster-modal"><span><strong>우리 로스터</strong><small>${e(state.room.season.team)} · ${state.room.roster?.length||state.room.players.length}명</small></span><b aria-hidden="true">↗</b></button></div>`;}
function renderQuickRoster(){const r=state.room,p=me();return `<section class="panel"><div class="panel-header"><h2>우리 로스터</h2><button class="text-link" data-action="nav" data-view="roster">선수단 →</button></div><div class="panel-body"><div class="roster-list">${(r.roster||r.players.map(x=>x.character)).map(c=>`<div class="roster-row">${portrait(c)}<span class="position-badge">${e(c.position)}</span><div><div class="nickname">${e(playerLabel(c))} ${c.id===p?.character.id?'<span class="accent" style="font-size:9px">YOU</span>':''}</div><div class="subtitle">${e(c.mainChampion||'챔피언 미정')} · ${r.players.some(x=>x.character.id===c.id)?'참가 선수':'NPC 팀원'}</div></div><span class="rating">${Math.round(Object.values(c.effectiveStats||c.stats||{}).reduce((a,b)=>a+Number(b),0)/Math.max(1,Object.keys(c.effectiveStats||c.stats||{}).length))}</span></div>`).join('')}</div></div></section>`;}
function renderQuickStandings(tab='team'){
 const choices=[['team','리그 순위'],['tournament','대회 대진 · 진출 현황'],['pom','POM 순위']];
 const tabs=`<div class="quick-standing-tabs" role="tablist" aria-label="순위 종류">${choices.map(([key,label])=>`<button class="button ${tab===key?'primary':'ghost'}" data-action="standings-tab" data-tab="${key}" role="tab" aria-selected="${tab===key}">${label}</button>`).join('')}</div>`;
 const table=[...(state.room.season.standings||[])].sort((a,b)=>b.wins-a.wins||(b.setWins-b.setLosses)-(a.setWins-a.setLosses));
 if(tab==='pom')return tabs+renderSeasonAwards(state.room);
 if(tab==='tournament')return tabs+renderTournamentStandings(state.room,{currentOnly:true})+renderQualifications();
 return tabs+renderLeagueStandings(state.room,renderStandings(table));
}
function renderMyStats(){
 const c=me()?.character;if(!c)return '';
 const honor=Object.values(state.room.season.awards?.ledger||{}).find(p=>p.team===state.room.season.team&&p.playerId===c.id),background=state.meta.characterBackgrounds?.find(b=>b.id===c.background);
 return `<section class="panel my-ability-panel" data-my-stats aria-label="내 선수 능력치"><div class="my-ability-identity">${portrait(c,'medium')}<div><strong>${e(playerLabel(c))}</strong><small>${e(posName[c.position])} · ${e(c.mainChampion||'주력 챔피언 미정')}</small><small>${e(background?.name||'선수')} · POM ${honor?.total.pom||0}회 · ${(honor?.total.pom||0)*100}점</small><button class="text-link" data-action="awards">POM 순위 · 시즌 시상식 →</button></div></div><div class="my-ability-grid">${Object.entries(statName).map(([key,label])=>{const value=effectiveStat(c,key),base=Number(c.stats?.[key]||0),diff=value-base;return `<div class="my-ability-stat ${diff<0?'negative':diff>0?'positive':''}" data-my-stat="${key}"><span>${e(label)}</span><strong>${value.toFixed(1)}</strong>${Math.abs(diff)>.01?`<small>기본 ${base.toFixed(1)} · ${diff>0?'+':''}${diff.toFixed(1)}</small>`:'<small>/ 100</small>'}</div>`;}).join('')}</div>${renderReadiness(c,{open:readinessOpen})}</section>`;
}
function renderTeamNews(room){
 const s=room.season,submission=room.submissions[me()?.userId],selected=state.meta.actions.find(a=>a.id===state.selectedAction),saved=state.meta.actions.find(a=>a.id===submission?.action);
 return `<aside class="team-news-sidebar" data-team-news><section class="panel"><div class="panel-header"><h2>선수단 소식</h2><span class="tag green">${e(shortDate(s.date))}</span></div><div class="panel-body news-declaration" aria-live="polite"><strong>${room.dayActivity?'오늘 일정 · '+e(room.dayActivity.type==='match'?'공식 경기':'상세 스크림'):room.vacation?'선수단 휴가 · 행동 선택 없음':`선택 중 · ${e(selected?.name||'준비 행동')}`}</strong><p>${room.dayActivity?'일반 준비 행동 제출 없이 오늘 일정을 진행합니다.':room.vacation?'휴가를 넘기면 각자의 일상이 기록됩니다.':submission?.turn===s.turn?`✓ 이번 턴 제출: ${e(saved?.name||submission.action)}`:'아직 이번 턴 행동을 제출하지 않았습니다.'}</p><small>새 사건과 활동 결과는 하루 정산 뒤 아래에 표시됩니다.</small></div></section><section class="panel"><div class="panel-header"><h2>최근 선수단 활동</h2><span class="eyebrow">TEAM LOG</span></div><div class="panel-body news-history" data-team-news-log>${renderHistory((s.history||[]).slice(0,16))}</div></section>${renderWorldEvents(room,{limit:4})}</aside>`;
}
function renderHistory(history) {return history.length?history.map(h=>`<div class="timeline-item"><span class="timeline-dot"></span><div>${e(h.text||h.summary||'활동 기록')}<div class="time">${shortDate(h.date)} · ${e(h.type||'기록')}${h.turn?` · TURN ${e(h.turn)}`:''}</div></div></div>`).join(''):'<p class="note">첫 하루를 정산하면 훈련, 일상과 경기 기록이 쌓입니다.</p>';}
function renderStandings(items) {return `<table class="standings"><thead><tr><th>#</th><th>TEAM</th><th>W</th><th>L</th><th>세트득실</th></tr></thead><tbody>${items.map((t,i)=>`<tr class="${t.team===state.room.season.team?'ours':''}"><td class="rank">${String(i+1).padStart(2,'0')}</td><td class="stand-team">${e(t.team)}${t.group?` <span class="tiny-label">${e(t.group)}</span>`:''}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.setWins-t.setLosses>0?'+':''}${t.setWins-t.setLosses}</td></tr>`).join('')}</tbody></table>`;}
function renderQualifications() {
 const q=state.room.season.qualifications||{},team=state.room.season.team;
 const statusText={pending:'진출권 경쟁 중',qualified:'진출 확정', 'not-qualified':'미진출',eliminated:'대회 탈락',champion:'대회 우승'};
 return `<div class="qualification-grid">${[['firstStand','FIRST STAND',gameYear()===2026?'LCK Cup 결승 진출 두 팀 출전':'LCK Cup 우승팀만 출전'],['msi','MSI','Road to MSI를 통과한 두 팀 출전'],['ewc'],['demacia'],['worlds','WORLDS','기본 3시드 · LCK MSI 결승 진출 시 4시드']].map(([key,label,desc])=>{if(key==='ewc')return renderEwcCard(state.room);if(key==='demacia')return renderDemaciaCard(state.room,host());const item=q[key]||{};return `<section class="panel qual-card"><h3>${label}</h3><div class="status ${['qualified','champion'].includes(item.status)?'accent':''}">${e(statusText[item.status]||item.status||'아직 결정되지 않음')}</div><p>${e(desc)}${key==='worlds'?`<br>현재 LCK ${item.seeds||3}시드 · ${e(item.reason||'MSI 결과로 추가 진출권 결정')}`:''}${item.teams?.length?`<br>진출팀: ${e(item.teams.join(', '))}`:''}${key==='firstStand'&&item.team?`<br>Cup 우승: ${e(item.team)}`:''}</p></section>`}).join('')}</div>`;
}
function liveCommentIdentity(key) {
 const names=['ㅇㅇ','집관러','라인관리좀','방금켰는데','강가와드','탑유기금지','한타만봄','오늘도직관','피어리스중독','롤붕이','아니이게','뇌지컬충','용앞에서보자','점멸어디감','미니맵좀봐','바론먹는중','현지중계','퇴근하고봄','일단보고말함','억제기앞','리플돌리는중','서폿시점'];
 let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);hash>>>=0;
 return {name:names[hash%names.length],address:`${100+(hash%123)}.${1+((hash>>>8)%253)}`};
}
function liveEventMarkup(event,index,total) {
 return `<article class="match-event ${index===total-1?'recent':''}" data-live-event="${e(event.id||index)}"><time class="event-time">${e(event.time)}</time><div><span class="event-label ${event.kills?.length||/kill|blood|trade|fight/i.test(event.type)?'kill':/dragon|baron|objective|tower/i.test(event.type)?'objective':''}">${e(eventLabel(event.subtype||event.type))}</span>${renderMatchText(event)}</div></article>`;
}
function liveDraftMarkup(set,broadcast) {
 const draft=set?.draft;if(!draft)return '';
 return `<section class="panel"><div class="panel-header"><h2>SET ${e(set.number)} · 공개된 밴픽</h2><span class="tag purple">피어리스 드래프트</span></div><div class="panel-body"><div class="draft-grid">${[['A',broadcast.teamA],['B',broadcast.teamB]].map(([side,name])=>`<div><div class="eyebrow accent">${e(displayTeam(name))}</div>${(draft['picks'+side]||[]).map(p=>`<div class="draft-pick"><span>${e(posName[p.position]||p.position)} · ${e(p.nickname)}</span><strong>${e(p.champion)}</strong></div>`).join('')}<div class="bans">BAN ${(draft['bans'+side]||[]).map(e).join(' / ')||'—'}</div></div>`).join('')}</div>${draft.selectionRight?`<p class="note section-gap">RoFS · ${e(draft.selectionRight.team)} · ${e(draft.selectionRight.reason)} · ${e(draft.selectionRight.choice)}</p>`:''}${draft.rule?`<p class="note section-gap">${e(draft.rule)}</p>`:''}${draft.notes?.length?`<p class="note section-gap">${draft.notes.map(e).join(' · ')}</p>`:''}</div></section>`;
}
function renderLiveMatch(broadcast) {
 const sets=broadcast.sets||[],activeNumber=Number(broadcast.activeSet)||sets.at(-1)?.number||1;
 const set=sets.find(item=>item.number===state.liveSetNumber)||sets.find(item=>item.number===activeNumber)||sets.at(-1);
 const events=set?.events||[],snapshot=events.at(-1),score=snapshot?.score||[set?.killsA||0,set?.killsB||0];
 const reactions=events.flatMap(event=>(event.reactions||[]).map((value,index)=>({text:typeof value==='string'?value:value?.text||'',time:event.time,type:event.type,key:`${broadcast.matchId}:${set?.number}:${event.id}:${index}`}))).slice(-120).reverse();
 const kda=set?.scoreboard||[],hasSeriesWinner=Math.max(broadcast.scoreA||0,broadcast.scoreB||0)>=Math.floor(broadcast.bestOf/2)+1;
 const setState=set?.completed?(hasSeriesWinner?'경기 종료 장면 · 정산 반영 중':'세트 종료 · 다음 세트 준비 중'):'경기 중계가 이어지고 있습니다';
 return pageHead('LIVE MATCH CENTER','실시간 경기 중계','게임 시간을 압축한 실시간 중계입니다. 방 참가자는 같은 장면과 현재 스코어를 함께 봅니다.',`<button class="button ghost" data-action="nav" data-view="home">오늘의 일정 →</button>`)+renderPomCard(broadcast.pom)+renderStrategyBreak(state.room,host())+`<div class="match-layout live-match-layout" data-live-match="${e(broadcast.id)}"><div class="stack"><section class="panel live-score-panel"><div class="score-header"><div class="row between"><span class="eyebrow">${e(broadcast.stage)} · ${e(broadcast.round)} · BO${e(broadcast.bestOf)}</span><span class="live-status"><span class="live-pulse"></span>LIVE · 실시간 중계</span></div><div class="big-score"><div class="big-team ${broadcast.teamA===state.room.season.team?'accent':''}">${e(displayTeam(broadcast.teamA))}<small>BLUE SIDE</small></div><div class="score-numbers" data-live-series-score>${e(broadcast.scoreA||0)} <span>:</span> ${e(broadcast.scoreB||0)}</div><div class="big-team ${broadcast.teamB===state.room.season.team?'accent':''}">${e(displayTeam(broadcast.teamB))}<small>RED SIDE</small></div></div><p class="match-meta live-score-description">${formatDate(broadcast.date,true)} · 종료된 세트만 시리즈 점수에 반영합니다.</p></div><div class="set-tabs" role="tablist" aria-label="현재까지 공개된 세트">${sets.map(item=>`<button class="set-tab ${set?.number===item.number?'active':''}" role="tab" aria-selected="${set?.number===item.number}" data-action="live-set" data-number="${e(item.number)}">SET ${e(item.number)} <span class="muted">· ${item.completed?'종료':item.number===activeNumber?'진행 중':'공개됨'}</span></button>`).join('')}</div><div class="match-toolbar live-toolbar"><span class="note" role="status"><span class="dot"></span>SET ${e(set?.number||activeNumber)} · ${e(setState)}</span>${set?.number!==activeNumber?'<button class="button small" data-action="follow-live">진행 중 세트로 →</button>':'<span class="live-server-sync">모든 참가자가 함께 보는 중계</span>'}</div>${renderObjectiveBoard({teamA:broadcast.teamA,teamB:broadcast.teamB,events})}<div class="event-list" id="event-list" data-live-event-list aria-label="현재까지 공개된 경기 장면">${events.length?events.map((event,index)=>liveEventMarkup(event,index,events.length)).join(''):'<div class="live-between-scenes"><span class="live-pulse"></span> 선수들이 경기석에서 준비하고 있습니다.</div>'}</div><div class="panel-footer live-progress-note">밴픽부터 넥서스까지 중계가 이어집니다. 오늘 일정과 순위는 경기 종료 후 확정됩니다.</div></section>${liveDraftMarkup(set,broadcast)}${kda.length?`<section class="panel"><div class="panel-header"><h2>SET ${e(set?.number||activeNumber)} · 현재 선수 기록</h2><span class="eyebrow">공개된 교전 집계 · K / D / A</span></div><div class="panel-body" style="padding:10px"><table class="scoreboard live-scoreboard"><thead><tr><th>팀</th><th>선수</th><th>포지션</th><th class="champion-cell">챔피언</th><th>K / D / A</th></tr></thead><tbody>${kda.map(player=>`<tr><td>${e(displayTeam(player.team))}</td><td>${e(player.nickname)}</td><td>${e(posName[player.position]||player.position)}</td><td class="champion-cell">${e(player.champion)}</td><td>${e(player.k||0)} / ${e(player.d||0)} / ${e(player.a||0)}</td></tr>`).join('')}</tbody></table></div></section>`:''}</div><aside class="panel reactions-panel live-reactions"><div class="reactions-head"><h2><span class="dot"></span>실시간 경기 불판 <span class="badge-count">ON AIR</span></h2><p>경기에서 공개된 장면에 반응합니다.</p></div><div class="reaction-list">${reactions.length?reactions.map(reaction=>{const user=liveCommentIdentity(reaction.key+reaction.text);return `<div class="reaction"><div class="reaction-name"><span>${e(user.name)} <span class="mono">(${e(user.address)})</span></span><time>${e(reaction.time)}</time></div><p>${e(reaction.text)}</p><div class="reaction-scene">↳ ${e(eventLabel(reaction.type))}</div></div>`;}).join(''):'<div class="empty">중계 장면이 나오면<br>불판도 같이 올라옵니다.</div>'}</div><div class="panel-footer" style="font-size:9px">작성된 최근 경기 장면의 반응을 모아봅니다.</div></aside></div>`;
}

function renderMatch() {
 if(liveBroadcast())return renderLiveMatch(liveBroadcast());
 const matches=getMatches(),match=selectedMatch();
 if(!match)return pageHead('MATCH CENTER','경기 센터','경기 결과와 세트별 중계 기록을 확인합니다.')+`<section class="panel empty-match"><span class="brand-mark club-crest"><img src="/crest.svg" alt="다섯 선수가 모인 팀 방패"></span><h2>아직 끝난 경기가 없습니다.</h2><p>우리 팀 경기일에 행동을 제출하고 하루를 정산하세요. 밴픽, 라인 개입, 교환 킬, 오브젝트와 한타가 순서대로 생성되고, 그 결과로 승패가 결정됩니다.</p><button class="button primary" data-action="nav" data-view="home">오늘의 일정으로 →</button></section>`;
 const result=match.result,index=Math.min(state.setIndex,result.sets.length-1),set=result.sets[index],events=set.events||[],count=Math.min(state.eventCount,events.length),visible=events.slice(0,count),all=count>=events.length;
 const snapshot=visible.at(-1);
 if(result.summaryOnly)return pageHead('MATCH CENTER','경기 센터','다른 팀 경기는 승패와 세트 결과를 요약 저장합니다. 우리 팀 경기에는 상세 사건과 KDA가 남습니다.')+renderPomCard(result.pom)+`<label class="field">다시 볼 경기<select class="match-selector" id="match-selector">${matches.map(m=>`<option value="${e(m.id)}" ${m.id===match.id?'selected':''}>${shortDate(m.date)} · ${e(m.stage)} · ${e(m.teamA)} ${m.result.scoreA} : ${m.result.scoreB} ${e(m.teamB)}</option>`).join('')}</select></label><section class="panel"><div class="score-header"><div class="row between"><span class="eyebrow">${e(match.stage)} · ${e(roundLabel(match))}</span><span class="tag">다른 팀 경기 요약</span></div><div class="big-score"><div class="big-team">${e(match.teamA)}</div><div class="score-numbers">${result.scoreA} <span>:</span> ${result.scoreB}</div><div class="big-team">${e(match.teamB)}</div></div><p class="match-meta" style="text-align:center">${formatDate(match.date,true)} · ${e(result.winner)} 승리</p></div><div class="panel-body"><p class="notice">이 경기는 다른 팀의 경기로, 순위 반영을 위한 시리즈 결과가 저장되었습니다. 상세 중계·KDA·불판은 우리 팀 경기를 선택해 확인하세요.</p><div class="set-tabs">${result.sets.map((s,i)=>`<span class="set-tab">SET ${i+1} · ${e(s.winner)}</span>`).join('')}</div></div></section>`;
 const reactions=visible.flatMap(ev=>(ev.reactions||[]).map((value,i)=>({text:typeof value==='string'?value:value?.text||'',time:ev.time,type:ev.type,index:i}))).slice(-100).reverse();
 return pageHead('MATCH CENTER','경기 기록','정산된 경기를 순서대로 다시 읽습니다. 불판은 공개된 장면에 맞춰 이어집니다.',`<button class="button ghost" data-action="nav" data-view="home">오늘의 일정 →</button>`)+renderPomCard(result.pom)+`<label class="field" style="margin-bottom:17px">다시 볼 경기<select class="match-selector" id="match-selector" aria-label="다시 볼 경기">${matches.map(m=>`<option value="${e(m.id)}" ${m.id===match.id?'selected':''}>${shortDate(m.date)} · ${e(m.stage)} · ${e(m.teamA)} ${m.result.scoreA} : ${m.result.scoreB} ${e(m.teamB)}</option>`).join('')}</select></label><div class="match-layout"><div class="stack"><section class="panel"><div class="score-header"><div class="row between"><span class="eyebrow">${e(match.stage)} · ${e(roundLabel(match))} · BO${match.bestOf}</span><span class="tag green">정산 완료 · 다시보기</span></div><div class="big-score"><div class="big-team ${match.teamA===state.room.season.team?'accent':''}">${e(match.teamA)}<small>BLUE SIDE</small></div><div class="score-numbers">${result.scoreA} <span>:</span> ${result.scoreB}</div><div class="big-team ${match.teamB===state.room.season.team?'accent':''}">${e(match.teamB)}<small>RED SIDE</small></div></div><div class="match-meta" style="text-align:center;margin-top:17px">${formatDate(match.date,true)} · ${e(result.winner)} 승리 · 경기 사건 누적 판정</div></div><div class="set-tabs" role="tablist" aria-label="세트 선택">${result.sets.map((s,i)=>`<button class="set-tab ${index===i?'active':''}" role="tab" aria-selected="${index===i}" data-action="select-set" data-index="${i}">SET ${i+1} <span class="muted">· ${e(s.winner)}</span></button>`).join('')}</div><div class="match-toolbar"><span class="note"><span class="dot"></span>${count} / ${events.length} 장면 · ${all?`${e(set.winner)} 넥서스 파괴`:'장면을 넘기며 중계를 읽어보세요'}</span><div class="row" style="gap:5px"><button class="button small ghost" data-action="event-prev" ${count<=1?'disabled':''} aria-label="이전 장면">←</button><button class="button small" data-action="play-events">${state.playing?'일시 정지':'자동 중계 ▶'}</button><button class="button small ghost" data-action="event-next" ${all?'disabled':''} aria-label="다음 장면">다음 →</button><button class="button small ghost" data-action="all-events">전체</button></div></div>${renderObjectiveBoard({teamA:match.teamA,teamB:match.teamB,events:visible,final:all?set.objectives:null})}<div class="event-list" id="event-list">${visible.map((ev,i)=>`<article class="match-event ${i===visible.length-1?'recent':''}"><time class="event-time">${e(ev.time)}</time><div><span class="event-label ${ev.kills?.length||/kill|blood|trade|fight/i.test(ev.type)?'kill':/dragon|baron|objective|tower/i.test(ev.type)?'objective':''}">${e(eventLabel(ev.subtype||ev.type))}</span>${renderMatchText(ev)}</div></article>`).join('')}${!all?'<div class="note" style="padding-top:12px;text-align:center">다음 장면을 눌러 계속 읽으세요.</div>':''}</div><div class="panel-footer">${all?`킬 ${set.killsA} : ${set.killsB} · 경기 시간 ${e(set.duration)} · 모든 킬과 KDA는 기록된 교전으로 계산됩니다.`:'커뮤니티 반응은 현재까지 공개된 사건을 기준으로 표시합니다.'}</div></section><section class="panel"><div class="panel-header"><h2>SET ${index+1} · 밴픽 노트</h2><span class="tag purple">시리즈 챔피언 중복 제한</span></div><div class="panel-body"><div class="draft-grid">${[['A',match.teamA],['B',match.teamB]].map(([side,name])=>`<div><div class="eyebrow accent">${e(name)}</div>${(set.draft?.['picks'+side]||[]).map(p=>`<div class="draft-pick"><span>${e(p.position)} · ${e(p.nickname)}</span><strong>${e(p.champion)}</strong></div>`).join('')}<div class="bans">BAN ${(set.draft?.['bans'+side]||[]).map(e).join(' / ')||'—'}</div></div>`).join('')}</div>${set.draft?.rule?`<p class="note section-gap">${e(set.draft.rule)}</p>`:""}${set.draft?.notes?.length?`<p class="note section-gap">${set.draft.notes.map(e).join(' · ')}</p>`:''}</div></section>${all?`<section class="panel"><div class="panel-header"><h2>SET ${index+1} · 선수 기록</h2><span class="eyebrow">K / D / A</span></div><div class="panel-body" style="padding:10px"><table class="scoreboard"><thead><tr><th>팀</th><th>선수</th><th>포지션</th><th class="champion-cell">챔피언</th><th>K / D / A</th></tr></thead><tbody>${(set.scoreboard||[]).map(p=>`<tr><td>${e(p.team)}</td><td>${e(p.nickname)}</td><td>${e(p.position)}</td><td class="champion-cell">${e(p.champion)}</td><td>${p.k} / ${p.d} / ${p.a}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-header"><h2>경기 후 복기</h2><span class="eyebrow">POST-MATCH REVIEW</span></div><div class="panel-body recap">${(Array.isArray(result.recap)?result.recap:[result.recap]).filter(Boolean).map(text=>`<p>${e(text)}</p>`).join('')}</div></section>`:''}</div><aside class="panel reactions-panel"><div class="reactions-head"><h2><span class="dot"></span>경기 불판 <span class="badge-count">LIVE REPLAY</span></h2><p>경기 장면에 따라 갱신되는 반응</p></div><div class="reaction-list">${reactions.length?reactions.map((r,i)=>`<div class="reaction"><div class="reaction-name"><span>${e(liveCommentIdentity(`${match.id}:${index}:${r.type}:${r.time}:${r.index}:${r.text}`).name)} <span class="mono">(${e(liveCommentIdentity(`${match.id}:${index}:${r.type}:${r.time}:${r.index}:${r.text}`).address)})</span></span><span>${e(r.time)}</span></div><p>${e(r.text)}</p><div class="reaction-scene">↳ ${e(eventLabel(r.type))} 장면</div></div>`).join(''):'<div class="empty">첫 장면이 나오면<br>불판도 시작됩니다.</div>'}</div><div class="panel-footer" style="font-size:9px">내부 스탯이나 주사위가 아닌, 경기에서 보이는 장면에 반응합니다.</div></aside></div>`;
}
function eventLabel(type) {
 const labels={coach_comms:'COACH COMMS · 코치 보이스',draft:'DRAFT · 밴픽',first_blood:'FIRST BLOOD · 퍼스트 킬',firstBlood:'FIRST BLOOD · 퍼스트 킬',trade_kill:'TRADE KILL · 교환 킬',call_conflict:'TEAM CALL · 콜 충돌',side_push:'SIDE PUSH · 사이드 운영',kill:'KILL · 킬',trade:'TRADE · 교환 킬',gank:'GANK · 라인 개입',dragon:'DRAGON · 드래곤',baron:'BARON · 내셔 남작',objective:'OBJECTIVE · 오브젝트',teamfight:'TEAM FIGHT · 한타',fight:'TEAM FIGHT · 교전',tower:'TOWER · 포탑',vision:'VISION · 시야',nexus:'NEXUS · 경기 종료',end:'NEXUS · 경기 종료',laning:'LANING · 라인전',comeback:'COMEBACK · 반격',review:'REVIEW · 복기',solo_kill:'SOLO KILL · 솔로 킬',counter_gank:'COUNTER GANK · 역갱',invade:'INVADE · 정글 침투',bot_skirmish:'BOT 2v2 · 바텀 교전',tower_dive:'DIVE · 포탑 다이브',outplay:'OUTPLAY · 스킬 회피와 반격',vision_catch:'PICK · 시야 밖에서 끊기',decisive_fight:'DECISIVE FIGHT · 결정적 한타',reset:'RESET · 귀환과 재정비',baron_steal:'BARON STEAL · 바론 스틸',objective_steal:'STEAL · 오브젝트 스틸',objective_contest:'CONTEST · 오브젝트 교전'};
 return labels[type]||String(type||'MATCH EVENT').replaceAll('_',' ').toUpperCase();
}
function renderCalendar() {
 const s=state.room.season,[year,month]=state.month.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate(),start=first.getUTCDay(),selected=state.selectedDate||s.date,schedule=s.schedule||[],club=state.room.clubSchedule||[],dailyClub=club.filter(x=>x.date===selected),dailyPractice=(state.room.scrimSchedule||[]).filter(x=>x.date===selected),selectedHoliday=(state.room.vacationWindows||[]).find(w=>selected>=w.start&&selected<=w.end)&&!schedule.some(m=>m.date===selected&&ownMatch(m)),details=schedule.filter(m=>m.date===selected),cells=[];
 for(let i=0;i<42;i++){const day=i-start+1,inMonth=day>0&&day<=days,d=new Date(Date.UTC(year,month-1,day)),date=d.toISOString().slice(0,10),matches=schedule.filter(m=>m.date===date),appointments=club.filter(x=>x.date===date),practice=(state.room.scrimSchedule||[]).find(x=>x.date===date),holiday=(state.room.vacationWindows||[]).find(w=>date>=w.start&&date<=w.end)&&!matches.some(ownMatch),own=matches.filter(ownMatch);const sorted=[...own,...matches.filter(m=>!ownMatch(m))];cells.push(`<button class="calendar-cell ${!inMonth?'outside':''} ${date===s.date?'today':''} ${date===selected?'selected':''}" data-action="select-date" data-date="${date}" aria-label="${date}, ${matches.length}경기, 팀 활동 ${appointments.length}건"><span class="cal-date">${d.getUTCDate()}</span>${sorted.slice(0,2).map(m=>`<span class="cal-match ${ownMatch(m)?'own':''} ${m.status==='completed'?'done':''}" title="${e(m.stage)} · ${e(m.teamA)} vs ${e(m.teamB)}">${m.result?`${e(m.teamA)} ${m.result.scoreA}:${m.result.scoreB}`:m.teamA&&m.teamB?`${e(m.teamA)} · ${e(m.teamB)}`:`${e(m.stage)} 대진 미정`}</span>`).join('')}${practice?`<span class="cal-match cal-club">스크림 · ${e(practice.opponent)}</span>`:''}${date===s.cupDraft?.date&&s.cupDraft.previous?'<span class="cal-match cal-club">시즌 전 미디어데이</span>':''}${holiday?'<span class="cal-match cal-vacation">선수단 휴가</span>':''}${appointments.map(x=>`<span class="cal-match cal-club ${x.status==='completed'?'done':''}" title="${e(x.location)}">${e(x.title)}</span>`).join('')}${matches.length>2?`<span class="cal-more">+${matches.length-2}경기</span>`:!matches.length&&!appointments.length&&!holiday&&inMonth?'<span class="cal-more">훈련·휴식</span>':''}</button>`);if(i>=34&&day>=days)break;}
 return pageHead(`${gameYear()} SEASON CALENDAR`,'시즌 캘린더','게임 날짜 기준: 한국시간(KST). 초기 대회 날짜를 바탕으로, 성적에 따라 진출팀과 후속 대진이 정해집니다.',`<button class="button" data-action="calendar-today">오늘로 이동</button>`)+`<div class="calendar-layout"><section class="panel"><div class="calendar-header"><h2>${year}<span class="muted" style="font-size:14px;margin:0 6px">/</span>${String(month).padStart(2,'0')} <span class="tiny-label" style="margin-left:8px">${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][month-1]}</span></h2><div class="row"><button class="icon-btn" data-action="calendar-prev" aria-label="이전 달">‹</button><button class="icon-btn" data-action="calendar-next" aria-label="다음 달">›</button></div></div><div class="calendar-week">${['SUN','MON','TUE','WED','THU','FRI','SAT'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div><div class="calendar-legend"><span><i class="legend-dot"></i>우리 팀 경기</span><span><i class="legend-dot blue"></i>다른 팀 경기</span><span><i class="legend-dot club"></i>팀 고정 활동</span><span>흐리게 표시: 정산 완료</span></div></section><aside class="panel day-detail"><div class="panel-header"><h2>일정 상세</h2>${selected===s.date?'<span class="tag green">TODAY</span>':''}</div><div class="panel-body"><h3>${formatDate(selected,true)}</h3><p class="note">${selected<s.date?'지나간 날짜':selected===s.date?'현재 게임 날짜':'예정된 날짜'} · KST</p>${(state.room.scrimSchedule||[]).filter(x=>x.date===selected).map(x=>`<div class="notice section-gap">상세 스크림 · ${e(x.opponent)} · BO3 · ${x.status==='completed'?'완료':'전략 선택 필요'}</div>`).join('')}${selectedHoliday?'<div class="notice section-gap">선수단 휴가 · 훈련 선택 없이 개인 일상을 보내는 날입니다.</div>':''}${selected===s.cupDraft?.date&&s.cupDraft.previous?`<div class="notice section-gap">LCK 컵 미디어데이 · 바론 대표 ${e(s.cupDraft.previous.champion)} / 장로 대표 ${e(s.cupDraft.previous.runnerUp)} · ${s.cupDraft.status==='completed'?'그룹 지명 완료':'그룹 지명 예정'}</div>`:''}${dailyClub.map(clubActivityHTML).join('')}${details.length?details.map(m=>`<div class="day-match"><div class="eyebrow">${e(m.stage)} · ${e(roundLabel(m))}</div><div class="teams">${e(m.teamA||'진출팀 미정')} <span class="muted">vs</span> ${e(m.teamB||'진출팀 미정')}</div><div class="row between"><span class="tag ${ownMatch(m)?'green':''}">BO${m.bestOf}${ownMatch(m)?' · 우리 경기':''}</span><span class="tiny-label">${m.status==='completed'?'정산 완료':m.status==='pending'?'대진 미정':'대진 확정'}</span></div>${m.result?`<p class="result" style="margin-top:12px">${m.result.scoreA} : ${m.result.scoreB} · ${e(m.result.winner)} 승리</p><button class="text-link" data-action="watch-match" data-id="${e(m.id)}">중계 기록 읽기 →</button>`:''}</div>`).join(''):dailyClub.length||dailyPractice.length||selectedHoliday?'':`<div class="empty" style="padding:32px 0">${selected>=(s.startDate||'2025-01-13')&&selected<=(s.endDate||'2025-11-09')?'확정 경기가 없는 날입니다.<br>훈련·분석·휴식으로 준비할 수 있습니다.':`${gameYear()} 게임 시즌 외의 날짜입니다.`}</div>`}</div><div class="panel-footer">예선 통과 전에는 후속 대진이 표시되지 않을 수 있습니다. 세부 진행 규칙은 게임 안내를 확인하세요.</div></aside></div>${renderQualifications()}${renderLckStandings(state.room,renderStandings([...(s.standings||[])].sort((a,b)=>b.wins-a.wins||(b.setWins-b.setLosses)-(a.setWins-a.setLosses))))}${renderEwcTournament(state.room,displayTeam)}${renderDemaciaTournament(state.room,displayTeam)}<div class="notice section-gap">대회 기간을 기준으로 만든 시뮬레이션 대진입니다. ${gameYear()===2026?'2026년 API 기반 보조 캘린더의 경기 날짜를 사용하되 진출팀은 게임 결과로 바뀝니다.':'2025년은 대회 기간 안에서 경기 날짜와 대진을 재구성한 기존 간소화 모델입니다.'} 동률 판정·상대 지명·세부 규정 일부는 간소화했습니다. <button class="text-link" data-action="nav" data-view="rules">자세한 규칙 →</button></div>`;
}
function renderPlayerDetails(c) {
 return `<div class="player-head">${portrait(c,'medium')}<span class="position-badge">${e(c.position)}</span><div><h2>${e(playerLabel(c))}</h2><p>${e(c.name)} · ${e(c.age)}세 · ${e(c.team||'소속 미정')} · 1군</p></div></div><div class="detail-list"><span>주력 <strong>${e(c.mainChampion)}</strong></span><span>배경 <strong>${e(state.meta.characterBackgrounds?.find(b=>b.id===c.background)?.name||'기본 선수')}</strong></span><span>성향 <strong>${e(c.style||'균형 운영')}</strong></span></div><div class="mini-stats">${Object.entries(statName).map(([key,label])=>`<div class="mini-stat"><strong>${Math.round(effectiveStat(c,key))}</strong>${label}</div>`).join('')}</div>${c.appearance||c.personality||c.memo?`<div class="detail-list">${c.appearance?`<span data-authored-text>외관 · ${e(c.appearance)}</span>`:''}${c.personality?`<span data-authored-text>성격 · ${e(c.personality)}</span>`:''}</div>${c.memo?`<p class="note" data-authored-text style="margin-top:10px">${e(c.memo)}</p>`:''}`:''}` + renderReadiness(c,{open:readinessOpen}) + renderEventEffects(c);
}
function renderOpponentEventEffects(team) {
 const affected=(team.players||[]).filter(c=>c.eventEffects?.length);
 return affected.length?`<div class="world-opponent-effects">${affected.map(c=>`<div><strong>${e(playerLabel(c))} · ${e(posName[c.position])}</strong>${renderEventEffects(c)}</div>`).join('')}</div>`:'';
}
function renderRoster() {
 const r=state.room,s=r.season;
 return pageHead(`${s.team} · FIRST TEAM ROSTER`,'선수단 정보','내 선수의 성장과 빈자리를 채운 NPC의 능력치를 함께 확인합니다. 상대 기본 전력은 시즌 시작 때 정하며, 이벤트로 경기 적용 능력치가 일시적으로 바뀔 수 있습니다. 팀 이름은 LCK 목록으로 고정됩니다.',`<button class="button" data-action="edit-portrait">프로필 사진 변경</button>`)+`<div class="roster-cards">${(r.roster||r.players.map(p=>p.character)).map(c=>{const human=r.players.find(p=>p.character.id===c.id);return `<section class="panel player-card"><div class="panel-header"><span class="tag ${human?'green':''}">${human?'PLAYER':'ROSTER NPC'}</span><span class="tiny-label">1군 · ${e(posName[c.position])}</span></div><div class="panel-body"><div class="player-head">${portrait(c,'medium')}<span class="position-badge">${e(c.position)}</span><div><h2>${e(playerLabel(c))}</h2><p>${e(human?.ownerName||'빈 포지션을 담당하는 팀원')} ${human?.userId===state.session.user.id?'· 나의 선수':''}</p></div></div>${Object.entries(statName).map(([key,label])=>`<div class="stat-line"><label>${label}</label><div class="bar"><span style="width:${Math.max(0,Math.min(100,effectiveStat(c,key)))}%"></span></div><strong>${Math.round(effectiveStat(c,key))}</strong></div>`).join('')}<div class="state-pills"><span class="state-pill">컨디션 ${Math.round(c.condition||0)}</span><span class="state-pill">피로 ${Math.round(c.fatigue||0)}</span><span class="state-pill">스트레스 ${Math.round(c.stress||0)}</span></div>${renderEventEffects(c)}<div class="divider" style="margin:15px 0"></div><p class="note">주력 ${e(c.mainChampion)} · ${e(c.style||'균형 운영')}<br>챔피언 풀: ${e((c.pool||[]).join(', '))}</p></div></section>`}).join('')}</div><div class="section-heading section-gap"><h2>상대 팀 스카우팅</h2><span class="tiny-label">선수단의 현재 능력치와 플레이 성향입니다.</span></div><div class="npc-settings">${(Array.isArray(s.opponents)?s.opponents:Object.entries(s.opponents||{}).map(([name,v])=>({name,...v}))).map(t=>`<section class="panel opponent-view"><div class="row between"><h3>${e(t.name||t.team)}</h3><span class="tag blue">전력 ${e(t.power??'—')} · ${e(t.style||'균형 운영')}</span></div>${t.players?.length?`<div class="opponent-stats">${t.players.map(c=>`<div class="opponent-stat">${e(c.position)}<strong>${Math.round(Object.values(c.stats||{}).reduce((a,b)=>a+Number(b),0)/Math.max(1,Object.keys(c.stats||{}).length))}</strong></div>`).join('')}</div>`:'<p class="note">팀 전력과 플레이 성향을 경기 교전 판정에 반영합니다.</p>'}${renderOpponentEventEffects(t)}</section>`).join('')}</div><div class="notice section-gap">기본 능력치와 현재 상태는 구분됩니다. 피로·스트레스가 높으면 훈련으로 올린 능력도 경기에서 온전히 쓰지 못합니다. 분석은 운영, 합동 훈련은 소통, 휴식은 컨디션 관리에 도움이 됩니다.</div>`;
}
function locationSceneHTML(){const p=me();return renderLocationScene({location:p.location,players:state.room.players,roster:state.room.roster,me:p.userId,team:state.room.season.team,date:state.room.season.date});}
function refreshLocationScene() {
 const target=$('#location-scene');if(!target||state.view!=='dorm')return;
 const focused=document.activeElement?.matches('[data-scene-floor]');
 target.innerHTML=locationSceneHTML();normalizeTeamUI(target);if(focused)$('[data-scene-floor]',target)?.focus({preventScroll:true});
}
function moveInsideScene(x,y) {
 const player=me();if(!player||state.view!=='dorm'||state.busy||state.modal)return;
 const position={location:player.location,x:Math.max(8,Math.min(92,x)),y:Math.max(58,Math.min(90,y))};
 player.scenePosition=position;
 const sprite=$(`#location-scene [data-character-id="${CSS.escape(player.character.id)}"]`);
 sprite?.style.setProperty('--scene-x',`${position.x}%`);sprite?.style.setProperty('--scene-y',`${position.y}%`);
 clearTimeout(sceneMoveTimer);const version=++sceneMoveVersion,code=state.room.code;pendingSceneMove={code,position,version};
 sceneMoveTimer=setTimeout(async()=>{
  try{const data=await api(`/api/rooms/${encodeURIComponent(code)}/move`,{method:'POST',body:position});if(version===sceneMoveVersion&&state.room?.code===code){pendingSceneMove=null;setRoom(data.room,false);refreshLocationScene();}}
  catch(error){if(version===sceneMoveVersion){pendingSceneMove=null;toast(error.message,true);}}
 },250);
}
function renderDorm() {
 const p=me(),s=state.room.season,locations=state.meta.locations||['연습실','거실','주방','분석실','헬스장','매니저실','경기장','PC방','편의점','식당','카페','클리닉'];
 const normalizeLoc=x=>typeof x==='string'?x:x.name||x.id;
 const scenery={'연습실':'헤드셋을 내려놓자 키보드 소리가 남았다. 옆자리 모니터에는 방금 끝난 게임의 리플레이가 멈춰 있다.','거실':'소파에 누군가 벗어 둔 팀 재킷이 걸려 있다. TV에서는 다른 팀의 경기 영상이 나온다.','주방':'냉장고 문에 식단표가 붙어 있다. 매니저가 이름 옆에 체크 표시를 했다.','분석실':'분석관이 바텀 강가를 확대했다. 와드 하나가 화면 중앙에 남아 있다.','헬스장':'트레이너가 손목 상태부터 물었다. 벤치 옆에 물병이 놓였다.','매니저실':'문 옆에 이번 주 이동 일정이 붙어 있다. 매니저가 의자를 하나 당겨 줬다.','경기장':'백스테이지에 케이블 박스가 쌓여 있다. 무대 쪽에서 음향 확인 소리가 들렸다.','PC방':'옆자리에서 의자가 밀렸다. 메뉴판에는 새 야식이 추가돼 있다.','편의점':'도시락 진열대 앞에서 잠깐 멈췄다. 점원이 계산대 위 영수증을 정리한다.','식당':'팀원들이 구석 테이블을 맡아 뒀다. 물컵은 다섯 개다.','카페':'창가 자리에서 숙소로 가는 길이 보인다. 휴대폰에 팀 단톡방 알림이 떴다.','클리닉':'대기표의 숫자가 바뀌었다. 의사가 다음 경기 날짜를 확인했다.'};
 const rel=(s.relationships||[]).filter(x=>x.userId===p.userId);
 return pageHead('TEAM HOUSE & DAILY LIFE','숙소 및 개인 활동','장소를 옮기고 동료와 이야기하세요. 이동과 자유 대화는 턴을 쓰지 않으며, 능력치 변화는 정산 행동으로만 발생합니다.')+`<section class="panel location-scene-panel"><div id="location-scene">${locationSceneHTML()}</div><div class="panel-footer">바닥을 누르거나 장면에 포커스를 두고 방향키·WASD로 이동합니다. 선수 캐릭터를 누르면 프로필을 볼 수 있습니다. 이동은 턴과 능력치를 바꾸지 않습니다.</div></section><div class="dorm-layout section-gap"><section class="panel"><div class="panel-header"><h2>이동 지도</h2><span class="tag green">현재 ${e(p.location||'연습실')}</span></div><div class="panel-body"><div class="map-category">TEAM HOUSE / OUTSIDE</div><div class="dorm-map">${locations.map((raw,i)=>{const loc=normalizeLoc(raw);return `<button class="map-place ${p.location===loc?'current':''}" data-action="move" data-location="${e(loc)}"><span aria-hidden="true">${['⌘','▱','☕','▤','↟','▣','⚑','⌨','▥','♧','◌','✚'][i%12]}</span>${e(loc)}</button>`}).join('')}</div><div class="divider"></div><div class="eyebrow accent" style="margin-bottom:10px">${e(p.location||'연습실')} · ${e(playerLabel(p.character))}</div><p class="life-prose">${e(scenery[p.location]||'문을 열고 들어섰다. 팀원에게 현재 위치를 알렸다.')}</p><button class="button ghost" data-action="nav" data-view="chat">선수단 채팅에서 이어가기 →</button></div></section><div class="stack"><section class="panel"><div class="panel-header"><h2>고정 듀오 · 훈련 파트너</h2><span class="eyebrow">TRAINING PARTNER</span></div><div class="panel-body"><p class="note" style="margin-bottom:14px">고정 파트너가 없으면 듀오 행동 정산 시 임시 NPC가 배정됩니다. 임시 배정은 활동 후 해제되며 기록만 남습니다. 로스터 NPC와는 별개입니다.</p><form class="partner-select" data-form="duo"><label class="field" style="flex:1">나의 파트너<select name="target"><option value="">고정 듀오 없음</option>${state.room.players.filter(x=>x.userId!==p.userId).map(x=>`<option value="${e(x.userId)}" ${p.duoId===x.userId?'selected':''}>${e(x.character.nickname)} · ${e(posName[x.character.position])}</option>`).join('')}${(state.room.roster||[]).filter(c=>!state.room.players.some(x=>x.character.id===c.id)).map(c=>`<option value="NPC:${e(c.position)}" ${p.duoId===`NPC:${c.position}`?'selected':''}>${e(playerLabel(c))} · NPC ${e(posName[c.position])}</option>`).join('')}</select></label><button class="button" type="submit" style="align-self:end">등록</button></form></div></section><section class="panel"><div class="panel-header"><h2>관계와 함께한 기억</h2><span class="eyebrow">RELATIONSHIP LOG</span></div><div class="panel-body">${rel.length?rel.map(x=>`<div class="relationship"><div class="row between"><strong>${e(x.targetName||x.targetId)}</strong><span class="tag green">친밀도 ${e(x.affinity)}</span></div>${(x.memories||[]).slice(0,3).map(m=>`<small>${shortDate(m.date)} · ${e(m.text)}</small>`).join('')}</div>`).join(''):'<p class="note">듀오 연습이나 합동 활동을 정산하면 함께한 기록이 쌓입니다. 오너 채팅은 캐릭터 관계에 반영되지 않습니다.</p>'}</div></section></div></div>`;
}
function renderChat() {
 const r=state.room,dm=r.players.find(p=>p.userId===state.dmTo),channelName=state.chat==='owner'?'오너 라운지':state.chat==='team'?`${r.season.team||'대기실'} 선수단`:dm?`${dm.character.nickname} · 개인 메시지`:'개인 메시지';
 const messages=(r.messages||[]).filter(m=>m.channel===state.chat&&(state.chat!=='dm'||((m.senderId===state.session.user.id&&m.to===state.dmTo)||(m.senderId===state.dmTo&&m.to===state.session.user.id))));
 return pageHead(state.view==='owner'?'OWNER MESSENGER':'TEAM MESSENGER',state.view==='owner'?'오너 메신저':'선수단 메신저',state.view==='owner'?'실제 참가자끼리 일정과 잡담을 나누는 공간입니다. 선수 대화와 게임 판정에 영향을 주지 않습니다.':'캐릭터로 대화하는 공간입니다. 개인 메시지는 두 당사자에게만 보입니다.')+`<section class="panel chat-layout ${state.view==='owner'?'owner-chat-layout':''}"><aside class="chat-channels" ${state.view==='owner'?'hidden':''}><div class="chat-section-label">IN CHARACTER</div><button class="channel ${state.chat==='team'?'active':''}" data-action="chat-channel" data-channel="team"><span>#</span>${e(r.season.team||'대기실')} 선수단</button><div class="chat-section-label">DIRECT MESSAGES</div>${r.players.filter(p=>p.userId!==state.session.user.id).map(p=>`<button class="channel ${state.chat==='dm'&&state.dmTo===p.userId?'active':''}" data-action="chat-channel" data-channel="dm" data-to="${e(p.userId)}"><span>○</span>${e(playerLabel(p.character))}</button>`).join('')}</aside><div class="chat-main"><div class="panel-header"><div><h2>${e(channelName)}</h2><p>${state.chat==='owner'?'실제 유저의 일정 조율·잡담. 경기 판정·관계에 반영되지 않습니다.':state.chat==='team'?'선수 캐릭터로 대화합니다. @코치 · @분석관 · @매니저에게 말을 걸어보세요.':'당사자만 조회할 수 있는 캐릭터 개인 대화입니다.'}</p></div><span class="tag ${state.chat==='owner'?'blue':'green'}">${state.chat==='owner'?'OUT OF CHARACTER':state.chat==='dm'?'PRIVATE':'IN CHARACTER'}</span></div><div class="chat-messages" role="log" aria-label="채팅 메시지">${messages.length?messages.map(m=>`<article class="message ${m.senderId===state.session.user.id?'own':''}">${state.chat!=='owner'&&r.players.some(p=>p.userId===m.senderId)?portrait(r.players.find(p=>p.userId===m.senderId).character):`<span class="avatar">${e((m.senderName||'S').slice(0,1))}</span>`}<div class="message-body"><div class="message-name">${e(m.channel!=='owner'&&r.players.find(p=>p.userId===m.senderId)?playerLabel(r.players.find(p=>p.userId===m.senderId).character):m.senderName)}<time>${new Date(m.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div><p class="message-text">${e(m.text)}</p></div></article>`).join(''):`<div class="empty">${state.chat==='owner'?'오늘 같이 진행할 시간을 이야기해 보세요.':'첫 메시지를 남겨보세요.'}</div>`}</div><form class="chat-form" data-form="chat"><label class="field"><span class="sr-only">${e(channelName)}에 메시지 보내기</span><textarea name="text" maxlength="2000" rows="2" placeholder="${state.chat==='owner'?'오너로 이야기하기…':'선수로 이야기하기…'}" required ${state.chat==='dm'&&!dm?'disabled':''}></textarea></label><div class="chat-form-footer"><small>${state.chat==='owner'?`표시 이름: ${e(state.session.user.name)}`:`표시 이름: ${e(me()?.character.nickname)}`} · 자유 대화는 스탯에 영향을 주지 않습니다.</small><button class="button primary" type="submit" ${state.chat==='dm'&&!dm?'disabled':''}>전송 ↑</button></div></form></div></section><div class="notice section-gap">경기 중 불판 반응은 경기 센터에서 확인할 수 있습니다. 이곳의 대화는 실제 참가자와 팀 스태프의 메시지입니다.</div>`;
}
function renderRules() {
 const rules=state.meta.seasonRules?.[gameYear()]||state.room?.season.rules||state.meta.rules;
 return pageHead('GAME GUIDE & RULES','시작하기 전에.','구현한 범위와 간소화한 규칙을 숨기지 않습니다.')+`<section class="panel rules-body"><div class="panel-header"><h2>FIRST TEAM · 플레이 가이드</h2><span class="tag green">${gameYear()} 기준</span></div><div class="panel-body"><div class="rule-section"><h3>01. 나의 선수와 함께하는 방</h3><p>처음부터 모든 캐릭터는 1군입니다. 캐릭터 생성 때는 팀을 고르지 않고, 방의 전원이 준비한 다음 팀을 선택합니다. 다섯 개의 개인 캐릭터 슬롯과 최대 다섯 명의 시즌 방은 별개입니다. 참가할 때 선택한 선수가 해당 시즌에 복사되므로, 슬롯 편집은 진행 중인 시즌을 바꾸지 않습니다. 빈 포지션은 NPC 팀원이 채웁니다.</p></div><div class="rule-section"><h3>02. 대기실 → 시즌 시작 → 하루 정산</h3><p>새 방은 대기실에서 시작합니다. 초대코드로 다른 포지션 선수가 참가하고, 실제 참가자 전원이 준비를 누르면 방장이 팀 선택 단계로 진행합니다. 팀을 고른 뒤 시즌을 시작합니다. NPC 자리는 자동 준비됩니다. 대기 중에는 턴을 정산할 수 없습니다. 기존 시즌은 초기화하지 않고 계속 진행합니다.</p><p>각 유저는 자신의 행동을 제출·수정합니다. 전원 제출 후 방장이 정산합니다. 미제출자는 방장이 명시적으로 NPC 대행을 선택해야 합니다. 하루에 한 번만 정산되며, 지난 턴의 제출은 서버에서 거부됩니다. 방장이 ‘시즌 방 나가기’를 선택하면 권한이 이전되지만 단순히 탭을 닫으면 방장이 유지됩니다. 부재 전에 시즌 방 관리에서 다른 참가자에게 위임해 주세요. 혼자일 때만 최대 7일 자동 진행을 쓸 수 있고 우리 팀 경기일 전에 멈춥니다.</p></div><div class="rule-section"><h3>03. 실제 사건을 계산하는 경기</h3><p>상대의 포지션별 능력치, 팀 성향, 준비 행동, 컨디션과 피로를 사용해 사건별 교전을 판정합니다. 퍼스트 킬, 정글 개입, 교환 킬, 드래곤과 바론, 한타로 벌어진 차이가 다음 판정에 영향을 주고 넥서스 파괴로 끝납니다. KDA와 불판은 실제로 발생한 사건에서만 만들어집니다. BO1·BO3·BO5는 세트 승수로 구분됩니다.</p></div><div class="rule-section"><h3>04. 국제대회는 출전권을 얻어야 합니다</h3><ul><li>${gameYear()===2026?'2026년에는 LCK Cup 결승 진출 두 팀이 퍼스트 스탠드에 진출합니다.':'2025년에는 LCK Cup 우승팀만 퍼스트 스탠드에 진출합니다.'}</li><li>정규시즌 R1~2 상위 6팀이 Road to MSI에 참가하고, 통과한 두 팀이 MSI에 갑니다.</li><li>정규시즌 성적을 승계하며 이후 라운드와 플레이오프로 이어집니다. 라운드 수와 일정은 선택한 연도의 엔진 규칙을 따릅니다.</li><li>기본 월즈 출전권은 3장입니다. LCK 팀이 MSI 결승에 진출하면 4장을 부여합니다.</li><li>별도의 LCK 지역 선발전 없이 해당 연도의 플레이오프 경로를 사용합니다. 플레이-인·플레이오프 결과로 출전팀을 결정합니다.</li></ul></div><div class="rule-section"><h3>05. 날짜와 대진의 기준</h3><p>게임은 2026년 1월 12일부터 11월 15일까지 총 308턴, 2025년은 1월 13일부터 11월 9일까지 총 301턴입니다. 진행 중인 방은 원래 연도의 날짜와 기록을 유지합니다. 캘린더는 한국시간 날짜를 씁니다. 2026년은 독립된 커뮤니티의 API 기반 캘린더 스냅샷에서 한국시간 경기 날짜를 가져왔고, 진출팀과 후속 대진은 게임 결과에 맞춰 재편성합니다. 공식 원문 온라인 대조는 완료하지 못했습니다. 2025년은 기존 간소화 캘린더를 유지합니다. 실제 경기의 승패를 고정해 두지 않습니다. 세부 브래킷·동률 순위·상대 지명·피어리스의 모든 공식 규정을 완전 재현하지는 않습니다.</p></div>${Array.isArray(rules)?`<div class="rule-section"><h3>엔진에 적용된 세부 규칙</h3><ul>${rules.map(rule=>`<li>${e(typeof rule==='string'?rule:rule.text||rule.description||JSON.stringify(rule))}</li>`).join('')}</ul></div>`:rules?`<div class="rule-section"><h3>엔진에 적용된 세부 규칙</h3>${Object.entries(rules).map(([key,value])=>`<p><strong>${e(key)}</strong> · ${e(typeof value==='string'?value:JSON.stringify(value))}</p>`).join('')}</div>`:''}<div class="rule-section"><h3>06. 저장·동기화·개인정보</h3><p>캐릭터 슬롯, 참가 방과 시즌은 서버에 저장됩니다. 새로고침 후 같은 기기 계정으로 복원합니다. 접속 쿠키를 지우면 기기 계정을 되찾을 수 없으므로 주의해 주세요. 외부 로그인이나 계정 복구는 구현하지 않았습니다. 서로 다른 기기·브라우저에서는 서로 다른 유저로 참가합니다. 오너 채팅·선수단 채팅·개인 메시지는 분리되며, 개인 슬롯과 DM은 서버에서 접근을 제한합니다.</p></div><div class="rule-section"><h3>07. 일상과 비용</h3><p>이동과 자유 롤플은 턴과 스탯을 바꾸지 않습니다. 실제 성장·상태 변화와 듀오 관계 기록은 정산 행동으로만 적용합니다. 일정·경기·기본 NPC·불판에는 생성형 AI를 호출하지 않습니다. 별도의 AI 키나 호출 비용이 필요하지 않으며, 서버 운영과 저장 비용은 호스팅 환경에 따릅니다.</p></div></div></section>`;
}

function openModal(kind, data={}) {
 state.modal={kind,...data};
 if(kind==='slot'||kind==='portrait'){
  const character=kind==='slot'?state.session.slots[data.index]:me()?.character;
  state.modal.avatar=safePortrait(character?.avatar);
  state.modal.avatarSource=safePortrait(character?.avatarSource)||state.modal.avatar;
  state.modal.avatarCrop=normalizePortraitCrop(character?.avatarCrop);
  state.modal.legacyPortrait=Boolean(state.modal.avatar&&!safePortrait(character?.avatarSource));
 }
 renderModal();setTimeout(()=>$('#modal-root input:not([type=hidden]), #modal-root select')?.focus(),70);
}
function closeModal() {const notification=['world-event','tournament-reward','life-event'].includes(state.modal?.kind);if(state.modal?.kind==='world-event'){seenWorldEvents.add(state.modal.key);while(seenWorldEvents.size>200)seenWorldEvents.delete(seenWorldEvents.values().next().value);try{localStorage.setItem('first-team.world-seen',JSON.stringify([...seenWorldEvents]));}catch{}}if(state.modal?.kind==='tournament-reward'){seenTournamentRewards.add(state.modal.key);while(seenTournamentRewards.size>200)seenTournamentRewards.delete(seenTournamentRewards.values().next().value);try{localStorage.setItem('first-team.title-seen',JSON.stringify([...seenTournamentRewards]));}catch{}}if(state.modal?.kind==='life-event'){dismissedLifeEvents.add(state.modal.key);while(dismissedLifeEvents.size>200)dismissedLifeEvents.delete(dismissedLifeEvents.values().next().value);try{localStorage.setItem('first-team.life-dismissed',JSON.stringify([...dismissedLifeEvents]));}catch{}}portraitDrag=null;state.modal=null;$('#modal-root').innerHTML='';if(notification)queueMicrotask(()=>{if(state.room&&state.session?.user&&!state.modal)render();});}
function renderModal() {
 const modal=state.modal;if(!modal){$('#modal-root').innerHTML='';return;}
 let title='',description='',body='',footer='',wide=false,form='';
 if(modal.kind==='standings'){
  title='순위 확인';description='LCK 정규시즌 순위 · 대회 대진과 진출 · POM';wide=true;body=renderQuickStandings(modal.tab);footer='<button class="button primary" type="button" data-action="close-modal">닫기</button>';
 }else if(modal.kind==='team-roster'){
  title='우리 로스터';description=`${state.room.season.team} · 현재 선수단`;wide=true;body=renderQuickRoster();footer='<button class="button primary" type="button" data-action="close-modal">닫기</button>';
 }else if(modal.kind==='world-event'){
  const event=state.room?.season.worldEvents?.events.find(x=>x.id===modal.eventId);if(!event||worldEventKey(event)!==modal.key){closeModal();return;}
  title='우리 팀에 영향을 주는 소식';description='리그 소식 · 선수단 영향';body=renderWorldEventPopup(state.room,event);footer='<button class="button primary" type="button" data-action="close-modal">확인</button>';
 }else if(modal.kind==='tournament-reward'){
  const reward=tournamentMoments(state.room).find(r=>r.id===modal.rewardId&&r.players.some(p=>p.userId===state.session.user.id));
  if(!reward||tournamentRewardKey(reward)!==modal.key){closeModal();return;}
  title=reward.kind==='stage-wrap'?`${reward.tournament} · ${tournamentMomentLabel(reward)}`:reward.placement==='champion'?'대회 우승':'대회 준우승';description=reward.kind==='stage-wrap'?'일정 마무리 · 선수단 대화':'대회 최종 성적 · 선수단 보상';body=renderTournamentReward(reward,state.session.user.id);footer='<button class="button primary" type="button" data-action="close-modal">확인</button>';
 }else if(modal.kind==='life-event'){
  const entry=state.room?.season.dailyLife?.entries.find(x=>x.id===modal.entryId&&x.userId===state.session.user.id);title=entry?.kind==='setback'?'일상 사건 · 컨디션 이슈':'일상 사건';description='선택에 따른 능력치와 선수 상태 변화';
  const active=!!entry&&!entry.answer&&!state.room.season.finished&&entry.turn===state.room.season.turn-1&&!state.room.broadcast&&!state.room.vacation;body=renderLifeEvent(entry,active);footer=`<button class="button primary" type="button" data-action="close-modal">${entry?.answer?'확인':'닫기'}</button>`;
 }else if(modal.kind==='slot') {
  const c=state.session.slots[modal.index]||{name:'',nickname:'',age:19,background:'rookie',team:null,position:'MID',mainChampion:'아리',pool:['아리','오리아나','아지르','신드라','사일러스'],style:'균형 운영'};
  title=`SLOT 0${modal.index+1} · ${c.id?'선수 편집':'선수 등록'}`;description='내 오리지널 캐릭터로 프로게이머 생활을 시작합니다.';wide=true;form='slot';
  body=`<div class="notice" style="margin-bottom:20px">모든 선수는 처음부터 <strong>1군</strong>으로 시작합니다. 기본 능력치 65에 선택한 배경의 소폭 보너스를 적용하며, 시즌 행동에 따라 성장합니다.</div><input type="hidden" name="index" value="${modal.index}">${portraitEditor(c)}<div class="form-grid"><label class="field">선수 이름 <span class="field-required">필수</span><input name="name" maxlength="24" placeholder="김선우" value="${e(c.name)}" required></label><label class="field">선수 닉네임 <span class="field-required">필수</span><input name="nickname" maxlength="24" placeholder="Rookie" value="${e(playerLabel(c))}" required></label><label class="field">나이<input type="number" name="age" min="17" max="60" value="${c.age||19}" required></label><div class="field">소속 팀<span class="note">대기실에서 준비를 마친 뒤 함께 선택합니다.</span></div><label class="field">포지션<select name="position">${state.meta.positions.map(p=>`<option value="${e(p)}" ${c.position===p?'selected':''}>${e(posName[p]||p)} · ${e(p)}</option>`).join('')}</select></label><label class="field">플레이 성향<select name="style">${styleNames.map(s=>`<option ${c.style===s?'selected':''}>${s}</option>`).join('')}</select></label><div class="field full champion-recommendation"><div class="row between"><label class="champion-auto-toggle"><input type="checkbox" name="autoChampions" ${(c.autoChampions??!c.id)?'checked':''}> 포지션·성향에 맞춰 챔피언 자동 추천</label><button class="button small ghost" type="button" data-action="recommend-champions">추천 다시 적용</button></div><p class="note" data-champion-recommendation></p></div><label class="field">시그니처 챔피언<input name="mainChampion" maxlength="30" value="${e(c.mainChampion)}" required></label><label class="field">주력 챔피언 풀<input name="pool" maxlength="500" value="${e((c.pool||[]).join(', '))}" placeholder="아리, 오리아나, 아지르, 신드라"><small>쉼표로 구분 · 최대 20개 · 주력 챔피언 자동 포함</small></label><label class="field full">선수 배경<select name="background">${backgroundOptions(state.meta.characterBackgrounds,c.background||'none')}</select><div class="background-preview" data-background-preview>${backgroundPreview(state.meta.characterBackgrounds,c.background||'none')}</div></label><label class="field full">외관<textarea name="appearance" maxlength="1000" rows="2" placeholder="선수의 인상, 스타일 등을 적어주세요.">${e(c.appearance)}</textarea></label><label class="field full">성격<textarea name="personality" maxlength="1000" rows="2" placeholder="말투, 팀에서의 모습 등을 적어주세요.">${e(c.personality)}</textarea></label><label class="field full">캐릭터 메모<textarea name="memo" maxlength="2000" rows="2" placeholder="알아두고 싶은 선수의 이야기.">${e(c.memo)}</textarea></label></div>`;
  footer='<p class="note">기존 시즌의 선수와 기록은 바뀌지 않습니다.</p><button class="button primary" type="submit">슬롯에 저장 →</button>';
 } else if(modal.kind==='awards') {
  title='POM · 시즌 시상식';description='올해의 선수와 올프로를 향한 시즌 기록';wide=true;body=renderSeasonAwards(state.room);
 } else if(modal.kind==='delete-slot') {
  const character=state.session.slots[modal.index];
  if(!character){closeModal();return;}
  title='저장된 캐릭터 삭제';description=`SLOT 0${modal.index+1}의 선수 설정을 삭제합니다.`;form='delete-slot';
  body=`<input type="hidden" name="index" value="${modal.index}"><div class="slot-delete-target">${portrait(character,'medium')}<div><strong>${e(character.nickname)}</strong><span>${e(character.name)} · ${e(posName[character.position])}</span></div></div><p class="notice section-gap">저장 슬롯만 삭제하며 진행 중인 시즌의 선수·기록은 유지됩니다.</p><p class="note section-gap">삭제한 슬롯 설정은 되돌릴 수 없습니다.</p>`;
  footer='<button class="button ghost" type="button" data-action="close-modal" data-delete-cancel>취소</button><button class="button danger" type="submit">이 캐릭터 슬롯 삭제</button>';
 } else if(modal.kind==='portrait') {
  title='나의 선수 프로필 사진';description='현재 시즌의 내 선수 사진만 변경합니다. 이름, 능력치와 진행 기록은 유지됩니다.';form='portrait';
  body=portraitEditor(me().character)+'<p class="note">캐릭터 슬롯의 사진은 별도로 보관됩니다. 슬롯 사진을 수정해도 진행 중인 시즌의 사진은 바뀌지 않습니다.</p>';
  footer='<p class="note">사진은 같은 방의 참가자에게 보입니다.</p><button class="button primary" type="submit">사진 저장하기</button>';
 } else if(modal.kind==='create') {
  title='시즌 방 만들기';description='선수와 연도를 선택하면 대기실로 이동합니다. 소속 팀은 모두 준비한 뒤 함께 정합니다.';wide=true;form='create-room';
  body=`<label class="field">참가할 캐릭터<select name="slot" required>${state.session.slots.map((c,i)=>c?`<option value="${i}" ${state.slot===i?'selected':''}>SLOT 0${i+1} · ${e(playerLabel(c))} · ${e(c.team||'소속 미정')} ${e(posName[c.position])}</option>`:'').join('')}</select></label><div class="form-section-title">시즌 방 설정</div><div class="form-grid"><input type="hidden" name="year" value="2026"><div class="field">시즌<span class="tag green">2026 LCK</span></div><label class="field">방 이름<input name="name" maxlength="60" value="우리의 새 시즌" required></label><label class="field">난이도<select name="difficulty"><option value="easy">여유롭게 · 쉬움</option><option value="normal" selected>표준 시즌 · 보통</option><option value="hard">치열한 시즌 · 어려움</option></select></label><label class="field">로스터 NPC 전력 기준<select name="npcPowerMode"><option value="team" selected>선택한 팀 전력에 맞춤 · 권장</option><option value="custom">직접 숫자로 설정</option></select><small>팀을 고르면 빈 포지션의 기본 능력을 해당 팀 전력에 맞춥니다.</small></label><label class="field">직접 설정할 NPC 기본 능력<input name="npcPower" type="number" min="35" max="95" value="65" disabled><small data-npc-power-help>팀 선택 후 자동 배정 · 유저 선수는 캐릭터 능력치를 사용합니다.</small></label></div><div class="form-section-title">상대 팀 전력 · 시즌 시작 후 고정</div><p class="note" style="margin-bottom:12px">팀별 35~95 범위의 게임 전력과 성향을 설정합니다. 기본값은 2026년 경기 기록으로 계산한 참고 전력입니다. 상대 성향은 게임용 설정입니다. 소속 팀은 전원 준비를 마친 뒤 선택합니다. 선택한 팀의 설정은 상대에서 제외됩니다. 팀 이름은 LCK 목록으로 고정되며 임의 이름 변경은 제공하지 않습니다.</p><div class="npc-settings">${state.meta.teams.map((t,i)=>`<div class="opponent-row"><label for="opponent-${i}">${e(teamProfiles().find(p=>p.name===t)?.displayName||t)}</label><input aria-label="${e(t)} 가상 전력" id="opponent-${i}" name="power-${i}" type="number" min="35" max="95" value="${teamProfiles().find(p=>p.name===t)?.power||65}"><select aria-label="${e(t)} 운영 성향" name="style-${i}">${styleNames.map((s,j)=>`<option ${(teamProfiles().find(p=>p.name===t)?.style||'균형 운영')===s?'selected':''}>${s}</option>`).join('')}</select></div>`).join('')}</div><div class="notice section-gap">국제대회는 자동 출전하지 않습니다. 2026년 Cup 결승 진출 두 팀 → 퍼스트 스탠드, Road to MSI 통과 → MSI, 시즌 최종 성적 → 월즈로 이어집니다.</div>`;
  footer='<p class="note">방을 만들면 대기실로 이동합니다. 혼자도 준비 후 시작할 수 있습니다.</p><button class="button primary" type="submit">시즌 방 만들기 →</button>';
 } else if(modal.kind==='join') {
  title='초대 코드로 참가';description='친구의 시즌에 나의 선수를 등록합니다.';form='join-room';
  body=`<div class="form-grid"><label class="field full">초대 코드<input name="code" maxlength="20" placeholder="ABCDEF" style="text-transform:uppercase;letter-spacing:3px;font-family:monospace" autocomplete="off" required></label><label class="field full">참가할 캐릭터<select name="slot">${state.session.slots.map((c,i)=>c?`<option value="${i}" ${state.slot===i?'selected':''}>${e(playerLabel(c))} · ${e(c.team||'소속 미정')} ${e(posName[c.position])}</option>`:'').join('')}</select></label></div><div class="notice section-gap">이미 등록된 포지션으로는 참가할 수 없습니다. 새 시즌의 소속 팀은 대기실에서 전원 준비 후 함께 정합니다. 다른 참가자의 캐릭터를 대신 조작하지 않습니다.</div>`;
  footer='<p class="note">초대 코드와 캐릭터의 포지션을 확인해 주세요.</p><button class="button primary" type="submit">시즌에 합류 →</button>';
 } else if(modal.kind==='character') {
  const c=[...state.room.players.map(p=>p.character),...(state.room.roster||[])].find(c=>c.id===modal.characterId);
  if(!c){closeModal();return;}
  const member=state.room.players.find(p=>p.character.id===c.id);
  title=`${c.nickname} · 선수 프로필`;description=`${state.room.season.team||'소속 미정'} 1군 · ${member?'참가 선수':'NPC 팀원'}`;
  body=renderPlayerDetails(c)+`<div class="state-pills"><span class="state-pill">컨디션 ${Math.round(c.condition||0)}</span><span class="state-pill">피로 ${Math.round(c.fatigue||0)}</span><span class="state-pill">스트레스 ${Math.round(c.stress||0)}</span></div><p class="note section-gap">챔피언 풀: ${e((c.pool||[]).join(', '))}</p>`;
  footer=`<p class="note">같은 방에 등록된 선수 정보입니다.</p>${member?.userId===state.session.user.id?'<button class="button" type="button" data-action="edit-portrait">내 프로필 사진 변경</button>':''}<button class="button primary" type="button" data-action="close-modal">돌아가기</button>`;
 } else if(modal.kind==='balance') {
  const balance=state.room?.balance;
  if(!balance){closeModal();return;}
  title='빈 포지션 NPC 전력 조정';description='이후 경기부터 선택한 팀의 기준으로 NPC를 구성합니다.';form='balance';
  body=`<div class="balance-change"><span>현재 NPC 기본 능력<strong>${e(balance.npcPower)}</strong></span><b aria-hidden="true">→</b><span>팀 기준 NPC 기본 능력<strong>${e(balance.teamNpcPower)}</strong></span></div><p class="note section-gap">유저 캐릭터의 능력치와 이미 끝난 경기 기록은 유지합니다. 다음 경기부터 로스터의 빈자리를 채우는 NPC에 적용되며 승리를 보장하는 기능은 아닙니다.</p>`;
  footer='<button class="button ghost" type="button" data-action="close-modal">돌아가기</button><button class="button primary" type="submit">이 전력으로 조정</button>';
 } else if(modal.kind==='profile') {
  title='오너 프로필';description='실제 유저의 표시 이름입니다. 선수 닉네임과 구분됩니다.';form='profile';
  body=`<p class="note">아이디 · ${e(state.session.user.username)}</p><label class="field section-gap">계정 닉네임<input name="name" value="${e(state.session.user.name)}" minlength="2" maxlength="24" required></label><div class="account-controls"><button type="button" class="button ghost" data-action="password-settings">비밀번호 변경</button><button type="button" class="button ghost" data-action="logout">로그아웃</button>${state.session.user.role==='admin'?'<button type="button" class="button ghost" data-action="nav" data-view="invites">초대장 관리</button>':''}</div>`;footer='<p class="note">대기실과 오너 채팅에서 이 닉네임으로 표시됩니다.</p><button class="button primary" type="submit">저장하기</button>';
 } else if(modal.kind==='password') {
  title='비밀번호 변경';description='다른 기기의 로그인은 함께 해제됩니다.';form='password';
  body='<div class="stack"><label class="field">현재 비밀번호<input type="password" name="currentPassword" autocomplete="current-password" maxlength="128" required></label><label class="field">새 비밀번호<input type="password" name="newPassword" autocomplete="new-password" minlength="8" maxlength="128" required></label><label class="field">새 비밀번호 확인<input type="password" name="passwordConfirm" autocomplete="new-password" minlength="8" maxlength="128" required></label></div>';footer='<button class="button primary" type="submit">비밀번호 변경</button>';
 } else if(modal.kind==='demacia-decline') {
  title='데마시아컵 초청 거절';description='구단 전체의 참가 결정';form='demacia-decline';body='<p class="note">초청을 거절하면 차순위 적격 팀에게 참가권이 넘어갑니다. 기존 경기 기록과 다른 대회의 출전권은 유지됩니다.</p>';footer='<button class="button" type="button" data-action="close-modal">돌아가기</button><button class="button danger" type="submit">초청 거절 확정</button>';
 } else if(modal.kind==='takeover') {
  title='미제출자 NPC 대행';description='이 턴의 미제출자를 기다리지 않고 명시적으로 정산합니다.';form='takeover';
  const missing=state.room.players.filter(p=>!state.room.submissions[p.userId]||state.room.submissions[p.userId].turn!==state.room.season.turn);
  body=`<p class="note">아래 참가자의 이번 턴 행동이 NPC의 기본 <strong class="accent">휴식</strong>으로 대행됩니다. 대행 사실과 기본 행동은 시즌 기록에 남습니다. 제출한 참가자의 행동은 그대로 적용합니다.</p><div class="divider"></div>${missing.map(p=>`<div class="room-entry"><strong>${e(playerLabel(p.character))}</strong><span class="tag">미제출 → 휴식 대행</span></div>`).join('')}<div class="notice red section-gap">${formatDate(state.room.season.date)} 하루를 정산합니다. 이후 지난 턴으로 되돌릴 수 없습니다.</div>`;footer='<button class="button ghost" type="button" data-action="close-modal">더 기다리기</button><button class="button primary" type="submit">대행하고 하루 정산</button>';
 } else if(modal.kind==='room-controls') {
  title='현재 방 관리';description=state.room.name+' · '+state.room.code;
  body=`<p class="note">${formatDate(state.room.season.date)} · ${state.room.players.length}명 참가</p><div class="stack section-gap"><button class="button" data-action="nav" data-view="lobby">참가 방과 방장 위임 관리</button><button class="button ghost" data-action="leave-room">방 나가기</button>${host()?`<button class="button danger" data-action="reset-room" ${liveBroadcast()?'disabled':''}>시즌 초기화</button><p class="note">초기화는 방장만 할 수 있으며, 중계 중에는 사용할 수 없습니다.</p>`:''}</div>`;
 } else if(modal.kind==='reset-room') {
  title='이 방의 시즌 초기화';description='현재 참가자 모두의 시즌 진행이 초기화됩니다.';form='reset-room';
  body='<div class="notice red">경기 결과·순위·훈련으로 성장한 능력치·관계·시즌 사건을 지우고 대기실부터 다시 시작합니다. 되돌릴 수 없습니다.</div><p class="note section-gap">방 코드·참가자·계정·등록한 캐릭터 슬롯·채팅은 유지합니다. 방 안의 선수 능력치는 배경별 초기값으로 돌아가며, 전원 준비 후 팀과 그룹을 다시 정합니다.</p><label class="field section-gap">계속하려면 <strong>초기화</strong>를 입력하세요.<input name="confirmation" autocomplete="off" required placeholder="초기화"></label>';
  footer='<button class="button ghost" type="button" data-action="close-modal">취소</button><button class="button danger" type="submit">시즌 초기화하기</button>';
 } else if(modal.kind==='leave') {
  title='시즌 방 나가기';description='내 참가 선수가 빠진 자리는 NPC가 담당합니다.';form='leave';body='<p class="note">다른 참가자가 남아 있으면 시즌 기록과 채팅은 유지됩니다. 방장이 나가면 다음 참가자에게 방장이 넘어갑니다. 마지막 참가자가 나가면 이 방과 채팅은 삭제되며 같은 코드로 재참가할 수 없습니다. 계정과 등록한 캐릭터 슬롯은 유지됩니다.</p>';footer='<button class="button" type="button" data-action="close-modal">취소</button><button class="button danger" type="submit">이 방에서 나가기</button>';
 } else if(modal.kind==='menu') {
  title='나의 게임';description='선수와 방을 관리합니다.';
  body=`<div class="stack" style="gap:9px">${[['lobby','시즌 방 관리'],['slots','캐릭터 슬롯'],['notices','공지사항'],['rules','게임 안내']].map(([key,label])=>`<button class="button full" data-action="nav" data-view="${key}">${label} →</button>`).join('')}<button class="button full" data-action="profile">오너 닉네임 설정</button>${state.room?'<button class="button full" data-action="room-controls">현재 방 관리 · 나가기 / 초기화</button>':''}</div>`;
 }
 $('#modal-root').innerHTML=`<div class="modal-backdrop" data-backdrop="true"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="modal-head"><div><h2 id="dialog-title">${title}</h2><p>${description}</p></div><button class="icon-btn" data-action="close-modal" aria-label="창 닫기">×</button></header>${form?`<form data-form="${form}">`:''}<div class="modal-body">${body}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}${form?'</form>':''}</section></div>`;
 normalizeTeamUI($('#modal-root'));
 if(modal.kind==='slot'||modal.kind==='portrait')hydratePortraitSource(modal);
 if(modal.kind==='slot')refreshChampionRecommendation($('[data-form="slot"]'));
}
function refreshChampionRecommendation(form,{force=false}={}){
 if(!form)return;
 const enabled=form.querySelector('[name="autoChampions"]'),hint=form.querySelector('[data-champion-recommendation]');
 if(!enabled?.checked&&!force){if(hint)hint.textContent='직접 설정 중입니다. 포지션·성향을 바꿔도 입력한 챔피언은 유지됩니다.';return;}
 const position=form.querySelector('[name="position"]').value,style=form.querySelector('[name="style"]').value,rec=state.meta.championRecommendations?.[position]?.[style];
 if(!rec)return;
 enabled.checked=true;form.querySelector('[name="mainChampion"]').value=rec.mainChampion;form.querySelector('[name="pool"]').value=rec.pool.join(', ');
 if(hint)hint.textContent=`${posName[position]} · ${style} 추천: ${rec.reason} 직접 입력하면 자동 추천이 꺼집니다.`;
}
function validateSlot() {if(!state.session.slots.some(Boolean)){toast('먼저 나의 선수를 만들어 주세요.');openModal('slot',{index:state.slot});return false;}return true;}
async function roomCommand(command,body={}) {body={seasonId:state.room.season.id,...body};const data=await api(`/api/rooms/${encodeURIComponent(state.room.code)}/${command}`,{method:'POST',body});if(data.room)setRoom(data.room);return data;}
async function settle(npcTakeover=false) {
 if(liveBroadcast()){navigate('match');return;}
 const before=state.room.season.date;
 const data=await roomCommand('settle',{turn:state.room.season.turn,npcTakeover,live:true});if(state.modal?.kind==='takeover'){closeModal();render();}
 if(liveBroadcast()){state.liveSetNumber=null;navigate('match');toast('실시간 중계를 시작했습니다. 최종 결과는 경기 종료 후 확정됩니다.');return data;}
 const match=getMatches().find(m=>m.date===before&&ownMatch(m));
 if(match){state.matchId=match.id;state.setIndex=0;state.eventCount=1;navigate('match');toast('경기 정산 완료. 첫 장면부터 중계를 읽어보세요.');}
 else toast(`${formatDate(before)} 정산 완료. 다음 하루로 이동했습니다.`);
 return data;
}
function afterEventRender() {render();const list=$('#event-list');if(list)list.scrollTop=list.scrollHeight;}
function stepEvents(delta) {stopPlayback();const m=selectedMatch();if(!m)return;const len=m.result.sets[state.setIndex]?.events.length||0;state.eventCount=Math.max(1,Math.min(len,state.eventCount+delta));afterEventRender();}
function togglePlayback() {
 if(liveBroadcast())return;
 if(state.playing){stopPlayback();render();return;}
 const m=selectedMatch(),len=m?.result.sets[state.setIndex]?.events.length||0;if(!len)return;
 if(state.eventCount>=len)state.eventCount=1;state.playing=true;render();
 playbackTimer=setInterval(()=>{if(state.view!=='match'){stopPlayback();return;}state.eventCount++;if(state.eventCount>=len){state.eventCount=len;stopPlayback();}afterEventRender();},1500);
}
document.addEventListener('click', async ev=>{
 const button=ev.target.closest('[data-action]');
 if(!button){if(ev.target.dataset.backdrop==='true')closeModal();const floor=ev.target.closest('[data-scene-floor]');if(floor){const rect=floor.getBoundingClientRect();floor.focus({preventScroll:true});moveInsideScene((ev.clientX-rect.left)/rect.width*100,(ev.clientY-rect.top)/rect.height*100);}return;}
 if(button.disabled||state.busy)return;
 const action=button.dataset.action;
 try {
  if(action==='nav'){if(button.dataset.view==='invites')await refreshInvitations();if(button.dataset.view==='notices')await refreshNotices();navigate(button.dataset.view);return;}
  if(action==='set-strategy'){const p=liveBroadcast()?.intermission;if(!p)return;await roomCommand('set-strategy',{turn:state.room.season.turn,matchId:p.matchId,nextSet:p.nextSet,strategy:button.dataset.plan});state.liveSetNumber=null;render();return;}
  if(action==='play-scrim'){await roomCommand('scrim',{turn:state.room.season.turn,id:button.dataset.id,focus:button.dataset.plan});toast('스크림을 마쳤습니다. 결과와 복기를 확인하세요.');return;}
  if(action==='notice-refresh'){await refreshNotices();render();return;}
  if(action==='notice-new'){state.noticeEditor={title:'',body:'',category:'안내',pinned:false};state.noticeDelete=null;render();return;}
  if(action==='notice-edit'){const n=state.notices.find(n=>n.id===button.dataset.id);if(n){state.noticeEditor={...n};state.noticeDelete=null;render();}return;}
  if(action==='notice-cancel'){state.noticeEditor=null;render();return;}
  if(action==='notice-delete'){state.noticeDelete=button.dataset.id;render();return;}
  if(action==='notice-cancel-delete'){state.noticeDelete=null;render();return;}
  if(action==='notice-confirm-delete'){const n=state.notices.find(n=>n.id===button.dataset.id);if(n){await api('/api/notices/'+encodeURIComponent(n.id),{method:'DELETE',body:{revision:n.revision}});state.noticeDelete=null;if(state.noticeEditor?.id===n.id)state.noticeEditor=null;await refreshNotices();render();toast('공지를 삭제했습니다.');}return;}
  if(action==='cup-draft-pick'||action==='cup-draft-auto'){await roomCommand('cup-draft',{turn:state.room.season.turn,pickNumber:state.room.season.cupDraft.picks.length+1,...(button.dataset.team?{team:button.dataset.team}:{}),...(action==='cup-draft-auto'?{remaining:true}:{})});render();return;}
  if(action==='watch-live'){state.liveSetNumber=null;navigate('match');return;}
  if(action==='live-set'){state.liveSetNumber=Number(button.dataset.number);render();return;}
  if(action==='follow-live'){state.liveSetNumber=null;render();return;}
  if(liveBroadcast()&&['choose-action','submit-action','settle','auto','takeover','select-set','event-prev','event-next','play-events','all-events'].includes(action)){toast('경기가 진행 중입니다. 공개되는 중계 장면을 함께 기다려 주세요.');return;}
  if(action==='close-modal'){closeModal();return;}
  if(action==='mobile-menu'){openModal('menu');return;}
  if(action==='awards'){openModal('awards');return;}
  if(action==='recommend-champions'){refreshChampionRecommendation(button.closest('form'),{force:true});return;}
  if(action==='password-settings'){openModal('password');return;}
  if(action==='refresh-invitations'){await refreshInvitations();render();return;}
  if(action==='copy-site-invite'){await navigator.clipboard.writeText(location.origin+'/?invite='+encodeURIComponent(state.invitationIssued.code));toast('사이트 초대 링크를 복사했습니다.');return;}
  if(action==='profile'){openModal('profile');return;}
  if(action==='review-balance'){if(liveBroadcast()){toast('중계가 끝난 뒤 NPC 전력을 조정할 수 있습니다.');return;}openModal('balance');return;}
  if(action==='scene-profile'){openModal('character',{characterId:button.dataset.characterId});return;}
  if(action==='edit-portrait'){openModal('portrait');return;}
  if(action==='remove-portrait'){if(state.modal){state.modal.photoRequest=(state.modal.photoRequest||0)+1;state.modal.photoLoading=false;state.modal.avatar=null;state.modal.avatarSource=null;state.modal.avatarCrop=normalizePortraitCrop();state.modal.portraitImage=null;state.modal.legacyPortrait=false;portraitDrag=null;const submit=$('#modal-root [type=submit]');if(submit)submit.disabled=false;refreshPortraitEditor();}return;}
  if(action==='reset-portrait-crop'){changePortraitCrop(normalizePortraitCrop());return;}
  if(action==='select-slot'){state.slot=Number(button.dataset.index);if(!state.session.slots[state.slot])openModal('slot',{index:state.slot});else if(state.view==='slots'){openModal('slot',{index:state.slot});}else render();return;}
  if(action==='edit-slot'){openModal('slot',{index:Number(button.dataset.index||state.slot)});return;}
  if(action==='delete-slot'){
   const index=Number(button.dataset.index||state.slot);if(!state.session.slots[index]){toast('이미 비어 있는 슬롯입니다.');return;}
   openModal('delete-slot',{index});setTimeout(()=>$('[data-delete-cancel]')?.focus(),80);return;
  }
  if(action==='open-create'){if(validateSlot())openModal('create');return;}
  if(action==='open-join'){if(validateSlot())openModal('join');return;}
  if(action==='copy-code'){try{await navigator.clipboard.writeText(state.room.code);toast(`초대 코드 ${state.room.code}를 복사했습니다.`);}catch{toast(`초대 코드: ${state.room.code}`);}return;}
  if(action==='choose-action'){state.selectedAction=button.dataset.id;render();return;}
  if(action==='watch-match'){state.matchId=button.dataset.id;state.setIndex=0;state.eventCount=1;navigate('match');return;}
  if(action==='select-set'){stopPlayback();state.setIndex=Number(button.dataset.index);state.eventCount=1;render();return;}
  if(action==='event-prev'){stepEvents(-1);return;}
  if(action==='event-next'){stepEvents(1);return;}
  if(action==='play-events'){togglePlayback();return;}
  if(action==='all-events'){stopPlayback();state.eventCount=selectedMatch().result.sets[state.setIndex].events.length;afterEventRender();return;}
  if(action==='calendar-today'){state.month=state.room.season.date.slice(0,7);state.selectedDate=state.room.season.date;render();return;}
  if(action==='calendar-prev'||action==='calendar-next'){const [y,m]=state.month.split('-').map(Number);state.month=new Date(Date.UTC(y,m-1+(action==='calendar-next'?1:-1),1)).toISOString().slice(0,7);render();return;}
  if(action==='select-date'){state.selectedDate=button.dataset.date;render();return;}
  if(action==='vacation-day'||action==='vacation-end'){const result=await roomCommand('vacation',{turn:state.room.season.turn,untilEnd:action==='vacation-end'});toast(`휴가 ${result.days}일을 보냈습니다.`);return;}
  if(action==='demacia-decline'){openModal('demacia-decline');return;}
  if(action==='standings-modal'){openModal('standings',{tab:'team'});return;}
  if(action==='team-roster-modal'){openModal('team-roster');return;}
  if(action==='standings-tab'){if(state.modal?.kind==='standings'){state.modal.tab=['team','tournament','pom'].includes(button.dataset.tab)?button.dataset.tab:'team';renderModal();}return;}
  if(action==='world-event-open'){const event=state.room.season.worldEvents?.events.find(e=>e.id===button.dataset.id);if(event)openModal('world-event',{eventId:event.id,key:worldEventKey(event)});return;}
  if(action==='tournament-reward'){const reward=tournamentMoments(state.room).find(r=>r.id===button.dataset.id&&r.players.some(p=>p.userId===state.session.user.id));if(reward)openModal('tournament-reward',{rewardId:reward.id,key:tournamentRewardKey(reward)});return;}
  if(action==='life-open'){const entry=state.room.season.dailyLife?.entries.find(x=>x.id===button.dataset.entry&&x.userId===state.session.user.id);if(entry)openModal('life-event',{entryId:entry.id,seasonId:state.room.season.id,turn:state.room.season.turn,key:lifeEventKey(entry)});return;}
  if(action==='life-answer'){state.busy=true;button.disabled=true;const modal=state.modal;await roomCommand('life',{seasonId:modal?.seasonId||state.room.season.id,turn:modal?.turn??state.room.season.turn,entryId:button.dataset.entry,choice:button.dataset.choice});state.busy=false;render();return;}
  if(action==='chat-channel'){state.chat=button.dataset.channel;state.dmTo=button.dataset.to||'';render();return;}
  if(action==='takeover'){openModal('takeover');return;}
  if(action==='room-controls'){openModal('room-controls');return;}
  if(action==='reset-room'){if(!host())return;openModal('reset-room',{seasonId:state.room.season.id,turn:state.room.season.turn});return;}
  if(action==='leave-room'){openModal('leave');return;}
  state.busy=true;button.setAttribute('aria-busy','true');
  if(action==='logout'){await api('/api/auth/logout',{method:'POST',body:{}});resetLoginState();state.auth.status=(await api('/api/session')).auth||{};renderAuth();}
  else if(action==='revoke-invitation'){await api('/api/invitations/'+encodeURIComponent(button.dataset.id),{method:'DELETE'});if(state.invitationIssued?.invitation.id===button.dataset.id)state.invitationIssued=null;await refreshInvitations();render();toast('초대장을 취소했습니다.');}
  else if(action==='resume-room'){const data=await api(`/api/rooms/${encodeURIComponent(button.dataset.code)}`);setRoom(data.room,false);navigate(waitingRoom()?'lobby':'home');}
  else if(action==='lobby-ready'){await roomCommand('ready',{ready:!state.room.lobby?.ready?.[state.session.user.id]});toast(state.room.lobby?.ready?.[state.session.user.id]?'준비를 완료했습니다.':'준비를 취소했습니다.');}
  else if(action==='lobby-prepare'){await roomCommand('prepare');toast('전원 준비 완료. 소속 팀을 선택해 주세요.');}
  else if(action==='choose-team'){await roomCommand('team',{team:button.dataset.team});toast(`${button.dataset.team}을 선택했습니다. 시즌 시작을 눌러주세요.`);}
  else if(action==='lobby-start'){await roomCommand('start');navigate('home');toast('시즌을 시작했습니다. 오늘의 행동을 선택해 주세요.');}
  else if(action==='submit-action'){await roomCommand('action',{turn:state.room.season.turn,action:state.selectedAction});toast('나의 행동을 제출했습니다. 정산 전까지 수정할 수 있습니다.');}
  else if(action==='settle'){await settle(false);}
  else if(action==='auto'){const before=state.room.season.date;const data=await roomCommand('auto',{turn:state.room.season.turn});toast(data.days?`${data.days}일 자동 준비했습니다. ${state.room.season.date===before?'':formatDate(state.room.season.date)+'에 멈췄습니다.'}`:'오늘은 우리 팀 경기일입니다. 행동을 제출하고 직접 정산해 주세요.');}
  else if(action==='move'){clearTimeout(sceneMoveTimer);sceneMoveVersion++;pendingSceneMove=null;await roomCommand('location',{location:button.dataset.location});toast(`${button.dataset.location}(으)로 이동했습니다. 이동은 턴을 소모하지 않습니다.`);}
 } catch(err) {toast(err.message,true);} finally{state.busy=false;button.removeAttribute('aria-busy');if(action==='life-answer')button.disabled=false;}
});
document.addEventListener('submit',async ev=>{
 const form=ev.target.closest('[data-form]');if(!form)return;ev.preventDefault();if(state.busy)return;if(state.modal?.photoLoading){toast('사진 처리가 끝나면 저장해 주세요.');return;}
 const kind=form.dataset.form,data=Object.fromEntries(new FormData(form));const submit=form.querySelector('[type=submit]');state.busy=true;if(submit)submit.disabled=true;
 try {
  if(kind==='auth-login'||kind==='auth-register'){
   if(kind==='auth-register'&&data.password!==data.passwordConfirm)throw new Error('비밀번호 확인이 일치하지 않습니다.');
   const session=await api('/api/auth/'+(kind==='auth-login'?'login':'register'),{method:'POST',body:{username:data.username,password:data.password,...(kind==='auth-register'?{nickname:data.nickname,invitation:data.invitation}:{})}});
   state.auth.invitation='';await enterAccount(session);toast(kind==='auth-login'?'로그인했습니다.':'초대 가입을 완료했습니다.');
  }else if(kind==='notice'){
   const editor=state.noticeEditor;if(!editor)throw new Error('작성할 공지를 다시 선택해 주세요.');
   await api('/api/notices'+(editor.id?'/'+encodeURIComponent(editor.id):''),{method:editor.id?'PUT':'POST',body:{title:data.title,body:data.body,category:data.category,pinned:data.pinned==='on',revision:editor.revision}});state.noticeEditor=null;await refreshNotices();render();toast('공지를 저장했습니다.');
  }else if(kind==='issue-invitation'){
   state.invitationIssued=await api('/api/invitations',{method:'POST',body:{days:Number(data.days)}});await refreshInvitations();render();toast('초대장을 발급했습니다.');
  }else if(kind==='password'){
   if(data.newPassword!==data.passwordConfirm)throw new Error('비밀번호 확인이 일치하지 않습니다.');
   await api('/api/auth/password',{method:'POST',body:{currentPassword:data.currentPassword,newPassword:data.newPassword}});closeModal();toast('비밀번호를 변경했습니다. 다른 기기는 다시 로그인해야 합니다.');
  }else if(kind==='slot'){
   commitPortraitCrop();const index=Number(data.index);const character={...data,team:state.session.slots[index]?.team||null,...portraitFields(),age:Number(data.age),autoChampions:data.autoChampions==='on',pool:data.pool.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean)};delete character.index;
   const result=await api(`/api/slots/${index}`,{method:'PUT',body:{character}});state.session.slots=result.slots;state.slot=index;closeModal();render();toast('선수를 1군 캐릭터 슬롯에 저장했습니다.');
  }else if(kind==='delete-slot'){
   const result=await api(`/api/slots/${Number(data.index)}`,{method:'DELETE'});state.session.slots=result.slots;closeModal();render();toast('캐릭터 슬롯을 삭제했습니다. 진행 중인 시즌 기록은 유지됩니다.');
  }else if(kind==='portrait'){
   commitPortraitCrop();await roomCommand('portrait',portraitFields());closeModal();render();toast('현재 시즌의 프로필 사진을 저장했습니다.');
  }else if(kind==='balance'){
   await roomCommand('balance',{mode:'team'});closeModal();render();toast('다음 경기부터 빈 포지션 NPC에 팀 기준 전력을 적용합니다.');
  }else if(kind==='profile'){
   await api('/api/profile',{method:'POST',body:{name:data.name}});await refreshSession();closeModal();render();toast('오너 닉네임을 저장했습니다.');
  }else if(kind==='create-room'){
   const body={slot:Number(data.slot),year:Number(data.year),waitingRoom:true,chooseTeam:true,name:data.name,difficulty:data.difficulty,npcPower:Number(data.npcPower||65),npcPowerMode:data.npcPowerMode||'team',opponents:state.meta.teams.map((name,i)=>({name,power:Number(data[`power-${i}`]),style:data[`style-${i}`]}))};
   const result=await api('/api/rooms',{method:'POST',body});await refreshSession();setRoom(result.room,false);closeModal();navigate(waitingRoom()?'lobby':'home');toast('대기실을 만들었습니다. 동료를 초대하고 준비를 눌러주세요.');
  }else if(kind==='join-room'){
   const result=await api('/api/rooms/join',{method:'POST',body:{slot:Number(data.slot),code:data.code.trim().toUpperCase()}});await refreshSession();setRoom(result.room,false);closeModal();navigate(waitingRoom()?'lobby':'home');toast('선수단에 합류했습니다.');
  }else if(kind==='takeover'){await settle(true);}
  else if(kind==='demacia-decline'){await roomCommand('demacia-decline');closeModal();toast('초청권을 차순위 팀에게 넘겼습니다.');}
  else if(kind==='owner-dock'){
   const code=state.room.code,channel=dockChannel,draftKey=code+':'+channel,text=data.text.trim();if(!text)throw new Error('메시지를 입력해 주세요.');
   const result=await api(`/api/rooms/${encodeURIComponent(code)}/chat`,{method:'POST',body:{channel,text}});
   ownerDrafts.delete(draftKey);const input=$('#owner-dock-text');if(input&&state.room?.code===code&&dockChannel===channel)input.value='';
   if(state.room?.code===code)setRoom(result.room,false);refreshOwnerDock();
  }
  else if(kind==='lobby-chat'){
   const text=data.text.trim();if(!text)throw new Error('메시지를 입력해 주세요.');await roomCommand('chat',{channel:'owner',text});
  }else if(kind==='chat'){
   const text=data.text.trim();if(!text)throw new Error('메시지를 입력해 주세요.');await roomCommand('chat',{channel:state.chat,text,...(state.chat==='dm'?{to:state.dmTo}:{})});
  }else if(kind==='duo'){await roomCommand('duo',{target:data.target||null});toast(data.target?'고정 훈련 파트너를 등록했습니다.':'고정 파트너를 해제했습니다. 듀오 일정에는 임시 NPC가 배정됩니다.');}
  else if(kind==='transfer'){await roomCommand('transfer',{userId:data.userId});toast('방장을 위임했습니다.');}
  else if(kind==='reset-room'){const reset=state.modal;await roomCommand('reset',{seasonId:reset.seasonId,turn:reset.turn,confirmation:data.confirmation});await refreshSession();closeModal();navigate('lobby');toast('시즌을 초기화했습니다. 전원 준비 후 팀을 다시 선택하세요.');}
  else if(kind==='leave'){
   const result=await roomCommand('leave');state.room=null;localStorage.removeItem('first-team.room');await refreshSession();closeModal();navigate('lobby');toast(result.deleted?'시즌 방에서 나왔습니다. 빈 방과 채팅을 정리했습니다.':'시즌 방에서 나왔습니다.');
  }
 }catch(err){toast(err.message,true);}finally{state.busy=false;if(submit)submit.disabled=false;}
});
document.addEventListener('input',ev=>{
 const key=ev.target.dataset.portraitControl;if(!['x','y','zoom'].includes(key))return;
 changePortraitCrop({[key]:Number(ev.target.value)/(key==='zoom'?1:100)});
});
document.addEventListener('pointerdown',ev=>{
 const frame=ev.target.closest('#portrait-crop-frame'),modal=state.modal;
 if(!frame||!modal?.portraitImage||modal.photoLoading||ev.button!==0)return;
 ev.preventDefault();frame.focus({preventScroll:true});
 portraitDrag={modal,pointerId:ev.pointerId,x:ev.clientX,y:ev.clientY,crop:{...modal.avatarCrop},width:frame.getBoundingClientRect().width};
 try{frame.setPointerCapture(ev.pointerId);}catch{}
});
document.addEventListener('pointermove',ev=>{
 const drag=portraitDrag;if(!drag||drag.pointerId!==ev.pointerId||drag.modal!==state.modal)return;
 ev.preventDefault();const image=drag.modal.portraitImage,side=Math.min(image.naturalWidth,image.naturalHeight)/drag.crop.zoom;
 const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;
 changePortraitCrop({x:image.naturalWidth>side?drag.crop.x-dx/drag.width*side/(image.naturalWidth-side):drag.crop.x,y:image.naturalHeight>side?drag.crop.y-dy/drag.width*side/(image.naturalHeight-side):drag.crop.y});
});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,ev=>{if(portraitDrag?.pointerId===ev.pointerId)portraitDrag=null;});
document.addEventListener('input',ev=>{
 if(!['mainChampion','pool'].includes(ev.target.name))return;const form=ev.target.closest('[data-form="slot"]');if(!form)return;
 form.querySelector('[name="autoChampions"]').checked=false;refreshChampionRecommendation(form);
});
document.addEventListener('change',async ev=>{
 if(['position','style','autoChampions'].includes(ev.target.name)){const form=ev.target.closest('[data-form="slot"]');if(form){refreshChampionRecommendation(form);return;}}
 if(ev.target.name==='background'){const preview=$('[data-background-preview]');if(preview)preview.innerHTML=backgroundPreview(state.meta.characterBackgrounds,ev.target.value);return;}
 if(ev.target.name==='npcPowerMode'){
  const form=ev.target.closest('[data-form="create-room"]'),input=form?.querySelector('[name="npcPower"]'),help=form?.querySelector('[data-npc-power-help]'),custom=ev.target.value==='custom';
  if(input){input.disabled=!custom;input.required=custom;}
  if(help)help.textContent=custom?'35~95 · 이 수치를 빈 포지션의 기본 능력으로 사용합니다.':'팀 선택 후 자동 배정 · 유저 선수는 캐릭터 능력치를 사용합니다.';
  return;
 }
 if(ev.target.matches('[data-portrait-file]')){
  const file=ev.target.files?.[0],modal=state.modal;if(!file||!modal)return;
  const request=modal.photoRequest=(modal.photoRequest||0)+1;modal.photoLoading=true;const submit=$('#modal-root [type=submit]');if(submit)submit.disabled=true;
  const status=$('#portrait-status');if(status)status.textContent='편집할 사진을 준비하는 중…';
  try{const prepared=await preparePortrait(file);if(state.modal===modal&&modal.photoRequest===request){Object.assign(modal,prepared,{legacyPortrait:false});refreshPortraitEditor();}}catch(error){if(state.modal===modal&&modal.photoRequest===request){refreshPortraitEditor();toast(error.message,true);}}finally{if(modal.photoRequest===request){modal.photoLoading=false;if(state.modal===modal&&submit)submit.disabled=false;}ev.target.value='';}
  return;
 }
 if(ev.target.id==='match-selector'){stopPlayback();state.matchId=ev.target.value;state.setIndex=0;state.eventCount=1;render();}
});
document.addEventListener('keydown',ev=>{
 if(document.activeElement?.id==='portrait-crop-frame'&&state.modal?.portraitImage){const crop=normalizePortraitCrop(state.modal.avatarCrop),key=ev.key;let changed;if(key==='ArrowLeft')changed={x:crop.x+.02};if(key==='ArrowRight')changed={x:crop.x-.02};if(key==='ArrowUp')changed={y:crop.y+.02};if(key==='ArrowDown')changed={y:crop.y-.02};if(key==='+'||key==='=')changed={zoom:crop.zoom+.05};if(key==='-')changed={zoom:crop.zoom-.05};if(changed){ev.preventDefault();changePortraitCrop(changed);return;}}
 if(document.activeElement?.matches('[data-scene-floor]')&&!state.modal){const movement={ArrowLeft:[-3,0],a:[-3,0],A:[-3,0],ArrowRight:[3,0],d:[3,0],D:[3,0],ArrowUp:[0,-2],w:[0,-2],W:[0,-2],ArrowDown:[0,2],s:[0,2],S:[0,2]}[ev.key];if(movement){ev.preventDefault();const p=me(),sprite=$('#location-scene .is-mine'),position=p.scenePosition?.location===p.location?p.scenePosition:{x:parseFloat(sprite?.style.getPropertyValue('--scene-x'))||50,y:parseFloat(sprite?.style.getPropertyValue('--scene-y'))||76};moveInsideScene(position.x+movement[0],position.y+movement[1]);return;}}
 if(ev.key==='Escape'&&state.modal)closeModal();
 if(ev.key==='Tab'&&state.modal){const nodes=[...$('#modal-root').querySelectorAll('button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
 if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)&&ev.target.matches('.chat-form textarea')){ev.preventDefault();ev.target.form.requestSubmit();}
});
function editing() {return !!state.modal||(document.activeElement?.id!=='owner-dock-text'&&!!document.activeElement?.matches('input,textarea,select,[data-scene-floor]'));}
document.addEventListener('focusout',()=>{setTimeout(()=>{if(state.pendingRender&&!editing()){state.pendingRender=false;render();}},30);});
async function pollRoom() {
 if(!state.room||state.busy||document.hidden||roomPollInFlight)return;
 const minimum=liveBroadcast()?650:2200;if(Date.now()-lastRoomPoll<minimum)return;
 lastRoomPoll=Date.now();roomPollInFlight=true;
 const code=state.room.code,revision=state.room.revision;
 try {const data=await api(`/api/rooms/${encodeURIComponent(code)}?since=${revision}`);if(state.room?.code!==code)return;if(data?.room){setRoom(data.room,false);refreshLiveStatus();if(editing()){if(document.activeElement?.matches('[data-scene-floor]'))refreshLocationScene();state.pendingRender=true;}else render();}state.pollError=false;}
 catch(err){if(!state.pollError){toast(`동기화 대기 중: ${err.message}`,true);state.pollError=true;}}
 finally{roomPollInFlight=false;}
}
function resetLoginState(){
 stopPlayback();state.pendingRender=false;state.auth.mode='login';state.session=null;state.room=null;state.modal=null;state.view='home';state.slot=0;state.dmTo='';state.invitations=[];state.invitationIssued=null;ownerDrafts.clear();
 $('#owner-dock')?.remove();$('#modal-root').innerHTML='';
}
function renderAuth(){
 $('#owner-dock')?.remove();$('#modal-root').innerHTML='';$('#app').innerHTML=renderAuthPage(state.auth);
}
async function refreshNotices(){state.notices=(await api('/api/notices')).notices;}
async function refreshInvitations(){state.invitations=(await api('/api/invitations')).invitations;}
async function enterAccount(session){
 state.session=session;state.meta=await api('/api/meta');state.notices=[];state.noticeEditor=null;state.noticeDelete=null;state.view='home';state.room=null;state.modal=null;
 const saved=localStorage.getItem('first-team.room');
 if(saved&&session.rooms?.some(r=>r.code===saved))try{setRoom((await api(`/api/rooms/${encodeURIComponent(saved)}`)).room,false);}catch{localStorage.removeItem('first-team.room');}
 render();if(!roomPollTimer)roomPollTimer=setInterval(pollRoom,650);
}
document.addEventListener('click',event=>{
 const tab=event.target.closest('[data-auth-mode]');if(!tab||state.busy)return;
 const current=$('[name="invitation"]');if(current)state.auth.invitation=current.value;
 state.auth.mode=tab.dataset.authMode;renderAuth();
});
async function boot() {
 try{
  const session=await api('/api/session');
  if(!session.authenticated){state.auth.status=session.auth||{};renderAuth();return;}
  await enterAccount(session);
 }catch(err){$('#app').innerHTML=`<div class="loading-screen"><h2>서버에 연결하지 못했습니다.</h2><p>${e(err.message)}</p><button class="button primary" id="retry-boot">다시 연결</button></div>`;$('#retry-boot').onclick=boot;}
}
boot();
