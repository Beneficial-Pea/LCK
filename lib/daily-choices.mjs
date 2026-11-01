import {dailySetbacks} from './daily-setbacks.mjs';
// Labels describe the authored outcome. Effects belong to the chosen action,
// not to a generic first/second option or to the other person's recovery.
const profiles={
 bond:{communication:.2,stress:-1,affinity:2},
 care:{communication:.1,mental:.1,affinity:2},
 organize:{mental:.1,stress:-1,affinity:1},
 delegate:{communication:.1,stress:-1,affinity:1},
 rest:{condition:2,fatigue:-2,stress:-1,affinity:1},
 stretch:{mental:.1,condition:3,fatigue:-3,affinity:1},
 food:{condition:2,stress:-2,affinity:1},
 analysis:{macro:.2,communication:.1,affinity:1},
 mastery:{mastery:.2,macro:.1,affinity:1},
 laning:{laning:.2,mastery:.1,fatigue:1,affinity:1},
 practice:{mechanics:.2,mastery:.1,fatigue:1,affinity:1},
 speaking:{communication:.2,mental:.1,affinity:2},
 confidence:{mental:.2,stress:-1,affinity:1},
};
// title | first action | effect | alternative action | effect
const definitions=`
야식 주문|메뉴를 더 골라 함께 주문한다|organize|오늘은 먼저 들어가 쉰다|rest
헤드셋 실종|목에 걸린 헤드셋을 알려준다|care|자리 밑부터 같이 찾아본다|organize
리플레이 내기|영상을 돌려 보며 진입 타이밍을 비교한다|analysis|지금은 쉬고 영상 링크를 받아 둔다|rest
분실된 충전기|케이블에 표시를 붙여 구분한다|organize|내 충전기는 방에 있다고 알리고 콘센트를 찾아준다|care
설거지 당번|그릇을 같이 닦는다|care|이번에는 부탁하고 다음 당번을 맡는다|delegate
편의점 신상품|신상품을 하나씩 나눠 먹는다|food|평소 먹던 것을 고르고 후기를 부탁한다|food
자리 온도|바람 방향을 바꾸고 후드를 건넨다|care|내 자리는 괜찮다고 하고 창가 온도를 봐준다|care
스트레칭 알람|지금 일어나 어깨와 손목을 푼다|stretch|이번 판 뒤에 하도록 알람을 다시 맞춘다|organize
라면 물 조절|봉지의 조리법을 보고 물을 맞춘다|care|라면은 안 먹고 타이머만 맞춰준다|organize
휴대폰 사진|복도에서 단체 사진을 다시 찍는다|bond|지금 사진을 그대로 남긴다|confidence
음악 취향|플레이리스트에 서로 한 곡씩 추가한다|bond|조용히 쉬고 싶다고 말한다|rest
비 오는 외출|우산을 나눠 쓰고 편의점에 간다|stretch|밖에서 필요한 것만 부탁하고 남는다|delegate
보드게임 상자|규칙을 읽고 같이 한 판 한다|bond|구경하며 점수 기록을 맡는다|care
인터뷰 연습|물병 마이크를 받고 답변을 연습한다|speaking|먼저 모범 답변을 보여 달라고 한다|analysis
모니터 밝기|같은 장면으로 화면 설정을 비교한다|organize|매니저에게 점검을 요청한다|delegate
아침 기상|내일 아침 방문을 두드려주기로 한다|care|알람 소리부터 바꿔보자고 한다|organize
분석 퀴즈|내가 고른 픽과 이유를 설명한다|analysis|힌트를 더 받아 상대 조합부터 살핀다|mastery
팀 굿즈|소매 길이를 비교하고 사이즈를 정한다|organize|샘플을 직접 입어보고 고른다|confidence
간식의 주인|주인을 확인하고 간식을 나눠 먹는다|food|공용인지 먼저 물어보고 돌려놓는다|care
쉬는 날의 약속|같이 갈 식당 후보를 정한다|bond|이번에는 쉬고 다음에 만나자고 한다|rest
짧은 산책|숙소 주변을 함께 한 바퀴 걷는다|stretch|나는 소파에서 쉬고 돌아올 때 깨워달라고 한다|rest
결정적 장면|각자 화면을 비교하며 당시 상황을 설명한다|analysis|북마크를 남기고 내일 설명하기로 한다|organize
점심 메뉴 투표|오늘 먹을 메뉴를 직접 고른다|confidence|메뉴는 맡기고 주문과 수령을 담당한다|care
숙소 정리|상자 안을 확인하고 분리수거한다|organize|주인이 올 때까지 메모를 붙여 보관한다|care
손목 보호대|보호대를 착용해 보고 크기를 확인한다|stretch|나는 괜찮다고 하고 상대 착용 상태를 봐준다|care
눈의 피로|화면을 끄고 창밖을 보며 눈을 쉰다|rest|복기를 마친 뒤 쉬기로 하고 밝기를 낮춘다|organize
등받이 각도|서로 자세를 보여주고 의자 높이를 맞춘다|stretch|트레이너에게 체격별 점검을 부탁한다|delegate
물병 표시|물병마다 이니셜을 붙인다|organize|헷갈리는 물병을 모두 씻고 물을 받는다|care
걷기 기록|같이 복도를 왕복하며 걷는다|stretch|남은 일정 뒤에 걸을 시간을 잡는다|organize
폼롤러|배운 동작을 천천히 같이 따라 한다|stretch|따라 하기보다 매트가 밀리지 않게 도와준다|care
수면 기록|잠들기 전 영상을 끌 시간을 정한다|organize|떠오르는 경기 장면을 종이에 적어 둔다|organize
온찜질 팩|팩 사용 시간을 확인하고 어깨를 푼다|stretch|지금은 받지 않고 남은 팩 위치만 확인한다|organize
신발 끈|매듭을 다시 묶고 걸어본다|care|여분 끈을 찾아주고 나중에 바꾸기로 한다|care
건조한 공기|가습기 물을 갈고 세척 날짜를 적는다|care|관리 순서를 묻고 창문을 잠깐 연다|delegate
짧은 낮잠|10분 뒤에 깨워주기로 한다|care|나도 잠들 수 있으니 알람을 두 개 맞춘다|organize
자세 사진|모니터 거리를 맞추고 자세를 서로 봐준다|stretch|다음 점검과 비교할 사진을 남긴다|organize
아이스크림 취향|서로 고른 맛을 한 숟갈씩 먹어본다|food|내 취향을 말하고 다음 주문 수량을 따로 적는다|confidence
커피 이름|컵 사진을 찍으며 같이 웃는다|bond|이름보다 맛이 중요하다며 컵만 구분한다|confidence
배달 주소|예전 주소를 지우고 새 주소로 수정한다|organize|주문을 멈추고 매니저에게 수령 장소를 묻는다|delegate
남은 케이크|마지막 조각을 반으로 나눠 먹는다|food|이번 조각은 양보하고 다음에 먼저 고른다|care
요리 영상|재료를 적고 작은 양부터 만들어보기로 한다|organize|실패할 때 먹을 메뉴도 함께 정한다|organize
도시락 반찬|서로 좋아하는 반찬으로 바꿔 먹는다|food|반찬은 그대로 먹고 못 먹는 재료만 확인한다|food
맵기 도전|한 단계 덜 맵게 먹자고 설득한다|care|상대 선택은 두고 내 메뉴는 따로 고른다|confidence
토스트 굽기|굽는 시간을 달리해 먹어보며 비교한다|food|먼저 구운 토스트부터 맛본다|food
과일 손질|달아 보이는 과일을 직접 골라 먹는다|food|나눈 과일 조각을 바꿔 먹으며 비교한다|food
야식 영수증|각자 주문한 메뉴를 표시해 정리한다|organize|금액 확인은 맡기고 음식 누락부터 확인한다|delegate
새 시리얼|각자 방식으로 만들어 비교한다|food|만드는 순서보다 먹고 남는 양을 비교한다|food
식당 웨이팅|근처를 걷다가 차례가 오면 들어간다|stretch|다음 일정에 맞춰 다른 식당을 찾는다|organize
마우스 패드 방향|같은 연습을 해보고 편한 방향을 찾는다|practice|우선 기존 설정을 사진으로 기록한다|organize
단축키 실랑이|손의 움직임을 서로 보여준다|practice|각자 설정을 존중하고 백업만 확인한다|organize
연습방 미니언|같은 조건으로 막타 연습을 해본다|laning|기록 경쟁 대신 놓치는 타이밍을 짚어준다|analysis
새 픽 첫인상|영상과 직접 해본 감각을 비교한다|mastery|결론을 미루고 스크림에서 확인할 장면을 정한다|analysis
콜 길이|자주 쓰는 콜을 짧게 맞춰본다|speaking|필수 정보가 빠지지 않게 다시 표현한다|speaking
복기 메모 색깔|성공 장면과 수정할 장면을 색으로 나눈다|analysis|한 줄에 한 가지씩 적는 방식으로 정리한다|analysis
모의 밴픽|감독 역할로 조합을 직접 짜본다|mastery|픽 의도를 듣고 다른 순서를 비교한다|analysis
시야 지도|와드 위치와 아군 합류 시간을 함께 적는다|analysis|당시 갈 수 있었던 경로부터 따져본다|analysis
귀환 타이밍|다음 오브젝트 시간에 맞춰 귀환을 계산한다|analysis|아군 위치에 따라 경우를 나눠본다|analysis
연습 기록 파일|날짜와 상대 이름으로 파일을 정리한다|organize|이름을 바꾸기 전에 공유 링크부터 확인한다|organize
관전 시점|상대 화면에서 놓쳤던 정보를 확인한다|analysis|내 화면과 당시 알고 있던 정보부터 정리한다|mastery
연습 종료 시간|내일 일정을 확인하고 한 판만 더 한다|practice|복기만 마치고 오늘 연습을 끝낸다|rest
빨래 양말|안쪽 표시를 보고 양말을 분류한다|care|공용으로 보관하고 내 빨래망에 이름을 쓴다|organize
택배 상자|주인을 찾아 상자를 직접 전달한다|care|뜯지 않고 단체방에 수령 위치를 알린다|delegate
냉장고 메모|날짜 지난 음식을 정리하고 답장을 붙인다|care|규칙에 따라 내 음식에 날짜를 적는다|organize
공용 리모컨|리모컨을 둘 바구니를 마련한다|organize|줄을 달자고 농담하며 잘 보이는 곳에 둔다|bond
기숙사 불빛|남은 사람을 확인하고 복도 불을 줄인다|care|늦게 올 사람을 위해 끝 전등은 켜둔다|care
청소기 소리|쉬는 시간을 확인해 청소 시간을 정한다|care|청소기는 미루고 작은 쓰레기만 줍는다|care
생일 날짜|좋아하는 케이크를 말하고 상대 생일도 저장한다|bond|큰 행사 대신 작게 축하받고 싶다고 말한다|confidence
우산의 주인|손잡이에 다른 색 리본을 묶는다|organize|각자 이름표를 붙이자고 한다|organize
화장실 순서|준비 시간을 나눠 사용 순서를 정한다|speaking|오늘은 먼저 쓰라고 양보한다|care
분리수거 퀴즈|분리배출 표시를 함께 확인한다|organize|확실한 쓰레기부터 분리하고 나머지는 확인한다|organize
소파 자리|옆에 앉아 오늘 있었던 일을 나눈다|bond|오래 앉지는 않고 잠깐 안부만 묻는다|care
분실물 바구니|내 케이블을 찾고 남은 물건도 분류한다|care|내 것은 없다고 하고 주인을 찾도록 메모한다|delegate
퍼즐 마지막 조각|탁자 밑을 함께 찾아본다|care|그림에서 빈 위치부터 좁혀본다|organize
노래 한 소절|기억나는 가사를 모아 곡을 찾아본다|bond|아는 사람에게 물어보자고 제안한다|delegate
사진 구도|빛이 드는 방향으로 접시를 돌려준다|care|사진은 짧게 찍고 먼저 먹자고 한다|food
영화 결말 금지|스포일러 없이 추천 이유를 듣는다|bond|내용을 듣기 전에 다른 이야기로 바꾼다|confidence
종이비행기|사람 없는 쪽으로 같이 날려본다|bond|멀리 던지기 대신 목표에 넣기를 제안한다|bond
선물 포장|포장지를 잡아주고 리본을 묶는다|care|간단한 포장 상자를 쓰자고 제안한다|organize
산책길 고양이|사진을 보며 고양이 이름 후보를 정한다|bond|자는 고양이는 깨우지 말자고 한다|care
종이책 북마크|남는 카드로 책갈피를 만들어준다|care|페이지를 접어도 괜찮다고 말한다|confidence
동전 마술|마술을 끝까지 본 뒤 손을 가리킨다|bond|마술을 보기 전에 비법부터 묻는다|confidence
하늘 사진|창가에 가서 남은 노을을 함께 본다|rest|다음 사진을 보내달라고 부탁한다|bond
주말 플레이리스트|오래 듣던 곡을 한 곡 추천한다|bond|기분별로 곡을 나눠 추천한다|speaking
간단한 그림|특징을 더 그려달라고 요청한다|bond|나도 같은 대상을 그려본다|bond
첫 광고 대사|숨을 고를 위치를 표시해준다|speaking|직접 읽어보며 말투를 비교한다|speaking
카메라 인사|짧은 인사를 함께 여러 번 찍어본다|speaking|평소 말투로 편하게 해보라고 격려한다|care
인터뷰 금지어|비슷한 뜻의 다른 표현을 함께 찾는다|speaking|자기 말투를 살리되 반복만 줄여본다|confidence
단체 포즈|서로 부딪히지 않게 동선을 맞춘다|speaking|복잡한 포즈 대신 단순한 구도를 제안한다|organize
자막 오타|오타가 나온 시간을 적어 제작진에게 보낸다|delegate|댓글보다 먼저 알리자고 바로 연락한다|delegate
라이브 시작 전|이어폰으로 마이크 잡음을 직접 확인한다|care|장비 담당자에게 음향 확인을 부탁한다|delegate
촬영 NG|같은 문장을 차분하게 다시 읽는다|speaking|잠깐 쉬고 다시 촬영하자고 한다|rest
유니폼 사인 위치|등번호를 피해서 사인할 자리를 나눈다|care|매니저에게 지정된 사인 위치를 확인한다|delegate
팬 질문 후보|내 경험을 바탕으로 짧은 답변을 준비한다|speaking|문장을 외우기보다 즉석에서 답하기로 한다|confidence
팀 채널 썸네일|가장 웃긴 사진에 한 표를 준다|bond|본인이 편한 사진을 고르도록 맡긴다|care
촬영 대기 시간|돌아가며 가벼운 질문을 낸다|bond|조용히 쉬는 시간을 갖자고 한다|rest
새 굿즈 샘플|가방에 대보며 크기를 비교한다|care|샘플에 대한 개선 의견부터 적는다|organize
팬레터 한 문장|어떤 문장이 마음에 남았는지 듣는다|care|혼자 읽을 시간을 주고 자리를 비켜준다|care
응원 슬로건|슬로건을 펼쳐 기념 사진을 남긴다|bond|구겨지지 않게 보관할 자리를 정한다|organize
그림 선물|그림과 얼굴을 비교하며 닮은 부분을 찾는다|bond|그린 사람의 마음이 느껴진다고 말한다|care
사인 펜 굵기|실제로 사인할 재질에 시험해본다|organize|잘 읽히는 굵기를 우선 고른다|organize
선물 수령 확인|수령 기록을 확인하고 감사 인사를 준비한다|speaking|구단 수령 절차부터 확인한다|delegate
옛 응원 사진|사진 속 응원 문구를 함께 찾아본다|bond|현장 분위기를 이야기해달라고 한다|care
해외 팬 인사|발음 자료를 찾아 함께 연습한다|speaking|뜻을 전하는 데 집중하자고 격려한다|care
사인 연습지|처음 사인과 지금 사인을 비교한다|bond|연습지에도 의미가 있다고 농담한다|bond
경기장 안내|입구와 퇴장 동선을 함께 확인한다|organize|매니저에게 최종 동선을 안내받는다|delegate
응원 영상 답장|감사 인사를 한 문장씩 나눠 말한다|speaking|촬영 전에 전하고 싶은 말부터 정한다|organize
기억에 남는 닉네임|닉네임의 뜻을 함께 추측해본다|bond|본인만의 뜻이 있을 거라고 이야기한다|care
빈 관중석|잠깐 무대를 바라보며 긴장을 정리한다|confidence|대기실로 돌아가 쉬자고 한다|rest
버스 자리|각자 편한 창가와 통로 자리를 고른다|confidence|나는 괜찮다며 먼저 고르도록 한다|care
원정 짐 목록|백업 장비와 충전기를 함께 점검한다|organize|각자 확인한 뒤 서로 한 번 더 봐준다|care
호텔 카드키|봉투를 구분해 각자의 카드키를 챙긴다|organize|바꿔 쓰지 않도록 보관 규칙을 정한다|care
낯선 조식|표시를 읽고 낯선 메뉴도 조금씩 먹어본다|food|익숙한 음식부터 골라 먹는다|food
이동 중 잠|도착 직전에 깨워주기로 한다|care|나도 잘 수 있으니 도착 알람을 맞춘다|organize
시차 메모|시간을 계산해 연락 가능한 때를 표시한다|organize|급하지 않으니 메시지만 남기자고 한다|delegate
편의점 길 찾기|건물 이름부터 확인하며 길을 찾는다|organize|헤매지 말고 매니저에게 길을 묻는다|delegate
어댑터 빌리기|여분 어댑터를 찾아 빌려준다|care|장비 담당자에게 필요한 수량을 알린다|delegate
돌아오는 길|돌아가서 할 일을 이야기한다|bond|도착할 때까지 조용히 쉬기로 한다|rest
기념품 선택|보관하기 편한 기념품을 추천한다|care|본인 취향에 맞는 물건을 고르도록 한다|confidence
새 연습실 길|입구 안내를 함께 읽으며 이동한다|organize|뒤따라오는 팀원이 없는지 먼저 확인한다|care
다음 원정 약속|이번에 유용했던 준비물 세 개를 적는다|organize|짐이 늘지 않도록 꼭 필요한 것만 고른다|organize
`.trim().split('\n').map(line=>line.split('|'));
const byTitle=new Map(definitions.map(([title,a,ap,b,bp])=>[title,{join:{label:a,profile:ap},later:{label:b,profile:bp}}]));
for(const incident of dailySetbacks)byTitle.set(incident.scene[0],incident.choices);
export const DAILY_CHOICE_TITLES=Object.freeze([...byTitle.keys()]);
export function dailyChoiceDefinition(title,id){
 if(!['join','later'].includes(id))throw Object.assign(new Error('대화 선택을 확인하세요.'),{status:400});
 const option=byTitle.get(title)?.[id]||{label:id==='join'?'도움을 준다':'다른 방법을 제안한다',profile:id==='join'?'care':'organize'};
 return {label:option.label,effects:{...(option.effects||profiles[option.profile])}};
}
