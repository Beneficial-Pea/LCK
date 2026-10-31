// Career and play-style motifs are combined into original character backgrounds.
// Public descriptions deliberately omit real players' names and unique aliases.
const debut='데뷔와 성장',career='경험과 커리어',style='플레이 스타일';
const entry=(id,name,category,description,bonuses,intro,reactions=[])=>({id,name,category,description,bonuses,intro,reactions});
export const CHARACTER_BACKGROUNDS = [
 entry('none','기본 선수','자유 설정','자신만의 길을 만들어 가는 선수. 정해진 과거 없이 직접 이야기를 채운다.',{},'{nickname}이 선수단에 합류했다.'),
 entry('rookie','신인',debut,'처음 1군 무대에 선 선수. 새 환경에 적응하며 한 경기씩 경험을 쌓는다.',{mechanics:1,mastery:2},'{nickname}이 첫 1군 시즌을 시작한다. 새로운 무대에서 한 경기씩 경험을 쌓는다.',['{nickname} 신인인데 과감하네','첫 시즌부터 {nickname} 눈에 들어오노']),
 entry('prospect','주목받는 신예',debut,'데뷔 전부터 관심을 모았다. 기대와 시선 속에서 자신의 실력을 증명하려 한다.',{mechanics:2,laning:2,mastery:1},'데뷔 전부터 주목받던 {nickname}이 합류했다. 기대를 경기력으로 바꿀 차례다.',['주목받던 신예 {nickname} 여기서 보여주네','{nickname} 기대받는 이유가 있노']),
 entry('academy_graduate','육성팀이 길러낸 유망주',debut,'연습생과 육성 리그를 거치며 기본기를 다졌다. 익숙한 팀 합과 챔피언 이해도를 바탕으로 1군에 도전한다.',{mechanics:1,laning:1,communication:1,mastery:2},'육성팀을 거쳐 올라온 {nickname}이 1군 명단에 이름을 올렸다. 연습실에서 쌓은 시간을 무대로 가져왔다.',['육성팀에서 올라온 {nickname} 드디어 보네','{nickname} 기본기 다지고 올라온 선수지']),
 entry('solo_queue_star','솔로 랭크가 먼저 알아본 재능',debut,'상위권 솔로 랭크에서 날카로운 손과 숙련도로 이름을 알렸다. 혼자 증명한 재능을 팀 경기에서도 보여주려 한다.',{mechanics:2,laning:1,mastery:2},'솔로 랭크에서 먼저 이름을 알린 {nickname}이 합류했다. 이제 다섯 명이 함께하는 경기에 적응할 차례다.',['랭크에서 보던 {nickname}이 여기 있네','{nickname} 솔랭에서 이름 날리던 선수잖아']),
 entry('late_bloomer','늦게 찾아온 전성기',debut,'긴 무명 생활 끝에 기회를 잡았다. 조급함을 내려놓고 준비해 온 경기 운영과 멘탈로 뒤늦은 전성기를 연다.',{laning:1,macro:1,mental:2,mastery:1},'오래 준비한 {nickname}에게 주전 기회가 찾아왔다. 늦게 시작한 이야기를 길게 이어 가려 한다.',['{nickname} 여기까지 오래 걸렸지','늦게 기회 잡은 {nickname} 응원하게 되네']),
 entry('underdog_ace','하위권에서 버틴 에이스',debut,'쉽지 않은 팀 사정 속에서도 라인전과 개인 기량으로 버텼다. 불리한 경기와 패배를 견디며 스스로를 단련했다.',{mechanics:1,laning:1,mental:2,mastery:1},'어려운 시즌마다 팀을 버티게 했던 {nickname}이 합류했다. 이번에는 더 높은 순위를 바라본다.',['{nickname} 힘든 팀에서 버티던 시절 생각나네','{nickname} 이제 좀 좋은 시즌 보내보자']),
 entry('veteran','베테랑',career,'리그의 긴 시즌과 큰 경기를 경험했다. 상황을 정리하고 동료를 이끄는 데 익숙하다.',{macro:2,communication:2,mental:1},'리그를 오래 지켜온 {nickname}이 합류했다. 긴 시즌을 헤쳐 갈 경험을 가져왔다.',['{nickname} 짬바 나오는 장면이네','베테랑 {nickname} 여기서 해주노']),
 entry('former_all_pro','지난 시즌 올프로',career,'지난 시즌 올프로에 이름을 올렸다. 특정 장면만이 아니라 시즌 내내 이어진 꾸준함을 올해도 증명하려 한다.',{mechanics:1,laning:1,macro:1,communication:1,mental:1,mastery:1},'지난 시즌 올프로 {nickname}이 합류했다. 올해도 자신의 자리를 증명하려 한다.',['전년도 올프로 {nickname} 폼 보소','작년 올프로 이름값 보여주네 {nickname}']),
 entry('franchise_player','팀을 지킨 프랜차이즈',career,'오랜 시간 같은 구단의 유니폼을 입었다. 흔들리는 시즌에도 동료를 붙잡고 팀의 기준을 지켜 왔다.',{macro:1,communication:2,mental:2},'팀의 오랜 시간을 함께한 {nickname}이 새 시즌을 맞는다. 익숙한 유니폼에 또 하나의 시즌을 쌓는다.',['{nickname} 하면 이 팀이지','{nickname} 이 팀에서 버틴 세월이 있잖아']),
 entry('dynasty_captain','왕조를 이끈 주장',career,'여러 차례 우승을 경험하며 팀의 중심을 맡았다. 유리할 때의 침착함과 불리할 때의 판단으로 동료들을 한 방향으로 모은다.',{macro:2,communication:2,mental:2},'우승을 거듭 경험한 주장 {nickname}이 선수단의 중심을 맡았다. 지난 영광보다 다음 경기를 먼저 이야기한다.',['우승 여러 번 해본 {nickname}이 중심 잡아야지','{nickname} 같은 주장은 든든하긴 해']),
 entry('international_veteran','국제전에서 단련된 승부사',career,'낯선 상대와 큰 무대의 압박을 여러 번 겪었다. 상대의 강점을 읽고 결정적인 순간에도 손을 굳히지 않는 법을 배웠다.',{mechanics:1,macro:1,mental:2,mastery:1},'국제 무대의 큰 경기를 경험한 {nickname}이 합류했다. 처음 보는 상대 앞에서도 준비한 순서를 지킨다.',['{nickname} 큰 무대 경험은 많지','{nickname} 국제전에서 단련된 선수잖아']),
 entry('returning_champion','다시 정상에 도전하는 우승자',career,'한 번 정상에 섰지만 그 뒤의 시즌은 순탄하지 않았다. 우승까지 가는 길을 기억하며 다시 자신의 자리를 되찾으려 한다.',{macro:1,mental:2,mastery:2},'우승의 기쁨과 그 뒤의 공백을 겪은 {nickname}이 돌아왔다. 다시 한 번 마지막 경기까지 가려 한다.',['{nickname} 우승하던 시절 기억나네','{nickname} 다시 정상 가는 거 보고 싶다']),
 entry('overseas_returnee','해외에서 돌아온 에이스',career,'다른 리그에서 낯선 언어와 경기 스타일에 적응했다. 넓어진 챔피언 이해와 소통 경험을 안고 국내 무대로 돌아왔다.',{laning:1,communication:1,mental:1,mastery:2},'해외 리그를 거쳐 {nickname}이 돌아왔다. 다른 환경에서 배운 준비 방식과 경험을 선수단에 가져왔다.',['{nickname} 해외 돌고 돌아온 거지','{nickname} 다른 리그 경험이 꽤 쌓였네']),
 entry('bench_to_starter','긴 대기 끝에 잡은 주전',career,'교체 명단에서 기다리는 동안에도 팀의 연습을 놓지 않았다. 얻어낸 기회를 지키기 위해 준비와 팀 합에 더 많은 시간을 쓴다.',{mechanics:1,communication:1,mental:2,mastery:1},'긴 대기 끝에 {nickname}이 선발 명단에 이름을 올렸다. 기다리는 동안에도 연습을 멈추지 않았다.',['{nickname} 주전 기회 오래 기다렸지','{nickname} 준비한 거 보여줄 차례네']),
 entry('role_swap','포지션을 바꾼 도전자',career,'다른 포지션에서 쌓은 경험을 새 역할에 연결했다. 동료의 시선을 이해하며 챔피언과 운영을 다시 익혀 주전 경쟁에 나섰다.',{macro:2,communication:1,mastery:2},'포지션 전향을 선택한 {nickname}이 새 역할로 합류했다. 이전 자리에서 배운 시야를 팀의 움직임에 보탠다.',['{nickname} 예전엔 다른 포지션이었잖아','전향하고 여기까지 온 {nickname}도 대단하네']),
 entry('comeback_player','공백기를 넘긴 복귀자',career,'무대에서 잠시 멀어졌지만 개인 연습은 계속했다. 다시 돌아오기까지 다듬은 기본기와 집중력으로 새로운 시즌을 시작한다.',{mechanics:1,laning:1,mental:1,mastery:2},'공백기를 보낸 {nickname}이 다시 경기장으로 돌아왔다. 비워 둔 시간을 새 경기 기록으로 채우려 한다.',['{nickname} 다시 무대에서 보니까 반갑네','공백기 지나 돌아온 {nickname} 응원한다']),
 entry('lane_dominator','라인전으로 증명한 에이스',style,'상성의 작은 차이와 자원 하나를 놓치지 않는 라인전으로 평가받았다. 초반에 만든 차이를 팀의 첫 움직임으로 연결한다.',{mechanics:2,laning:2,macro:1},'라인전으로 이름을 알린 {nickname}이 합류했다. 작은 우위를 놓치지 않는 습관을 새 시즌에도 이어 간다.',['{nickname} 원래 라인전으로 유명했지','{nickname} 기본 라인전은 믿고 보던 선수잖아']),
 entry('teamfight_carry','한타로 이름을 알린 캐리',style,'교전에서 설 자리와 공격할 대상을 빠르게 찾는다. 긴 대치 끝에도 딜을 넣을 순간을 기다리는 집중력으로 인정받았다.',{mechanics:2,macro:1,communication:1,mastery:1},'한타에서 강점을 보여 온 {nickname}이 합류했다. 팀과 함께 들어가고 함께 살아 나오는 타이밍을 맞춘다.',['{nickname}은 한타에서 이름 알린 선수지','{nickname} 교전 잘하던 시절부터 봤다']),
 entry('side_lane_specialist','사이드 운영의 설계자',style,'혼자 선 라인에서 상대의 선택을 끌어냈다. 라인전과 순간 이동, 합류의 시간을 함께 계산하는 운영으로 평가받았다.',{mechanics:1,laning:2,macro:2},'사이드 운영에 강점을 가진 {nickname}이 합류했다. 떨어져 있는 시간까지 팀의 움직임과 맞추려 한다.',['{nickname} 사이드 운영으로 유명하잖아','{nickname} 혼자 서는 라인 경험이 많지']),
 entry('pathing_architect','동선으로 판을 짜는 설계자',style,'자원과 합류 시간을 계산하며 팀의 첫 계획을 세워 왔다. 보이지 않는 상대의 움직임을 읽고 필요한 자리에 먼저 가는 유형이다.',{laning:1,macro:2,communication:1,mastery:1},'동선과 합류 설계에 강점을 가진 {nickname}이 합류했다. 코치와 함께 다음 경기의 첫 움직임을 정리한다.',['{nickname} 원래 동선 연구 많이 하던 선수지','{nickname} 판 짜는 스타일은 익숙하네']),
 entry('engage_leader','교전의 문을 여는 이니시에이터',style,'첫 진입의 거리와 타이밍을 과감하게 잡는 플레이로 주목받았다. 동료가 따라올 수 있는 진입을 만들기 위해 짧고 분명한 콜을 쓴다.',{mechanics:2,communication:2,mental:1},'교전의 첫 진입을 맡아 온 {nickname}이 합류했다. 들어가는 순간만큼 팀과의 마지막 확인을 중요하게 여긴다.',['{nickname} 원래 먼저 여는 스타일이지','{nickname} 진입각 보던 선수잖아']),
 entry('vision_anchor','시야와 합류를 책임진 조율자',style,'맵의 빈틈을 메우고 동료가 움직일 길을 확보해 왔다. 화려한 처치보다 시야와 소통으로 팀의 선택을 편하게 만드는 유형이다.',{macro:2,communication:2,mastery:1},'시야와 합류를 조율해 온 {nickname}이 합류했다. 동료가 편하게 움직일 수 있는 길부터 살핀다.',['{nickname}은 시야랑 합 맞추는 쪽이지','{nickname} 팀 움직임 챙기던 선수잖아']),
 entry('signature_specialist','시그니처 픽의 장인',style,'주력 챔피언을 깊게 파고들며 밴픽에서 존재감을 만들었다. 익숙한 픽의 세밀한 조작과 한계를 아는 숙련도가 무기다.',{mechanics:2,mental:1,mastery:2},'주력 픽의 높은 숙련도로 알려진 {nickname}이 합류했다. 상대가 준비한 밴까지 예상하며 연습 범위를 넓힌다.',['{nickname} 주력 챔프 연습량 많던 선수지','장인 출신 {nickname}이네']),
 entry('versatile_player','넓은 챔피언 풀의 만능형',style,'메타가 바뀌어도 팀이 필요한 픽을 빠르게 준비했다. 여러 역할과 조합을 이해하며 밴픽의 선택지를 넓혀 왔다.',{mechanics:1,macro:1,communication:1,mastery:2},'넓은 챔피언 풀을 갖춘 {nickname}이 합류했다. 팀이 필요한 조합부터 물으며 이번 주 연습 픽을 정한다.',['{nickname} 챔프 폭 넓은 걸로 유명하지','{nickname} 여러 픽 준비하던 선수네']),
 entry('late_game_closer','후반을 끝내는 마무리',style,'경기가 길어져도 다음 목표를 놓치지 않는 선수다. 마지막 한타와 본진 진입을 앞두고도 위험과 보상을 침착하게 따진다.',{mechanics:1,macro:2,mental:2},'후반 판단으로 평가받아 온 {nickname}이 합류했다. 긴 경기에서도 다음에 해야 할 일을 차분하게 정리한다.',['{nickname}은 후반 침착함으로 알려졌지','{nickname} 긴 경기 경험이 꽤 많잖아']),
 entry('clutch_performer','승부처에 강한 해결사',style,'세트의 무게가 커져도 자신의 판단을 끝까지 실행한다. 큰 경기에서의 과감한 플레이와 흔들리지 않는 소통으로 기억됐다.',{mechanics:2,communication:1,mental:2},'승부처에서 강한 모습을 보여 온 {nickname}이 합류했다. 중요한 순간에도 평소의 준비 순서를 반복한다.',['{nickname} 승부처 강하다고 하던 선수지','{nickname} 중요한 경기 경험도 많잖아']),
 entry('selfless_teammate','팀을 살리는 헌신형',style,'자신의 자원보다 팀 조합과 동료의 성장 시간을 먼저 봐 왔다. 안정적인 라인 관리와 소통으로 팀이 원하는 경기를 뒷받침한다.',{laning:1,macro:1,communication:2,mental:1},'팀을 위한 역할을 묵묵히 맡아 온 {nickname}이 합류했다. 새 동료들이 편하게 뛸 수 있는 방법부터 찾는다.',['{nickname}은 팀 맞춰주던 선수잖아','{nickname} 묵묵히 해주던 거 기억난다']),
];
export function backgroundFor(value){return CHARACTER_BACKGROUNDS.find(b=>b.id===value)||CHARACTER_BACKGROUNDS[0];}
export function normalizeBackground(value){
 if(value==null||value==='')return 'none';
 if(typeof value!=='string'||!CHARACTER_BACKGROUNDS.some(b=>b.id===value))throw Object.assign(new Error('선수 배경을 선택하세요.'),{status:400});
 return value;
}
export function startingStats(background){
 const bonus=backgroundFor(background).bonuses;
 return Object.fromEntries(['mechanics','laning','macro','communication','mental','mastery'].map(key=>[key,65+(bonus[key]||0)]));
}
export function backgroundIntro(c){return backgroundFor(c.background).intro.replaceAll('{nickname}',c.nickname||c.name||'선수');}
export function backgroundReactions(background,nickname){return (backgroundFor(background).reactions||[]).map(line=>line.replaceAll('{nickname}',nickname));}
