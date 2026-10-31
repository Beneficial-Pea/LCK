// Authored fictional spectator comments. Context comes only from revealed events.
// No remote community, AI call, player allegation or hidden simulation number.
const roles = { TOP: '탑', JGL: '정글', MID: '미드', ADC: '원딜', SUP: '서폿' };
const asText = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const count = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function contextOf(input) {
  return {
    ...input,
    team: asText(input.team, '이쪽'), enemy: asText(input.enemy, '상대'),
    killer: asText(input.killer, '저 선수'), victim: asText(input.victim, '잡힌 선수'),
    champion: asText(input.champion, '저 픽'), role: roles[input.role] || asText(input.role, '저 라인'),
    location: asText(input.location, '저 위치'), objective: asText(input.objective, '오브젝트'),
    number: count(input.number) || 1, winKills: count(input.winKills), lossKills: count(input.lossKills),
    deathCount: count(input.deathCount), killCount: count(input.killCount), multiKill: count(input.multiKill),
  };
}

const banks = {
  draft: c => [
    `${c.champion} 열어줬노 ㅋㅋ`, `${c.champion} 일단 인게임 보고 말함`,
    `${c.team} 이 픽으로 뭐 보여주나 보자`, `밴픽 끝났고 손가락으로 증명해라`,
    `픽 보고 바로 설레발 치는 애들 또 시작이네`, `${c.champion} 나온 순간부터 댓글 빨라지는 거 봐라`,
    `조합은 됐고 이번엔 운영 좀 해라`, `${c.team} ${c.champion} 잡았네 기대는 해봄`,
    `밴픽부터 싸우지 말고 일단 좀 보자고 ㅋㅋ`, `아 ${c.champion} 보고 싶은데 못 참지`,
    `픽창만 보고 벌써 감독 세 명 경질됐노`, `${c.number}세트 시작한다 밥상 차려라`,
    `${c.champion} 잘하면 신의 픽 못하면 왜 뽑음 나올 예정`, `${c.team} 또 댓글창 뒤집을 준비하네`,
  ],
  laning: c => [
    `${c.killer} 라인 미는 거 보소`, `${c.role}부터 빡세게 치네`,
    `${c.team} 주도권부터 잡으려고 하노`, `웨이브 먼저 넣는 건 좋네`,
    `${c.killer} 시작부터 앞에 서네 ㅋㅋ`, `${c.role} 카메라 좀 더 잡아줘라`,
    `${c.team} 이번엔 라인부터 힘 주네`, `서로 라인 하나도 공짜로 안 주노`,
    `초반부터 ${c.role} 바쁘다 바빠`, `${c.killer} 이 웨이브 밀고 어디 가냐`,
    `${c.team} 라인 움직이는 거부터 다르긴 하네`, `${c.role} 벌써 눈치싸움 지리네`,
  ],
  first_blood: c => [
    `퍼블은 ${c.killer} ㅋㅋ`, `퍼블부터 ${c.victim}이 내주노`,
    `${c.killer} 퍼블 먹고 시작하네`, `아니 씨발 ${c.victim} 여기서 퍼블이냐`,
    `${c.location} 퍼블 났다 잠 다 깼노`, `${c.team} 퍼블 출발은 좋다`,
    `퍼블 장면 다시 좀 ${c.killer} 뭐였냐`, `${c.victim} 퍼블은 너무 허무한데`,
    `퍼블 주인 ${c.killer} 등장`, `${c.champion} 퍼블 먹었다 이제 조심해야지`,
    `${c.killer} 첫 킬 가져가는 거 보소`, `${c.victim} 시작부터 정신 차려라`,
    `${c.location} 저길 들어가네 ㄷㄷ`, `${c.killer} 오늘 좀 매섭노`,
    `퍼블 한 번 났다고 끝났다는 애들은 뭐임 ㅋㅋ`, `${c.victim} 저 위치는 좀 아니지 않냐`,
  ],
  trade_kill: c => [
    `어 러브샷 ㅋㅋ`, `${c.killer}도 그냥 보내진 않네`, `${c.victim} 잡아서 일단 교환했노`,
    `아 깔끔하게 빠질 수 있었는데`, `ㅋㅋㅋ 결국 하나씩 가져가네`,
    `${c.killer} 끝까지 쫓아갔네 독하다`, `러브샷이면 일단 숨은 쉰다`,
    `시발 저걸 교환하네`, `${c.location} 장례식 두 번 열렸노`,
    `${c.victim} 잡은 건 좋았는데 못 살았다`, `복수는 빨랐다 ㅋㅋ`,
    `이걸 둘 다 죽어서 계산 복잡하게 만드네`,
  ],
  gank: c => [
    `${c.victim} 저 동선을 못 봤노`, `${c.victim}한테 바로 갔네 ㅋㅋ`,
    `${c.victim} 위치가 너무 맛있긴 했다`, `${c.killer} 갱 오는 속도 보소`,
    `아니 ${c.victim} 거기 계속 서 있냐고`, `${c.victim} 이건 정글에 잡힌 거 맞지`,
    `${c.victim} 라인에 초인종 달렸냐`, `시발 ${c.victim}한테 바로 붙네`,
    `${c.victim}은 미니맵 좀 보고 해라`, `${c.killer} 와서 바로 돈 받아가노`,
    `${c.victim} 쪽으로 꺾는 거부터 쎄하더라`, `${c.victim} 이 갱은 아프겠다`,
    `${c.killer} 동선 깔끔하네 인정`, `${c.victim} 지금 라인전 혼자 하는 거 아니라고`,
  ],
  solo_kill: c => [
    `${c.killer} 솔킬 씨발 ㅋㅋㅋ`, `${c.victim} 이건 변명 없지`,
    `정글 탓도 못 하노 ${c.victim}`, `${c.champion}으로 솔킬을 따버리네`,
    `${c.killer} 라인전 폼 보소`, `${c.victim} 일대일로 진 건 좀 크다`,
    `${c.killer} 손 풀렸다`, `솔킬인데 무슨 팀 탓을 하노 ㅋㅋ`,
    `${c.victim} 방금 건 진짜 개못했다`, `${c.location} 일대일 정리됐네`,
    `시발 ${c.killer} 저걸 혼자 잡냐`, `${c.victim} 복기 때 저 장면 몇 번 보겠노`,
    `${c.killer} 솔킬 먹고 표정 궁금하다`, `솔킬 나니까 불판 바로 터지네`,
  ],
  counter_gank: c => [
    `역갱 대기였노 ㅋㅋ`, `${c.killer} 뒤에서 기다렸네`,
    `${c.team} 오히려 받아먹네`, `먼저 들어간 쪽이 손해 보네`,
    `시발 저기서 한 명이 더 나오네`, `${c.location} 역갱 그림 예술이네`,
    `갱 왔더니 기다리고 있었음 ㅋㅋ`, `${c.killer} 읽고 있었노`,
    `아 이래서 정글 위치 확인하라니까`, `${c.victim} 역으로 잡혔네`,
    `${c.team} 합류 한 번은 빨랐다`, `뭐야 이거 함정이었냐`,
  ],
  invade: c => [
    `${c.team} 남의 정글에서 뭐하노 ㅋㅋ`, `들어가서 아예 눌러버리네`,
    `${c.victim} 자기 정글에서도 편히 못 도네`, `${c.killer} 정글 안쪽까지 들어갔노`,
    `카정이 아니라 사람을 잡고 있네`, `${c.location}부터 싸움 걸어버림`,
    `시발 정글 소유권 분쟁났네`, `${c.team} 저쪽 캠프에 월세 내냐`,
    `${c.victim} 정글 들어가다 맞았노`, `와 침투 타이밍 독하게 잡네`,
    `정글 안에서 저렇게 만나면 피곤하지`, `${c.killer} 맵 넓게 쓰는 거 보소`,
  ],
  bot_skirmish: c => [
    `바텀 지금 난리 났노`, `${c.killer} 바텀에서 돈 벌어가네`,
    `${c.victim} 바텀 싸움은 그렇게 하면 안 되지`, `둘이 들어가는 타이밍 보소`,
    `시발 바텀 카메라 고정해라`, `바텀에서 서로 물었네 ㅋㅋ`,
    `${c.team} 바텀 교전은 좋다`, `원딜 서폿 둘 다 바쁘노`,
    `${c.killer} 바텀에서 존재감 지리네`, `밑에서 싸우는 동안 불판도 싸우고 있음`,
    `바텀 한 번 붙으니까 바로 터지네`, `${c.victim} 이 교환은 좀 비쌌다`,
  ],
  tower_dive: c => [
    `다이브를 박아버리노`, `${c.victim} 포탑 아래도 안전하지 않네`,
    `${c.killer} 포탑 안까지 들어갔노`, `시발 저걸 포탑에서 잡아`,
    `웨이브 박히니까 바로 들어오는 거 봐라`, `${c.team} 다이브 설계 좋네`,
    `${c.victim} 이건 숨도 못 쉬겠다`, `포탑이 경호원은 아니었네 ㅋㅋ`,
    `${c.location}에 사람 몰리는 거 무섭노`, `${c.killer} 다이브 마무리 깔끔하네`,
    `아 포탑 믿고 있었는데`, `다이브 들어가는 콜 하나는 세네`,
  ],
  vision_catch: c => [
    `${c.victim} 혼자 가면 그러지`, `시야 없는 데 왜 들어가노`,
    `${c.killer} 저 자리에서 기다렸네`, `아니 ${c.victim} 거길 왜 확인해`,
    `시발 와드 지우다 사람이 지워졌네`, `${c.location} 덫 제대로 깔았노`,
    `${c.victim} 이건 너무 공짜인데`, `${c.team} 한 명 끊는 타이밍 좋네`,
    `와드 하나 보려다 전광판을 보노`, `${c.killer} 각 하나 잘 잡았다`,
    `${c.victim} 혼자 다니면 죽는 시간이야`, `저렇게 잘리면 오브젝트 앞에서 피곤하지`,
  ],
  outplay: c => [
    `${c.killer} 뭐야 저거 ?????`, `시발 저걸 살아서 잡아?`,
    `${c.champion} 방금 무빙 봤냐`, `${c.victim} 잡으러 갔다가 잡혔노`,
    `와 이건 ${c.killer}이 잘했다`, `${c.killer} 방금은 욕 못 한다`,
    `????? 이게 사람 손이냐`, `${c.champion} 이 장면은 인정이다`,
    `아니 씨발 방금 화면이 이상했는데`, `${c.killer} 저걸 뒤집네 미쳤노`,
    `${c.victim} 저게 안 죽으면 어쩌라는 거냐 ㅋㅋ`, `지금 장면은 다시 봐야겠노`,
  ],
  objective: c => [
    `${c.objective}은 ${c.team}`, `${c.team} 공짜는 안 놓치네`,
    `${c.objective} 앞에 먼저 서는 게 답이노`, `반대쪽은 그냥 양보했네`,
    `${c.team} 오브젝트 타이밍 좋다`, `${c.objective} 하나 챙기고 숨 돌리네`,
    `시발 ${c.objective}은 봐야지`, `${c.team} 먹을 건 먹네`,
    `${c.objective} 쌓는 거 은근 아픈데`, `뒤늦게 와봤자 이미 먹었지 ㅋㅋ`,
    `${c.team} 강가 선점한 값 받는다`, `${c.objective}은 깔끔하게 넘어갔노`,
  ],
  objective_contest: c => [
    `${c.objective} 앞에서 또 다 붙었네`, `먹겠다고 모였다가 싸움 커지네 ㅋㅋ`,
    `${c.team} 이번 ${c.objective}은 안 빼네`, `시발 여기서 물면 끝까지 가야지`,
    `${c.location} 사람 몰리는 거 봐라`, `${c.objective} 때문에 한타 열렸노`,
    `${c.team} 합류 늦지 않았네`, `오브젝트 앞에서 치킨게임 하네`,
    `저렇게 붙으면 ${c.objective}보다 사람이 먼저지`, `${c.killer} 이 싸움에서 돈 벌었노`,
    `${c.objective} 하나 때문에 맵 절반이 싸우네`, `붙을 거면 같이 붙어야지 ㅅㅂ`,
  ],
  objective_steal: c => [
    `뺏었다 씨발 ㅋㅋㅋㅋ`, `${c.killer}이 ${c.objective} 들고 튀노`,
    `${c.objective} 스틸 뭐냐 ?????`, `먹던 팀 지금 키보드 놨겠노`,
    `${c.team} 저걸 가져오네`, `와 ${c.objective} 막타를 뺏네`,
    `시발 이거 뺏기면 안 되는 거잖아`, `${c.killer} 갑자기 영웅 됐노`,
    `${c.objective} 주인이 바뀌었는데요`, `상대가 열심히 치고 ${c.team}이 먹음 ㅋㅋ`,
    `오브젝트 배달 감사합니다`, `${c.objective} 스틸 장면 다시 틀어라`,
  ],
  baron: c => [
    `${c.team} 바론 먹는다`, `시발 바론을 그냥 주노`,
    `바론 앞 시야부터 다 먹혔네`, `${c.team} 바론 턴 좋다`,
    `바론 가져가면 이제 라인 어떻게 막냐`, `${c.team} 먹을 때는 존나 빠르네`,
    `사람 빠지니까 바로 바론 켜노`, `아 저기서 바론이 넘어가네`,
    `바론 먹었으면 밀어야지 이제`, `${c.team} 판단 하나는 빨랐다`,
    `바론이 공짜였냐고 ㅋㅋ`, `이제 버프 들고 어디로 가나 보자`,
  ],
  baron_steal: c => [
    `바론 스틸 씨발 ㅋㅋㅋㅋㅋ`, `${c.killer} 저걸 쳐들어가서 먹네`,
    `아니 바론을 뺏기면 어떡하노`, `????? 방금 바론 주인 바뀜`,
    `${c.team} 바론까지 훔쳐가노`, `시발 이건 댓글 속도 못 따라감`,
    `${c.killer} 영웅 등판`, `바론 먹다가 게임이 이상해졌노`,
    `열심히 잡아서 ${c.team} 줬네 ㅋㅋ`, `와 저걸 막타쳐서 가져오냐`,
    `바론 스틸인데 카메라 좀 다시 돌려줘`, `바론 뺏긴 팀 지금 복기 생각나겠노`,
  ],
  side_push: c => [
    `사이드에 사람이 없노`, `${c.team} 맵 넓게 쓰네`,
    `중앙만 쳐다보다가 옆이 털리네`, `시발 사이드 좀 봐라`,
    `${c.killer} 사이드에서 돈 벌고 있네`, `${c.team} 싸움 안 하고도 뜯어가노`,
    `저쪽 막으러 가면 또 반대가 비는데`, `포탑 뜯는 속도 봐라 ㅋㅋ`,
    `${c.team} 운영으로 이득 내는 중`, `몰려다니는 동안 옆에서 월급 받네`,
    `한타만 게임이 아니긴 하노`, `맵 넓어지니까 다들 바쁘다 바빠`,
  ],
  tower: c => [
    `${c.team} 포탑 하나 더 뜯는다`, `아 포탑까지 나가네`,
    `시발 저 라인 비우면 당연히 밀리지`, `${c.team} 건물 철거하노`,
    `포탑 하나씩 빠지는 거 아픈데`, `막으러 갔어야지 ㅋㅋ`,
    `${c.team} 압박 계속 넣네`, `저 포탑까지 주면 동선 불편해지지`,
    `건물은 거짓말 안 하노`, `${c.team} 눈에 보이는 돈 챙긴다`,
  ],
  vision: c => [
    `${c.team} 시야 잡는 건 좋네`, `와드부터 다 지우고 들어오노`,
    `강가 시야 없으면 발을 못 뻗지`, `서폿들 지금 존나 바쁘네`,
    `${c.team} 먼저 자리 잡았다`, `아 저 지역 깜깜한 거 봐라`,
    `킬은 안 나도 저거 중요한 장면이지`, `시야 먹는 턴 깔끔하노`,
    `와드 지우는 거 은근 독하네`, `${c.team} 맵에서 숨을 쉬게 해주질 않네`,
    `오브젝트 전에 자리부터 잡아야지`, `미니맵 볼 맛 난다`,
  ],
  call_conflict: c => [
    `콜 갈렸노 ㅋㅋ`, `둘이 다른 화면 보고 있냐`,
    `아니 시발 갈 거면 같이 가라고`, `${c.enemy} 방금 콜 하나는 엉망이네`,
    `누구는 가고 누구는 빠지고 뭐하노`, `불판보다 팀 안이 더 시끄럽겠네`,
    `저걸 반반씩 움직이면 둘 다 못 먹지`, `의견 통일부터 하고 들어가라`,
    `${c.team} 상대 갈린 거 바로 먹네`, `합류 안 맞는 거 화면에 다 보이노`,
    `판단이 둘이면 몸은 어디로 가냐고`, `콜 하나 정리해라 좀 ㅅㅂ`,
  ],
  teamfight: c => [
    `${c.killer} 방금 들어가는 거 봄?`, `시발 한타가 왜 이렇게 되노`,
    `${c.team} 같이 붙는 타이밍 좋네`, `${c.killer} 저기서 킬 쓸어가네`,
    `${c.team} 한타는 인정`, `와 방금 싸움 존나 정신없네`,
    `${c.winKills}대${c.lossKills}면 ${c.team} 이득이지`, `들어가는 사람은 하나인데 뒤가 다 붙네`,
    `${c.victim} 이번 교전은 아팠다`, `시발 싸움 한 번에 화면 색이 바뀌네`,
    `${c.team} 교전 한 번 잘했노`, `${c.killer} 이번 장면은 잘했다`,
    `누가 뭐 해도 저 한타는 ${c.team}이 잘함`, `ㅈㄴ 빠르게 붙네 저 팀`,
  ],
  decisive_fight: c => [
    `씨발 마지막 한타 뭐였냐`, `${c.team} 끝내는 싸움 나왔노`,
    `${c.killer}이 이 장면을 해버리네`, `저렇게 죽으면 막을 사람이 없지`,
    `와 이 싸움으로 게임이 넘어가네`, `${c.team} 여기서 안 쫄고 붙네`,
    `시발 지금 교전 다시 봐야겠다`, `${c.killer} 오늘 이 장면으로 기억나겠노`,
    `${c.winKills}대${c.lossKills} 교환이면 이제 밀어야지`, `결정적일 때 한 번 세게 치네`,
    `${c.team} 싸움 끝나자마자 밀 준비하네`, `아 저 한타를 지네`,
  ],
  nexus: c => [
    `${c.team} 끝냈노`, `아 시발 이렇게 끝나네`,
    `${c.number}세트는 ${c.team} 거다`, `넥서스까지 밀었다 수고`,
    `${c.team} 마무리는 확실하네`, `싸움 이기니까 그냥 끝까지 가노`,
    `이번 세트 댓글 복기하면 재밌겠네 ㅋㅋ`, `${c.team} 마지막에는 안 놓쳤다`,
    `아니 끝날 땐 존나 빨리 끝나네`, `넥서스 터졌다 다음 얘기하자`,
    `${c.team} 우선 한 세트 챙긴다`, `이 세트만 보고 세상 끝난 척은 하지 말고`,
    `넥서스 깨지니까 갑자기 조용해지노`, `결국 ${c.team}이 쳐냈다`,
  ],
};

