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
},{
 id:'update-stage-wrapups-and-objectives',key:'notice_release_stage_objectives_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 대회 마무리 대화·오브젝트 현황·우리 팀 소식',
 body:`대회와 주요 일정 마무리
• 컵·플레이인·플레이오프·국제전에서 우리 팀 일정이 끝나거나 정규시즌이 마무리되면 선수단 대화 팝업이 표시됩니다.
• 다음 단계 진출·탈락·정규시즌 종료에 맞는 메시지를 제공합니다. 패자조 기회가 남아 있으면 탈락으로 표시하지 않습니다.
• 우승·준우승은 기존 성적·보상 팝업을 유지합니다. 이미 끝난 과거 일정에 대화를 소급 생성하지 않습니다.

경기 오브젝트 현황판
• 현재 게임 시간·킬·골드와 함께 양 팀의 용·유충·포탑·바론·전령·장로 획득 현황을 표시합니다.
• 실시간 중계와 다시보기 모두 현재 공개된 장면까지만 집계하며, 세트가 바뀌면 새 세트의 현황을 표시합니다.
• 새 경기부터 공허 유충 3마리를 확보하는 사건이 추가됩니다. 예전 경기에서 집계하지 않은 항목은 —로 표시합니다.
• 이미 진행 중인 중계는 기존 경기 규칙을 유지합니다.

우리 팀에 영향을 주는 리그 소식
• 우리 팀 선수나 NPC 팀원에게 실제 효과가 적용되는 소식만 팝업으로 알립니다. 대상 선수·능력치 변화·남은 기간을 확인할 수 있습니다.
• 닫은 소식은 자동으로 반복 표시하지 않으며, 리그 소식의 ‘우리 팀 영향 보기’에서 다시 확인할 수 있습니다.
• 새 챔피언 너프는 시그니처 챔피언이면 라인전 −2, 주력 챔피언 풀에 들어 있으면 라인전 −1을 적용합니다. 같은 선수에게 두 조건을 중복 적용하지 않습니다.
• 대표 챔피언을 시그니처로, 챔피언 풀의 나머지 챔피언을 주력 픽으로 취급합니다. 버프도 시그니처·주력 풀 선수에게 적용됩니다.
• 기존에 적용 중인 패치 효과는 원래 수치·기간을 유지하며, 팝업을 열거나 닫아도 효과를 중복 적용하지 않습니다.`
},{
 id:'update-krx-display',key:'notice_release_krx_display_v1',category:'업데이트',pinned:false,
 title:'정정 업데이트 · 키움 DRX의 약칭은 KRX입니다',
 body:`팀 이름 표기 정정
• 앞선 DRX 표기 통일 안내를 바로잡습니다. 키움 DRX의 2026 시즌 약칭은 KRX입니다.
• 홈·순위·로스터·일정·중계·선수 이름 앞의 팀 약칭을 KRX로 통일했습니다. 정식 이름 KIWOOM DRX는 유지합니다.
• 기존 방·선수·경기 결과는 그대로 유지하며, 방을 초기화할 필요가 없습니다.`
},{
 id:'update-daily-setbacks',key:'notice_release_daily_setbacks_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 일상 대화 정리와 가벼운 차질 사건',
 body:`일상 대화 정리
• 현재 질문과 선택지에 관계없는 ‘전에 나눴던 일’ 회상 대사를 제거했습니다. 기존 일상 기록에서도 이 부가 대사를 숨깁니다.
• 현재 사건의 질문과 선택지, 이미 선택한 답변과 적용된 효과는 유지합니다.

가벼운 일상 차질 추가
• 수면 부족·손목 뻐근함·장비 설정 문제·연습 연패 등 안 좋은 일상 사건 12개를 추가했습니다. 일상 사건은 총 132개입니다.
• 사건 발생 시 컨디션·피로·스트레스에 작은 변화가 한 번 적용되며, 실제 반영된 수치를 팝업에 표시합니다.
• 선택지로 부담을 줄이거나 다른 대응을 할 수 있습니다. 선택 전에 예상 추가 변화를 확인할 수 있습니다.
• 팝업을 닫거나 새로고침해도 발생 효과가 다시 적용되지 않습니다. 선택하지 않고 넘어가도 이미 발생한 변화는 남습니다.
• 휴식 등으로 회복할 수 있으며, 기존 사건에 불이익을 소급 적용하지 않습니다.`
},{
 id:'update-standings-tournament-tabs',key:'notice_release_standings_tournament_tabs_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 리그 순위와 대회 대진 탭 분리',
 body:`순위 확인 팝업 개선
• ‘리그 순위 / 대회 대진 · 진출 현황 / POM 순위’를 각각의 탭으로 분리했습니다.
• EWC 등 국제전 기간에도 리그 순위 탭에서 LCK 정규시즌 순위를 계속 확인할 수 있습니다.
• 대회 대진 · 진출 현황 탭에서는 현재 진행 중인 대회의 대진과 대회별 진출 현황을 확인할 수 있습니다. 컵·플레이인·플레이오프도 진행 단계에 맞춰 표시됩니다.
• 대회 기간이 아닐 때는 안내 문구를 표시합니다. 대진이 정해지지 않은 대회는 빈 브래킷이나 미확정 안내 문구를 표시하지 않습니다.
• 순위·경기 기록과 POM 집계 방식은 유지합니다.`
},{
 id:'update-public-recruitment',key:'notice_release_public_recruitment_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 공개 모집방과 대기실 대화',
 body:`공개 모집방
• 방을 만들 때 공개 모집 또는 비공개를 선택할 수 있습니다. 기존 방은 비공개로 유지합니다.
• 가입한 이용자는 공개 목록에서 방 이름·인원·남은 포지션을 확인하고, 빈 포지션의 캐릭터로 참가할 수 있습니다.
• 공개 목록에는 대기 중이고 자리가 있는 방만 표시합니다. 팀 선택이 시작되거나 시즌이 시작되면 공개 모집을 종료합니다.
• 방장은 팀 선택 전 대기실에서 공개·비공개를 바꿀 수 있습니다. 5명이 모이지 않아도 빈자리를 NPC로 채워 시작할 수 있습니다.
• 공개 목록에는 모집 정보만 표시하며, 방 채팅과 캐릭터 상세 정보는 참가자만 볼 수 있습니다.

대기실 대화
• 대기실 안에 오너칸·선수단 카톡방의 대화와 입력창을 바로 표시합니다. 오른쪽 아래 채팅창과 같은 대화를 이용합니다.
• 메시지가 도착해도 작성 중인 글은 유지하며, 기존 자동 정산 안내는 계속 숨깁니다.

대회 카드
• 대회별 진출 카드의 ‘ROAD TO EWC’ 제목을 ‘EWC’로 변경했습니다. 한국 예선과 본선 설명은 유지합니다.`
},{
 id:'update-public-room-spacing',key:'notice_release_public_room_spacing_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 공개 모집방 화면 간격 조정',
 body:'시즌 방 화면에서 공개 모집방과 참가 중인 시즌 사이에 여백을 추가했습니다. 모바일에서도 두 영역을 구분하기 쉽게 조정했습니다.'
},{
 id:'update-roster-power-check',key:'notice_release_roster_power_check_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 전력 점검 위치 변경',
 body:'전력 점검을 시즌 방 화면에서 오늘의 일정 → 우리 로스터 팝업의 선수 목록 아래로 옮겼습니다. 우리 로스터와 상대 참고 전력, NPC 전력 설정을 함께 확인할 수 있습니다. NPC 전력 조정 권한과 중계 중 제한은 유지됩니다.'
},{
 id:'update-set-records',key:'notice_release_set_records_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 세트별 블루·레드 선수 기록과 선택권',
 body:`경기 중계와 다시보기의 선수 기록을 블루팀·레드팀 두 칸으로 나누고 가운데 구분선을 추가했습니다. 밴픽도 같은 세트별 진영 순서로 표시합니다.
세트마다 진영 선택권, 퍼스트픽 선택권과 실제 퍼스트픽 팀을 확인할 수 있습니다. 새 경기의 1세트는 사전 배정, 이후에는 직전 세트 패배 팀에 선택권을 배정합니다.
일반 경기에서는 선택권 팀이 블루와 퍼스트픽을 자동 선택합니다. RoFS가 적용되는 경기에서는 선지명 팀이 퍼스트픽을, 상대 팀이 블루 진영을 자동 선택합니다. 선택 방식은 화면에 함께 안내합니다.
완료된 경기와 이미 시작한 중계의 결과는 유지합니다. 예전 경기에서 기록하지 않은 선택권은 기록 없음으로 표시합니다.`
},{
 id:'update-side-score-npc-training-chat',key:'notice_release_side_score_npc_training_chat_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 세트별 점수판·NPC 동반 성장·채팅 개선',
 body:`세트별 점수판
• 선택한 세트의 진영에 맞춰 상단 팀 이름과 시리즈 점수를 왼쪽 블루·오른쪽 레드로 함께 배치합니다. 킬·골드·오브젝트도 같은 순서로 표시합니다.

NPC 동반 성장
• 듀오 연습에서는 함께한 로스터 NPC, 팀 훈련과 상세 스크림에서는 참가한 로스터 NPC도 능력치가 오릅니다. 성장한 능력치와 실제 변화량은 훈련 기록에 남습니다.
• NPC 성장분을 현재 시즌에 저장합니다. 팀 기본 전력 보정이 적용돼 있어도 성장하며, 이후 기본 전력을 재조정해도 성장분은 유지합니다.
• 같은 날 같은 종류의 합동 훈련은 NPC에게 한 번만 반영합니다. 능력치 상한은 99입니다. 기존 완료 경기에는 소급하지 않습니다.

대기실과 채팅
• 대기실 안에는 오너 대화만 표시하고, 메시지의 이름·본문·시간에 안쪽 여백을 추가했습니다.
• 채팅 입력창은 Enter로 전송하고 Shift+Enter로 줄바꿈합니다. 한글 입력을 확정하는 중에는 전송되지 않게 처리했습니다.`
},{
 id:'update-stage-popup-only',key:'notice_release_stage_popup_only_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 일정 종료 안내 정리',
 body:'오늘의 일정 상단에 남아 있던 대회·단계 일정 종료 안내를 제거했습니다. 일정 마무리와 선수단 대화는 팝업으로 한 번 안내하며, 확인 후에는 상단에 계속 표시하지 않습니다.'
},{
 id:'update-season-flow-and-performance',key:'notice_release_season_flow_performance_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 진출·그룹 순위·일상 선택과 경기 준비 개선',
 body:`진출과 순위
• MSI 진출 확정!처럼 실제 진출 대회·단계를 팝업 제목에 표시합니다.
• 그룹 편성 후 리그 순위를 레전드·라이즈 표로 나누고 각 그룹의 1~5위를 표시합니다.
• 프로필의 POM 횟수·포인트도 정규시즌만 반영합니다. 국제대회 기록은 더하지 않습니다. 국제전 수훈 선수는 경기 형식에 따라 POG·POS 또는 경기 MVP로 구분해 표시합니다.

일상 선택과 달력
• 132개 일상 사건을 점검하고, 두 선택지 효과가 같던 27개 사건에 서로 다른 능력치·회복·친밀도·부담을 적용했습니다. 이미 고른 선택과 지급된 효과는 유지합니다.
• 캘린더를 열거나 게임 날짜가 바뀌면 현재 게임 날짜를 자동 선택합니다. 다른 날짜를 둘러볼 수 있으며 오늘로 이동 버튼도 유지합니다.

경기력 보정
• 멘탈 65 초과 구간에서 멘탈이 높을수록 컨디션·피로의 경기력 불이익을 최대 30% 완화합니다. 피로·컨디션 수치, 스트레스 불이익과 훈련 성장 감소는 유지합니다.
• 시그니처 챔피언 전력 보너스를 +6%, 등록한 주력 챔피언은 +3%로 적용합니다. 중복 적용하지 않으며 등록 풀 밖 보정은 −6%로 유지합니다. 실제 적용 보너스는 밴픽·선수 기록에 표시합니다.
• 이미 완료된 경기와 시작한 중계는 종전 경기 규칙과 결과를 보존합니다.

하루 진행과 구단 행사
• 행동 카드를 누르면 바로 저장합니다. 별도의 행동 제출 버튼 없이 하루 정산을 누를 수 있습니다.
• 아직 선택하지 않은 선수가 있으면 경고창으로 명단을 보여줍니다. 계속 진행을 확인한 경우에만 해당 선수를 충분한 휴식으로 처리합니다.
• 퍼스트 스탠드·MSI·EWC·데마시아컵·월즈 기간에는 휴경일에도 새 구단 행사를 배정하지 않습니다. 기존 미래 행사도 기간 밖으로 조정하고, 완료된 행사 기록은 유지합니다.`
},{
 id:'update-results-popup-only',key:'notice_release_results_popup_only_v1',category:'업데이트',pinned:false,
 title:'업데이트 · 우승·시즌 종료 안내를 팝업으로 통일',
 body:'오늘의 일정 상단에 계속 남던 우승·준우승·일정 종료·시즌 종료 배너를 모두 제거했습니다. 각 결과는 팝업으로 안내하며 확인 후에는 상단에 남지 않습니다. 시즌 종료 팝업도 해당 계정·방·시즌에서 한 번 확인하면 다시 표시하지 않습니다. 우승 보상과 경기·시즌 기록은 유지합니다.'
},{
 id:'update-road-msi-seed-label',key:'notice_release_road_msi_seed_label_v1',category:'업데이트',pinned:false,
 title:'업데이트 · Road to MSI 진출 시드 표시',
 body:'MSI 진출 팝업의 Road to MSI 통과 문구를 실제 진출 결과에 맞춰 Road to MSI 1시드 또는 2시드로 표시합니다. 첫 번째 진출팀이 먼저 확정된 시점에도 해당 경기 결과로 시드를 확인하며, 기존 경기·진출 결과와 팝업 확인 기록은 유지합니다.'
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
  // Replace only the untouched automatic notice containing our mistaken advice.
  // Any later administrator edit remains theirs to keep.
  if(n.id==='update-krx-display')store.db.prepare("DELETE FROM notices WHERE id='update-drx-display' AND author='운영팀' AND revision=1 AND title='업데이트 · DRX 팀 이름 표기 통일'").run();
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
