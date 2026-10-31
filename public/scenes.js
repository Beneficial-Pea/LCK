// Original team-house pixel scenes: no external assets or copied reference UI.
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const roles = { TOP:'탑', JGL:'정글', MID:'미드', ADC:'원딜', SUP:'서포터' };
const palettes = ['#b7ef61', '#83b8ed', '#ca9fea', '#e7b875', '#dc92a2'];
const skin = ['#e6bba0', '#cf9d7b', '#a77355', '#efd0b2'];
const hair = ['#24262e', '#5b4438', '#c6bda5', '#774f4a', '#3e4d58', '#b3b9c4'];
const hints = {
  '연습실':'모니터에 다음 상대의 리플레이가 멈춰 있다. 옆자리 선수가 헤드셋을 고쳐 쓴다.',
  '거실':'소파 앞 테이블에 배달 봉투가 놓였다. TV는 소리를 줄인 채 켜져 있다.',
  '주방':'냉장고 문에 식단표가 붙었다. 전자레인지가 한 번 울렸다.',
  '분석실':'프로젝터에 첫 귀환 시간이 표시됐다. 분석관이 리모컨을 내려놓는다.',
  '헬스장':'러닝머신 화면이 켜졌다. 벤치 옆에 팀 수건이 접혀 있다.',
  '매니저실':'다음 원정의 차량 배정표가 책상 위에 놓였다.',
  '경기장':'무대 위 모니터에 팀 로고가 떴다. 빈 관중석 쪽으로 음향 테스트가 흐른다.',
  'PC방':'키보드 소리가 칸막이를 넘어온다. 주문 알림이 카운터에서 울렸다.',
  '편의점':'냉장 진열대의 불이 켜졌다. 출입문 너머로 저녁 거리가 보인다.',
  '식당':'주문서가 주방으로 넘어갔다. 테이블에 물컵이 하나씩 놓인다.',
  '카페':'창가 자리에 햇빛이 걸렸다. 바리스타가 컵 뚜껑을 닫는다.',
  '클리닉':'진료 순서가 표시됐다. 손목 보호대 샘플이 선반에 놓여 있다.',
};
function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
const r = (x,y,w,h,fill,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

export function renderPixelSprite(character = {}) {
  const seed = hash(character.id || `${character.nickname}:${character.position}`);
  const tone = skin[seed % skin.length], color = palettes[Math.max(0, Object.keys(roles).indexOf(character.position)) % palettes.length];
  const top = hair[(seed >>> 3) % hair.length], dark = '#202632', light = '#eef4ec';
  return `<svg class="pixel-sprite" viewBox="0 0 32 44" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${
    r(7,40,20,3,'#080d1590') + r(8,2,16,3,top) + r(5,5,22,13,top) + r(7,11,18,10,tone) + r(5,13,2,5,tone) + r(25,13,2,5,tone) +
    r(7,9,18,4,top) + r(seed%2?8:18,11,5,4,top) + r(10,16,2,2,dark) + r(20,16,2,2,dark) + r(14,20,5,1,'#9d6d5e') +
    r(12,22,9,3,tone) + r(8,25,17,11,dark) + r(8,25,4,10,color) + r(22,25,3,10,color) + r(14,25,6,3,light) + r(16,28,2,7,color) +
    r(4,26,4,10,dark) + r(25,26,4,10,dark) + r(4,35,4,3,tone) + r(25,35,4,3,tone) +
    r(10,36,5,5,'#303947') + r(19,36,5,5,'#303947') + r(8,41,7,2,light) + r(19,41,8,2,light)
  }</svg>`;
}

function monitor(x,y,accent='#9cce7d',scale=1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${r(0,0,112,68,'#090f16')+r(5,5,102,56,'#243443')+r(11,11,60,3,accent)+r(11,20,90,3,'#485c6c')+r(11,29,72,3,'#354c60')+r(15,39,15,14,'#375b5b')+r(35,35,19,18,'#526b63')+r(59,42,29,11,'#253f51')+r(50,68,12,13,'#50606b')+r(32,80,48,5,'#6b7b7c')}</g>`;
}
function desk(x,y,w=155) {
  return r(x,y,w,9,'#56616a')+r(x+5,y+9,w-10,10,'#303b45')+r(x+9,y+19,7,52,'#24303c')+r(x+w-16,y+19,7,52,'#24303c');
}
function chair(x,y) { return r(x,y,45,44,'#243540')+r(x+5,y+5,35,27,'#354d55')+r(x+7,y+44,31,9,'#111c27')+r(x+19,y+53,7,26,'#485664')+r(x+4,y+77,38,4,'#465565'); }
function plant(x,y) { return r(x+4,y+35,29,31,'#495455')+r(x,y+31,37,7,'#728078')+r(x+15,y-6,6,40,'#6e9e6b')+r(x+2,y+4,15,13,'#648a68')+r(x+22,y+12,16,13,'#83a979'); }
function windowArt(x,y,w=150,h=100) {
  return r(x-6,y-6,w+12,h+12,'#46515a')+r(x,y,w,h,'#21394a')+r(x+7,y+9,w-14,h-18,'#365666')+r(x+w/2-3,y,6,h,'#697b80')+r(x,y+h/2-3,w,6,'#697b80')+r(x+10,y+h-25,23,16,'#233a47')+r(x+45,y+h-35,29,26,'#1e3441');
}
function shelves(x,y,w=150) {
  let out=r(x,y,w,133,'#293340')+r(x+6,y+8,w-12,117,'#17232d');
  for(let row=0;row<3;row++) { out+=r(x+6,y+37+row*39,w-12,5,'#65706e'); for(let col=0;col<5;col++)out+=r(x+15+col*24,y+14+row*39,12,23,['#647c83','#899079','#667187','#ab9376','#576e65'][col]); }
  return out;
}
function seatTable(x,y,w=115) { return r(x-10,y+24,30,40,'#344752')+r(x+w-20,y+24,30,40,'#344752')+desk(x,y,w)+r(x+20,y-7,12,7,'#b5c5bc')+r(x+w-32,y-7,12,7,'#b5c5bc'); }

function venueArt(location, team) {
  const type = Object.hasOwn(hints, location) ? location : '연습실';
  let art = '';
  if(type==='연습실' || type==='PC방') {
    const pc=type==='PC방'; art+=windowArt(30,35,100,105)+plant(817,142);
    for(const x of [160,340,520,700])art+=monitor(x,86,pc?'#83b8ed':'#b7ef61')+desk(x-18,171,150)+chair(x+29,188);
    art+=r(150,48,665,3,pc?'#618cc9':'#658c58')+r(150,54,200,2,'#2f4940');
    if(pc)art+=r(25,172,101,44,'#4a5260')+r(35,182,75,17,'#b9a772');
  } else if(type==='거실') {
    art+=windowArt(50,43,185,108)+r(323,45,264,127,'#070d13')+r(331,53,248,111,'#263d49')+r(369,87,168,5,'#7c9f79')+r(403,104,105,3,'#476c73');
    art+=r(272,181,356,52,'#465a5a')+r(253,198,394,50,'#374b4d')+r(262,188,28,64,'#516462')+r(612,188,27,64,'#516462')+r(295,218,140,6,'#688177')+r(451,218,143,6,'#688177');
    art+=desk(351,267,205)+r(414,255,66,12,'#91836e')+plant(760,160)+shelves(655,50,115);
  } else if(type==='주방') {
    art+=r(60,49,148,211,'#778383')+r(68,57,132,84,'#aab2a8')+r(68,149,132,103,'#889893')+r(179,85,7,29,'#3f555b')+r(179,168,7,41,'#3f555b');
    art+=r(249,165,531,13,'#b3b5a5')+r(259,178,511,82,'#4e6266')+r(266,187,157,62,'#344d55')+r(432,187,158,62,'#344d55')+r(599,187,162,62,'#344d55');
    art+=r(273,62,202,72,'#4b6065')+r(285,73,85,48,'#324a54')+r(379,73,85,48,'#324a54')+r(535,133,94,31,'#222f3a')+r(545,140,52,17,'#5d7985')+r(697,149,33,16,'#c5c5ac');
  } else if(type==='분석실') {
    art+=r(179,27,544,153,'#929f97')+r(187,35,528,137,'#263d42');
    for(const [x,y] of [[230,65],[291,112],[386,77],[493,128],[597,65]])art+=r(x,y,10,10,'#b7ef61')+r(x+15,y+2,42,3,'#617b75');
    art+=`<path d="M240 70 396 82 503 132 607 70" stroke="#7295a2" stroke-width="3" fill="none" stroke-dasharray="9 6"/>`+desk(230,237,440)+r(396,218,94,19,'#70827f')+plant(70,166)+plant(795,166);
  } else if(type==='헬스장') {
    art+=r(49,38,320,128,'#536670')+r(58,47,302,110,'#304752');
    for(const x of [91,230])art+=r(x,126,64,10,'#40525e')+r(x+47,130,9,103,'#7a8a8a')+r(x-9,225,94,18,'#243441')+r(x-4,230,84,8,'#52626b');
    art+=r(510,211,180,18,'#465866')+r(530,229,12,43,'#70818a')+r(659,229,12,43,'#70818a')+r(489,153,8,75,'#647780')+r(709,153,8,75,'#647780')+r(471,153,264,7,'#98a3a0')+r(477,141,20,31,'#27343f')+r(711,141,20,31,'#27343f')+shelves(754,70,100);
  } else if(type==='매니저실') {
    art+=shelves(52,53,142)+windowArt(671,43,166,109)+desk(257,202,350)+monitor(429,110,'#e7b875',.9)+r(293,180,82,18,'#b0b09a')+r(305,173,74,7,'#dde0c6')+chair(370,207)+plant(774,182);
    art+=r(275,46,125,78,'#59706f')+r(284,55,107,60,'#c5c8b1');
  } else if(type==='경기장') {
    art+=r(0,20,900,163,'#111a28')+r(235,42,430,103,'#1b3943')+r(248,55,404,75,'#244a50')+r(67,180,766,18,'#487b72')+r(45,198,810,92,'#172832')+r(45,198,810,5,'#9cd390');
    for(const [i,x] of [110,246,382,518,654].entries())art+=monitor(x,156,palettes[i],.85)+desk(x-10,230,118);
    art+=r(80,51,8,91,'#647b86')+r(810,51,8,91,'#647b86')+r(82,53,738,4,'#4d6475');
  } else if(type==='편의점') {
    art+=shelves(50,45,188)+shelves(265,45,188)+r(663,40,175,193,'#586b75')+r(672,49,157,175,'#324d5c');
    for(let row=0;row<4;row++) {art+=r(681,83+row*35,139,4,'#8ba0a2');for(let col=0;col<6;col++)art+=r(688+col*21,60+row*35,12,23,['#c6ad7b','#8fb3a6','#839bb6'][col%3]);}
    art+=desk(465,203,143)+r(493,177,59,26,'#3b515b')+r(500,182,44,13,'#9dc2ab');
  } else if(type==='식당' || type==='카페') {
    const cafe=type==='카페';art+=windowArt(30,36,218,116)+r(564,144,284,17,'#9eaa95')+r(577,161,257,77,'#51615b')+shelves(642,34,154);
    for(const [x,y]of [[84,216],[286,238],[489,251]])art+=seatTable(x,y,115);
    art+=plant(815,210);
    if(cafe)art+=r(586,107,70,37,'#273843')+r(592,114,58,19,'#7e938b')+r(682,128,21,16,'#cccfb4');
    else art+=r(568,100,224,10,'#344b50')+r(582,111,8,32,'#a0ab96')+r(740,111,8,32,'#a0ab96')+r(604,131,59,13,'#b5b89b');
  } else if(type==='클리닉') {
    art+=r(47,45,210,138,'#7c9693')+r(55,53,194,122,'#aebfb2')+r(148,63,8,102,'#536f70')+r(65,109,174,8,'#536f70');
    art+=r(328,181,271,35,'#a0b4aa')+r(336,174,65,12,'#d3dcc9')+r(335,216,8,52,'#5c7378')+r(578,216,8,52,'#5c7378')+shelves(680,63,135)+r(707,93,78,7,'#d5d9bc')+r(743,62,8,67,'#d5d9bc');
  }
  return `<svg class="scene-background" viewBox="0 0 900 360" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${r(0,0,900,360,'#182630')+r(0,0,900,210,'#22333d')+r(0,210,900,150,'#253845')+r(0,201,900,9,'#0e1d27')+r(0,18,900,4,'#354e59')}${[240,278,316,354].map(y=>r(0,y,900,2,'#344955')).join('')}<path d="M450 210 120 360M450 210 780 360M150 210 0 360M750 210 900 360" stroke="#344955" stroke-width="2"/>${art}<text x="450" y="${type==='경기장'?105:29}" text-anchor="middle" fill="${type==='경기장'?'#c6efb1':'#647f86'}" font-family="monospace" font-size="${type==='경기장'?24:10}" letter-spacing="5">${escape(team || 'FIRST TEAM')}</text></svg>`;
}

export function sceneOccupants({ location='연습실', players=[], roster=[], me=null }={}) {
  const people=players.filter(p=>(p.location || '연습실')===location).map(p=>({ character:p.character || {}, userId:p.userId, scenePosition:p.scenePosition?.location===location?p.scenePosition:null, mine:p.userId===me || p.character?.id===me, npc:false }));
  // NPC teammates have a stated default location; they never impersonate connected users.
  if(location==='연습실')for(const c of roster.filter(c=>c.npc===true))people.push({character:c,mine:false,npc:true});
  return people.slice(0,5);
}

export function renderLocationScene({location='연습실',players=[],roster=[],me=null,team='FIRST TEAM',date=''}={}) {
  const people=sceneOccupants({location,players,roster,me}),humanCount=people.filter(p=>!p.npc).length,npcCount=people.filter(p=>p.npc).length;
  const slots=people.length===1?[50]:people.length===2?[34,66]:people.length===3?[25,50,75]:people.length===4?[19,40,61,82]:[13,32,50,68,86];
  return `<section class="location-scene" aria-label="${escape(location)} 장소 장면"><div class="scene-heading"><div><span class="scene-eyebrow">TEAM HOUSE · PIXEL VIEW</span><h3>${escape(location)}</h3></div><span class="scene-population">이 장소의 참가자 ${humanCount}명${npcCount?` · NPC ${npcCount}명`:''}</span></div><div class="scene-stage venue-stage" data-scene="${escape(location)}" data-scene-floor tabindex="0" role="group" aria-label="${escape(location)} 이동 장면. 바닥을 누르거나 방향키와 WASD로 이동하세요.">${venueArt(location,team)}<div class="scene-people">${people.map(({character:c,mine,npc,userId,scenePosition},i)=>{
    const x=Number.isFinite(scenePosition?.x)?Math.max(8,Math.min(92,scenePosition.x)):slots[i],y=Number.isFinite(scenePosition?.y)?Math.max(58,Math.min(90,scenePosition.y)):73+(i%2)*7;
    return `<button class="scene-character ${mine?'is-mine':''}" style="--scene-x:${x}%;--scene-y:${y}%" data-action="scene-profile" data-character-id="${escape(c.id)}" ${userId?`data-user-id="${escape(userId)}"`:''} aria-label="${escape(c.nickname || '선수')} ${escape(roles[c.position] || '')}${mine?' 나의 선수':''}${npc?' NPC':''} 프로필 보기">${renderPixelSprite(c)}<span class="scene-character-name">${mine?'<b>나</b> ':''}${escape(c.nickname || '선수')}</span><span class="scene-character-role">${escape(roles[c.position] || '선수')}${npc?' · NPC':''}</span></button>`;
  }).join('')}</div>${people.length?'':`<div class="scene-empty">지금 이 장소에 있는 선수는 없습니다.</div>`}</div><div class="scene-caption"><p>${escape(hints[location] || hints['연습실'])}</p><span>${date?escape(date)+' · ':''}바닥 클릭 · 방향키/WASD로 이동 · 캐릭터를 누르면 프로필${npcCount?' · NPC 팀원의 기본 위치는 연습실':''}</span></div></section>`;
}