function extraComments(c) {
  const extra = [];
  if (c.comeback) extra.push(
    `욕하던 애들 어디 갔노`, `저 여기 있는데요`, `${c.team} 망했다던 사람들 나와봐`,
    `아니 씨발 이걸 뒤집네`, `끝났다고 밥 먹으러 간 애들 돌아와라`,
    `${c.killer} 욕하려고 쓴 댓글 지우는 중`, `아까 장례식 치른 팀 맞냐 ㅋㅋ`,
  );
  if (c.deathCount >= 2) extra.push(
    `${c.victim} 또 죽네`, `${c.victim} 오늘 데스 장면 자주 보노`,
    `${c.victim} 같은 세트에서 또 누웠는데`, `시발 ${c.victim} 데스만 보느라 눈 바쁘다`,
  );
  if (c.killCount >= 4) extra.push(
    `${c.killer} 킬 먹는 속도 미쳤노`, `${c.killer} 계속 킬 쌓네`,
    `오늘 ${c.killer}한테 돈 몰리네`, `${c.killer} 이쯤 되면 더 조심해야지`,
  );
  if (c.multiKill >= 3) extra.push(
    `${c.killer}이 ${c.multiKill}명 잡았노 ????`, `씨발 ${c.multiKill}킬을 쓸어담네`,
    `${c.killer}한테 왜 다 죽냐고 ㅋㅋ`, `${c.champion} 킬 로그 도배한다`,
  );
  if (c.winKills === 5 && c.lossKills === 0) extra.push('에이스 씨발 ㅋㅋㅋㅋ', '다 잡고 다 살았노', '아무도 못 데려갔네 이건 크다');
  return extra;
}

