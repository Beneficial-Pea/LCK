import { seededRandom } from './match.mjs';
const day=date=>Math.floor(Date.parse(date+'T00:00:00Z')/86400000);

export function vacationWindows(s){
 if(s.year!==2026||!s.team||s.draft)return [];
 const windows=[
  {id:'post-cup',title:'컵 대회 뒤 재충전',start:'2026-03-03',end:'2026-03-07'},
  {id:'spring-break',title:'정규시즌 전 짧은 휴가',start:'2026-03-23',end:'2026-03-27'},
  {id:'summer-break',title:'서머 재개 전 휴가',start:'2026-07-20',end:'2026-07-25'},
 ];
 const msi=s.qualifications?.msi,worlds=s.qualifications?.worlds;
 if(s.flags?.msiSeeded&&!msi?.teams?.includes(s.team))windows.push({id:'june-break',title:'여름 재충전 휴가',start:'2026-06-17',end:'2026-06-24'});
 if(s.flags?.worldsSeeded){
  const attendingWorlds=worlds?.teams?.includes(s.team),demacia=s.qualifications?.demacia?.teams?.includes(s.team);
  windows.push({id:'post-lck',title:attendingWorlds?'국제대회 준비 전 짧은 휴가':'국내 시즌 종료 휴가',start:'2026-09-15',end:attendingWorlds?'2026-09-18':demacia?'2026-09-24':'2026-09-30'});
  if(!attendingWorlds)windows.push({id:'autumn-break',title:'가을 휴가',start:'2026-10-19',end:'2026-10-26'});
 }
 return windows.sort((a,b)=>a.start.localeCompare(b.start));
}

export function vacationFor(s,date=s.date){
 if(s.finished)return null;
 if(s.schedule.some(m=>m.date===date&&[m.teamA,m.teamB].includes(s.team)))return null;
 const window=vacationWindows(s).find(w=>date>=w.start&&date<=w.end);
 return window?{...window,remainingDays:day(window.end)-day(date)+1,totalDays:day(window.end)-day(window.start)+1}:null;
}

const away=[
 ['family','가족과 함께 식사하고 동네를 걸었다. 경기장에서는 못 했던 집안 이야기를 천천히 들었다.'],
 ['family','집에 돌아가 부모님이 차려 준 밥을 먹었다. 설거지를 마치고 오래 앉아 이야기를 나눴다.'],
 ['family','가족과 가까운 곳으로 드라이브를 다녀왔다. 돌아오는 길에는 휴게소 간식을 나눠 먹었다.'],
 ['home','알람을 끄고 늦게 일어났다. 밀린 빨래를 돌리고 집에서 느긋하게 하루를 보냈다.'],
 ['home','방 정리를 하다 예전 사진을 찾았다. 책상에 앉아 오래된 물건을 하나씩 정리했다.'],
 ['home','편한 옷을 입고 집에서 영화를 봤다. 저녁에는 평소 좋아하던 음식을 시켜 먹었다.'],
 ['trip','작은 가방을 챙겨 바닷가에 다녀왔다. 바람을 쐬고 돌아와 찍은 사진을 정리했다.'],
 ['trip','친구와 가까운 도시로 여행을 갔다. 가 보고 싶던 식당을 들르고 길을 조금 헤맸다.'],
 ['trip','기차를 타고 당일치기 여행을 다녀왔다. 창밖을 보며 쉬다가 돌아오는 길에는 잠이 들었다.'],
 ['friends','오랜 친구와 카페에서 만났다. 게임 밖의 이야기를 한참 하다가 다음 약속을 잡았다.'],
 ['friends','친구들과 식사하고 짧게 산책했다. 서로의 근황을 듣느라 시간이 금방 지나갔다.'],
 ['rest','일정을 비우고 푹 쉬었다. 저녁에 가벼운 스트레칭을 하고 평소보다 일찍 잠들었다.'],
 ['rest','낮에는 책을 읽고 밤에는 가족과 통화했다. 쉬는 날에는 서두르지 않기로 했다.'],
 ['home','집 근처 장을 보고 간단한 저녁을 만들었다. 장비 대신 주방 정리를 하며 하루를 마쳤다.'],
 ['family','가족과 시장에 들러 간식을 골랐다. 모처럼 시간을 신경 쓰지 않고 집까지 걸어왔다.'],
 ['trip','숙소 밖에서 하룻밤을 보내고 돌아왔다. 여행 짐 속 기념품을 정리하며 다음 휴가를 이야기했다.'],
];
const returns=[
 ['early-return','휴가가 끝나기 전에 조금 일찍 복귀했다. 빈 연습실에서 장비를 연결하고 의자 높이를 다시 맞췄다.'],
 ['early-return','먼저 숙소에 돌아와 캐리어를 풀었다. 팀원이 돌아올 때 먹을 간식을 냉장고에 채웠다.'],
 ['early-return','조기 복귀해 혼자 연습실 문을 열었다. 가벼운 연습을 마치고 다음 일정만 확인했다.'],
 ['early-return','조금 일찍 복귀한 동료와 저녁을 먹었다. 여행 이야기를 나누고 평소보다 일찍 방으로 들어갔다.'],
 ['return-home','집에서 마지막 휴일을 보냈다. 돌아갈 짐을 미리 싸고 가족과 저녁을 먹었다.'],
 ['return-trip','여행 사진을 정리하고 복귀할 준비를 했다. 남은 간식은 팀원에게 나눠 주기로 했다.'],
 ['return-rest','남은 휴가에는 멀리 나가지 않았다. 생활 리듬을 맞추며 숙소로 돌아갈 준비를 했다.'],
 ['early-return','한발 먼저 숙소에 도착했다. 조용한 거실에서 짐을 정리하고 돌아올 팀원들에게 연락을 남겼다.'],
];

export function processVacation(room){
 const s=room.season,vacation=vacationFor(s);if(!vacation)return null;
 const diary=s.vacations??={lastTurn:null,entries:[]};if(diary.lastTurn===s.turn)return vacation;diary.lastTurn=s.turn;
 for(const p of room.players){
  const random=seededRandom(`${s.seed}:vacation:${vacation.id}:${s.date}:${p.character.position}`),pool=vacation.remainingDays<=2?returns:away;
  const recent=diary.entries.filter(e=>e.userId===p.userId).slice(0,5).map(e=>e.description),fresh=pool.filter(([,text])=>!recent.includes(text)),choices=fresh.length?fresh:pool;
  const [kind,description]=choices[Math.floor(random()*choices.length)],entry={id:`vacation-${s.turn}-${p.userId}`,userId:p.userId,date:s.date,turn:s.turn,window:vacation.id,title:vacation.title,kind,description,text:`${p.character.nickname} · ${description}`};
  diary.entries.unshift(entry);s.history.unshift({...entry,type:'vacation'});
  p.character.condition=Math.min(100,p.character.condition+7);p.character.fatigue=Math.max(0,p.character.fatigue-15);p.character.stress=Math.max(0,p.character.stress-9);
 }
 diary.entries=diary.entries.slice(0,500);return vacation;
}
