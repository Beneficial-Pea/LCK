import {randomUUID} from 'node:crypto';
const defaults=[
 {id:'welcome',title:'FIRST TEAM 이용 안내',category:'안내',pinned:true,body:'초대장을 통해 가입한 계정으로 이용할 수 있습니다.\n캐릭터 슬롯에 선수를 등록하고 시즌 방을 만들거나 친구의 방 코드로 참가해 주세요.\n함께 플레이할 때는 각자 행동을 제출한 뒤 방장이 하루를 정산합니다. 방을 나가거나 새로고침해도 같은 계정으로 다시 접속할 수 있습니다.\n오류를 발견하면 게임 날짜, 대회 이름, 발생한 상황을 운영자에게 알려주세요.'},
 {id:'update-media-day',title:'업데이트 · LCK 컵 미디어데이와 선수 생활',category:'업데이트',pinned:false,body:'새 시즌마다 전년도 LCK 우승·준우승 팀이 정해지고, 시즌 전 미디어데이에 바론·장로 그룹을 지명합니다. 우리 팀이 대표라면 직접 지명할 수 있습니다.\n선수 배경별 능력치 보너스, 포지션·성향별 챔피언 추천, 컨디션·피로에 따른 경기력 변화가 적용됩니다.\n경기별 POM과 멀티킬, 시즌 시상식, 대회별 진출 현황과 대진표를 확인할 수 있습니다.\n선수단 휴가에는 행동 선택 없이 일상을 보내며, 일주일 자동 진행은 상황에 맞는 준비 행동을 고릅니다.'}
];
const releaseNotices=[{
 id:'update-gameplay-and-tournament-rewards',key:'notice_release_tournament_rewards_v1',
 title:'업데이트 · 국제전 닉네임·대회 보상·일상 선택지 개선',category:'업데이트',pinned:false,
 body:`국제전 닉네임과 대회 보상
• 해외 NPC의 팀명·포지션이 붙던 닉네임을 별도 닉네임으로 변경했습니다. LCK NPC·참가자와 닉네임이 겹치지 않도록 처리합니다. 완료된 경기 기록은 유지합니다.
• 우승·준우승 시 결과 팝업과 선수단 보상이 추가됩니다. 중계가 끝나고 결승 결과가 확정되면 한 번만 적용합니다.
• 우승: 멘탈 +0.5, 소통 +0.3, 컨디션 +6, 피로 −6, 스트레스 −8.
• 준우승: 멘탈 +0.2, 소통 +0.1, 컨디션 +3, 피로 −3, 스트레스 −4.
• 능력치·상태 상한에 따라 실제 변화량이 달라질 수 있습니다. 능력치 상승은 현재 시즌에 유지됩니다. 기존에 완료한 결승에는 소급 지급하지 않습니다.
• 오늘의 일정에서 ‘성적 보상 보기’로 다시 확인할 수 있습니다. 팝업을 다시 열어도 보상은 중복 지급되지 않습니다.

일상 사건과 선택지
• 일상 사건을 팝업으로 표시하고, 사건 120개에 서로 다른 행동형 선택지 240개를 추가했습니다.
• 선택 전에 예상 변화를 확인할 수 있으며, 선택하면 실제 선수 능력치·상태와 친밀도에 반영됩니다.
• ‘짧은 낮잠’처럼 상황에 맞는 행동을 구체적으로 표시합니다. 친구를 깨워주는 행동으로 자신의 컨디션이 회복되지는 않습니다.
• 아직 답하지 않은 기존 사건에도 새 선택지를 표시합니다. 이미 선택한 기록은 유지합니다.
• ‘매니저이·코치이’ 등 잘못된 조사를 수정했습니다.

경기 화면과 일정
• 닉네임 업데이트 전에 시작한 국제전에서 세트 사이 전략 선택이 실패하던 문제를 수정했습니다. 이미 공개된 세트는 보존하며, 전략은 다음 세트에 적용됩니다.
• 경기 불판 댓글, 중계 문구, 역전·추격·오브젝트 교환 등 실제 경기 흐름에 따른 상황 기록을 늘렸습니다.
• 미디어데이가 끝나면 상단 미디어데이 창을 숨기고, 상세 스크림은 해당 날짜에만 표시합니다.
• 경기·상세 스크림 날에는 일반 준비 행동 선택 창을 표시하지 않습니다.
• 세트 사이 전략 회의와 경기 패널, 스크림 결과와 일정 패널 사이 간격을 조정했습니다.
• 경기 후 수훈선수 인터뷰는 제거하고 POM·시즌 시상 기록은 유지합니다.

방 관리와 화면 문구
• 방 나가기·방 초기화 기능을 추가했습니다. 마지막 참가자가 나간 빈 방과 관련 채팅을 정리합니다.
• 방 초기화에는 확인 절차가 있으며, 계정과 등록 캐릭터 슬롯은 유지합니다.
• 게임 이름을 ‘FIRST TEAM LCK 시뮬레이터’로 변경하고 일정 화면의 설명을 간결하게 정리했습니다.`
}];
export function initializeNotices(store){
 store.db.exec(`CREATE TABLE IF NOT EXISTS notices(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL,pinned INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,author TEXT NOT NULL,revision INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 store.transaction(()=>{
 const now=Date.now(),insert=store.db.prepare('INSERT OR IGNORE INTO notices VALUES(?,?,?,?,?,?,?,?,?)');
 if(!store.db.prepare("SELECT value FROM app_settings WHERE key='notices_seed_v1'").get()){
  for(const n of defaults)insert.run(n.id,n.title,n.body,n.category,Number(n.pinned),now,now,'운영팀',1);
  store.db.prepare("INSERT INTO app_settings VALUES('notices_seed_v1','done')").run();
 }
 for(const n of releaseNotices){
  if(store.db.prepare('SELECT value FROM app_settings WHERE key=?').get(n.key))continue;
  insert.run(n.id,n.title,n.body,n.category,Number(n.pinned),now,now,'운영팀',1);
  store.db.prepare("INSERT INTO app_settings VALUES(?,'done')").run(n.key);
 }
 });
}
const view=row=>row?{id:row.id,title:row.title,body:row.body,category:row.category,pinned:!!row.pinned,createdAt:row.created_at,updatedAt:row.updated_at,author:row.author,revision:row.revision}:null;
export const listNotices=store=>store.db.prepare('SELECT * FROM notices ORDER BY pinned DESC,created_at DESC,id DESC').all().map(view);
function fail(status,message){throw Object.assign(new Error(message),{status});}
function validate(input){
 const text=(key,max)=>{if(typeof input[key]!=='string')fail(400,'제목과 내용을 입력해 주세요.');const value=input[key].trim();if(!value||value.length>max)fail(400,`${key==='title'?'제목은 100자':'내용은 10000자'} 이내로 입력해 주세요.`);return value;};
 const title=text('title',100),body=text('body',10000);if(!['안내','업데이트','점검'].includes(input.category))fail(400,'공지 분류를 선택해 주세요.');if(typeof input.pinned!=='boolean')fail(400,'상단 고정 여부를 확인해 주세요.');
 return {title,body,category:input.category,pinned:Number(input.pinned)};
}
export function saveNotice(store,input,author,id=null){
 const n=validate(input),now=Date.now();
 if(id){const result=store.db.prepare('UPDATE notices SET title=?,body=?,category=?,pinned=?,updated_at=?,author=?,revision=revision+1 WHERE id=? AND revision=?').run(n.title,n.body,n.category,n.pinned,now,author,id,Number(input.revision)||0);if(!result.changes)fail(409,'공지가 변경되었거나 삭제됐습니다. 새로고침 후 다시 확인해 주세요.');}
 else{id=randomUUID();store.db.prepare('INSERT INTO notices VALUES(?,?,?,?,?,?,?,?,?)').run(id,n.title,n.body,n.category,n.pinned,now,now,author,1);}
 return view(store.db.prepare('SELECT * FROM notices WHERE id=?').get(id));
}
export function deleteNotice(store,id,revision){const result=store.db.prepare('DELETE FROM notices WHERE id=? AND revision=?').run(id,Number(revision)||0);if(!result.changes)fail(409,'공지가 변경되었거나 삭제됐습니다. 새로고침 후 다시 확인해 주세요.');return {ok:true};}