function shuffled(random, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createCommentator(random, usedComments = new Set()) {
  let fallback = 0;
  return (type, input = {}) => {
    const context = contextOf(input);
    const choices = (banks[type] || banks.teamfight)(context);
    const extra = extraComments(context);
    const available = shuffled(random, [...new Set([...extra, ...choices])]).filter(text => !usedComments.has(text));
    const desired = 2 + Math.floor(random() * 3);
    const comments = [];
    // First blood always includes an observable first-kill reaction, including
    // after an unlucky series has exhausted generic first-kill comments.
    if (type === 'first_blood') {
      let first = available.find(text => text.includes('퍼블'));
      if (!first) first = `${context.killer} 퍼블 · ${context.location}${'!'.repeat(1 + fallback++ % 4)}`;
      comments.push(first);usedComments.add(first);
    }
    if (type === 'gank') {
      const focused = available.find(text => text.includes(context.victim));
      if (focused && !usedComments.has(focused)) { comments.push(focused);usedComments.add(focused); }
    }
    // A comeback/repeated mistake can change the tone, without claiming a
    // streak, ability use or map information which the caller did not reveal.
    if (extra.length && random() < .72) {
      const special = available.find(text => extra.includes(text) && !usedComments.has(text));
      if (special) { comments.push(special);usedComments.add(special); }
    }
    for (const text of available) {
      if (comments.length >= desired) break;
      if (!usedComments.has(text)) { comments.push(text);usedComments.add(text); }
    }
    // Contextual alternates are used only when a long series exhausts a bank.
    // They still refer to the actual event and never invent off-screen actions.
    const tails = ['이 장면 좀 봐라', '이걸 이렇게 하네 ㅋㅋ', '방금은 인정', '댓글창 터지겠노', '다시 한 번 보자', '이건 좀 크다', '와 이게 되네', '지금 장면은 남겠네'];
    while (comments.length < desired) {
      const anchor = type === 'draft' ? context.champion : type === 'nexus' ? context.team : context.killer;
      let text = `${anchor} · ${tails[fallback++ % tails.length]}`;
      while (usedComments.has(text)) text += fallback % 2 ? ' ㅋㅋ' : ' ㄷㄷ';
      comments.push(text);usedComments.add(text);
    }
    return comments;
  };
}

export const COMMENTARY_TYPES = Object.freeze(Object.keys(banks));
