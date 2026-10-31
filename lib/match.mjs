// Seeded, event-driven match simulation. No result is drawn before the game.
const POSITIONS = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const LABELS = { TOP: '탑', JGL: '정글', MID: '미드', ADC: '원딜', SUP: '서포터' };
const CHAMPIONS = {
  TOP: ['제이스', '그웬', '럼블', '나르', '레넥톤', '오른', '크산테', '잭스', '카밀', '케넨', '암베사', '아트록스', '말파이트', '사이온', '갱플랭크', '피오라'],
  JGL: ['비에고', '리 신', '세주아니', '바이', '오공', '신 짜오', '자르반 4세', '니달리', '뽀삐', '마오카이', '스카너', '녹턴', '킨드레드', '릴리아', '그레이브즈', '엘리스'],
  MID: ['아지르', '아리', '오리아나', '사일러스', '탈리야', '신드라', '갈리오', '빅토르', '라이즈', '트위스티드 페이트', '르블랑', '조이', '코르키', '애니', '카시오페아', '베이가'],
  ADC: ['이즈리얼', '카이사', '바루스', '애쉬', '진', '자야', '칼리스타', '루시안', '케이틀린', '제리', '미스 포츈', '징크스', '시비르', '아펠리오스', '드레이븐', '트리스타나'],
  SUP: ['노틸러스', '레오나', '라칸', '알리스타', '브라움', '렐', '쓰레쉬', '탐 켄치', '바드', '레나타 글라스크', '유미', '룰루', '나미', '카르마', '밀리오', '블리츠크랭크'],
};
const WEIGHTS = {
  early: { mechanics: .24, laning: .32, macro: .13, communication: .12, mental: .06, mastery: .13 },
  middle: { mechanics: .18, laning: .12, macro: .25, communication: .22, mental: .1, mastery: .13 },
  late: { mechanics: .19, laning: .06, macro: .25, communication: .24, mental: .16, mastery: .1 },
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function seededRandom(seed) {
  let h = 2166136261;
  for (const c of String(seed ?? 'LCK')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const choose = (rng, list) => list[Math.floor(rng() * list.length)];
const shuffled = (rng, list) => [...list].sort(() => 0).map(item => ({ item, n: rng() })).sort((a, b) => a.n - b.n).map(x => x.item);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function normalizeTeam(team, index) {
  const name = String(team?.name || `팀 ${index + 1}`);
  return {
    name,
    style: String(team?.style || 'balanced'),
    players: POSITIONS.map((position, i) => {
      const source = team?.players?.find(p => p.position === position) || {};
      const base = Number(team?.power) || 65;
      const stats = Object.fromEntries(Object.keys(WEIGHTS.early).map(k => [k, clamp(Number(source.stats?.[k]) || base, 1, 100)]));
      return { ...source, nickname: String(source.nickname || `${name} ${LABELS[position]}`), position, stats,
        condition: clamp(Number(source.condition ?? 85), 0, 100), fatigue: clamp(Number(source.fatigue ?? 10), 0, 100), stress: clamp(Number(source.stress ?? 10), 0, 100),
        pool: Array.isArray(source.pool) ? source.pool.filter(x => typeof x === 'string' && x.trim()) : [],
        mainChampion: source.mainChampion || CHAMPIONS[position][i],
      };
    }),
  };
}

function styleBonus(style, phase) {
  if (/early|초반|공격|주도권/.test(style)) return phase === 'early' ? 5 : phase === 'late' ? -1 : 1;
  if (/teamfight|한타/.test(style)) return phase === 'late' ? 5 : phase === 'middle' ? 3 : -1;
  if (/side|사이드/.test(style)) return phase === 'middle' ? 4 : phase === 'late' ? 2 : 0;
  return 1;
}

function individualStrength(player, phase, champion) {
  const weighted = Object.entries(WEIGHTS[phase]).reduce((sum, [key, weight]) => sum + player.stats[key] * weight, 0);
  const championFactor = champion === player.mainChampion ? 1.035 : player.pool.includes(champion) ? 1 : .94;
  return weighted * (.80 + player.condition * .002) * championFactor - player.fatigue * .11 - player.stress * .07 + styleBonus(player.style || '', phase) * .4;
}

function buildDraft(teams, spent, rng) {
  const used = new Set();
  const notes = [];
  const bans = teams.map((team, i) => shuffled(rng, [...new Set(teams[1 - i].players.map(p => p.mainChampion).filter(c => !spent.has(c)))]).slice(0, 3));
  const banned = new Set(bans.flat());
  const picks = teams.map((team, ti) => team.players.map(player => {
    const preferred = [...new Set([player.mainChampion, ...player.pool])];
    let available = preferred.filter(c => !spent.has(c) && !used.has(c) && !banned.has(c));
    let champion;
    if (available.length) champion = available[0];
    else {
      available = CHAMPIONS[player.position].filter(c => !spent.has(c) && !used.has(c) && !banned.has(c));
      champion = choose(rng, available);
      notes.push(`${player.nickname}: 등록 챔피언이 밴되거나 이전 세트에 사용되어 ${champion || '대체 챔피언'} 선택. 등록 풀 밖 숙련도 보정 적용.`);
    }
    if (!champion) {
      // Extremely large custom drafts can exhaust a role pool. Retain uniqueness globally.
      champion = Object.values(CHAMPIONS).flat().find(c => !spent.has(c) && !used.has(c) && !banned.has(c));
    }
    used.add(champion);
    return { nickname: player.nickname, position: player.position, champion };
  }));
  for (const c of used) spent.add(c);
  return { bansA: bans[0], bansB: bans[1], picksA: picks[0], picksB: picks[1], notes,
    rule: '세트마다 팀별 3밴으로 간소화. 시리즈 전 세트에서 양 팀이 사용한 챔피언 재사용 금지. 등록 풀이 부족하면 포지션별 대체 챔피언과 숙련도 보정 적용. 실제 밴픽 순서·5밴 전체 규칙은 재현하지 않음.' };
}

function simulateSet(teams, number, spent, rng, strategy, stage) {
  const draft = buildDraft(teams, spent, rng);
  const picks = [draft.picksA, draft.picksB];
  const scoreboard = teams.flatMap((team, ti) => team.players.map((p, pi) => ({ nickname: p.nickname, position: p.position, team: team.name, champion: picks[ti][pi].champion, k: 0, d: 0, a: 0 })));
  const rows = [scoreboard.slice(0, 5), scoreboard.slice(5)];
  const events = [];
  const state = { gold: [2500, 2500], kills: [0, 0], towers: [0, 0], dragons: [0, 0], barons: [0, 0] };
  let counter = 0;
  const add = (seconds, type, text, team = null, reactions = [], extra = {}) => {
    const event = { id: `set-${number}-event-${++counter}`, time: formatTime(seconds), type, text, team, reactions, ...extra,
      score: [...state.kills], gold: [...state.gold] };
    events.push(event); return event;
  };
  const strength = (ti, phase) => {
    const team = teams[ti];
    const base = team.players.reduce((sum, p, pi) => sum + individualStrength(p, phase, picks[ti][pi].champion), 0) / 5;
    const selected = typeof strategy === 'string' ? (ti === 0 ? strategy : '') : strategy?.[ti === 0 ? 'teamA' : 'teamB'];
    return base + styleBonus(team.style, phase) + (selected ? styleBonus(String(selected), phase) : 0);
  };
  const contested = (phase, snowball = true) => {
    const difference = strength(0, phase) - strength(1, phase) + (snowball ? (state.gold[0] - state.gold[1]) / 720 : 0);
    return rng() < clamp(1 / (1 + Math.exp(-difference / 15)), .045, .955) ? 0 : 1;
  };
  const roleIndex = position => POSITIONS.indexOf(position);
  const actor = (ti, preferred = []) => {
    if (preferred.length && rng() < .72) return roleIndex(choose(rng, preferred));
    // A carry's mechanics and current champion affect who finishes a kill.
    const weights = teams[ti].players.map(p => Math.max(10, p.stats.mechanics + (p.position === 'SUP' ? -35 : 0)));
    let ticket = rng() * weights.reduce((a, b) => a + b, 0);
    return Math.max(0, weights.findIndex(w => (ticket -= w) <= 0));
  };
  const kill = (ti, killerIndex, victimIndex, location, availableAssists = null) => {
    const killer = rows[ti][killerIndex], victim = rows[1 - ti][victimIndex];
    const candidates = (availableAssists || [0, 1, 2, 3, 4]).filter(i => i !== killerIndex);
    const assistCount = Math.min(candidates.length, 1 + Math.floor(rng() * 3));
    const assists = shuffled(rng, candidates).slice(0, assistCount).map(i => rows[ti][i]);
    killer.k++; victim.d++; assists.forEach(p => p.a++);
    state.kills[ti]++; state.gold[ti] += 300 + assists.length * 50;
    return { killer: killer.nickname, victim: victim.nickname, killerTeam: teams[ti].name, victimTeam: teams[1 - ti].name, assists: assists.map(p => p.nickname), location, champion: killer.champion };
  };
  const killText = (record, prefix = '') => `${prefix}${record.killer}(${record.champion})이 ${record.location}에서 ${record.victim}을 잡았다.`;
  const fight = (seconds, phase, decisive = false) => {
    const winner = contested(phase), loser = 1 - winner;
    const location = choose(rng, ['미드 강가', '바론 둥지 입구', '용 둥지 앞', '미드 2차 포탑 앞']);
    const defeated = shuffled(rng, [0, 1, 2, 3, 4]);
    const winKills = decisive ? 4 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    const records = [];
    for (const victim of defeated.slice(0, winKills)) records.push(kill(winner, actor(winner, ['MID', 'ADC']), victim, location));
    const aliveLosers = [0, 1, 2, 3, 4].filter(i => !defeated.slice(0, winKills).includes(i));
    const lossKills = aliveLosers.length ? Math.floor(rng() * 3) : 0;
    for (const victim of shuffled(rng, [0, 1, 2, 3, 4]).slice(0, lossKills)) records.push(kill(loser, choose(rng, aliveLosers), victim, location, aliveLosers));
    const carry = records[0];
    const previousLeader = state.gold[loser] > state.gold[winner] + 1200;
    add(seconds, decisive ? 'decisive_fight' : 'teamfight',
      `${location}. ${carry.killer}이 먼저 진입 각을 열었다. ${records.map(r => `${r.killer} → ${r.victim}`).join(', ')}. ${teams[winner].name}이 ${winKills}:${lossKills} 교환으로 교전을 가져갔다.${previousLeader ? ' 뒤처지던 골드 차이를 좁힌다.' : ''}`,
      teams[winner].name, [`${carry.killer} 방금 들어가는 거 봄?`, winKills >= 4 ? '???? 저걸 넷이나 넘겼네' : `${winKills}대${lossKills}면 이득이지`, lossKills ? '러브샷은 했는데 후속이 없었다' : '콜 한 번에 다 들어가네'],
      { actors: [...new Set(records.flatMap(r => [r.killer, r.victim]))], kills: records, location, comeback: previousLeader });
    state.towers[winner] += decisive ? 3 : seconds >= 27 * 60 ? 2 : 1;
    state.gold[winner] += 500;
    return winner;
  };

  add(0, 'draft', `${stage || '공식 경기'} ${number}세트. ${teams[0].name}: ${draft.picksA.map(p => `${p.nickname} ${p.champion}`).join(' · ')}. ${teams[1].name}: ${draft.picksB.map(p => `${p.nickname} ${p.champion}`).join(' · ')}.`, null,
    [`${draft.picksA[2].champion} 나온다`, '일단 인게임 보고 말함', '밴픽 끝. 첫 동선 보자']);
  const laneSide = contested('early', false);
  const lane = choose(rng, ['TOP', 'MID', 'ADC']);
  const lanePlayer = teams[laneSide].players[roleIndex(lane)];
  state.gold[laneSide] += 200;
  add(130, 'laning', `${lanePlayer.nickname}이 ${LABELS[lane]} 웨이브를 먼저 밀었다. ${teams[laneSide].name} 정글이 강가 입구까지 움직인다.`, teams[laneSide].name, [], { location: `${LABELS[lane]} 라인` });
  const firstSide = contested('early');
  const firstPosition = choose(rng, ['TOP', 'MID', 'ADC']);
  const firstKiller = actor(firstSide, [firstPosition, 'JGL']);
  const firstVictim = roleIndex(firstPosition);
  const firstTime = 190 + Math.floor(rng() * 80);
  const first = kill(firstSide, firstKiller, firstVictim, `${LABELS[firstPosition]} 강가 입구`, [roleIndex('JGL'), roleIndex(firstPosition), roleIndex('SUP')]);
  add(firstTime, 'first_blood', killText(first, '퍼스트 킬. ') + ` ${first.assists.length ? first.assists.join(', ') + '의 합류가 먼저였다.' : '라인에서 솔로 킬이 나왔다.'}`,
    teams[firstSide].name, [`퍼블은 ${first.killer}`, `${first.victim} 강가에서 잡혔네`, first.assists.length ? '합류가 한 박자 빨랐음' : '솔킬로 시작하네'], { actors: [first.killer, first.victim], kills: [first], location: first.location });
  if (rng() < .40) {
    const defender = firstVictim === 1 ? 4 : 1;
    const trade = kill(1 - firstSide, defender, firstKiller, first.location, [defender]);
    add(firstTime + 7, 'trade_kill', killText(trade, '러브샷. ') + ' 빠져나가던 체력을 끝까지 따라가 정리했다.', teams[1 - firstSide].name,
      ['어 러브샷', `${trade.killer}이 일단 복수는 해줌`, '깔끔하게 빠지진 못했네'], { actors: [trade.killer, trade.victim], kills: [trade], location: trade.location });
  }

  let winner = null;
  let seconds = firstTime;
  for (let minute = 6; minute <= 39; minute += 3) {
    seconds = minute * 60 + Math.floor(rng() * 35);
    const phase = minute < 14 ? 'early' : minute < 26 ? 'middle' : 'late';
    state.gold[0] += 2100; state.gold[1] += 2100;
    let eventWinner;
    if (minute === 6 || minute === 12) {
      const side = contested(phase), victimRole = choose(rng, ['TOP', 'MID', 'ADC']);
      const record = kill(side, actor(side, ['JGL', victimRole]), roleIndex(victimRole), `${LABELS[victimRole]} 1차 포탑 앞`, [roleIndex(victimRole), 1, 4]);
      add(seconds, 'gank', killText(record, `${teams[side].name}의 라인 개입. `) + ' 웨이브가 포탑에 박힌 뒤 두 방향에서 들어왔다.', teams[side].name,
        [`${record.victim} 이 동선은 못 봤다`, `${record.killer} 오늘 발 빠르네`], { actors: [record.killer, record.victim], kills: [record], location: record.location });
      eventWinner = side;
    } else if (minute === 9 || minute === 18 || minute === 30) {
      const side = contested(phase), object = state.dragons[side] === 3 ? '용 영혼' : '드래곤';
      state.dragons[side]++; state.gold[side] += 550;
      add(seconds, 'objective', `${teams[side].players[1].nickname}이 용 둥지 뒤 시야를 지웠다. ${teams[side].name}이 ${object}을 확보했다. 반대쪽은 웨이브를 받느라 늦었다.`, teams[side].name,
        [`용은 ${teams[side].name}`, '강가 와드부터 지우더라'], { objective: object, location: '용 둥지', kills: [] });
      eventWinner = side;
    } else if (minute === 15) {
      const side = contested(phase), other = 1 - side;
      const communication = teams[other].players.reduce((sum, p) => sum + p.stats.communication, 0) / 5;
      const conflict = rng() < clamp((100 - communication) / 100, .1, .6);
      state.gold[side] += 450;
      add(seconds, conflict ? 'call_conflict' : 'vision', conflict
        ? `${teams[other].players[1].nickname}은 전령을, ${teams[other].players[2].nickname}은 미드 압박을 콜했다. 합류가 갈린 사이 ${teams[side].name}이 전령과 강가 시야를 챙겼다.`
        : `${teams[side].players[4].nickname}이 제어 와드를 바꾸며 상대 동선을 확인했다. ${teams[side].name}이 전령을 먼저 시작해 확보했다.`, teams[side].name,
        conflict ? ['지금 콜 갈린 거 같은데', '둘이 다른 데 보고 있음'] : ['서폿 혼자 시야 다 열었네'], { objective: '전령', kills: [] });
      eventWinner = side;
    } else if (minute === 24 || minute === 27) {
      const side = contested(phase);
      const isBaron = minute === 27;
      const object = isBaron ? '바론' : '미드 외곽 포탑';
      state.gold[side] += isBaron ? 1100 : 650;
      if (isBaron) state.barons[side]++; else state.towers[side]++;
      add(seconds, isBaron ? 'baron' : 'side_push', `${teams[side].name}이 사이드 웨이브를 먼저 밀었다. ${teams[side].players[0].nickname}이 상대 두 명을 묶은 사이 ${object}을 가져갔다.`, teams[side].name,
        isBaron ? ['바론 공짜로 주네', '사이드에 둘 가면 이건 먹지'] : ['운영으로 포탑 하나 뜯었다'], { objective: object, kills: [], location: isBaron ? '바론 둥지' : '미드 라인' });
      eventWinner = side;
    } else {
      eventWinner = fight(seconds, phase, minute >= 36);
    }
    const other = 1 - eventWinner;
    const ahead = state.gold[eventWinner] - state.gold[other];
    if (minute >= 27 && ((state.towers[eventWinner] >= 4 && ahead > 2000) || (state.towers[eventWinner] >= 2 && ahead > 7000) || (minute >= 36 && ['teamfight', 'decisive_fight'].includes(events.at(-1).type)))) {
      winner = eventWinner;
      break;
    }
  }
  if (winner === null) {
    seconds += 120;
    winner = fight(seconds, 'late', true);
  }
  seconds += 48;
  state.towers[winner] = Math.max(state.towers[winner], 6);
  add(seconds, 'nexus', `${teams[winner].name}이 남은 인원과 미드로 진입했다. 억제기와 쌍둥이 포탑이 무너졌다. 넥서스 파괴. ${teams[winner].name}이 ${number}세트를 가져간다.`, teams[winner].name,
    [`${teams[winner].name} 마무리`, '끝날 때는 진짜 한 번에 끝나네', `${number}세트는 이렇게 종료`], { kills: [], location: '상대 넥서스' });
  const mvp = [...rows[winner]].sort((a, b) => (b.k * 2 + b.a - b.d) - (a.k * 2 + a.a - a.d))[0];
  return { number, winner: teams[winner].name, duration: formatTime(seconds), killsA: state.kills[0], killsB: state.kills[1], events, draft, scoreboard,
    goldA: state.gold[0], goldB: state.gold[1], objectives: { towers: [...state.towers], dragons: [...state.dragons], barons: [...state.barons] }, mvp: mvp.nickname };
}

export function simulateSeries({ teamA, teamB, bestOf = 3, seed = 'LCK', stage = '', strategy = '' } = {}) {
  if (![1, 3, 5].includes(bestOf)) throw new RangeError('bestOf는 1, 3, 5 중 하나여야 합니다.');
  const teams = [normalizeTeam(teamA, 0), normalizeTeam(teamB, 1)];
  if (teams[0].name === teams[1].name) throw new Error('서로 다른 두 팀이 필요합니다.');
  const rng = seededRandom(seed);
  const spent = new Set();
  const sets = [];
  let scoreA = 0, scoreB = 0;
  const target = Math.ceil(bestOf / 2);
  while (scoreA < target && scoreB < target) {
    const set = simulateSet(teams, sets.length + 1, spent, rng, strategy, stage);
    sets.push(set);
    if (set.winner === teams[0].name) scoreA++; else scoreB++;
  }
  const winner = scoreA > scoreB ? teams[0].name : teams[1].name;
  const finalSet = sets.at(-1);
  const recap = [
    `${stage || '시리즈'} 종료. ${teams[0].name} ${scoreA}:${scoreB} ${teams[1].name}. 승리 팀은 ${winner}.`,
    `${finalSet.number}세트 ${finalSet.mvp}이 교전의 마무리를 맡았다. 최종 킬 스코어 ${finalSet.killsA}:${finalSet.killsB}.`,
    ...sets.map(set => {
      const blood = set.events.find(e => e.type === 'first_blood').kills[0];
      return `${set.number}세트 복기: ${blood.location}에서 ${blood.killer}의 퍼스트 킬. ${set.winner}이 ${set.duration}에 넥서스를 파괴했다.`;
    }),
  ];
  return { winner, scoreA, scoreB, bestOf, sets, recap, seed: String(seed), stage,
    simulationNote: '사건별 능력·컨디션·팀 성향·골드 차이로 판정하며, 누적 교전과 오브젝트 이후 넥서스 파괴로 승패가 결정됩니다. 가상 중계와 가상 커뮤니티입니다.' };
}
