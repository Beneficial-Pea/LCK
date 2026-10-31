import { seededRandom } from './match.mjs';
const scenes=[
 ['야식 주문','휴대폰을 내밀었다. 배달 최소 금액이 아직 모자랐다.','같이 주문할래?','메뉴를 하나 더 골랐다. 배달 도착 시간을 같이 확인했다.','오늘은 먼저 들어가겠다고 했다. 남은 메뉴는 냉장고에 넣어 두기로 했다.'],
 ['헤드셋 실종','연습석 주변을 뒤지고 있었다. 헤드셋은 목에 걸려 있었다.','내 헤드셋 못 봤어?','목 쪽을 가리켰다. 잠깐 정적이 흐르다 둘 다 웃었다.','자리 밑부터 같이 찾아줬다. 의자를 밀다가 뒤늦게 발견했다.'],
 ['리플레이 내기','어제 장면을 멈춰 놓고 마우스로 강가를 짚었다.','여기서 들어갔으면 잡았을까?','한 번 더 돌려 보고 서로 다른 타이밍을 짚었다. 다음 스크림에서 확인하기로 했다.','지금은 머리가 안 돌아간다고 했다. 영상 주소를 따로 받아 뒀다.'],
 ['분실된 충전기','충전 케이블 세 개를 책상 위에 늘어놨다.','이 중에 네 거 있어?','테이프로 표시를 붙였다. 공용 충전기는 거실에 두기로 했다.','자기 것은 방에 있다고 했다. 대신 빈 콘센트를 찾아줬다.'],
 ['설거지 당번','싱크대 앞에서 빈 그릇과 종이컵을 나눴다.','가위바위보로 정하자.','같이 그릇을 닦았다. 컵은 각자 씻자는 규칙을 붙였다.','이번에는 먼저 맡아 달라고 했다. 다음번에는 자신이 맡기로 했다.'],
 ['편의점 신상품','봉지 두 개를 꺼내 나란히 놓았다.','둘 중에 뭐가 나을 것 같아?','하나씩 나눠 먹었다. 별점은 끝까지 맞지 않았다.','평소 먹던 것을 골랐다. 다음에 먹어 본 평을 알려 달라고 했다.'],
 ['자리 온도','에어컨 리모컨을 손에 들고 주변을 살폈다.','너는 안 추워?','바람 방향을 옮기고 팀 후드 하나를 건넸다.','자리는 괜찮다고 했다. 대신 창가 쪽 온도를 확인해 줬다.'],
 ['스트레칭 알람','휴대폰 알람이 울리자 의자에서 일어났다.','손목 좀 풀고 하자.','벽 앞에서 어깨와 손목을 풀었다. 앉는 높이도 다시 맞췄다.','이번 판만 끝내고 하겠다고 했다. 알람을 오 분 뒤로 맞췄다.'],
 ['라면 물 조절','냄비 앞에서 계량컵을 내려다봤다.','두 개 끓이면 물 몇이지?','봉지 뒤를 읽고 물을 덜었다. 그릇을 두 개 꺼냈다.','오늘은 안 먹겠다고 했다. 대신 타이머를 맞춰 줬다.'],
 ['휴대폰 사진','흔들린 단체 사진을 확대해서 보여줬다.','너만 눈 감았어. 다시 찍을까?','복도에서 한 장 더 찍었다. 이번에는 옆 사람이 눈을 감았다.','그냥 이 사진으로 두자고 했다. 파일 이름에 날짜를 붙였다.'],
 ['음악 취향','스피커 볼륨을 줄이고 재생 목록을 넘겼다.','다음 곡 하나 골라봐.','각자 한 곡씩 추가했다. 취향 차이를 두고 짧게 실랑이했다.','오늘은 조용히 있고 싶다고 했다. 이어폰을 꺼내는 걸 기다렸다.'],
 ['비 오는 외출','출입문 앞에서 우산 한 개를 펴 봤다.','잠깐만 같이 나갈래?','편의점까지 우산을 번갈아 들었다. 돌아오는 길에는 비가 그쳤다.','나갈 때 가져다줄 것을 메모해 줬다. 우산은 문 옆에 세워 뒀다.'],
 ['보드게임 상자','서랍에서 오래된 카드 한 묶음을 찾아냈다.','한 판만 할까?','규칙부터 다시 읽었다. 마지막 패 한 장 때문에 목소리가 커졌다.','구경만 하겠다고 했다. 점수 기록은 대신 맡았다.'],
 ['인터뷰 연습','빈 물병을 마이크처럼 내밀었다.','오늘 소감 한 말씀 부탁드립니다.','짐짓 진지한 표정으로 대답했다. 뒤에서 누군가 박수를 쳤다.','물병을 밀어 돌려줬다. 먼저 모범 답안을 보여 달라고 했다.'],
 ['모니터 밝기','연습 화면을 번갈아 보며 눈을 가늘게 떴다.','내 화면만 좀 어두운가?','같은 장면을 띄워 설정을 비교했다. 케이블 위치까지 확인했다.','매니저에게 점검 요청을 남겼다. 오늘은 옆 모니터를 쓰기로 했다.'],
 ['아침 기상','복도에서 수건을 목에 건 채 하품했다.','알람을 다섯 개 맞췄는데도 못 들었어.','내일은 문을 두드려 주기로 했다. 기상 시간을 다시 맞췄다.','알람 소리부터 바꿔 보라고 했다. 서로 추천음을 들어 봤다.'],
 ['분석 퀴즈','종이에 챔피언 이름 세 개를 적었다.','여기서 마지막 픽은 뭐였을까?','서로 고른 픽의 이유를 설명했다. 정답보다 의견이 길어졌다.','힌트를 하나 더 달라고 했다. 상대 조합부터 다시 살폈다.'],
 ['팀 굿즈','새로 온 팀 후드의 사이즈표를 펼쳤다.','네 사이즈 이거 맞지?','소매 길이를 비교하고 주문표에 표시했다.','직접 입어 보고 정하겠다고 했다. 샘플을 잠시 빌렸다.'],
 ['간식의 주인','이름 없는 과자 봉지를 들고 멈췄다.','이거 먹어도 되나?','주인을 확인한 뒤 나눠 먹었다. 남은 봉지에는 이름을 썼다.','공용인지 먼저 물어보기로 했다. 봉지는 원래 자리에 돌려놨다.'],
 ['쉬는 날의 약속','다음 빈 일정에 동그라미를 쳤다.','이번엔 밥 먹으러 나갈까?','가까운 식당 두 곳을 후보로 적었다. 다른 팀원에게도 물어보기로 했다.','오늘은 쉬고 싶다고 했다. 약속은 다음 빈 일정으로 미뤘다.'],
 ['짧은 산책','현관에서 신발 끈을 고쳐 묶었다.','한 바퀴만 돌고 오자.','숙소 주변을 돌며 게임 밖의 이야기를 했다. 돌아와 물을 한 잔씩 마셨다.','대신 돌아올 때 깨워 달라고 했다. 소파에 잠깐 누웠다.'],
 ['결정적 장면','지난 경기의 한타를 느린 속도로 돌렸다.','이때 네 화면에서는 뭐가 보였어?','서로의 시야를 번갈아 확인했다. 다음에는 먼저 말하기로 했다.','설명은 내일 하기로 했다. 장면에 북마크만 남겼다.'],
 ['점심 메뉴 투표','메뉴 후보 세 개에 숫자를 적었다.','오늘은 네가 결정해.','메뉴 하나를 골랐다. 반대한 사람의 메뉴는 내일 먹기로 했다.','선택권을 돌려줬다. 대신 주문과 수령을 맡았다.'],
 ['숙소 정리','거실 바닥의 박스를 한쪽으로 밀었다.','이 상자 이제 버려도 되겠지?','내용물을 확인하고 분리수거했다. 잃어버린 케이블이 하나 나왔다.','주인이 올 때까지 따로 두기로 했다. 박스에 메모를 붙였다.'],
];
const openings={mechanics:'개인 훈련을 마치고 손을 털었다.',laning:'연습 상대에게 종료 인사를 보냈다.',analysis:'분석 영상을 닫고 메모를 정리했다.',team:'스크림 복기를 마치고 자리에서 일어났다.',duo:'듀오 연습의 마지막 판을 마쳤다.',rest:'오늘은 훈련 시간을 비우고 쉬었다.',walk:'밖에서 돌아와 팀원과 마주쳤다.'};
export function processDailyLife(room,roster=[]){
 const s=room.season;if(s.schedule.some(m=>m.date===s.date&&[m.teamA,m.teamB].includes(s.team)))return;
 const life=s.dailyLife??={lastTurn:null,entries:[],bonds:{}};if(life.lastTurn===s.turn)return;life.lastTurn=s.turn;
 for(const p of room.players){
  const rand=seededRandom(`${s.seed}:life:${s.turn}:${p.character.position}`),recent=life.entries.filter(e=>e.userId===p.userId).slice(0,12).map(e=>e.scene);
  const eligible=scenes.map((_,i)=>i).filter(i=>!([4,8].includes(i)&&p.location!=='주방')&&!(i===14&&!['연습실','PC방','분석실'].includes(p.location)));const fresh=eligible.filter(i=>!recent.includes(i)),available=fresh.length?fresh:eligible,index=available[Math.floor(rand()*available.length)];
  const pool=[...roster.filter(c=>c.id!==p.character.id&&c.npc),{id:'staff:coach',nickname:'코치'},{id:'staff:manager',nickname:'매니저'},{id:'staff:analyst',nickname:'분석관'}];if(!pool.length)continue;const partner=pool[Math.floor(rand()*pool.length)],scene=scenes[index],key=`${p.userId}:${partner.id}`;
  const bond=life.bonds[key]??={userId:p.userId,targetId:partner.id,targetName:partner.nickname,affinity:0,encounters:0};bond.encounters++;bond.affinity=Math.min(100,bond.affinity+1);
  const previous=life.entries.find(e=>e.userId===p.userId&&e.partnerId===partner.id);
  const callback=previous&&bond.encounters%3===0?` ${partner.nickname}이 지난번 「${previous.title}」 이야기를 꺼냈다. "그 뒤에는 어떻게 됐어?"`:'';
  const action=room.submissions[p.userId]?.action||'rest';const entry={id:`life-${s.turn}-${p.userId}`,scene:index,userId:p.userId,partnerId:partner.id,partnerName:partner.nickname,date:s.date,turn:s.turn,location:p.location||'연습실',title:scene[0],text:`${openings[action]||openings.rest} ${p.location||'연습실'}에서 ${partner.nickname}이 ${scene[1]} "${scene[2]}"${callback}`,choices:[{id:'join',label:'함께 이야기한다',text:scene[3]},{id:'later',label:'내 방식으로 답한다',text:scene[4]}],answer:null};
  life.entries.unshift(entry);s.history.unshift({id:entry.id,date:s.date,turn:s.turn,type:'daily-life',userId:p.userId,text:entry.text});
 }
 life.entries=life.entries.slice(0,120);
}
export function answerDailyLife(room,userId,id,choice){
 const entry=room.season.dailyLife?.entries.find(e=>e.id===id&&e.userId===userId);
 if(!entry||entry.turn!==room.season.turn-1||entry.answer)throw Object.assign(new Error('현재 하루의 아직 답하지 않은 사건을 선택하세요.'),{status:409});
 const option=entry.choices.find(c=>c.id===choice);if(!option)throw Object.assign(new Error('대화 선택을 확인하세요.'),{status:400});
 entry.answer=choice;entry.reply=option.text;const bond=room.season.dailyLife.bonds[`${userId}:${entry.partnerId}`];bond.affinity=Math.min(100,bond.affinity+(choice==='join'?2:1));
 const p=room.players.find(p=>p.userId===userId);if(choice==='join')p.character.stress=Math.max(0,p.character.stress-1);
 room.season.history.unshift({id:entry.id+'-reply',date:room.season.date,turn:room.season.turn,type:'daily-life',userId,text:`${p.character.nickname}과 ${entry.partnerName}. ${option.text}`});return entry;
}
