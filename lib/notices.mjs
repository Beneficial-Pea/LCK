import {randomUUID} from 'node:crypto';
const defaults=[
 {id:'welcome',title:'FIRST TEAM 이용 안내',category:'안내',pinned:true,body:'초대장을 통해 가입한 계정으로 이용할 수 있습니다.\n캐릭터 슬롯에 선수를 등록하고 시즌 방을 만들거나 친구의 방 코드로 참가해 주세요.\n함께 플레이할 때는 각자 행동을 제출한 뒤 방장이 하루를 정산합니다. 방을 나가거나 새로고침해도 같은 계정으로 다시 접속할 수 있습니다.\n오류를 발견하면 게임 날짜, 대회 이름, 발생한 상황을 운영자에게 알려주세요.'},
 {id:'update-media-day',title:'업데이트 · LCK 컵 미디어데이와 선수 생활',category:'업데이트',pinned:false,body:'새 시즌마다 전년도 LCK 우승·준우승 팀이 정해지고, 1월 13일 미디어데이에 바론·장로 그룹을 지명합니다. 우리 팀이 대표라면 직접 지명할 수 있습니다.\n선수 배경별 능력치 보너스, 포지션·성향별 챔피언 추천, 컨디션·피로에 따른 경기력 변화가 적용됩니다.\n경기별 POM과 멀티킬, 시즌 시상식, 대회별 진출 현황과 대진표를 확인할 수 있습니다.\n선수단 휴가에는 행동 선택 없이 일상을 보내며, 일주일 자동 진행은 상황에 맞는 준비 행동을 고릅니다.'}
];
export function initializeNotices(store){
 store.db.exec(`CREATE TABLE IF NOT EXISTS notices(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL,pinned INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,author TEXT NOT NULL,revision INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 store.transaction(()=>{if(store.db.prepare("SELECT value FROM app_settings WHERE key='notices_seed_v1'").get())return;
 const now=Date.now();for(const n of defaults)store.db.prepare('INSERT OR IGNORE INTO notices VALUES(?,?,?,?,?,?,?,?,?)').run(n.id,n.title,n.body,n.category,Number(n.pinned),now,now,'운영팀',1);
 store.db.prepare("INSERT INTO app_settings VALUES('notices_seed_v1','done')").run();});
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
